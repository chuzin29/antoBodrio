/**
 * demo.js — Demo Mode with Realistic Simulated Data
 * Supports device selection and fault simulation
 */
const DemoMode = (() => {
  const ALL_DEVICES = [
    { addr: 0x27, name: 'PCF8574A', type: 'LCD / IO Expander', baseStability: 100 },
    { addr: 0x3C, name: 'SSD1306', type: 'OLED 128x64', baseStability: 100 },
    { addr: 0x68, name: 'DS3231', type: 'Reloj RTC', baseStability: 100 },
    { addr: 0x50, name: 'AT24C32', type: 'EEPROM', baseStability: 100 },
    { addr: 0x76, name: 'BME280', type: 'Sensor Climatico', baseStability: 100 },
    { addr: 0x48, name: 'ADS1115', type: 'ADC 16-bit', baseStability: 100 }
  ];

  let selectedDevices = [];
  let simulateColdSolder = false;
  let simulateIntermittent = false;
  let onLogCallback = null;

  function setLogCallback(cb) {
    onLogCallback = cb;
  }

  function log(message, level) {
    if (onLogCallback) onLogCallback(message, level);
  }

  function getSelectedDevices() {
    selectedDevices = [];
    var checkboxes = document.querySelectorAll('.demo-devices-grid .demo-device-check input:checked');
    checkboxes.forEach(function(cb) {
      var addr = parseInt(cb.value, 16);
      var device = ALL_DEVICES.find(function(d) { return d.addr === addr; });
      if (device) selectedDevices.push(Object.assign({}, device));
    });
    simulateColdSolder = document.getElementById('simColdSolder').checked;
    simulateIntermittent = document.getElementById('simIntermittent').checked;

    if (simulateColdSolder) {
      selectedDevices.forEach(function(d) {
        if (d.addr === 0x50 || d.addr === 0x48) {
          d.baseStability = 65 + Math.floor(Math.random() * 20);
        }
      });
    }

    if (simulateIntermittent) {
      selectedDevices.forEach(function(d) {
        if (d.baseStability === 100) {
          d.baseStability = 80 + Math.floor(Math.random() * 15);
        }
      });
    }

    if (selectedDevices.length === 0) {
      selectedDevices = ALL_DEVICES.slice(0, 5).map(function(d) { return Object.assign({}, d); });
    }

    return selectedDevices;
  }

  function simulateScan() {
    getSelectedDevices();
    var found = [];
    selectedDevices.forEach(function(d) {
      var chance = d.baseStability / 100;
      if (Math.random() < chance) {
        found.push(d.addr);
      }
    });
    log('Escaneo completado: ' + found.length + ' dispositivos', 'success');
    return {
      success: true,
      devices: found.sort(function(a, b) { return a - b; }),
      timestamp: Date.now()
    };
  }

  function simulateStabilityTest(iterations, onProgress) {
    getSelectedDevices();
    var stats = {};
    selectedDevices.forEach(function(d) {
      stats[d.addr] = {
        address: d.addr,
        responses: 0,
        errors: 0,
        nack: 0,
        timeout: 0,
        disappearances: 0,
        firstSeen: null,
        lastSeen: null,
        name: d.name,
        type: d.type,
        baseStability: d.baseStability
      };
    });

    var prev = new Set();

    return new Promise(function(resolve) {
      var i = 0;
      var interval = setInterval(function() {
        if (i >= iterations) {
          clearInterval(interval);
          var results = {};
          Object.values(stats).forEach(function(device) {
            var stability = iterations > 0 ? (device.responses / iterations * 100) : 0;
            var rounded = Math.round(stability * 100) / 100;
            var status;
            if (rounded >= 95 && device.errors === 0) status = 'stable';
            else if (rounded >= 70) status = 'suspicious';
            else status = 'danger';

            var statusLabel;
            if (status === 'stable') statusLabel = 'ESTABLE';
            else if (status === 'suspicious') statusLabel = 'SOSPECHOSO';
            else statusLabel = 'POSIBLE FALLA';

            results[device.address] = {
              address: device.address,
              responses: device.responses,
              errors: device.errors,
              nack: device.nack,
              timeout: device.timeout,
              disappearances: device.disappearances,
              stability: rounded,
              status: status,
              statusLabel: statusLabel,
              commonDevice: device.name
            };
          });

          var devices = Object.values(results);
          var total = devices.length;
          var stable = devices.filter(function(d) { return d.status === 'stable'; }).length;
          var suspicious = devices.filter(function(d) { return d.status === 'suspicious'; }).length;
          var danger = devices.filter(function(d) { return d.status === 'danger'; }).length;

          var explanation = '';
          if (danger > 0) {
            explanation = 'Se detectaron ' + danger + ' dispositivo(s) con comportamiento inestable. Esto puede indicar conexiones defectuosas, problemas en el cableado o dispositivos danados.';
          } else if (suspicious > 0) {
            explanation = 'Se detectaron ' + suspicious + ' dispositivo(s) con comportamiento ligeramente inestable.';
          } else {
            explanation = 'Todos los ' + total + ' dispositivo(s) respondieron de forma estable.';
          }

          resolve({
            results: results,
            summary: {
              total: total,
              stable: stable,
              suspicious: suspicious,
              danger: danger,
              explanation: explanation,
              hasColdSolderSymptoms: danger > 0 || suspicious > 0
            },
            iterations: iterations,
            timestamp: Date.now()
          });
          return;
        }

        var currentPresent = new Set();
        selectedDevices.forEach(function(d) {
          var stability = d.baseStability / 100;
          if (simulateIntermittent && Math.random() < 0.05) {
            stability *= 0.7;
          }
          if (Math.random() < stability) {
            currentPresent.add(d.addr);
            stats[d.addr].responses++;
            stats[d.addr].lastSeen = Date.now();
            if (!stats[d.addr].firstSeen) stats[d.addr].firstSeen = Date.now();
          } else {
            stats[d.addr].errors++;
            if (Math.random() < 0.6) stats[d.addr].nack++;
            else stats[d.addr].timeout++;
          }
        });

        Object.keys(stats).forEach(function(addr) {
          var a = parseInt(addr);
          if (prev.has(a) && !currentPresent.has(a)) {
            stats[a].disappearances++;
          }
        });
        prev = currentPresent;

        i++;
        if (onProgress) onProgress(i, iterations, stats);
      }, 25 + Math.random() * 40);
    });
  }

  return {
    simulateScan: simulateScan,
    simulateStabilityTest: simulateStabilityTest,
    setLogCallback: setLogCallback,
    ALL_DEVICES: ALL_DEVICES,
    getSelectedDevices: getSelectedDevices
  };
})();
