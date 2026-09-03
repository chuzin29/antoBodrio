/** learn.js — Academia: ruta guiada, árbol de fallas, quiz y lecciones por nivel */
const Learn = (() => {
  const ARTICLES = [
    { lvl: 'Básico', t: '¿Qué es I2C?', b: 'Bus de 2 líneas (SDA datos + SCL reloj) que conecta muchos dispositivos con solo 2 pines del microcontrolador. Velocidades típicas: 100 kHz (estándar) y 400 kHz (rápido).' },
    { lvl: 'Básico', t: '¿Qué es SDA?', b: 'Serial Data: línea bidireccional por donde viajan direcciones y datos. Es open-drain: necesita pull-up a VCC.' },
    { lvl: 'Básico', t: '¿Qué es SCL?', b: 'Serial Clock: el MASTER genera el reloj que sincroniza cada bit. Sin SCL no hay comunicación.' },
    { lvl: 'Básico', t: '¿Qué es ACK?', b: 'Acknowledge: el esclavo baja SDA a 0 en el 9.º pulso para confirmar "recibido".' },
    { lvl: 'Básico', t: '¿Qué es NACK?', b: 'No-acknowledge: SDA queda en 1. Significa que nadie respondió: revisa dirección, alimentación y cableado.' },
    { lvl: 'Básico', t: '¿Qué es un MASTER?', b: 'El que inicia y controla la comunicación (tu Arduino/ESP32). Genera START, direcciones y STOP.' },
    { lvl: 'Básico', t: '¿Qué es un SLAVE / TARGET?', b: 'El dispositivo que responde cuando lo llaman por su dirección (sensores, pantallas, memorias).' },
    { lvl: 'Básico', t: '¿Qué es una dirección I2C?', b: 'Identificador de 7 bits (0x03–0x77). Cada esclavo tiene la suya; si dos comparten, hay conflicto y el bus falla.' },
    { lvl: 'Planta', t: '¿Qué es una soldadura fría?', b: 'Unión defectuosa que conduce a ratos: el síntoma es intermitencia (ACK a veces, NACK/timeouts aleatorios). El software solo detecta el comportamiento compatible; la confirmación es visual y física (lupa, flux y calor).' },
    { lvl: 'Planta', t: '¿Cómo diagnosticar un bus I2C?', b: '1) Escanea y anota quién responde. 2) Corre 100+ pruebas y mira estabilidad. 3) Si hay intermitencia: revisa pull-ups (4.7k), GND común, VCC correcto y soldaduras. 4) Compara simulación vs hardware real.' },
    { lvl: 'Planta', t: 'Pull-ups: ¿por qué 4.7k?', b: 'SDA/SCL son open-drain: solo bajan a 0, el 1 lo pone la resistencia. 4.7k a VCC es el punto medio clásico. Bus largo o 400 kHz: baja a 2.2k. Usa la calculadora en Herramientas para tu capacitancia real.' },
    { lvl: 'Planta', t: '3.3V vs 5V: niveles lógicos', b: 'Un ESP32 (3.3V) hablando con un sensor de 5V puede dañarse o leer mal. Regla: el pull-up va al VCC del maestro, y si mezclas voltajes usa un conversor de nivel (level shifter). Nunca alimentes un esclavo 3.3V con 5V.' },
    { lvl: 'Planta', t: 'Longitud de cable en planta', b: 'I2C nació para centímetros dentro de un equipo. Límite práctico: 400 pF de bus (~1-2 m con cable común). Si tu tablero está lejos: baja a 50-100 kHz, pull-ups de 2.2k, o usa extensor P82B715. El asesor en Herramientas te dice si tu tramo es viable.' },
    { lvl: 'Planta', t: 'Salud del bus como OEE', b: 'Trata la estabilidad como disponibilidad de línea: 99-100% excelente, 80-98% estable, 60-79% programa mantenimiento, <60% paro no programado en camino. Registra cada intervención en la bitácora.' },
    { lvl: 'Planta', t: 'ESD y ambiente industrial', b: 'En planta hay variadores, contactores y polvo: usa cable apantallado para SDA/SCL, GND común sólido, y mantén el bus lejos de líneas de potencia. Un NACK que aparece solo cuando arranca un motor es ruido, no soldadura.' },
    { lvl: 'Avanzado', t: 'Clock stretching', b: 'Un esclavo lento puede retener SCL en 0 para pedir tiempo. Si tu osciloscopio muestra SCL "estirado" en bajo, el esclavo está ocupado: no es falla, es el protocolo funcionando. Sube timeouts en vez de culpar al cable.' },
    { lvl: 'Avanzado', t: 'Arbitraje y multi-master', b: 'I2C permite varios masters: si dos inician a la vez, el que primero pone un 1 donde el otro pone 0 pierde y se retira sin corromper datos. En diagnóstico con un solo master no te afecta, pero explica colisiones raras con dos controladores.' },
    { lvl: 'Avanzado', t: 'Direcciones reservadas', b: '0x00 (llamada general), 0x01-0x02 y 0x78-0x7F están reservadas. Rango útil real: 0x03-0x77. Si tu escáner marca algo en zona reservada, sospecha de ruido o de un dispositivo fuera de norma.' },
  ];

  const PATH = [
    { v: 'learn', t: '1. Aprende lo mínimo', d: 'Lee 3 lecciones básicas de abajo (I2C, ACK/NACK, direcciones). 5 minutos.' },
    { v: 'lab', t: '2. Arma un circuito virtual', d: 'Agrega 3 nodos desde la paleta y verifica que no haya alertas de cableado.' },
    { v: 'i2c', t: '3. Escanea el bus', d: 'Corre el escáner virtual y anota qué direcciones responden ACK.' },
    { v: 'signals', t: '4. Mira las señales', d: 'Captura el osciloscopio y ejecuta una transacción paso a paso.' },
    { v: 'lab', t: '5. Rompe algo a propósito', d: 'Inyecta soldadura fría o NACK aleatorio. Así se ve una falla real.' },
    { v: 'diag', t: '6. Corre estrés de 100', d: 'Ejecuta 100 pruebas y lee la salud del bus en el Dashboard.' },
    { v: 'arduino', t: '7. Compara con hardware', d: 'Si tienes Arduino, escanea el bus real y compara con la simulación.' },
    { v: 'reports', t: '8. Genera tu reporte', d: 'Exporta el HTML/PDF. Un diagnóstico sin reporte no existió.' },
  ];
  const PKEY = 'anto_learn_path_v1';
  function getPath() { try { return JSON.parse(localStorage.getItem(PKEY) || '[]'); } catch (e) { return []; } }

  // ---- Árbol de fallas ----
  const TREE = {
    n0: { q: '¿El escaneo detecta el dispositivo?', y: 'n1', n: 'n2' },
    n1: { q: '¿Su estabilidad es ≥95% en 100 pruebas?', y: 'ok', n: 'unstable' },
    n2: { q: '¿Tiene VCC correcto y GND común con el master?', y: 'n3', n: 'a_pwr' },
    n3: { q: '¿La dirección es correcta y única en el bus?', y: 'n4', n: 'a_addr' },
    n4: { q: '¿Hay pull-ups de 4.7k en SDA y SCL?', y: 'a_wire', n: 'a_pu' },
    ok: { a: 'Bus sano. Documenta la medición en la bitácora y programa la próxima revisión preventiva.' },
    unstable: { a: 'Intermitencia: revisa en orden pull-ups, GND común, conectores y soldaduras (lupa). Comportamiento compatible con conexión defectuosa: confirma físicamente.' },
    a_pwr: { a: 'Mide VCC en el pin del esclavo con multímetro y verifica GND común. Sin tierra común no hay I2C que funcione.' },
    a_addr: { a: 'Revisa jumpers del módulo y que ningún otro esclavo use la misma dirección. Corre el escáner y busca duplicados.' },
    a_pu: { a: 'Agrega una resistencia de 4.7k de SDA a VCC y otra de SCL a VCC. Sin ellas el bus flota y todo es NACK.' },
    a_wire: { a: 'Busca corto SDA/SCL a GND o VCC, cables >50 cm, o velocidad muy alta. Baja a 50-100 kHz y prueba de nuevo.' },
  };
  let treeNode = 'n0';
  function renderTree(host) {
    const n = TREE[treeNode];
    if (n.a) {
      host.innerHTML = '<div class="alert ' + (treeNode === 'ok' ? 'ok' : 'warn') + '">' + n.a + '</div>' +
        '<div class="proto-controls"><button class="btn btn-secondary" id="treeBack">Reiniciar</button></div>';
      document.getElementById('treeBack').onclick = () => { treeNode = 'n0'; renderTree(host); };
    } else {
      host.innerHTML = '<p style="font-size:14px"><b>' + n.q + '</b></p>' +
        '<div class="proto-controls"><button class="btn btn-primary" id="treeY">Sí</button><button class="btn btn-secondary" id="treeN">No</button></div>';
      document.getElementById('treeY').onclick = () => { treeNode = n.y; renderTree(host); };
      document.getElementById('treeN').onclick = () => { treeNode = n.n; renderTree(host); };
    }
  }

  // ---- Quiz ----
  const QUIZ = [
    { q: 'Un NACK significa que...', o: ['El dato llegó corrupto', 'Nadie respondió a esa dirección', 'El bus va muy rápido'], a: 1 },
    { q: 'Pull-up típico para I2C a 100 kHz', o: ['330Ω', '4.7kΩ', '1MΩ'], a: 1 },
    { q: 'Pines I2C en Arduino Uno', o: ['SDA=A4, SCL=A5', 'SDA=D0, SCL=D1', 'SDA=A0, SCL=A1'], a: 0 },
    { q: 'Rango útil de direcciones de 7 bits', o: ['0x00–0xFF', '0x03–0x77', '0x01–0x7F'], a: 1 },
    { q: 'Estabilidad 70-95% con NACK aleatorios sugiere...', o: ['Firmware desactualizado', 'Conexión defectuosa: verificar físico', 'Cambiar de microcontrolador'], a: 1 },
    { q: 'Capacitancia máxima del bus I2C', o: ['400 pF', '10 nF', 'Sin límite'], a: 0 },
  ];
  const QKEY = 'anto_quiz_best_v1';
  function renderQuiz(host) {
    let best = 0;
    try { best = +(localStorage.getItem(QKEY) || 0); } catch (e) {}
    host.innerHTML = '<p style="font-size:13px;color:var(--text-secondary)">6 preguntas de planta. Mejor puntaje: <b>' + best + '/6</b></p>' +
      QUIZ.map((q, i) => '<div class="cat-card" style="margin-top:8px"><b>' + (i + 1) + '. ' + q.q + '</b><div class="proto-controls" style="margin-top:6px">' +
        q.o.map((o, j) => '<button class="btn btn-small" data-qq="' + i + '" data-qo="' + j + '">' + o + '</button>').join('') + '</div><p class="tb-out" id="qfb' + i + '"></p></div>').join('');
    let score = 0, done = 0;
    host.querySelectorAll('[data-qq]').forEach(b => b.onclick = () => {
      const i = +b.dataset.qq, j = +b.dataset.qo;
      const fb = document.getElementById('qfb' + i);
      if (fb.dataset.ok) return;
      fb.dataset.ok = '1'; done++;
      if (j === QUIZ[i].a) { score++; fb.innerHTML = '<b style="color:var(--green)">Correcto. Bzzz.</b>'; b.style.borderColor = 'var(--green)'; }
      else { fb.innerHTML = '<b style="color:var(--red)">Casi: era "' + QUIZ[i].o[QUIZ[i].a] + '".</b>'; b.style.borderColor = 'var(--red)'; }
      if (done === QUIZ.length) {
        if (score > best) { try { localStorage.setItem(QKEY, score); } catch (e) {} best = score; }
        fb.innerHTML += '<br>Puntaje: <b>' + score + '/6</b> (mejor: ' + best + '/6).' + (score === 6 ? ' ¡Nivel abeja reina!' : score >= 4 ? ' Bien, ya hueles el bus.' : ' Repasa las lecciones y reintenta.');
      }
    });
  }

  function render(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    const done = getPath();
    const lvls = [...new Set(ARTICLES.map(a => a.lvl))];
    el.innerHTML =
      '<div class="cat-card"><h4>Ruta guiada: de cero a diagnóstico (' + done.length + '/' + PATH.length + ')</h4>' +
      PATH.map((p, i) => '<label class="chk"><input type="checkbox" data-path="' + i + '"' + (done.includes(i) ? ' checked' : '') + '> <span><b>' + p.t + '</b><br><small style="color:var(--text-muted)">' + p.d + '</small></span> <button class="btn btn-small" data-goto="' + p.v + '" style="margin-left:auto">Ir</button></label>').join('') + '</div>' +
      '<div class="cat-card" style="margin-top:10px"><h4>Árbol de fallas: mi dispositivo no aparece</h4><div id="faultTree" style="margin-top:8px"></div></div>' +
      '<div class="cat-card" style="margin-top:10px"><h4>Quiz de planta</h4><div id="quizBox" style="margin-top:4px"></div></div>' +
      '<h4 style="margin:14px 0 4px">Lecciones</h4>' +
      lvls.map(l => '<h5 style="margin:10px 0 2px;color:var(--text-muted);font-size:12px;text-transform:uppercase">' + l + '</h5>' +
        ARTICLES.filter(a => a.lvl === l).map(a => '<details class="learn-article"><summary>' + a.t + '</summary><div>' + a.b + '</div></details>').join('')).join('');
    el.querySelectorAll('[data-path]').forEach(ch => ch.onchange = () => {
      let d = getPath();
      const i = +ch.dataset.path;
      d = ch.checked ? [...new Set([...d, i])] : d.filter(x => x !== i);
      try { localStorage.setItem(PKEY, JSON.stringify(d)); } catch (e) {}
      render(elId);
    });
    el.querySelectorAll('[data-goto]').forEach(b => b.onclick = (e) => { e.preventDefault(); if (window.LabUI) LabUI.show(b.dataset.goto); });
    treeNode = 'n0';
    renderTree(document.getElementById('faultTree'));
    renderQuiz(document.getElementById('quizBox'));
  }
  return { render };
})();
