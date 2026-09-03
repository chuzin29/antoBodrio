/**
 * app.js — Main Application Orchestrator
 */
const App = (function() {
  var isDemo = false;
  var isHardwareConnected = false;
  var detectedDevices = [];
  var lastScanResult = null;
  var stabilityResults = null;
  var eventLog = [];

  function init() {
    renderI2CGrid();
    setupListeners();
    logEvent('Aplicacion iniciada. Conecta un dispositivo o activa el Modo Demo.', 'info');
  }

  function setupListeners() {
    window.addEventListener('serial-data', function(e) {
      logEvent('RX: ' + e.detail.trim(), 'info');
    });
  }

  // ==================== UI UPDATES ====================

  function renderI2CGrid() {
    var grid = document.getElementById('i2cGrid');
    grid.innerHTML = '';
    for (var i = 0; i <= 0x7F; i++) {
      var cell = document.createElement('div');
      cell.className = 'i2c-cell';
      cell.id = 'cell-' + i;
      cell.textContent = '0x' + i.toString(16).toUpperCase().padStart(2, '0');
      grid.appendChild(cell);
    }
  }

  function highlightGridCell(addr, found) {
    var cell = document.getElementById('cell-' + addr);
    if (!cell) return;
    cell.className = found ? 'i2c-cell found' : 'i2c-cell';
  }

  function resetGrid() {
    for (var i = 0; i <= 0x7F; i++) {
      var cell = document.getElementById('cell-' + i);
      if (cell) cell.className = 'i2c-cell';
    }
  }

  function updateConnectionStatus(connected, info) {
    info = info || {};
    var ids = ['dotHardware', 'dotPort', 'dotBridge', 'dotSpeed', 'dotBus'];
    ids.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.className = 'status-dot ' + (connected ? 'active' : '');
    });

    document.getElementById('statusHardware').textContent = connected ? 'Conectado' : 'No conectado';
    document.getElementById('statusPort').textContent = info.deviceName || '--';
    document.getElementById('statusBridge').textContent = connected ? 'Activo' : 'Inactivo';
    document.getElementById('statusSpeed').textContent = connected ? '100 kHz' : '--';
    document.getElementById('statusBus').textContent = connected ? 'Operativo' : 'Inactivo';

    document.getElementById('btnConnect').disabled = connected;
    document.getElementById('btnScan').disabled = !connected && !isDemo;
    document.getElementById('btnStability').disabled = (!connected && !isDemo) || detectedDevices.length === 0;
    document.getElementById('masterDevice').textContent = info.deviceName || (isDemo ? 'Simulado (Demo)' : 'No conectado');
  }

  function setModeBanner(type) {
    var banner = document.getElementById('modeBanner');
    if (type === 'demo') {
      banner.className = 'mode-banner demo-banner';
      banner.textContent = 'MODO DEMO - DATOS SIMULADOS';
      banner.style.display = 'block';
    } else if (type === 'real') {
      banner.className = 'mode-banner real-banner';
      banner.textContent = 'HARDWARE REAL';
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }
  }

  function updateScanResult(count) {
    document.getElementById('scanResult').textContent = count > 0 ? count + ' dispositivo(s) encontrado(s)' : 'No se encontraron dispositivos';
  }

  function updateDevicesTable(devices) {
    var tbody = document.getElementById('devicesBody');
    if (!devices || devices.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No hay dispositivos detectados</td></tr>';
      return;
    }
    tbody.innerHTML = devices.map(function(d) {
      var name = I2CScanner.getCommonDevice(d.address) || d.commonDevice || 'Desconocido';
      var badgeClass = Diagnostics.getStatusBadgeClass(d.status || 'stable');
      var statusLabel = d.statusLabel || 'OK';
      return '<tr>' +
        '<td><strong>' + I2CScanner.formatAddress(d.address) + '</strong> <small style="color:var(--text-muted)">' + name + '</small></td>' +
        '<td><span class="badge ' + badgeClass + '">' + statusLabel + '</span></td>' +
        '<td>' + (d.responses || '--') + '</td>' +
        '<td>' + (d.errors || '0') + '</td>' +
        '<td>' + (d.nack || '0') + '</td>' +
        '<td>' + (d.timeout || '0') + '</td>' +
        '<td><strong>' + (d.stability !== undefined ? d.stability + '%' : '--') + '</strong></td>' +
        '<td>' + (d.status === 'stable' ? 'OK' : d.status === 'suspicious' ? 'Revisar' : 'Falla') + '</td>' +
        '</tr>';
    }).join('');
  }

  function updateSlaveList(devices) {
    var el = document.getElementById('slaveList');
    if (!devices || devices.length === 0) {
      el.innerHTML = '<p class="empty-text">No hay dispositivos detectados.</p>';
      return;
    }
    el.innerHTML = devices.map(function(d) {
      var addr = typeof d === 'number' ? d : d.address;
      var name = I2CScanner.getCommonDevice(addr) || '';
      return '<div class="slave-item"><span class="slave-addr">' + I2CScanner.formatAddress(addr) + '</span><span>' + (name || 'TARGET') + '</span></div>';
    }).join('');
  }

  function updateStabilityResults(results) {
    var container = document.getElementById('stabilityResults');
    if (!results || !results.results) { container.innerHTML = ''; return; }
    container.innerHTML = Object.values(results.results).map(function(d) {
      var badgeClass = Diagnostics.getStatusBadgeClass(d.status);
      return '<div class="stability-device">' +
        '<div class="stability-device-header"><span class="stability-device-addr">' + I2CScanner.formatAddress(d.address) + '</span><span class="badge ' + badgeClass + '">' + d.statusLabel + '</span></div>' +
        '<div class="stability-stats">' +
        '<div class="stability-stat"><span class="stability-stat-label">Pruebas:</span><span class="stability-stat-value">' + results.iterations + '</span></div>' +
        '<div class="stability-stat"><span class="stability-stat-label">Respuestas:</span><span class="stability-stat-value">' + d.responses + '</span></div>' +
        '<div class="stability-stat"><span class="stability-stat-label">Errores:</span><span class="stability-stat-value">' + d.errors + '</span></div>' +
        '<div class="stability-stat"><span class="stability-stat-label">NACK:</span><span class="stability-stat-value">' + d.nack + '</span></div>' +
        '<div class="stability-stat"><span class="stability-stat-label">Timeout:</span><span class="stability-stat-value">' + d.timeout + '</span></div>' +
        '<div class="stability-stat"><span class="stability-stat-label">Estabilidad:</span><span class="stability-stat-value">' + d.stability + '%</span></div>' +
        '</div></div>';
    }).join('');
  }

  function updateDiagnosis(results) {
    var container = document.getElementById('diagnosisResults');
    var warningBox = document.getElementById('warningBox');
    if (!results || !results.results) {
      container.innerHTML = '<p class="empty-text">Ejecuta una prueba de estabilidad para ver el diagnostico.</p>';
      warningBox.style.display = 'none';
      return;
    }
    container.innerHTML = Object.values(results.results).map(function(d) {
      return '<div class="diagnosis-item ' + d.status + '">' +
        '<div class="diagnosis-header"><span class="diagnosis-addr">' + I2CScanner.formatAddress(d.address) + ' - ' + d.statusLabel + '</span></div>' +
        '<div class="diagnosis-detail">' + d.responses + '/' + results.iterations + ' respuestas correctas | Errores: ' + d.errors + ' | NACK: ' + d.nack + ' | Timeout: ' + d.timeout + '</div></div>';
    }).join('');
    warningBox.style.display = results.summary.hasColdSolderSymptoms ? 'flex' : 'none';
  }

  function updateFinalResults(summary) {
    document.getElementById('finalTotal').textContent = summary.total;
    document.getElementById('finalStable').textContent = summary.stable;
    document.getElementById('finalSuspicious').textContent = summary.suspicious;
    document.getElementById('finalDanger').textContent = summary.danger;
    document.getElementById('finalExplanation').textContent = summary.explanation;
  }

  function updateProgress(current, total) {
    var pct = Math.round((current / total) * 100);
    document.getElementById('progressFill').style.width = pct + '%';
    document.getElementById('progressText').textContent = pct + '%';
  }

  // ==================== 3D BUS VISUALIZATION ====================

  function showBus3D() {
    document.getElementById('bus3dCard').style.display = 'block';
    renderBus3D();
  }

  function hideBus3D() {
    document.getElementById('bus3dCard').style.display = 'none';
  }

  function renderBus3D() {
    var container = document.getElementById('bus3dSlaves');
    container.innerHTML = '';
    detectedDevices.forEach(function(addr) {
      var name = I2CScanner.getCommonDevice(addr) || 'Device';
      var div = document.createElement('div');
      div.className = 'bus3d-slave active';
      div.id = 'bus3d-slave-' + addr;
      div.innerHTML = '<div class="bus3d-slave-activity"></div>' +
        '<div class="bus3d-slave-addr">' + I2CScanner.formatAddress(addr) + '</div>' +
        '<div class="bus3d-slave-label">' + name + '</div>' +
        '<div class="bus3d-slave-led"></div>';
      container.appendChild(div);
    });
  }

  function animateBus3D(addr, success) {
    var slave = document.getElementById('bus3d-slave-' + addr);
    if (!slave) return;
    if (success) {
      slave.className = 'bus3d-slave active';
    } else {
      slave.className = 'bus3d-slave error';
      setTimeout(function() {
        if (slave) slave.className = 'bus3d-slave active';
      }, 300);
    }
  }

  // ==================== ACTIONS ====================

  function connectHardware() {
    logEvent('Solicitando conexion a hardware...', 'info');
    SerialManager.connect().then(function(result) {
      if (result.success) {
        isHardwareConnected = true;
        isDemo = false;
        updateConnectionStatus(true, { deviceName: result.deviceName });
        setModeBanner('real');
        document.getElementById('btnScan').disabled = false;
        hideBus3D();
        logEvent('Hardware conectado: ' + result.deviceName, 'success');
      } else {
        logEvent('Error de conexion: ' + result.error, 'error');
      }
    });
  }

  function startDemo() {
    isDemo = true;
    isHardwareConnected = false;
    detectedDevices = [];

    document.getElementById('demoSelector').style.display = 'block';
    document.getElementById('btnDemo').style.display = 'none';
    document.getElementById('btnStopDemo').style.display = 'inline-flex';
    setModeBanner('demo');
    updateConnectionStatus(true, { deviceName: 'Simulado (Demo)' });
    document.getElementById('btnScan').disabled = false;

    logEvent('Modo Demo activado', 'warning');

    var result = DemoMode.simulateScan();
    detectedDevices = result.devices;
    lastScanResult = result;

    resetGrid();
    result.devices.forEach(function(addr) { highlightGridCell(addr, true); });
    updateScanResult(result.devices.length);
    updateSlaveList(result.devices);

    var deviceList = result.devices.map(function(addr) {
      return { address: addr, responses: '--', errors: '--', nack: '--', timeout: '--', stability: '--', status: 'stable', statusLabel: 'OK' };
    });
    updateDevicesTable(deviceList);

    showBus3D();
    document.getElementById('btnStability').disabled = false;
    logEvent('Escaneo completado: ' + result.devices.length + ' dispositivos', 'success');
  }

  function stopDemo() {
    isDemo = false;
    detectedDevices = [];
    lastScanResult = null;
    stabilityResults = null;

    document.getElementById('demoSelector').style.display = 'none';
    document.getElementById('btnDemo').style.display = 'inline-flex';
    document.getElementById('btnStopDemo').style.display = 'none';
    setModeBanner('none');
    updateConnectionStatus(false);
    resetGrid();
    updateScanResult(0);
    updateDevicesTable([]);
    updateSlaveList([]);
    updateStabilityResults(null);
    updateDiagnosis(null);
    updateFinalResults({ total: 0, stable: 0, suspicious: 0, danger: 0, explanation: '' });
    document.getElementById('btnScan').disabled = true;
    document.getElementById('btnStability').disabled = true;
    document.getElementById('progressContainer').style.display = 'none';
    hideBus3D();
    logEvent('Modo Demo desactivado', 'info');
  }

  function scanBus() {
    resetGrid();
    detectedDevices = [];
    logEvent('Escaneo del bus I2C iniciado...', 'info');

    var promise;
    if (isDemo) {
      promise = Promise.resolve(DemoMode.simulateScan());
    } else {
      promise = I2CScanner.scanBus();
    }

    promise.then(function(result) {
      if (!result.success) {
        logEvent('Error en escaneo: ' + (result.error || 'Sin respuesta'), 'error');
        return;
      }
      lastScanResult = result;
      detectedDevices = result.devices;
      result.devices.forEach(function(addr) { highlightGridCell(addr, true); });
      updateScanResult(result.devices.length);
      updateSlaveList(result.devices);

      var deviceList = result.devices.map(function(addr) {
        return { address: addr, responses: '--', errors: '--', nack: '--', timeout: '--', stability: '--', status: 'stable', statusLabel: 'OK' };
      });
      updateDevicesTable(deviceList);

      if (isDemo) showBus3D();
      document.getElementById('btnStability').disabled = detectedDevices.length === 0;
      logEvent('Escaneo completado: ' + result.devices.length + ' dispositivos', 'success');
    });
  }

  function startStabilityTest() {
    if (detectedDevices.length === 0) { alert('No hay dispositivos detectados.'); return; }

    var radio = document.querySelector('input[name="testCount"]:checked');
    var iterations = parseInt(radio.value);

    document.getElementById('progressContainer').style.display = 'flex';
    document.getElementById('btnStability').disabled = true;
    document.getElementById('btnScan').disabled = true;
    updateProgress(0, iterations);
    logEvent('Prueba de estabilidad: ' + iterations + ' iteraciones', 'info');

    var promise;
    if (isDemo) {
      promise = DemoMode.simulateStabilityTest(iterations, function(current, total) {
        updateProgress(current, total);
        if (detectedDevices.length > 0) {
          var randomAddr = detectedDevices[Math.floor(Math.random() * detectedDevices.length)];
          animateBus3D(randomAddr, Math.random() > 0.15);
        }
      });
    } else {
      promise = Diagnostics.runStabilityTest(detectedDevices, iterations, function(current, total) {
        updateProgress(current, total);
      });
    }

    promise.then(function(results) {
      stabilityResults = results;
      updateProgress(iterations, iterations);
      updateDevicesTable(Object.values(results.results));
      updateStabilityResults(results);
      updateDiagnosis(results);
      updateFinalResults(results.summary);
      document.getElementById('btnStability').disabled = false;
      document.getElementById('btnScan').disabled = false;
      logEvent('Prueba completada', 'success');
    });
  }

  // ==================== LOG ====================

  function logEvent(message, level) {
    level = level || 'info';
    var now = new Date();
    var time = now.toTimeString().split(' ')[0];
    eventLog.push({ time: time, message: message, level: level });

    var consola = document.getElementById('logConsole');
    var span = document.createElement('span');
    span.className = 'log-entry';
    span.innerHTML = '<span class="log-time">[' + time + ']</span> <span class="log-' + level + '">' + message + '</span>';
    consola.appendChild(span);
    consola.scrollTop = consola.scrollHeight;
  }

  function clearLog() {
    eventLog = [];
    document.getElementById('logConsole').innerHTML = '';
    logEvent('Registro limpiado', 'info');
  }

  function exportLog() {
    var text = eventLog.map(function(e) { return '[' + e.time + '] ' + e.message; }).join('\n');
    navigator.clipboard.writeText(text).then(function() { logEvent('Log copiado', 'success'); });
  }

  // ==================== EXPORT ====================

  function exportJSON() {
    var data = {
      tool: 'Antony el tonto XD - I2C Diagnostic Tool',
      exportDate: new Date().toISOString(),
      mode: isDemo ? 'demo' : 'real',
      devices: detectedDevices.map(function(addr) {
        return { address: I2CScanner.formatAddress(addr), name: I2CScanner.getCommonDevice(addr) || 'Unknown' };
      }),
      stabilityResults: stabilityResults ? stabilityResults.results : null,
      summary: stabilityResults ? stabilityResults.summary : null,
      eventLog: eventLog.map(function(e) { return '[' + e.time + '] ' + e.message; })
    };
    downloadFile(JSON.stringify(data, null, 2), 'i2c-diagnostic-' + Date.now() + '.json', 'application/json');
    logEvent('JSON exportado', 'success');
  }

  function exportCSV() {
    if (!stabilityResults) { alert('Ejecuta una prueba primero.'); return; }
    var csv = 'Direccion,Nombre,Pruebas,Respuestas,Errores,NACK,Timeout,Estabilidad,Estado\n';
    Object.values(stabilityResults.results).forEach(function(d) {
      csv += I2CScanner.formatAddress(d.address) + ',' + (d.commonDevice || '') + ',' + stabilityResults.iterations + ',' + d.responses + ',' + d.errors + ',' + d.nack + ',' + d.timeout + ',' + d.stability + '%,' + d.statusLabel + '\n';
    });
    downloadFile(csv, 'i2c-diagnostic-' + Date.now() + '.csv', 'text/csv');
    logEvent('CSV exportado', 'success');
  }

  function downloadFile(content, filename, mimeType) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ==================== CALLBACKS ====================

  SerialManager.setLogCallback(function(msg, level) { logEvent(msg, level); });
  I2CScanner.setLogCallback(function(msg, level) { logEvent(msg, level); });
  Diagnostics.setLogCallback(function(msg, level) { logEvent(msg, level); });
  DemoMode.setLogCallback(function(msg, level) { logEvent(msg, level); });

  document.addEventListener('DOMContentLoaded', init);

  return {
    connectHardware: connectHardware,
    startDemo: startDemo,
    stopDemo: stopDemo,
    scanBus: scanBus,
    startStabilityTest: startStabilityTest,
    clearLog: clearLog,
    exportLog: exportLog,
    exportJSON: exportJSON,
    exportCSV: exportCSV
  };
})();
