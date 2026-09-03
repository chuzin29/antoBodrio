/**
 * toolbox.js — Caja de herramientas del ingeniero (cálculos + bitácora).
 * Todo local, sin dependencias. Se renderiza dentro de la vista Herramientas.
 */
const Toolbox = (() => {
  const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
  function e12fit(kohm) {
    let best = E12[0], bd = 1e9;
    E12.forEach(v => { const d = Math.abs(v - kohm); if (d < bd) { bd = d; best = v; } });
    return best.toFixed(1) + 'k';
  }

  function pullups() {
    const vcc = parseFloat(document.getElementById('tbVcc').value) || 5;
    const cb = parseFloat(document.getElementById('tbCap').value) || 100;
    const tr = parseFloat(document.getElementById('tbSpeed').value) || 1000;
    const rmin = (vcc - 0.4) / 0.003 / 1000;            // kΩ, IOL=3mA
    const rmax = (tr * 1e-9) / (0.8473 * cb * 1e-12) / 1000; // kΩ
    const el = document.getElementById('tbPuOut');
    if (rmin >= rmax) {
      el.innerHTML = 'Con ' + cb + 'pF no hay rango válido: baja la velocidad o acorta el bus. Bzzz... ni la miel salva ese bus.';
    } else {
      const mid = Math.sqrt(rmin * rmax);
      el.innerHTML = 'Rango válido: <b>' + rmin.toFixed(1) + 'k – ' + rmax.toFixed(1) + 'k</b>. Sugerido E12: <b>' + e12fit(mid) + '</b> por línea (SDA y SCL).';
    }
  }

  function addr() {
    const raw = document.getElementById('tbAddr').value.trim();
    const el = document.getElementById('tbAddrOut');
    const a = parseInt(raw, 16);
    if (isNaN(a) || a < 3 || a > 0x77) { el.textContent = 'Dirección 7-bit válida: 0x03–0x77.'; return; }
    const hx = n => '0x' + n.toString(16).toUpperCase().padStart(2, '0');
    el.innerHTML = 'Lectura: <b>' + hx((a << 1) | 1) + '</b> · Escritura: <b>' + hx(a << 1) + '</b> · Binario: <b>' + a.toString(2).padStart(7, '0') + '</b>';
  }

  function conv() {
    const raw = document.getElementById('tbConv').value.trim().toLowerCase().replace(/^0x/, '').replace(/^0b/, '');
    const el = document.getElementById('tbConvOut');
    let n = NaN;
    if (/^[01]+$/.test(raw) && raw.length <= 16 && /[01]/.test(raw) && (document.getElementById('tbConvBase').value === 'bin' || /^[01]+$/.test(raw) && raw.length > 2 && document.getElementById('tbConvBase').value === 'auto')) n = parseInt(raw, 2);
    const base = document.getElementById('tbConvBase').value;
    if (base === 'hex') n = parseInt(raw, 16);
    else if (base === 'dec') n = parseInt(raw, 10);
    else if (base === 'bin') n = parseInt(raw, 2);
    if (isNaN(n)) { el.textContent = 'Valor no válido.'; return; }
    el.innerHTML = 'HEX <b>0x' + n.toString(16).toUpperCase() + '</b> · DEC <b>' + n + '</b> · BIN <b>' + n.toString(2) + '</b>';
  }

  function cable() {
    const len = parseFloat(document.getElementById('tbLen').value) || 0.3;
    const khz = parseFloat(document.getElementById('tbKhz').value) || 100;
    const cap = len * 50; // pF aprox por metro
    const el = document.getElementById('tbCableOut');
    let msg = 'Capacitancia estimada: <b>~' + cap.toFixed(0) + 'pF</b> (límite I2C: 400pF). ';
    if (cap > 400) msg += '<b>No viable:</b> acorta el bus o usa extensor P82B715.';
    else if (khz > 100 && cap > 150) msg += 'A ' + khz + 'kHz es riesgoso: baja a <b>100kHz</b> o usa pull-ups de 2.2k.';
    else msg += 'A ' + khz + 'kHz debería funcionar con pull-ups de 4.7k.';
    el.innerHTML = msg;
  }

  // ---- Checklist de puesta en marcha ----
  const CHK = ['GND común entre master y esclavos', 'VCC correcto (3.3V/5V según dispositivo)', 'Pull-ups 4.7k en SDA y SCL', 'SDA/SCL sin cruces ni cortos', 'Direcciones únicas (sin duplicados)', 'Escaneo detecta todos los nodos', 'Estrés 100+ pruebas ≥95% estable', 'Reporte generado y archivado'];
  function chkKey() { return 'anto_checklist_v1'; }
  function renderCheck() {
    let done = [];
    try { done = JSON.parse(localStorage.getItem(chkKey()) || '[]'); } catch (e) {}
    const el = document.getElementById('tbCheck');
    if (!el) return;
    el.innerHTML = CHK.map((c, i) => '<label class="chk"><input type="checkbox" data-chk="' + i + '"' + (done.includes(i) ? ' checked' : '') + '> ' + c + '</label>').join('') +
      '<p style="margin-top:6px;font-size:13px">Avance: <b>' + done.length + '/' + CHK.length + '</b></p>';
    el.querySelectorAll('[data-chk]').forEach(ch => ch.onchange = () => {
      let d = [];
      try { d = JSON.parse(localStorage.getItem(chkKey()) || '[]'); } catch (e) {}
      const i = +ch.dataset.chk;
      d = ch.checked ? [...new Set([...d, i])] : d.filter(x => x !== i);
      try { localStorage.setItem(chkKey(), JSON.stringify(d)); } catch (e) {}
      renderCheck();
    });
  }

  // ---- Bitácora de mantenimiento ----
  function logKey() { return 'anto_bitacora_v1'; }
  function getLog() { try { return JSON.parse(localStorage.getItem(logKey()) || '[]'); } catch (e) { return []; } }
  function addLog() {
    const txt = document.getElementById('tbLogTxt').value.trim();
    if (!txt) return;
    const tipo = document.getElementById('tbLogTipo').value;
    const log = getLog();
    log.unshift({ ts: Date.now(), tipo, txt });
    try { localStorage.setItem(logKey(), JSON.stringify(log.slice(0, 200))); } catch (e) {}
    document.getElementById('tbLogTxt').value = '';
    renderLog();
  }
  function renderLog() {
    const el = document.getElementById('tbLog');
    if (!el) return;
    const log = getLog();
    el.innerHTML = log.length ? log.map(e => '<div class="hist-item"><span>' + new Date(e.ts).toLocaleString() + ' · <b>' + e.tipo + '</b> · ' + e.txt.replace(/</g, '&lt;') + '</span></div>').join('')
      : '<p style="color:var(--text-muted);font-size:13px">Sin registros. Anota cada intervención: lo que no se registra, no existió.</p>';
  }
  function exportLog() {
    const log = getLog();
    let csv = 'Fecha,Tipo,Detalle\n';
    log.forEach(e => csv += new Date(e.ts).toISOString() + ',' + e.tipo + ',"' + e.txt.replace(/"/g, "'") + '"\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'bitacora-' + Date.now() + '.csv';
    a.click();
  }

  function renderAll() {
    const host = document.getElementById('toolbox');
    if (!host || host.dataset.done) { renderCheck(); renderLog(); return; }
    host.dataset.done = '1';
    host.innerHTML =
      tbCard('Calculadora de pull-ups', '<div class="tb-row"><label>VCC <select id="tbVcc"><option>5</option><option>3.3</option></select> V</label><label>Cap. bus <input type="number" id="tbCap" value="100" style="width:70px"> pF</label><label>Flanco <select id="tbSpeed"><option value="1000">100kHz</option><option value="300">400kHz</option></select></label><button class="btn btn-primary" id="tbPuGo">Calcular</button></div><p class="tb-out" id="tbPuOut"></p>') +
      tbCard('Calculadora de direcciones', '<div class="tb-row"><label>Dir 7-bit <input type="text" id="tbAddr" value="0x68" style="width:80px"></label><button class="btn btn-primary" id="tbAddrGo">Calcular</button></div><p class="tb-out" id="tbAddrOut"></p>') +
      tbCard('Conversor HEX / DEC / BIN', '<div class="tb-row"><input type="text" id="tbConv" value="0x68" style="width:100px"><select id="tbConvBase"><option value="hex">HEX</option><option value="dec">DEC</option><option value="bin">BIN</option></select><button class="btn btn-primary" id="tbConvGo">Convertir</button></div><p class="tb-out" id="tbConvOut"></p>') +
      tbCard('Asesor cable vs velocidad', '<div class="tb-row"><label>Longitud <input type="number" id="tbLen" value="0.3" step="0.1" style="width:70px"> m</label><label>Velocidad <select id="tbKhz"><option>100</option><option>400</option></select> kHz</label><button class="btn btn-primary" id="tbCableGo">Evaluar</button></div><p class="tb-out" id="tbCableOut"></p>') +
      tbCard('Checklist de puesta en marcha', '<div id="tbCheck"></div>') +
      tbCard('Bitácora de mantenimiento', '<div class="tb-row"><select id="tbLogTipo"><option>Preventivo</option><option>Correctivo</option><option>Inspección</option><option>Mejora</option></select><input type="text" id="tbLogTxt" placeholder="Qué se hizo..." style="flex:1;min-width:140px"><button class="btn btn-primary" id="tbLogAdd">Anotar</button><button class="btn btn-secondary" id="tbLogExp">CSV</button></div><div class="hist-list" id="tbLog"></div>');
    document.getElementById('tbPuGo').onclick = pullups;
    document.getElementById('tbAddrGo').onclick = addr;
    document.getElementById('tbConvGo').onclick = conv;
    document.getElementById('tbCableGo').onclick = cable;
    document.getElementById('tbLogAdd').onclick = addLog;
    document.getElementById('tbLogExp').onclick = exportLog;
    pullups(); addr();
    renderCheck(); renderLog();
  }
  function tbCard(t, inner) {
    return '<div class="cat-card" style="margin-top:10px"><h4>' + t + '</h4><div style="margin-top:8px">' + inner + '</div></div>';
  }

  return { renderAll };
})();
window.Toolbox = Toolbox;
