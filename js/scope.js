/**
 * scope.js — Osciloscopio virtual SDA/SCL (SIMULACIÓN).
 * Dibuja forma de onda cuadrada generada de bits I2C + mediciones.
 */
const Scope = (() => {
  let running = false, raf = null, t = 0, zoom = 2, showSDA = true, showSCL = true;
  let bits = [];

  function genBits(addr) {
    // byte dirección + ACK + byte dato + ACK, MSB primero
    const b = [];
    for (let i = 6; i >= 0; i--) b.push((addr >> i) & 1);
    b.push(0); // R/W = WRITE
    const nack = Math.random() > 0.85;
    b.push(nack ? 1 : 0); // ACK=0 / NACK=1
    const reg = Math.floor(Math.random() * 256);
    for (let i = 7; i >= 0; i--) b.push((reg >> i) & 1);
    b.push(Math.random() > 0.9 ? 1 : 0);
    return b;
  }
  // SDA por bit, SCL = reloj continuo durante la trama
  function levelSDA(bitIdx, phase) { return bits[bitIdx] ? 1 : 0; }

  function draw() {
    const cv = document.getElementById('scopeCanvas');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const W = cv.width = cv.clientWidth * 2;
    const H = cv.height = 480;
    ctx.fillStyle = '#05080f';
    ctx.fillRect(0, 0, W, H);
    // retícula
    ctx.strokeStyle = 'rgba(80,100,140,0.18)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    const freq = VLab.getFreq() * 1000;
    const periodPx = 60 * zoom;               // px por bit
    const ySCL_H = H * 0.22, ySCL_L = H * 0.38;
    const ySDA_H = H * 0.60, ySDA_L = H * 0.78;
    const off = (t * 60) % periodPx;

    function wave(yH, yL, color, isSCL) {
      ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath();
      const totalBits = Math.ceil(W / periodPx) + 2;
      for (let i = -1; i < totalBits; i++) {
        const x0 = i * periodPx - off;
        let v0, v1;
        if (isSCL) { v0 = 0; v1 = 1; } // reloj alterna cada medio periodo
        else {
          const bi = ((Math.floor(t) + i) % bits.length + bits.length) % bits.length;
          v0 = bits[bi]; v1 = v0;
        }
        const yA = (i % 2 === 0 ? (isSCL ? yH : (v0 ? yH : yL)) : (isSCL ? yL : (v0 ? yH : yL)));
        const yB = isSCL ? (i % 2 === 0 ? yL : yH) : yA;
        if (i === -1) ctx.moveTo(x0, yA);
        else { ctx.lineTo(x0, yA); ctx.lineTo(x0, yB); ctx.lineTo(x0 + periodPx / 2, yB); }
      }
      ctx.stroke();
    }
    if (showSCL) { ctx.fillStyle = '#22c55e'; ctx.font = '22px monospace'; ctx.fillText('SCL', 12, ySCL_H - 12); wave(ySCL_H, ySCL_L, '#22c55e', true); }
    if (showSDA) { ctx.fillStyle = '#3b82f6'; ctx.font = '22px monospace'; ctx.fillText('SDA', 12, ySDA_H - 12); wave(ySDA_H, ySDA_L, '#3b82f6', false); }

    // mediciones
    const periodUs = 1000000 / freq;
    setMeta({
      freq: freq >= 1000 ? (freq / 1000).toFixed(0) + ' kHz' : freq + ' Hz',
      period: periodUs >= 1 ? periodUs.toFixed(1) + ' µs' : (periodUs * 1000).toFixed(0) + ' ns',
      high: (periodUs / 2).toFixed(1) + ' µs', low: (periodUs / 2).toFixed(1) + ' µs',
      bits: bits.length + ' bits/trama'
    });
    if (running) { t += 0.03 * zoom; raf = requestAnimationFrame(draw); }
  }
  function setMeta(m) {
    const el = document.getElementById('scopeMeta');
    if (!el) return;
    el.innerHTML = '<span>Frecuencia SCL <b>' + m.freq + '</b></span><span>Periodo <b>' + m.period + '</b></span>' +
      '<span>tHIGH <b>' + m.high + '</b></span><span>tLOW <b>' + m.low + '</b></span><span><b>' + m.bits + '</b></span>';
  }
  function capture(addr) {
    bits = genBits(addr == null ? 0x68 : addr);
    if (!running) draw(); // un frame estático
  }
  function start() { if (!bits.length) capture(); running = true; cancelAnimationFrame(raf); draw(); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  function setZoom(z) { zoom = z; if (!running) draw(); }
  function toggle(ch) { if (ch === 'SDA') showSDA = !showSDA; else showSCL = !showSCL; if (!running) draw(); }
  return { capture, start, stop, setZoom, toggle };
})();
