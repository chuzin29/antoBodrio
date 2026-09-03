/**
 * app.js — Main Application Orchestrator
 * Connects all modules, manages state, handles UI
 */
const App = (() => {
  let isDemo = false;
  let isHardwareConnected = false;
  let detectedDevices = [];
  let lastScanResult = null;
  let stabilityResults = null;
  let eventLog = [];

  // Initialize
  function init() {
    renderI2CGrid();
    setupListeners();
    logEvent('Aplicación iniciada. Conecta un dispositivo o activa el Modo Demo.', 'info');
  }

  function setupListeners() {
    window.addEventListener('serial-data', (e) => {
      handleSerialData(e.detail);
    });
  }

  function handleSerialData(data) {
    logEvent(`RX: ${data.trim()}`, 'info');
  }

  // ==================== UI UPDATES ====================

  function renderI2CGrid() {
    const grid = document.getElementById('i2cGrid');
    grid.innerHTML = '';
    for (let i = 0; i <= 0x7F; i++) {
      const cell = document.createElement('div');
      cell.className = 'i2c-cell';
      cell.id = `cell-${i}`;
      cell.textContent = '0x' + i.toString(16).toUpperCase().padStart(2, '0');
      cell.title = `0x${i.toString(16).toUpperCase().padStart(2, '0')}`;
      grid.appendChild(cell);
    }
  }

  function highlightGridCell(addr, found) {
    const cell = document.getElementById(`cell-${addr}`);
    if (!cell) return;
    cell.className = found ? 'i2c-cell found' : 'i2c-cell';
  }

  function resetGrid() {
    for (let i = 0; i <= 0x7F; i++) {
      const cell = document.getElementById(`cell-${i}`);
      if (cell) cell.className = 'i2c-cell';
    }
  }

  function updateConnectionStatus(connected, info = {}) {
    const dots = {
      dotHardware: connected ? 'active' : '',
      dotPort: connected ? 'active' : '',
      dotBridge: connected ? 'active' : '',
      dotSpeed: connected ? 'active' : '',
      dotBus: connected ? 'active' : ''
    };

    Object.entries(dots).forEach(([id, cls]) => {
      const el = document.getElementById(id);
      if (el) el.className = 'status-dot ' + cls;
    });

    document.getElementById('statusHardware').textContent = connected ? 'Conectado' : 'No conectado';
    document.getElementById('statusPort').textContent = info.deviceName || '—';
    document.getElementById('statusBridge').textContent = connected ? 'Activo' : 'Inactivo';
    document.getElementById('statusSpeed').textContent = connected ? '100 kHz' : '—';
    document.getElementById('statusBus').textContent = connected ? 'Operativo' : 'Inactivo';

    document.getElementById('btnConnect').disabled = connected;
    document.getElementById('btnScan').disabled = !connected && !isDemo;
    document.getElementById('btnStability').disabled = (!connected && !isDemo) || detectedDevices.length === 0;

    document.getElementById('masterDevice').textContent = info.deviceName || (isDemo ? 'Simulado (Demo)' : 'No conectado');
  }

  function setModeBanner(type) {
    const banner = document.getElementById('modeBanner');
    if (type === 'demo') {
      banner.className = 'mode-banner demo-banner';
      banner.textContent = '⚠️ MODO DEMO — DATOS SIMULADOS';
      banner.style.display = 'block';
    } else if (type === 'real') {
      banner.className = 'mode-banner real-banner';
      banner.textContent = '🔌 HARDWARE REAL';
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  }

  function updateScanResult(count) {
    const el = document.getElementById('scanResult');
    el.textContent = count > 0 ? `${count} dispositivo(s) encontrado(s)` : 'No se encontraron dispositivos';
  }

  function updateDevicesTable(devices) {
    const tbody = document.getElementById('devicesBody');
    if (devices.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No hay dispositivos detectados</td></tr>';
      return;
    }

    tbody.innerHTML = devices.map(d => {
      const name = I2CScanner.getCommonDevice(d.address) || 'Desconocido';
      const badgeClass = Diagnostics.getStatusBadgeClass(d.status || 'stable');
      const statusLabel = d.statusLabel || (d.status === 'stable' ? '🟢 OK' : d.status === 'suspicious' ? '🟡 SOSPECHOSO' : '🔴 FALLA');
      return `
        <tr>
          <td><strong>${I2CScanner.formatAddress(d.address)}</strong> <small style="color:var(--text-muted)">${name}</small></td>
          <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
          <td>${d.responses || '—'}</td>
          <td>${d.errors || '0'}</td>
          <td>${d.nack || '0'}</td>
          <td>${d.timeout || '0'}</td>
          <td><strong>${d.stability !== undefined ? d.stability + '%' : '—'}</strong></td>
          <td>${d.status === 'stable' ? 'OK' : d.status === 'suspicious' ? 'Revisar' : 'Falla'}</td>
        </tr>
      `;
    }).join('');
  }

  function updateSlaveList(devices) {
    const el = document.getElementById('slaveList');
    if (devices.length === 0) {
      el.innerHTML = '<p class="empty-text">No hay dispositivos detectados.</p>';
      return;
    }
    el.innerHTML = devices.map(d => {
      const addr = typeof d === 'number' ? d : d.address;
      const name = I2CScanner.getCommonDevice(addr) || '';
      return `
        <div class="slave-item">
          <span class="slave-addr">${I2CScanner.formatAddress(addr)}</span>
          <span>${name || 'TARGET'}</span>
        </div>
      `;
    }).join('');
  }

  function updateStabilityResults(results) {
    const container = document.getElementById('stabilityResults');
    if (!results || !results.results) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = Object.values(results.results).map(d => {
      const badgeClass = Diagnostics.getStatusBadgeClass(d.status);
      return `
        <div class="stability-device">
          <div class="stability-device-header">
            <span class="stability-device-addr">${I2CScanner.formatAddress(d.address)}</span>
            <span class="badge ${badgeClass}">${d.statusLabel}</span>
          </div>
          <div class="stability-stats">
            <div class="stability-stat"><span class="stability-stat-label">Pruebas:</span><span class="stability-stat-value">${results.iterations}</span></div>
            <div class="stability-stat"><span class="stability-stat-label">Respuestas:</span><span class="stability-stat-value">${d.responses}</span></div>
            <div class="stability-stat"><span class="stability-stat-label">Errores:</span><span class="stability-stat-value">${d.errors}</span></div>
            <div class="stability-stat"><span class="stability-stat-label">NACK:</span><span class="stability-stat-value">${d.nack}</span></div>
            <div class="stability-stat"><span class="stability-stat-label">Timeout:</span><span class="stability-stat-value">${d.timeout}</span></div>
            <div class="stability-stat"><span class="stability-stat-label">Desapariciones:</span><span class="stability-stat-value">${d.disappearances}</span></div>
            <div class="stability-stat"><span class="stability-stat-label">Estabilidad:</span><span class="stability-stat-value">${d.stability}%</span></div>
            <div class="stability-stat"><span class="stability-stat-label">Dispositivo:</span><span class="stability-stat-value">${d.commonDevice || 'N/A'}</span></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function updateDiagnosis(results) {
    const container = document.getElementById('diagnosisResults');
    const warningBox = document.getElementById('warningBox');

    if (!results || !results.results) {
      container.innerHTML = '<p class="empty-text">Ejecuta una prueba de estabilidad para ver el diagnóstico.</p>';
      warningBox.style.display = 'none';
      return;
    }

    container.innerHTML = Object.values(results.results).map(d => {
      return `
        <div class="diagnosis-item ${d.status}">
          <div class="diagnosis-header">
            <span class="diagnosis-addr">${I2CScanner.formatAddress(d.address)} — ${d.statusLabel}</span>
          </div>
          <div class="diagnosis-detail">
            ${d.responses}/${results.iterations} respuestas correctas | Errores: ${d.errors} | NACK: ${d.nack} | Timeout: ${d.timeout}
          </div>
        </div>
      `;
    }).join('');

    if (results.summary.hasColdSolderSymptoms) {
      warningBox.style.display = 'flex';
    } else {
      warningBox.style.display = 'none';
    }
  }

  function updateFinalResults(summary) {
    document.getElementById('finalTotal').textContent = summary.total;
    document.getElementById('finalStable').textContent = summary.stable;
    document.getElementById('finalSuspicious').textContent = summary.suspicious;
    document.getElementById('finalDanger').textContent = summary.danger;
    document.getElementById('finalExplanation').textContent = summary.explanation;
  }

  function updateProgress(current, total) {
    const pct = Math.round((current / total) * 100);
    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('progressText').textContent = pct + '%';
  }

  // ==================== ACTIONS ====================

  async function connectHardware() {
    logEvent('Solicitando conexión a hardware...', 'info');
    const result = await SerialManager.connect();

    if (result.success) {
      isHardwareConnected = true;
      isDemo = false;
      updateConnectionStatus(true, { deviceName: result.deviceName });
      setModeBanner('real');
      document.getElementById('btnScan').disabled = false;
      logEvent(`Hardware conectado: ${result.deviceName}`, 'success');
    } else {
      logEvent(`Error de conexión: ${result.error}`, 'error');
      alert('No se pudo conectar al hardware.\n\n' + result.error + '\n\n¿Deseas usar el Modo Demo?');
    }
  }

  async function startDemo() {
    isDemo = true;
    isHardwareConnected = false;
    detectedDevices = [];

    setModeBanner('demo');
    updateConnectionStatus(true, { deviceName: 'Simulado (Demo)' });
    document.getElementById('btnScan').disabled = false;
    document.getElementById('btnDemo').style.display = 'none';
    document.getElementById('btnStopDemo').style.display = 'inline-flex';

    logEvent('Modo Demo activado — Datos simulados', 'warning');
    logEvent('Simulando bus I²C con 5 dispositivos...', 'info');

    // Simulate initial scan
    const result = DemoMode.simulateScan();
    detectedDevices = result.devices;
    lastScanResult = result;

    resetGrid();
    result.devices.forEach(addr => highlightGridCell(addr, true));

    updateScanResult(result.devices.length);
    updateSlaveList(result.devices);

    const deviceList = result.devices.map(addr => ({
      address: addr,
      responses: '—',
      errors: '—',
      nack: '—',
      timeout: '—',
      stability: '—',
      status: 'stable',
      statusLabel: '🟢 OK'
    }));
    updateDevicesTable(deviceList);

    document.getElementById('btnStability').disabled = false;
    logEvent(`Escaneo completado: ${result.devices.length} dispositivos encontrados`, 'success');
  }

  function stopDemo() {
    isDemo = false;
    detectedDevices = [];
    lastScanResult = null;
    stabilityResults = null;

    setModeBanner('none');
    updateConnectionStatus(false);
    resetGrid();
    updateScanResult(0);
    updateDevicesTable([]);
    updateSlaveList([]);
    updateStabilityResults(null);
    updateDiagnosis(null);
    updateFinalResults({ total: 0, stable: 0, suspicious: 0, danger: 0, explanation: '' });

    document.getElementById('btnDemo').style.display = 'inline-flex';
    document.getElementById('btnStopDemo').style.display = 'none';
    document.getElementById('btnScan').disabled = true;
    document.getElementById('btnStability').disabled = true;
    document.getElementById('progressContainer').style.display = 'none';

    logEvent('Modo Demo desactivado', 'info');
  }

  async function scanBus() {
    resetGrid();
    detectedDevices = [];

    logEvent('Escaneo del bus I²C iniciado...', 'info');

    let result;
    if (isDemo) {
      result = DemoMode.simulateScan();
    } else {
      result = await I2CScanner.scanBus();
    }

    if (!result.success) {
      logEvent('Error en el escaneo: ' + (result.error || 'Sin respuesta'), 'error');
      return;
    }

    lastScanResult = result;
    detectedDevices = result.devices;

    result.devices.forEach(addr => highlightGridCell(addr, true));
    updateScanResult(result.devices.length);
    updateSlaveList(result.devices);

    const deviceList = result.devices.map(addr => ({
      address: addr,
      responses: '—',
      errors: '—',
      nack: '—',
      timeout: '—',
      stability: '—',
      status: 'stable',
      statusLabel: '🟢 OK'
    }));
    updateDevicesTable(deviceList);

    document.getElementById('btnStability').disabled = detectedDevices.length === 0;
    logEvent(`Escaneo completado: ${result.devices.length} dispositivo(s) encontrado(s)`, 'success');
  }

  async function startStabilityTest() {
    if (detectedDevices.length === 0) {
      alert('No hay dispositivos detectados. Ejecuta un escaneo primero.');
      return;
    }

    const radio = document.querySelector('input[name="testCount"]:checked');
    const iterations = parseInt(radio.value);

    document.getElementById('progressContainer').style.display = 'flex';
    document.getElementById('btnStability').disabled = true;
    document.getElementById('btnScan').disabled = true;
    updateProgress(0, iterations);

    logEvent(`Prueba de estabilidad iniciada: ${iterations} iteraciones`, 'info');

    let results;
    if (isDemo) {
      results = await DemoMode.simulateStabilityTest(iterations, (current, total) => {
        updateProgress(current, total);
      });
    } else {
      results = await Diagnostics.runStabilityTest(detectedDevices, iterations, (current, total) => {
        updateProgress(current, total);
      });
    }

    stabilityResults = results;
    updateProgress(iterations, iterations);

    // Update all UI sections
    updateDevicesTable(Object.values(results.results));
    updateStabilityResults(results);
    updateDiagnosis(results);
    updateFinalResults(results.summary);

    document.getElementById('btnStability').disabled = false;
    document.getElementById('btnScan').disabled = false;

    logEvent('Prueba de estabilidad completada', 'success');
    logEvent(`Resultado: ${results.summary.total} dispositivos, ${results.summary.stable} estables, ${results.summary.suspicious} sospechosos, ${results.summary.danger} con posible falla`, 'info');
  }

  // ==================== LOG ====================

  function logEvent(message, level = 'info') {
    const now = new Date();
    const time = now.toTimeString().split(' ')[0];
    const entry = { time, message, level };
    eventLog.push(entry);

    const console = document.getElementById('logConsole');
    const span = document.createElement('span');
    span.className = 'log-entry';
    span.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-${level}">${message}</span>`;
    console.appendChild(span);
    console.scrollTop = console.scrollHeight;
  }

  function clearLog() {
    eventLog = [];
    document.getElementById('logConsole').innerHTML = '';
    logEvent('Registro limpiado', 'info');
  }

  function exportLog() {
    const text = eventLog.map(e => `[${e.time}] ${e.message}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      logEvent('Log copiado al portapapeles', 'success');
    });
  }

  // ==================== EXPORT ====================

  function exportJSON() {
    const data = {
      tool: 'Antony el tonto XD — I²C Diagnostic Tool',
      exportDate: new Date().toISOString(),
      mode: isDemo ? 'demo' : 'real',
      devices: detectedDevices.map(addr => ({
        address: I2CScanner.formatAddress(addr),
        addressDecimal: addr,
        name: I2CScanner.getCommonDevice(addr) || 'Unknown'
      })),
      stabilityResults: stabilityResults ? stabilityResults.results : null,
      summary: stabilityResults ? stabilityResults.summary : null,
      eventLog: eventLog.map(e => `[${e.time}] ${e.message}`)
    };

    downloadFile(
      JSON.stringify(data, null, 2),
      `i2c-diagnostic-${Date.now()}.json`,
      'application/json'
    );
    logEvent('Reporte JSON exportado', 'success');
  }

  function exportCSV() {
    if (!stabilityResults) {
      alert('Primero ejecuta una prueba de estabilidad para generar datos de exportación.');
      return;
    }

    let csv = 'Direccion,Nombre,Pruebas,Respuestas,Errores,NACK,Timeout,Desapariciones,Estabilidad,Estado\n';
    Object.values(stabilityResults.results).forEach(d => {
      csv += `${I2CScanner.formatAddress(d.address)},${d.commonDevice || 'Unknown'},${stabilityResults.iterations},${d.responses},${d.errors},${d.nack},${d.timeout},${d.disappearances},${d.stability}%,"${d.statusLabel}"\n`;
    });

    downloadFile(csv, `i2c-diagnostic-${Date.now()}.csv`, 'text/csv');
    logEvent('Reporte CSV exportado', 'success');
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ==================== SERIAL LISTENERS ====================

  SerialManager.setLogCallback((msg, level) => {
    logEvent(msg, level);
  });

  I2CScanner.setLogCallback((msg, level) => {
    logEvent(msg, level);
  });

  Diagnostics.setLogCallback((msg, level) => {
    logEvent(msg, level);
  });

  DemoMode.setLogCallback((msg, level) => {
    logEvent(msg, level);
  });

  // Init on DOM ready
  document.addEventListener('DOMContentLoaded', init);

  return {
    connectHardware,
    startDemo,
    stopDemo,
    scanBus,
    startStabilityTest,
    clearLog,
    exportLog,
    exportJSON,
    exportCSV
  };
})();
