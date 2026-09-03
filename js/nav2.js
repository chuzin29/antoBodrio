/**
 * nav2.js — Navegación cómoda en celular + cabecera de vista + atajos.
 * Se engancha a LabUI.show sin modificarlo.
 */
const Nav2 = (() => {
  const ORDER = ['dashboard', 'lab', 'i2c', 'signals', 'diag', 'arduino', 'components', 'reports', 'learn', 'config', 'tools'];
  const TABS = ['dashboard', 'lab', 'i2c', 'diag']; // acceso directo + Señales? -> 5 tabs:
  const TAB_IDS = ['dashboard', 'lab', 'i2c', 'signals', 'diag'];
  const META = {
    dashboard: ['Dashboard', 'Estado general del sistema, bus y diagnóstico.'],
    lab: ['Laboratorio virtual', 'Arma circuitos, inyecta fallas y mira el 3D.'],
    i2c: ['Analizador I2C', 'Escaneo, dispositivos y mapa del bus.'],
    signals: ['Señales', 'Osciloscopio SDA/SCL y protocolo paso a paso.'],
    diag: ['Diagnóstico', 'Estabilidad, estrés y salud del bus.'],
    arduino: ['Arduino Real', 'Hardware físico, consola y comparador.'],
    components: ['Componentes', 'Catálogo con direcciones y voltajes.'],
    reports: ['Reportes', 'Genera y revisa reportes técnicos.'],
    learn: ['Aprender', 'Conceptos I2C cortos y prácticos.'],
    config: ['Config', 'Tema, sonido, API key e historial.'],
    tools: ['Herramientas', 'Cálculos, checklist y bitácora de planta.'],
  };
  const svg = p => '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  const ICONS = {};
  function grabIcons() {
    document.querySelectorAll('#sideNav .nav-item').forEach(b => {
      const s = b.querySelector('svg');
      if (s) ICONS[b.dataset.view] = s.outerHTML.replace('width="17" height="17"', 'width="22" height="22"');
    });
  }
  const icon = v => ICONS[v] || svg('<circle cx="12" cy="12" r="8"/>');
  const nameOf = v => (META[v] ? META[v][0] : v);

  function build() {
    grabIcons();
    const main = document.querySelector('main.main-container');
    // cabecera de vista
    const vh = document.createElement('div');
    vh.id = 'viewHeader';
    main.prepend(vh);
    // tab bar
    const tab = document.createElement('nav');
    tab.id = 'tabBar';
    tab.setAttribute('aria-label', 'Navegación principal');
    tab.innerHTML = '<div class="tab-row">' +
      TAB_IDS.map(v => '<button class="tab-btn" data-tab="' + v + '">' + icon(v) + '<span>' + shortName(v) + '</span></button>').join('') +
      '<button class="bee-fab" id="beeFab" aria-label="Asistente IA Antopupis"><svg width="28" height="28" viewBox="0 0 32 32" fill="none"><ellipse cx="16" cy="17" rx="8" ry="7" fill="#F5C518" stroke="#8B6914" stroke-width="1.5"/><rect x="12" y="15" width="8" height="2" rx="1" fill="#1a1a1a"/><rect x="12" y="19" width="8" height="2" rx="1" fill="#1a1a1a"/><circle cx="10" cy="12" r="3.4" fill="rgba(200,220,255,.65)"/><circle cx="22" cy="12" r="3.4" fill="rgba(200,220,255,.65)"/></svg></button>' +
      '<button class="tab-btn" data-tab="__more">' + svg('<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>') + '<span>Más</span></button>' +
      '</div>';
    document.body.appendChild(tab);
    document.getElementById('beeFab').onclick = () => { window.Antopupis && Antopupis.toggle(); };
    tab.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
      const v = b.dataset.tab;
      if (v === '__more') openSheet();
      else { window.LabUI && LabUI.show(v); }
    });
    // hoja Más
    const sheet = document.createElement('div');
    sheet.id = 'moreSheet';
    const rest = ORDER.filter(v => !TAB_IDS.includes(v));
    sheet.innerHTML = '<div class="sheet-bg"></div><div class="sheet-panel"><div class="sheet-grip"></div><div class="sheet-grid">' +
      rest.map(v => '<button class="sheet-btn" data-tab="' + v + '">' + icon(v) + '<span>' + nameOf(v) + '</span></button>').join('') +
      '</div></div>';
    document.body.appendChild(sheet);
    sheet.querySelector('.sheet-bg').onclick = closeSheet;
    sheet.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { closeSheet(); window.LabUI && LabUI.show(b.dataset.tab); });
    // sincroniza activo observando el sidebar (solo re-anima si cambió la vista)
    let lastV = '';
    const sync = () => {
      const act = document.querySelector('#sideNav .nav-item.active');
      const v = act ? act.dataset.view : 'dashboard';
      updateHeader(v);
      document.querySelectorAll('#tabBar .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === v));
      document.querySelectorAll('#moreSheet .sheet-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === v));
      if (v === lastV) return;
      lastV = v;
      const m = document.querySelector('main.main-container');
      if (m) { m.classList.remove('view-anim'); void m.offsetWidth; m.classList.add('view-anim'); }
    };
    const side = document.getElementById('sideNav');
    if (side) new MutationObserver(sync).observe(side, { subtree: true, attributes: true, attributeFilter: ['class'] });
    // atajos de teclado 1..9,0 (solo desktop)
    document.addEventListener('keydown', e => {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      const i = '1234567890'.indexOf(e.key);
      if (i >= 0 && i < ORDER.length && window.LabUI) LabUI.show(ORDER[i]);
    });
    // agrupa y numera el sidebar desktop
    if (side) {
      const groups = [['Principal', ['dashboard', 'lab', 'i2c', 'signals', 'diag']], ['Herramientas', ['arduino', 'components', 'reports', 'learn', 'config', 'tools']]];
      const items = {};
      side.querySelectorAll('.nav-item').forEach(b => items[b.dataset.view] = b);
      side.querySelectorAll('.nav-item,.nav-group').forEach(n => n.remove());
      groups.forEach(([g, vs]) => {
        const h = document.createElement('div');
        h.className = 'nav-group'; h.textContent = g;
        side.appendChild(h);
        vs.forEach(v => {
          if (!items[v]) return;
          const kbd = document.createElement('kbd');
          kbd.textContent = ORDER.indexOf(v) + 1;
          items[v].appendChild(kbd);
          side.appendChild(items[v]);
        });
      });
    }
    sync();
  }

  function shortName(v) {
    return { dashboard: 'Inicio', lab: 'Lab', i2c: 'I²C', signals: 'Señales', diag: 'Diag' }[v] || v;
  }
  function updateHeader(v) {
    const el = document.getElementById('viewHeader');
    if (!el || !META[v]) return;
    const idx = ORDER.indexOf(v) + 1;
    el.innerHTML = '<div class="vh-inner"><div class="vh-icon">' + icon(v) + '</div>' +
      '<div><h2>' + META[v][0] + '</h2><p>' + META[v][1] + '</p></div>' +
      '<div class="vh-step">' + idx + ' / ' + ORDER.length + '</div></div>';
  }
  function openSheet() { document.getElementById('moreSheet').classList.add('open'); }
  function closeSheet() { const s = document.getElementById('moreSheet'); if (s) s.classList.remove('open'); }

  document.addEventListener('DOMContentLoaded', () => setTimeout(build, 400));
  return { closeSheet };
})();
