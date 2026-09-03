/**
 * demo.js — Demo Mode with Realistic Simulated Data
 * Generates realistic I²C scan results for testing without hardware
 */
const DemoMode = (() => {
  const DEMO_DEVICES = [
    { addr: 0x27, name: 'PCF8574A (LCD)', stability: 100, nack: 0, timeout: 0 },
    { addr: 0x3C, name: 'SSD1306 (OLED)', stability: 100, nack: 0, timeout: 0 },
    { addr: 0x68, name: 'DS3231 (RTC)', stability: 100, nack: 0, timeout: 0 },
    { addr: 0x50, name: 'AT24C32 (EEPROM)', stability: 72, nack: 18, timeout: 10 },
    { addr: 0x76, name: 'BME280 (Sensor)', stability: 96, nack: 4, timeout: 0 }
  ];

  let onLogCallback = null;

  function setLogCallback(cb) {
    onLogCallback = cb;
  }

  function log(message, level = 'info') {
    if (onLogCallback) onLogCallback(message, level);
  }

  /**
   * Simulate a bus scan
   */
  function simulateScan() {
    const devices = [];
    DEMO_DEVICES.forEach(d => {
      // Simulate occasional disappearance for unstable devices
      const stableChance = d.stability / 100;
      if (Math.random() < stableChance) {
        devices.push(d.addr);
      }
    });
    return {
      success: true,
      devices: devices.sort((a, b) => a - b),
      timestamp: Date.now()
    };
  }

  /**
   * Run simulated stability test
   */
  function simulateStabilityTest(iterations, onProgress) {
    return new Promise((resolve) => {
      const stats = {};
      DEMO_DEVICES.forEach(d => {
        stats[d.addr] = {
          address: d.addr,
          responses: 0,
          errors: 0,
          nack: 0,
          timeout: 0,
          disappearances: 0,
          firstSeen: null,
          lastSeen: null,
          name: d.name
        };
      });

      let prev = new Set();

      let i = 0;
      const interval = setInterval(() => {
        if (i >= iterations) {
          clearInterval(interval);
          const results = {};
          Object.values(stats).forEach(device => {
            const stability = iterations > 0 ? (device.responses / iterations * 100) : 0;
            const roundedStability = Math.round(stability * 100) / 100;
            let status;
            if (roundedStability >= 95 && device.errors === 0) status = 'stable';
            else if (roundedStability >= 70) status = 'suspicious';
            else status = 'danger';

            results[device.address] = {
              ...device,
              stability: roundedStability,
              status,
              statusLabel: status === 'stable' ? '🟢 ESTABLE' : status === 'suspicious' ? '🟡 SOSPECHOSO' : '🔴 POSIBLE FALLA',
              commonDevice: device.name
            };
          });

          resolve({
            results,
            summary: generateDemoSummary(results, iterations),
            iterations,
            timestamp: Date.now()
          });
          return;
        }

        // Simulate scan
        const currentPresent = new Set();
        DEMO_DEVICES.forEach(d => {
          const stableChance = d.stability / 100;
          // Add some randomness for unstable devices
          const adjustedChance = d.stability < 100 ? stableChance : 0.995;
          if (Math.random() < adjustedChance) {
            currentPresent.add(d.addr);
            stats[d.addr].responses++;
            stats[d.addr].lastSeen = Date.now();
            if (!stats[d.addr].firstSeen) stats[d.addr].firstSeen = Date.now();
          } else {
            stats[d.addr].errors++;
            // Simulate NACK vs timeout
            if (Math.random() < 0.6) stats[d.addr].nack++;
            else stats[d.addr].timeout++;
          }
        });

        // Track disappearances
        Object.keys(stats).forEach(addr => {
          const a = parseInt(addr);
          if (prev.has(a) && !currentPresent.has(a)) {
            stats[a].disappearances++;
          }
        });
        prev = currentPresent;

        i++;
        if (onProgress) onProgress(i, iterations, stats);
      }, 30 + Math.random() * 50);
    });
  }

  function generateDemoSummary(results, iterations) {
    const devices = Object.values(results);
    const total = devices.length;
    const stable = devices.filter(d => d.status === 'stable').length;
    const suspicious = devices.filter(d => d.status === 'suspicious').length;
    const danger = devices.filter(d => d.status === 'danger').length;

    let explanation = '';
    if (danger > 0) {
      explanation = `Se detectaron ${danger} dispositivo(s) con comportamiento inestable. ` +
        `Esto puede indicar conexiones defectuosas (soldadura fría), problemas en el cableado ` +
        `o dispositivos dañados. Se recomienda verificar físicamente las conexiones.`;
    } else if (suspicious > 0) {
      explanation = `Se detectaron ${suspicious} dispositivo(s) con comportamiento ligeramente inestable. ` +
        `Puede tratarse de interferencia o ruido eléctrico.`;
    } else {
      explanation = `Todos los ${total} dispositivo(s) respondieron de forma estable.`;
    }

    return { total, stable, suspicious, danger, explanation, hasColdSolderSymptoms: danger > 0 || suspicious > 0 };
  }

  return {
    simulateScan,
    simulateStabilityTest,
    setLogCallback,
    DEMO_DEVICES
  };
})();
