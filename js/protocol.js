/**
 * protocol.js — Simulador I2C paso a paso + decodificador lógico.
 * Todo SIMULACIÓN VIRTUAL.
 */
const Protocol = (() => {
  let steps = [], idx = -1, timer = null, addr = 0x68;

  function describe(evts) {
    // evts: [START, ADDR, RW, ACK/NACK, DATA, ACK/NACK, STOP]
    const a = evts[1] ? evts[1].t : '?';
    const rw = evts[2] ? evts[2].t : '?';
    const ack1 = evts[3] ? evts[3].t : '?';
    if (ack1 === 'NACK') return 'El MASTER llamó a ' + a + ' pero nadie respondió (NACK). Revisa dirección, alimentación y SDA/SCL.';
    const reg = evts[4] ? evts[4].t : '?';
    const ack2 = evts[5] ? evts[5].t : '?';
    let s = rw === 'WRITE'
      ? 'El MASTER escribió en el dispositivo ' + a + ' (registro ' + reg + ').'
      : 'El MASTER leyó del dispositivo ' + a + ' (registro ' + reg + ').';
    if (ack2 === 'NACK') s += ' El esclavo no confirmó el dato: posible conexión inestable.';
    return s;
  }

  function newSequence(a) {
    addr = a;
    steps = VLab.simTransaction(a);
    idx = -1;
    render();
    explain('Pulsa Ejecutar o Siguiente evento para avanzar la transacción.');
  }
  function render() {
    const box = document.getElementById('protoSteps');
    if (!box) return;
    box.innerHTML = steps.map((s, i) =>
      '<span class="proto-chip' + (i === idx ? ' cur' : '') + (i < idx ? ' ' + s.cls : '') + '">' + s.t + '</span>' +
      (i < steps.length - 1 ? '<span style="color:var(--text-muted)">→</span>' : '')
    ).join('');
  }
  function explain(t) {
    const el = document.getElementById('protoExplain');
    if (el) el.textContent = t;
  }
  function step() {
    if (!steps.length) newSequence(addr);
    if (idx < steps.length - 1) {
      idx++;
      render();
      const cur = steps[idx];
      explain('Evento ' + (idx + 1) + '/' + steps.length + ': ' + cur.t + ' — ' +
        ({ START: 'el MASTER toma el bus.', STOP: 'el MASTER libera el bus.', ACK: 'el esclavo confirma.', NACK: 'el esclavo NO confirma.', WRITE: 'bit R/W = escritura.', READ: 'bit R/W = lectura.' }[cur.t] ||
        (cur.t.startsWith('0x') && cur.t.length <= 4 ? 'byte de dirección o registro.' : 'byte de datos.')));
      if (window.UX) UX.beep(cur.t === 'NACK' ? 220 : 660, 0.07);
      if (idx === steps.length - 1) explain(describe(steps));
      return true;
    }
    return false;
  }
  function play() {
    pause();
    if (idx >= steps.length - 1) { idx = -1; }
    timer = setInterval(() => { if (!step()) pause(); }, 700);
  }
  function pause() { if (timer) { clearInterval(timer); timer = null; } }
  function reset() { pause(); idx = -1; render(); explain('Secuencia reiniciada.'); }
  return { newSequence, step, play, pause, reset };
})();
