/**
 * vlab.js — Motor del laboratorio virtual.
 * Circuito virtual: master + nodos (addr, nombre, conexiones SDA/SCL/GND/VCC, estado físico).
 * Simula escaneo / estrés / transacciones con fallas inyectadas. Todo etiquetado SIMULACIÓN.
 */
const VLab = (() => {
  const PHYS = ['NORMAL', 'SOLDADURA FRÍA', 'CONEXIÓN FLOJA', 'CORTOCIRCUITO', 'CABLE DESCONECTADO', 'COMPONENTE DAÑADO'];
  const DEFAULTS = [
    { addr: 0x27, name: 'LCD 16x2 (PCF8574)' },
    { addr: 0x3C, name: 'OLED SSD1306' },
    { addr: 0x68, name: 'MPU6050' },
    { addr: 0x76, name: 'BME280' },
  ];
  let nodes = [];
  let uid = 1;
  let faults = { sdaCut: false, sclCut: false, gndCut: false, badVcc: false, dupAddr: false, randNack: false, timeout: false, noise: false, intermittent: false, coldSolder: false, deadDev: false };
  let pullups = true;
  let freqKhz = 100;

  function reset(devs) {
    nodes = (devs || DEFAULTS).map(d => ({
      id: uid++, addr: d.addr, name: d.name,
      sda: true, scl: true, gnd: true, vcc: '5V',
      phys: 'NORMAL'
    }));
  }
  function getNodes() { return nodes; }
  function addNode(addr, name) {
    nodes.push({ id: uid++, addr, name: name || ('DEV ' + fmtAddr(addr)), sda: true, scl: true, gnd: true, vcc: '5V', phys: 'NORMAL' });
  }
  function removeNode(id) { nodes = nodes.filter(n => n.id !== id); }
  function setFaults(f) { faults = Object.assign({}, faults, f); }
  function getFaults() { return faults; }
  function fmtAddr(a) { return '0x' + a.toString(16).toUpperCase().padStart(2, '0'); }

  /** Probabilidad de ACK por nodo según fallas globales + estado físico */
  function ackProb(n) {
    if (faults.sdaCut || faults.sclCut || faults.gndCut) return 0;
    if (faults.deadDev && n.phys !== 'NORMAL') return 0;
    if (n.phys === 'CABLE DESCONECTADO' || n.phys === 'COMPONENTE DAÑADO' || n.phys === 'CORTOCIRCUITO') return 0;
    if (n.phys === 'SOLDADURA FRÍA') return 0.80 + Math.random() * 0.08;
    if (n.phys === 'CONEXIÓN FLOJA') return 0.86 + Math.random() * 0.08;
    if (!n.sda || !n.scl || !n.gnd) return 0;
    if (n.vcc === 'OFF' || n.vcc === '3V3-5V!') return 0.15;
    let p = 1;
    if (faults.coldSolder && (n.addr === 0x50 || n.addr === 0x48 || Math.random() < 0.3)) p *= 0.72;
    if (faults.intermittent) p *= 0.85;
    if (faults.randNack) p *= 0.9;
    if (faults.noise) p *= 0.94;
    if (faults.timeout) p *= 0.93;
    if (faults.badVcc) p *= 0.8;
    if (!pullups) p *= 0.55;
    if (freqKhz > 100 && (faults.noise || !pullups)) p *= 0.8;
    return Math.max(0, Math.min(1, p));
  }

  /** Escaneo simulado: devuelve {devices:[addr]} */
  function simScan() {
    if (faults.dupAddr && nodes.length) {
      // duplicar: el conflicto hace que ambos fallen parcialmente
    }
    const found = nodes.filter(n => Math.random() < ackProb(n)).map(n => n.addr);
    return { success: true, simulated: true, devices: [...new Set(found)].sort((a, b) => a - b) };
  }

  /** Estrés configurable: iteraciones 10..10000 */
  function simStress(iterations, onProgress) {
    const stats = {};
    nodes.forEach(n => { stats[n.addr] = { address: n.addr, responses: 0, errors: 0, nack: 0, timeout: 0, name: n.name }; });
    return new Promise(resolve => {
      let i = 0;
      const CHUNK = 50;
      function step() {
        for (let c = 0; c < CHUNK && i < iterations; c++, i++) {
          nodes.forEach(n => {
            const s = stats[n.addr];
            if (Math.random() < ackProb(n)) s.responses++;
            else {
              s.errors++;
              const r = Math.random();
              if (faults.timeout && r < 0.35) s.timeout++;
              else if (r < 0.65) s.nack++;
              else s.timeout++;
            }
          });
        }
        if (onProgress) onProgress(Math.min(i, iterations), iterations);
        if (i < iterations) setTimeout(step, 0);
        else {
          const results = {};
          Object.values(stats).forEach(d => {
            const stab = Math.round(d.responses / iterations * 10000) / 100;
            const status = (stab >= 95 && d.errors === 0) ? 'stable' : stab >= 70 ? 'suspicious' : 'danger';
            results[d.address] = Object.assign({}, d, {
              stability: stab, status,
              statusLabel: status === 'stable' ? 'ESTABLE' : status === 'suspicious' ? 'SOSPECHOSO' : 'POSIBLE FALLA',
              commonDevice: d.name
            });
          });
          resolve({ results, iterations, simulated: true, timestamp: Date.now() });
        }
      }
      step();
    });
  }

  /** Transacción I2C simulada para el stepper: evento por evento */
  function simTransaction(addr) {
    const node = nodes.find(n => n.addr === addr) || { addr, name: 'Desconocido' };
    const okAddr = Math.random() < ackProb(node);
    const okData = okAddr && Math.random() < ackProb(node);
    const reg = '0x' + Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0');
    return [
      { t: 'START', cls: '' },
      { t: fmtAddr(addr), cls: '' },
      { t: 'WRITE', cls: '' },
      { t: okAddr ? 'ACK' : 'NACK', cls: okAddr ? 'ack' : 'nack' },
      { t: reg, cls: '' },
      { t: okData ? 'ACK' : 'NACK', cls: okData ? 'ack' : 'nack' },
      { t: 'STOP', cls: '' },
    ];
  }

  /** Detección de conflictos y errores de cableado */
  function validate() {
    const alerts = [];
    const seen = {};
    nodes.forEach(n => {
      const k = fmtAddr(n.addr);
      seen[k] = seen[k] || [];
      seen[k].push(n.name);
    });
    Object.keys(seen).forEach(k => {
      if (seen[k].length > 1) alerts.push({ lvl: 'err', msg: 'CONFLICTO DE DIRECCIÓN: ' + k + ' usado por ' + seen[k].join(' y ') + '. Dos dispositivos no pueden compartir dirección.' });
    });
    if (faults.dupAddr) alerts.push({ lvl: 'err', msg: 'Falla inyectada: dirección duplicada en el bus.' });
    if (faults.sdaCut) alerts.push({ lvl: 'err', msg: 'SDA desconectado: ningún dispositivo puede responder.' });
    if (faults.sclCut) alerts.push({ lvl: 'err', msg: 'SCL desconectado: sin reloj no hay comunicación.' });
    if (faults.gndCut) alerts.push({ lvl: 'err', msg: 'GND faltante: el bus no tiene referencia común.' });
    if (faults.badVcc) alerts.push({ lvl: 'warn', msg: 'Alimentación incorrecta: revisa niveles 3.3V/5V.' });
    if (!pullups) alerts.push({ lvl: 'warn', msg: 'Bus sin pull-ups en SDA/SCL: agrega 4.7k a VCC.' });
    nodes.forEach(n => {
      if (!n.sda) alerts.push({ lvl: 'err', msg: fmtAddr(n.addr) + ' (' + n.name + '): SDA desconectado.' });
      if (!n.scl) alerts.push({ lvl: 'err', msg: fmtAddr(n.addr) + ' (' + n.name + '): SCL desconectado.' });
      if (!n.gnd) alerts.push({ lvl: 'err', msg: fmtAddr(n.addr) + ' (' + n.name + '): sin GND.' });
      if (n.vcc === 'OFF') alerts.push({ lvl: 'err', msg: fmtAddr(n.addr) + ' (' + n.name + '): sin alimentación.' });
      if (n.phys !== 'NORMAL') alerts.push({ lvl: 'warn', msg: fmtAddr(n.addr) + ' (' + n.name + '): estado físico = ' + n.phys + '.' });
    });
    if (!alerts.length) alerts.push({ lvl: 'ok', msg: 'Circuito válido: sin conflictos ni conexiones incompletas.' });
    return alerts;
  }

  reset();
  return { PHYS, reset, getNodes, addNode, removeNode, setFaults, getFaults, simScan, simStress, simTransaction, validate, fmtAddr,
    setPullups: v => pullups = v, getPullups: () => pullups,
    setFreq: v => freqKhz = v, getFreq: () => freqKhz };
})();
