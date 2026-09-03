/**
 * diagnostics.js — Stability Tests and Cold Solder Detection
 * Analyzes I²C device responses for intermittent behavior
 */
const Diagnostics = (() => {
  const THRESHOLD_STABLE = 95;
  const THRESHOLD_SUSPICIOUS = 70;
  let onLogCallback = null;

  function setLogCallback(cb) {
    onLogCallback = cb;
  }

  function log(message, level = 'info') {
    if (onLogCallback) onLogCallback(message, level);
  }

  /**
   * Run stability test on detected devices
   * @param {number[]} addresses - Array of I²C addresses
   * @param {number} iterations - Number of scan iterations
   * @param {function} onProgress - Progress callback
   * @returns {Object} Stability results
   */
  async function runStabilityTest(addresses, iterations, onProgress) {
    log(`Iniciando prueba de estabilidad: ${iterations} iteraciones, ${addresses.length} dispositivos`, 'info');

    const deviceStats = {};
    addresses.forEach(addr => {
      deviceStats[addr] = {
        address: addr,
        responses: 0,
        errors: 0,
        nack: 0,
        timeout: 0,
        disappearances: 0,
        firstSeen: null,
        lastSeen: null,
        history: []
      };
    });

    let previousPresent = new Set();

    for (let i = 0; i < iterations; i++) {
      // Use I2CScanner to do a scan
      const scanResult = await I2CScanner.fullScan();
      const currentPresent = new Set(scanResult.devices);

      addresses.forEach(addr => {
        const device = deviceStats[addr];
        if (currentPresent.has(addr)) {
          device.responses++;
          device.lastSeen = Date.now();
          if (!device.firstSeen) device.firstSeen = Date.now();
        } else {
          device.errors++;
          if (previousPresent.has(addr)) {
            device.disappearances++;
            log(`Dispositivo ${I2CScanner.formatAddress(addr)} desapareció en iteración ${i + 1}`, 'warning');
          }
        }
      });

      previousPresent = currentPresent;

      if (onProgress) {
        onProgress(i + 1, iterations, deviceStats);
      }

      // Delay between scans
      await new Promise(r => setTimeout(r, 150));
    }

    // Calculate final statistics
    const results = {};
    Object.values(deviceStats).forEach(device => {
      const stability = iterations > 0 ? (device.responses / iterations * 100) : 0;
      const status = getStatus(stability, device);

      results[device.address] = {
        ...device,
        stability: Math.round(stability * 100) / 100,
        status,
        statusLabel: getStatusLabel(status),
        commonDevice: I2CScanner.getCommonDevice(device.address)
      };

      log(
        `${I2CScanner.formatAddress(device.address)} — ${getStatusLabel(status)} ` +
        `(${device.responses}/${iterations} respuestas, estabilidad: ${results[device.address].stability}%)`,
        status === 'stable' ? 'success' : status === 'suspicious' ? 'warning' : 'error'
      );
    });

    return {
      results,
      summary: generateSummary(results, iterations),
      iterations,
      timestamp: Date.now()
    };
  }

  /**
   * Determine device status based on stability and errors
   */
  function getStatus(stability, device) {
    if (stability >= THRESHOLD_STABLE && device.errors === 0 && device.disappearances === 0) {
      return 'stable';
    }
    if (stability >= THRESHOLD_SUSPICIOUS) {
      return 'suspicious';
    }
    return 'danger';
  }

  function getStatusLabel(status) {
    switch (status) {
      case 'stable': return 'ESTABLE';
      case 'suspicious': return 'SOSPECHOSO';
      case 'danger': return 'POSIBLE FALLA';
      default: return 'DESCONOCIDO';
    }
  }

  function getStatusBadgeClass(status) {
    switch (status) {
      case 'stable': return 'badge-stable';
      case 'suspicious': return 'badge-suspicious';
      case 'danger': return 'badge-danger';
      default: return 'badge-ok';
    }
  }

  /**
   * Generate summary from results
   */
  function generateSummary(results, iterations) {
    const devices = Object.values(results);
    const total = devices.length;
    const stable = devices.filter(d => d.status === 'stable').length;
    const suspicious = devices.filter(d => d.status === 'suspicious').length;
    const danger = devices.filter(d => d.status === 'danger').length;

    let explanation = '';
    if (total === 0) {
      explanation = 'No se encontraron dispositivos en el bus I²C durante la prueba.';
    } else if (danger > 0) {
      explanation = `Se detectaron ${danger} dispositivo(s) con comportamiento inestable. ` +
        `Esto puede indicar conexiones defectuosas (soldadura fría), problemas en el cableado, ` +
        `conflicto de direcciones o dispositivos dañados. Se recomienda verificar físicamente las conexiones.`;
    } else if (suspicious > 0) {
      explanation = `Se detectaron ${suspicious} dispositivo(s) con comportamiento ligeramente inestable. ` +
        `Puede tratarse de interferencia, ruido eléctrico o inicio de una conexión defectuosa. ` +
        `Se recomienda monitorear.`;
    } else {
      explanation = `Todos los ${total} dispositivo(s) respondieron de forma estable. ` +
        `No se detectaron síntomas de conexiones defectuosas.`;
    }

    return {
      total,
      stable,
      suspicious,
      danger,
      explanation,
      hasColdSolderSymptoms: danger > 0 || suspicious > 0
    };
  }

  /**
   * Analyze a single scan result for quick diagnosis
   */
  function quickDiagnose(scanResult, previousScan) {
    if (!previousScan) return null;

    const newDevices = scanResult.devices.filter(d => !previousScan.includes(d));
    const disappeared = previousScan.filter(d => !scanResult.devices.includes(d));

    return {
      newDevices,
      disappeared,
      hasChanges: newDevices.length > 0 || disappeared.length > 0
    };
  }

  return {
    runStabilityTest,
    quickDiagnose,
    getStatus,
    getStatusLabel,
    getStatusBadgeClass,
    generateSummary,
    setLogCallback,
    THRESHOLD_STABLE,
    THRESHOLD_SUSPICIOUS
  };
})();
