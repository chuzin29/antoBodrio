/**
 * ui-nav.js — Navegación por vistas, dashboard, laboratorio, bus map,
 * estrés, comparador, historial, config y contexto para la IA.
 * NO toca Arduino/IA/diagnóstico existentes: los reutiliza.
 */
const LabUI = (() => {
  const VIEWS = [
    { id: 'dashboard', name: 'Dashboard', icon: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>' },
    { id: 'lab', name: 'Laboratorio', icon: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/>' },
    { id: 'i2c', name: 'Analizador I2C', icon: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>' },
    { id: 'signals', name: 'Señales', icon: '<path d="M2 12h4l3-8 4 16 3-8h6"/>' },
    { id: 'diag', name: 'Diagnóstico', icon: '<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/>' },
    { id: 'arduino', name: 'Arduino Real', icon: '<rect x="4" y="8" width="16" height="10" rx="2"/><path d="M8 8V4m8 4V4"/>' },
    { id: 'components', name: 'Componentes', icon: '<path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>' },
    { id: 'reports', name: 'Reportes', icon: '<path d="M6 2h9l5 5v15H6zM14 2v6h6"/>' },
    { id: 'learn', name: 'Aprender', icon: '<path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z"/>' },
    { id: 'config', name: 'Config', icon: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z"/>' },
    { id: 'tools', name: 'Herramientas', icon: '<path d="M14 6l4 4L8 20H4v-4L14 6zm1-5l4 4-2 2-4-4 2-2z"/>' },
  ];
  let current = 'dashboard';
  let lastStress = null;

  const svg = p => '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';

  function card(title, inner, icon) {
    return '<section class="card" data-view-card><h2 class="card-title">' + svg(icon || VIEWS[0].icon) + ' ' + title + '</h2>' + inner + '</section>';
  }

  function build() {
    document.body.classList.add('has-nav');
    // botón móvil
    const tg = document.createElement('button');
    tg.id = 'navToggle';
    tg.className = 'icon-btn';
    tg.innerHTML = svg('<path d="M3 6h18M3 12h18M3 18h18"/>');
    tg.setAttribute('aria-label', 'Menú');
    tg.onclick = () => document.body.classList.toggle('nav-open');
    document.body.appendChild(tg);
    // nav lateral
    const nav = document.createElement('aside');
    nav.id = 'sideNav';
    nav.innerHTML = '<div class="nav-brand">Laboratorio I2C<small>Antony el tonto XD</small></div>' +
      VIEWS.map(v => '<button class="nav-item" data-view="' + v.id + '">' + svg(v.icon) + ' ' + v.name + '</button>').join('');
    document.body.appendChild(nav);
    nav.querySelectorAll('.nav-item').forEach(b => b.onclick = () => { show(b.dataset.view); document.body.classList.remove('nav-open'); });

    const main = document.querySelector('main.main-container');
    // marca vistas de tarjetas existentes
    const map = {
      '.status-card': 'arduino', '.scanner-card': 'i2c', '.devices-card': 'i2c',
      '.stability-card': 'diag', '.diagnosis-card': 'diag', '.final-card': 'diag',
      '.roles-card': 'i2c', '.bus3d-card': 'lab', '.log-card': 'arduino', '.export-card': 'reports'
    };
    Object.keys(map).forEach(sel => {
      const el = main.querySelector(sel);
      if (el) el.dataset.viewCard = map[sel];
    });

    // ===== vistas nuevas =====
    const dash = card('Dashboard', '<div class="dash-grid" id="dashGrid"></div><div class="health-wrap"><div style="min-width:130px"><b>SALUD DEL BUS</b><br><small style="color:var(--text-muted)" id="healthLabel">SIN DATOS</small></div><div class="health-bar"><div class="health-fill" id="healthFill" style="width:0%"></div></div><div class="health-num" id="healthNum">--</div></div>', VIEWS[0].icon);
    const lab = card('Escenarios <span class="mode-tag sim">SIMULACIÓN</span>',
      '<div class="scenario-row" id="scenarioRow"></div>', VIEWS[1].icon) +
      card('Constructor de circuitos <span class="mode-tag sim">SIMULACIÓN</span>',
      '<div class="lab-layout"><div class="palette" id="palette"></div><div class="workbench"><div id="wbNodes"></div><div class="alert-list" id="wbAlerts"></div></div></div>', VIEWS[1].icon) +
      card('Inyección de fallas <span class="mode-tag sim">SIMULACIÓN</span>',
      '<div class="fault-grid" id="faultGrid"></div><div class="proto-controls"><button class="btn btn-primary" id="btnFaultGo">Iniciar falla</button><label style="font-size:13px"><input type="checkbox" id="chkPullups" checked> Pull-ups 4.7k</label><label style="font-size:13px">Bus <select id="selFreq"><option value="50">50 kHz</option><option value="100" selected>100 kHz</option><option value="400">400 kHz</option></select></label></div>', VIEWS[1].icon) +
      card('Vista 3D del circuito <span class="mode-tag sim">SIMULACIÓN</span>',
      '<canvas id="sim3dCanvas"></canvas><p style="font-size:12.5px;color:var(--text-secondary);margin-top:6px" id="sim3dInfo">Cargando Three.js…</p>', VIEWS[1].icon);
    const i2cExtra = card('Mapa del bus <span class="mode-tag sim">SIMULACIÓN</span>', '<div class="busmap" id="busMap">—</div>', VIEWS[2].icon);
    const sig = card('Osciloscopio virtual SDA/SCL <span class="mode-tag sim">SIMULACIÓN</span>',
      '<canvas id="scopeCanvas"></canvas><div class="scope-meta" id="scopeMeta"></div><div class="proto-controls"><button class="btn btn-primary" id="btnScopeRun">Capturar y correr</button><button class="btn btn-secondary" id="btnScopeStop">Pausar</button><label style="font-size:13px">Zoom <input type="range" id="rngZoom" min="1" max="5" step="1" value="2"></label><button class="btn btn-small" id="btnTglSDA">SDA on/off</button><button class="btn btn-small" id="btnTglSCL">SCL on/off</button></div>', VIEWS[3].icon) +
      card('Transacción I2C paso a paso <span class="mode-tag sim">SIMULACIÓN</span>',
      '<div class="proto-controls"><label style="font-size:13px">Dispositivo <select id="selProtoAddr"></select></label><button class="btn btn-primary" id="btnProtoNew">Nueva transacción</button></div><div class="proto-steps" id="protoSteps"></div><div class="proto-controls"><button class="btn btn-secondary" id="btnProtoPlay">Ejecutar</button><button class="btn btn-secondary" id="btnProtoPause">Pausar</button><button class="btn btn-secondary" id="btnProtoStep">Siguiente evento</button><button class="btn btn-secondary" id="btnProtoReset">Reiniciar</button></div><div class="proto-explain" id="protoExplain">—</div>', VIEWS[3].icon);
    const stress = card('Pruebas de estrés <span class="mode-tag sim">SIMULACIÓN</span>',
      '<div class="proto-controls"><label style="font-size:13px">Iteraciones <select id="selStress"><option>10</option><option>50</option><option selected>100</option><option>500</option><option>1000</option><option>10000</option></select></label><button class="btn btn-primary" id="btnStress">Ejecutar estrés</button></div><div class="progress-container" id="stressProg" style="display:none"><div class="progress-bar"><div class="progress-fill" id="stressFill"></div></div><span class="progress-text" id="stressTxt">0%</span></div><div id="stressOut" style="margin-top:8px;font-size:13px"></div>', VIEWS[4].icon);
    const cmp = card('Comparar simulación vs hardware',
      '<p style="font-size:13px;color:var(--text-secondary)">Compara el escaneo virtual con el último escaneo real/demo de la herramienta.</p><div class="proto-controls"><button class="btn btn-primary" id="btnCompare">Comparar ahora</button></div><div class="table-wrapper"><table class="cmp-table" id="cmpTable"><thead><tr><th>Dirección</th><th>Simulado</th><th>Real / Demo</th><th>Resultado</th></tr></thead><tbody><tr><td colspan="4">Sin comparación aún.</td></tr></tbody></table></div>', VIEWS[5].icon);
    const comp = card('Catálogo de componentes',
      '<div class="cat-filter" id="catFilter"></div><div class="cat-grid" id="catGrid"></div>', VIEWS[6].icon);
    const rep = card('Generar reporte técnico',
      '<div class="proto-controls"><button class="btn btn-primary" id="btnRepJson">JSON</button><button class="btn btn-secondary" id="btnRepCsv">CSV</button><button class="btn btn-secondary" id="btnRepHtml">HTML / PDF</button></div><h4 style="margin-top:12px">Últimos diagnósticos</h4><div class="hist-list" id="histList"></div>', VIEWS[7].icon);
    const learn = card('Centro de aprendizaje', '<div id="learnList"></div>', VIEWS[8].icon);
    const cfg = card('Configuración',
      '<div class="cfg-row"><label>API Key de Groq</label><input type="text" id="cfgKey" placeholder="gsk_... (vacío = modo local)"><button class="btn btn-primary" id="btnKeySave">Guardar</button></div><div class="cfg-row"><button class="btn btn-secondary" id="btnCfgTheme">Alternar tema</button><button class="btn btn-secondary" id="btnCfgSound">Alternar sonido</button><button class="btn btn-secondary" id="btnHistClear">Borrar historial</button></div><p style="font-size:12.5px;color:var(--text-muted);margin-top:8px">Estructura del proyecto: js/ plano (sin framework, estático para GitHub Pages). Arduino: js/serial.js · IA: js/antopupis.js · Diagnóstico: js/diagnostics.js · Lab: js/vlab.js + módulos.</p>', VIEWS[9].icon);

    const tools = card('Caja de herramientas del ingeniero',
      '<p style="font-size:13px;color:var(--text-secondary)">Cálculos y utilidades de planta. Todo local, sin internet.</p><div id="toolbox"></div>', VIEWS[10].icon);

    const tmp = document.createElement('div');
    tmp.innerHTML = dash + lab + i2cExtra + sig + stress + cmp + comp + rep + learn + cfg + tools;
    const buckets = { dashboard: [], lab: [], i2c: [], signals: [], diag: [], arduino: [], components: [], reports: [], learn: [], config: [], tools: [] };
    // clasifica nuevas por orden conocido
    const order = ['dashboard', 'lab', 'lab', 'lab', 'lab', 'i2c', 'signals', 'signals', 'diag', 'arduino', 'components', 'reports', 'learn', 'config', 'tools'];
    [...tmp.children].forEach((el, i) => { el.dataset.viewCard = order[i]; main.appendChild(el); });

    bindAll();
    refreshAll();
    show('dashboard');
  }

  function show(v) {
    current = v;
    document.querySelectorAll('#sideNav .nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === v));
    document.querySelectorAll('main.main-container [data-view-card]').forEach(el => {
      el.classList.toggle('view-hidden', el.dataset.viewCard !== v);
    });
    if (v === 'lab' && window.Sim3D) { Sim3D.init(); setTimeout(() => { try { Sim3D.rebuild(); } catch (e) {} }, 350); }
    if (v === 'signals' && window.Scope) setTimeout(() => { try { Scope.capture(); } catch (e) {} }, 150);
    if (v === 'tools' && window.Toolbox) { try { Toolbox.renderAll(); } catch (e) {} }
    if (window.UX) UX.refreshReveal();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Dashboard ----------
  function state() {
    const st = (window.App && App.getState) ? App.getState() : { detectedDevices: [], isDemo: false, isHardwareConnected: false };
    const hw = document.getElementById('statusHardware');
    const hwTxt = hw ? hw.textContent : '';
    const arduino = st.isHardwareConnected || /conectado/i.test(hwTxt) && !st.isDemo;
    return st;
  }
  function refreshDashboard() {
    const g = document.getElementById('dashGrid');
    if (!g) return;
    const st = state();
    const n = st.detectedDevices.length;
    const aiKey = window.APP_CONFIG && window.APP_CONFIG.GROQ_API_KEY && window.APP_CONFIG.GROQ_API_KEY !== 'TU_API_KEY_AQUI';
    const last = Store.hist()[0];
    const dot = (c) => '<span class="dot ' + c + '"></span>';
    g.innerHTML =
      dashCard('Sistema', dot('g') + 'OPERATIVO') +
      dashCard('Arduino', st.isHardwareConnected ? dot('r') + 'CONECTADO' : st.isDemo ? dot('b') + 'DEMO' : dot('o') + 'DESCONECTADO') +
      dashCard('Bus I2C', dot(n ? 'g' : 'o') + n + ' DISP.') +
      dashCard('Circuito virtual', dot('b') + VLab.getNodes().length + ' NODOS') +
      dashCard('Último diagnóstico', last ? dot('y') + last.type : dot('o') + '—') +
      dashCard('IA', aiKey ? dot('g') + 'NUBE' : dot('y') + 'LOCAL');
    // salud desde último estrés o demo
    const h = lastStress ? Store.busHealth(lastStress.results, lastStress.iterations) : { score: 0, label: 'SIN DATOS', cls: 'o' };
    const fill = document.getElementById('healthFill');
    if (fill) {
      fill.style.width = h.score + '%';
      fill.style.background = h.cls === 'g' ? 'var(--green)' : h.cls === 'y' ? 'var(--yellow)' : h.cls === 'r' ? 'var(--red)' : '#64748b';
      document.getElementById('healthNum').textContent = lastStress ? h.score + '%' : '--';
      document.getElementById('healthLabel').textContent = h.label;
    }
  }
  function dashCard(k, v) { return '<div class="dash-card"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>'; }

  // ---------- Bus map ----------
  function renderBusMap() {
    const el = document.getElementById('busMap');
    if (!el) return;
    const nodes = VLab.getNodes();
    const st = window.__lastDiag || {};
    let s = 'MASTER (Arduino virtual)\n│\n';
    nodes.forEach((n, i) => {
      const last = i === nodes.length - 1;
      const d = st[n.addr];
      const cls = !d ? '' : d.status === 'stable' ? 'st-g' : d.status === 'suspicious' ? 'st-y' : 'st-r';
      const tag = !d ? 'sin probar' : d.statusLabel + ' ' + d.stability + '%';
      s += (last ? '└── ' : '├── ') + VLab.fmtAddr(n.addr) + ' ' + n.name + '  <span class="' + cls + '">[' + tag + ']</span>\n';
    });
    el.innerHTML = s;
  }

  // ---------- Builder ----------
  const PALETTE = [[0x27, 'LCD 16x2'], [0x3C, 'OLED SSD1306'], [0x68, 'MPU6050'], [0x68, 'DS3231 RTC'], [0x50, 'EEPROM'], [0x76, 'BME280'], [0x48, 'ADS1115']];
  function renderBuilder() {
    const pal = document.getElementById('palette');
    if (!pal) return;
    pal.innerHTML = '<h4>Agregar</h4>' + PALETTE.map((p, i) => '<button data-pal="' + i + '">' + p[1] + '<small>' + VLab.fmtAddr(p[0]) + '</small></button>').join('');
    pal.querySelectorAll('[data-pal]').forEach(b => b.onclick = () => {
      const p = PALETTE[+b.dataset.pal];
      VLab.addNode(p[0], p[1]);
      refreshLab();
    });
    const wb = document.getElementById('wbNodes');
    wb.innerHTML = VLab.getNodes().map(n =>
      '<div class="wb-node" data-id="' + n.id + '"><div class="row"><b>' + VLab.fmtAddr(n.addr) + '</b><span>' + n.name + '</span>' +
      '<button class="btn btn-small" data-del="' + n.id + '">Quitar</button></div><div class="row" style="margin-top:6px">' +
      conn(n, 'sda', 'SDA') + conn(n, 'scl', 'SCL') + conn(n, 'gnd', 'GND') +
      '<label class="conn">VCC <select data-f="vcc">' + ['5V', '3.3V', 'OFF', '3V3-5V!'].map(v => '<option' + (n.vcc === v ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label>' +
      '<label class="conn">Estado <select data-f="phys">' + VLab.PHYS.map(v => '<option' + (n.phys === v ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label>' +
      '</div></div>'
    ).join('') || '<p style="color:var(--text-muted);font-size:13px">Sin nodos. Agrega componentes de la paleta.</p>';
    wb.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { VLab.removeNode(+b.dataset.del); refreshLab(); });
    wb.querySelectorAll('.wb-node').forEach(div => {
      const n = VLab.getNodes().find(x => x.id === +div.dataset.id);
      if (!n) return;
      div.querySelectorAll('[data-c]').forEach(ch => ch.onchange = () => { n[ch.dataset.c] = ch.checked; refreshLab(false); });
      div.querySelectorAll('[data-f]').forEach(sel => sel.onchange = () => { n[sel.dataset.f] = sel.value; refreshLab(false); });
    });
    const al = document.getElementById('wbAlerts');
    al.innerHTML = VLab.validate().map(a => '<div class="alert ' + a.lvl + '">' + a.msg + '</div>').join('');
  }
  function conn(n, f, label) {
    return '<label class="conn"><input type="checkbox" data-c="' + f + '"' + (n[f] ? ' checked' : '') + '> ' + label + ' <b>' + (n[f] ? 'OK' : '—') + '</b></label>';
  }

  // ---------- Faults / scenarios ----------
  const FAULTS = [['sdaCut', 'SDA desconectado'], ['sclCut', 'SCL desconectado'], ['gndCut', 'GND desconectado'], ['badVcc', 'Alimentación incorrecta'], ['dupAddr', 'Dirección duplicada'], ['randNack', 'NACK aleatorio'], ['timeout', 'Timeout'], ['noise', 'Ruido'], ['intermittent', 'Conexión intermitente'], ['coldSolder', 'Soldadura fría'], ['deadDev', 'Dispositivo dañado']];
  function renderFaults() {
    const g = document.getElementById('faultGrid');
    if (!g) return;
    const f = VLab.getFaults();
    g.innerHTML = FAULTS.map(x => '<label class="' + (f[x[0]] ? 'on' : '') + '"><input type="checkbox" data-fault="' + x[0] + '"' + (f[x[0]] ? ' checked' : '') + '> ' + x[1] + '</label>').join('');
    g.querySelectorAll('[data-fault]').forEach(ch => ch.onchange = () => {
      const o = {}; o[ch.dataset.fault] = ch.checked;
      VLab.setFaults(o);
      ch.closest('label').classList.toggle('on', ch.checked);
    });
  }
  function renderScenarios() {
    const r = document.getElementById('scenarioRow');
    if (!r) return;
    r.innerHTML = Scenarios.LIST.map(s => '<button class="btn btn-secondary" data-sc="' + s.id + '" title="' + s.desc + '">' + s.name + '</button>').join('');
    r.querySelectorAll('[data-sc]').forEach(b => b.onclick = () => {
      Scenarios.apply(b.dataset.sc);
      document.getElementById('chkPullups').checked = VLab.getPullups();
      refreshLab();
    });
  }

  // ---------- Estrés ----------
  function runStress() {
    const it = parseInt(document.getElementById('selStress').value);
    const prog = document.getElementById('stressProg');
    prog.style.display = 'flex';
    VLab.simStress(it, (c, t) => {
      const p = Math.round(c / t * 100);
      document.getElementById('stressFill').style.width = p + '%';
      document.getElementById('stressTxt').textContent = p + '%';
    }).then(res => {
      lastStress = res;
      const map = {};
      Object.values(res.results).forEach(d => map[d.address] = d.status);
      window.__lastDiag = map;
      const h = Store.busHealth(res.results, it);
      document.getElementById('stressOut').innerHTML = Object.values(res.results).map(d =>
        '<div class="wb-node"><b>' + VLab.fmtAddr(d.address) + '</b> ' + d.name +
        ' · ACK <b>' + d.responses + '</b> · NACK <b>' + d.nack + '</b> · Timeout <b>' + d.timeout + '</b>' +
        ' · Estabilidad <b>' + d.stability + '%</b> <span class="pill ' + (d.status === 'stable' ? 'g' : d.status === 'suspicious' ? 'y' : 'r') + '">' + d.statusLabel + '</span></div>'
      ).join('') + '<p style="margin-top:6px">Salud del bus: <b>' + h.score + '% ' + h.label + '</b>. Comportamiento compatible con posible soldadura/conexión defectuosa donde aplique (requiere verificación física).</p>';
      Store.save({ type: 'estres-virtual', pruebas: it, salud: h.score });
      if (window.UX) UX.renderDashboard(res);
      if (window.Sim3D) Sim3D.rebuild();
      renderBusMap(); refreshDashboard(); renderHistory();
    });
  }

  // ---------- Comparar ----------
  function runCompare() {
    const sim = VLab.simScan().devices;
    const st = state();
    const real = st.detectedDevices || [];
    const origin = st.isHardwareConnected ? 'HARDWARE REAL' : 'DEMO';
    const all = [...new Set([...sim, ...real])].sort((a, b) => a - b);
    document.getElementById('cmpTable').querySelector('tbody').innerHTML = all.length ? all.map(a => {
      const s = sim.includes(a), r = real.includes(a);
      const ok = s === r;
      return '<tr><td><b>' + VLab.fmtAddr(a) + '</b></td><td>' + (s ? 'ACK' : '—') + '</td><td>' + (r ? 'ACK' : '—') + ' <small>(' + origin + ')</small></td><td>' + (ok ? '✓ Coincide' : '⚠ Diferencia') + '</td></tr>';
    }).join('') : '<tr><td colspan="4">Sin dispositivos en ambos.</td></tr>';
  }

  // ---------- Historial ----------
  function renderHistory() {
    const el = document.getElementById('histList');
    if (!el) return;
    const h = Store.hist();
    el.innerHTML = h.length ? h.map(x => '<div class="hist-item"><span>' + new Date(x.ts).toLocaleString() + ' · <b>' + x.type + '</b> · ' + (x.origen || '') + '</span><span>' + (x.pruebas ? x.pruebas + ' pruebas' : '') + (x.salud != null ? ' · salud ' + x.salud + '%' : '') + '</span></div>').join('')
      : '<p style="color:var(--text-muted);font-size:13px">Sin historial aún.</p>';
  }

  function refreshLab() { renderBuilder(); renderFaults(); renderBusMap(); refreshDashboard(); if (window.Sim3D && current === 'lab') Sim3D.rebuild(); }
  function refreshAll() {
    renderScenarios(); renderBuilder(); renderFaults(); renderBusMap(); refreshDashboard(); renderHistory();
    ComponentsDB.render('catGrid');
    const cf = document.getElementById('catFilter');
    if (cf) {
      cf.innerHTML = ['Todos'].concat(ComponentsDB.CATS).map(c => '<button class="btn btn-small" data-cat="' + c + '">' + c + '</button>').join('');
      cf.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => ComponentsDB.render('catGrid', b.dataset.cat));
    }
    Learn.render('learnList');
    if (window.Toolbox) { try { Toolbox.renderAll(); } catch (e) {} }
    // protocolo
    const sel = document.getElementById('selProtoAddr');
    if (sel) {
      sel.innerHTML = VLab.getNodes().map(n => '<option value="' + n.addr + '">' + VLab.fmtAddr(n.addr) + ' ' + n.name + '</option>').join('');
      sel.onchange = () => Protocol.newSequence(+sel.value);
      if (sel.options.length) Protocol.newSequence(+sel.value);
    }
    Scope.capture(0x68);
  }

  function bindAll() {
    document.getElementById('btnFaultGo').onclick = () => { renderBusMap(); renderBuilder(); refreshDashboard(); if (window.Sim3D) Sim3D.rebuild(); };
    document.getElementById('chkPullups').onchange = e => VLab.setPullups(e.target.checked);
    document.getElementById('selFreq').onchange = e => VLab.setFreq(+e.target.value);
    document.getElementById('btnStress').onclick = runStress;
    document.getElementById('btnCompare').onclick = runCompare;
    document.getElementById('btnScopeRun').onclick = () => { const a = VLab.getNodes()[0]; Scope.capture(a ? a.addr : 0x68); Scope.start(); };
    document.getElementById('btnScopeStop').onclick = () => Scope.stop();
    document.getElementById('rngZoom').oninput = e => Scope.setZoom(+e.target.value);
    document.getElementById('btnTglSDA').onclick = () => Scope.toggle('SDA');
    document.getElementById('btnTglSCL').onclick = () => Scope.toggle('SCL');
    document.getElementById('btnProtoNew').onclick = () => Protocol.newSequence(+document.getElementById('selProtoAddr').value);
    document.getElementById('btnProtoPlay').onclick = () => Protocol.play();
    document.getElementById('btnProtoPause').onclick = () => Protocol.pause();
    document.getElementById('btnProtoStep').onclick = () => Protocol.step();
    document.getElementById('btnProtoReset').onclick = () => Protocol.reset();
    document.getElementById('btnRepJson').onclick = () => Reports.generate('sim', lastStress, 'json');
    document.getElementById('btnRepCsv').onclick = () => Reports.generate('sim', lastStress, 'csv');
    document.getElementById('btnRepHtml').onclick = () => Reports.generate('sim', lastStress, 'html');
    document.getElementById('btnCfgTheme').onclick = () => window.UX && UX.toggleTheme();
    document.getElementById('btnCfgSound').onclick = () => window.UX && UX.toggleSound();
    document.getElementById('btnHistClear').onclick = () => { Store.clearHist(); renderHistory(); refreshDashboard(); };
    const key = window.APP_CONFIG && window.APP_CONFIG.GROQ_API_KEY;
    if (key && key !== 'TU_API_KEY_AQUI') document.getElementById('cfgKey').value = key;
    document.getElementById('btnKeySave').onclick = () => {
      const v = document.getElementById('cfgKey').value.trim();
      try {
        if (v) { localStorage.setItem('anto_groq_key', v); localStorage.setItem('anto_groq_model', 'openai/gpt-oss-20b'); }
        else { localStorage.removeItem('anto_groq_key'); }
      } catch (e) {}
      if (window.APP_CONFIG) window.APP_CONFIG.GROQ_API_KEY = v || window.APP_CONFIG.GROQ_API_KEY;
      refreshDashboard();
    };
  }

  // ---------- Contexto para la IA ----------
  function labContext() {
    const st = state();
    const lines = ['[Contexto del laboratorio]'];
    lines.push('Nodos virtuales: ' + VLab.getNodes().map(n => VLab.fmtAddr(n.addr) + ' ' + n.name + ' (' + n.phys + ')').join(', '));
    const f = Object.keys(VLab.getFaults()).filter(k => VLab.getFaults()[k]);
    lines.push('Fallas inyectadas: ' + (f.length ? f.join(', ') : 'ninguna'));
    if (lastStress) lines.push('Último estrés (' + lastStress.iterations + '): ' + Object.values(lastStress.results).map(d => VLab.fmtAddr(d.address) + ' ' + d.responses + 'ACK/' + d.nack + 'NACK/' + d.timeout + 'TO ' + d.stability + '%').join(' | '));
    lines.push('Hardware: ' + (st.isHardwareConnected ? 'conectado' : st.isDemo ? 'modo demo' : 'desconectado') + ' · detectados: ' + (st.detectedDevices || []).map(a => VLab.fmtAddr(a)).join(', '));
    return lines.join('\n');
  }

  document.addEventListener('DOMContentLoaded', () => setTimeout(() => { build(); window.LabContext = labContext; }, 50));
  return { show, refreshDashboard, renderHistory, lastStress: () => lastStress, labContext,
    cmd: {
      goto: v => show(v),
      scenario: id => { const s = Scenarios.apply(id); const c = document.getElementById('chkPullups'); if (c) c.checked = VLab.getPullups(); refreshLab(); show('lab'); return s; },
      fault: (k, on) => { const o = {}; o[k] = on !== false; VLab.setFaults(o); refreshLab(); show('lab'); },
      clearFaults: () => { VLab.setFaults({ sdaCut: false, sclCut: false, gndCut: false, badVcc: false, dupAddr: false, randNack: false, timeout: false, noise: false, intermittent: false, coldSolder: false, deadDev: false }); refreshLab(); },
      stress: n => { const s = document.getElementById('selStress'); if (s) s.value = String(n); show('diag'); runStress(); },
      scan: () => { const r = VLab.simScan(); renderBusMap(); show('i2c'); return r; }
    } };
})();

/** Técnico IA: ejecuta simulaciones y responde con datos del lab antes de la nube */
window.LabTech = function (q, cmdsOnly) {
  const s = q.toLowerCase();
  const cmd = window.LabUI && LabUI.cmd;
  const joke = h => h + ' Bzzz.';
  // ---- Comandos de simulación ----
  if (cmd) {
    const scMap = [['caos', 'chaos'], ['soldadura', 'cold'], ['intermitente', 'intermit'], ['duplicad', 'dupaddr'], ['desconectado', 'disconn'], ['sda cortado', 'sdacut'], ['scl cortado', 'sclcut'], ['dañado', 'dead'], ['perfecto', 'perfect']];
    let m = s.match(/(?:carga|pon|simula|activa|escenario)\s+(?:el\s+)?(?:escenario\s+)?(.+)/);
    if (m) {
      for (const [k, id] of scMap) {
        if (m[1].includes(k)) {
          const sc = cmd.scenario(id);
          return joke('Listo: cargué <strong>' + sc.name + '</strong> (' + sc.desc + '). Ya manché el bus de miel... digo, de fallas. Corre un estrés y vemos qué llora primero.');
        }
      }
    }
    const fMap = [['sda desconectado', 'sdaCut'], ['scl desconectado', 'sclCut'], ['gnd', 'gndCut'], ['alimentaci', 'badVcc'], ['duplicada', 'dupAddr'], ['nack', 'randNack'], ['timeout', 'timeout'], ['ruido', 'noise'], ['intermiten', 'intermittent'], ['soldadura', 'coldSolder'], ['dañado', 'deadDev']];
    m = s.match(/(?:inyecta|mete|pon|activa|simula)\s+(.+)/);
    if (m && /falla|nack|timeout|ruido|corte|sda|scl|gnd|soldadura|dañado|duplicada|alimentaci|intermiten/.test(m[1])) {
      for (const [k, fk] of fMap) {
        if (m[1].includes(k)) { cmd.fault(fk, true); return joke('Falla inyectada: <strong>' + k + '</strong>. El bus ya está temblando. Ejecuta un diagnóstico y atrápala con las manos en la masa.'); }
      }
    }
    if (/quit.*falla|limpia.*falla|repara todo|sistema perfecto/.test(s)) { cmd.clearFaults(); cmd.scenario('perfect'); return joke('Fallas retiradas, bus como nuevo. Hasta la abeja pasó la escoba.'); }
    m = s.match(/(?:corre|ejecuta|haz|inicia).{0,12}estr[eé]s(?:\s+de\s+(\d+))?/);
    if (m) {
      const n = parseInt(m[1] || '100');
      const it = [10, 50, 100, 500, 1000, 10000].includes(n) ? n : 100;
      cmd.stress(it);
      return joke('Estrés de <strong>' + it + '</strong> pruebas en marcha. Voy preparando el parte de daños...');
    }
    if (/escanea/.test(s)) { const r = cmd.scan(); return joke('Escaneo virtual: encontré <strong>' + r.devices.length + '</strong> dispositivo(s) (' + r.devices.map(a => VLab.fmtAddr(a)).join(', ') + '). Los tímidos que no respondieron... ya sabemos por qué.'); }
    m = s.match(/(?:abre|ve|muestra|ir).{0,10}(osciloscopio|se[ñn]ales|3d|laboratorio|diagn[oó]stico|dashboard|arduino|reportes|componentes|aprender|config)/);
    if (m) {
      const vMap = { osciloscopio: 'signals', 'señales': 'signals', '3d': 'lab', laboratorio: 'lab', 'diagnóstico': 'diag', dashboard: 'dashboard', arduino: 'arduino', reportes: 'reports', componentes: 'components', aprender: 'learn', config: 'config' };
      const t = Object.keys(vMap).find(k => m[1].includes(k));
      if (t) { cmd.goto(vMap[t]); return joke('Abriendo <strong>' + t + '</strong>. Ponte el casco.'); }
    }
  }
  if (cmdsOnly) return null; // con nube, el diagnóstico explicativo lo da la IA real
  const st = (window.App && App.getState) ? App.getState() : {};
  const nodes = VLab.getNodes();
  const byAddr = m => { const x = m && m[0]; return x ? parseInt(x[1], 16) : null; };
  const addrM = s.match(/0x([0-9a-f]{2})/);
  const addr = byAddr(addrM);
  const stress = LabUI.lastStress();
  const diagFor = a => stress && stress.results[a];
  if (/qu[eé] est[aá] fallando|que falla|cual.*(mas|más) errores|que debo revisar/.test(s)) {
    if (!stress) return 'Bzzz… Aún no hay prueba de estrés virtual. Ve a Diagnóstico → Pruebas de estrés y ejecútala; luego pregúntame qué falla y te digo con números.';
    const worst = Object.values(stress.results).sort((a, b) => a.stability - b.stability)[0];
    const n = nodes.find(x => x.addr === worst.address);
    return 'Bzzz… El que más falla es <strong>' + VLab.fmtAddr(worst.address) + '</strong> (' + worst.commonDevice + '): ' + worst.stability + '% estable, ' + worst.nack + ' NACK, ' + worst.timeout + ' timeouts. Revisa en orden: SDA/SCL, alimentación (' + (n ? n.vcc : '?') + '), GND y estado físico (' + (n ? n.phys : '?') + '). Comportamiento intermitente = compatible con conexión defectuosa, verifícalo físicamente.';
  }
  if (addr) {
    const n = nodes.find(x => x.addr === addr);
    const d = diagFor(addr);
    let r = 'Bzzz… <strong>' + VLab.fmtAddr(addr) + '</strong>' + (n ? ' es ' + n.name : '') + '. Conexiones: SDA ' + (n && n.sda ? 'OK' : 'mal') + ', SCL ' + (n && n.scl ? 'OK' : 'mal') + ', GND ' + (n && n.gnd ? 'OK' : 'mal') + ', VCC ' + (n ? n.vcc : '?') + ', estado ' + (n ? n.phys : '?') + '.';
    r += d ? ' Último estrés: ' + d.stability + '% (' + d.responses + ' ACK, ' + d.nack + ' NACK, ' + d.timeout + ' TO).' : ' Sin prueba de estrés aún.';
    return r;
  }
  if (/comparar|diferencia|simulad.*real|real.*simulad/.test(s)) return 'Bzzz… Ve a Arduino Real → Comparar: tabla dirección por dirección con Simulado vs Real/Demo y marcas de coincidencia o diferencia.';
  return null;
};
