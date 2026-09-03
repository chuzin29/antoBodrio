/**
 * antopupis.js — Antopupis AI Bee Assistant
 * Estrategia: Groq directo (key propia en config.js) -> proxy AllOrigins -> fallback local.
 * Sin key hardcodeada. Modelo actualizado.
 */
const Antopupis = (() => {
  const MODEL = (window.APP_CONFIG && window.APP_CONFIG.GROQ_MODEL) || 'openai/gpt-oss-20b';
  const LEGACY_MODEL = 'llama3-8b-8192';
  const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

  let isOpen = false;
  let messages = [];
  let isTyping = false;
  let cloudOk = false;

  const SYSTEM_PROMPT = 'Eres Antopupis, una abejita técnica con sentido del humor que trabaja en mantenimiento industrial. Hablas español, haces chistes cortos de abejas y electrónica (bzzz, "esto tiene más ruido que..."), pero cuando hay datos de falla hablas en serio como ingeniera: causas probables en orden, qué medir y con qué instrumento. Máximo 130 palabras. Si te piden simular algo (escenarios, fallas, estrés), el sistema ejecuta la acción y tú confirmas con humor qué hiciste y qué salió.';

  /* ---------- Fallback local por keywords ---------- */
  const KB = [
    { k: ['nack'], t: 'Bzzz... El <strong>NACK</strong> significa que ningun dispositivo respondio a esa direccion. Causas tipicas: direccion incorrecta, dispositivo sin alimentacion, SDA/SCL invertidos o pull-ups faltantes. Verifica con escaneo y revisa que la direccion este entre 0x03 y 0x77.' },
    { k: ['soldadura', 'fria', 'fria', 'cold'], t: 'Bzzz... La <strong>soldadura fria</strong> se ve como intermitencia: el dispositivo aparece y desaparece, con NACK y timeouts aleatorios. Ojo: el software solo sugiere el sintoma, la confirmacion es visual/fisica (lupa, repasar con flux y calor). Si tu prueba muestra estabilidad 70-95%, es sospechoso.' },
    { k: ['pull-up', 'pullup', 'pull up', 'resistencia'], t: 'Bzzz... I2C necesita <strong>pull-ups</strong> en SDA y SCL (tipico 4.7k a VCC). Sin ellas el bus flota y hay NACK/timeouts. Si tu modulo no las trae, agrega una por linea. Con cables largos (>20cm) baja a 2.2k.' },
    { k: ['sda', 'scl'], t: 'Bzzz... <strong>SDA</strong> = datos, <strong>SCL</strong> = reloj. Ambas en open-drain con pull-up. Revisa continuidad, que no esten cruzadas ni en corto a GND/VCC. En Arduino Uno: SDA=A4, SCL=A5. En ESP32: SDA=GPIO21, SCL=GPIO22.' },
    { k: ['direccion', 'direcci', 'address', '0x'], t: 'Bzzz... Cada esclavo I2C tiene direccion de 7 bits (0x03-0x77). Las reservadas 0x00-0x02 y 0x78-0x7F no se usan. Si dos dispositivos comparten direccion hay colision: cambia jumpers (ej. PCF8574) o usa multiplexor TCA9548A.' },
    { k: ['timeout'], t: 'Bzzz... El <strong>timeout</strong> es que el esclavo no responde a tiempo. Suele ser cable largo, bus a velocidad muy alta, esclavo colgado o alimentacion debil. Baja a 50-100kHz y prueba de nuevo.' },
    { k: ['velocidad', 'frecuencia', 'khz', 'baud'], t: 'Bzzz... I2C estandar: 100kHz, rapido: 400kHz. Para diagnostico usa 100kHz: es mas tolerante a cables malos. Sube a 400kHz solo con bus corto y pull-ups correctos.' },
    { k: ['demo', 'simula'], t: 'Bzzz... El <strong>Modo Demo</strong> simula dispositivos sin hardware. Elige direcciones en el selector, activa "Soldadura fria" o "Intermitencia" para ver como se ve una falla, y corre la prueba de estabilidad.' },
    { k: ['conectar', 'arduino', 'esp32', 'hardware', 'serial'], t: 'Bzzz... Para hardware real: carga <code>firmware/i2c_bridge.ino</code> en tu Arduino/ESP32, conecta SDA/SCL/GND (+VCC), luego pulsa Conectar (solo Chrome/Edge por Web Serial). El bridge responde a SCAN y PROBE.' },
    { k: ['hola', 'buenas', 'hey'], t: 'Bzzz... Hola! Soy Antopupis, tu abejita de diagnostico. Preguntame por NACK, soldadura fria, pull-ups, direcciones o como conectar tu Arduino.' },
    { k: ['gracias'], t: 'Bzzz... De nada! Que tu bus siempre tenga ACK y tus paros sean solo los programados. Si ves algo raro, corre 100 pruebas y mira la estabilidad.' },
    { k: ['quien eres', 'quién eres', 'tu nombre', 'presentate', 'preséntate'], t: 'Bzzz... Soy <strong>Antopupis</strong>, abejita de mantenimiento industrial: mitad técnica, mitad comediante. Puedo explicarte I2C, diagnosticar tus dispositivos con datos reales y hasta <strong>ejecutar simulaciones</strong> si me lo pides: prueba "simula soldadura fría en 0x68" o "corre estrés de 100".' },
    { k: ['chiste', 'cuentame algo', 'cuéntame algo', 'hazme reir', 'hazme reír'], t: 'Bzzz... Va uno: ¿por qué el esclavo I2C no fue a la fiesta? Porque le hicieron NACK en la puerta. ...Está bien, sigo con la electrónica, la comedia la dejo para el bus.' },
    { k: ['ayuda', 'comandos', 'que puedes hacer', 'qué puedes hacer', 'que sabes hacer'], t: 'Bzzz... Puedo: 1) <strong>Diagnosticar</strong> ("¿qué está fallando?", "¿por qué falla el 0x68?"). 2) <strong>Simular</strong> ("carga el escenario caos", "inyecta NACK aleatorio", "corre estrés de 500"). 3) <strong>Navegar</strong> ("abre el osciloscopio", "ve al 3D"). 4) <strong>Enseñar</strong> (NACK, pull-ups, soldadura fría...).' },
    { k: ['disponibilidad', 'oee', 'salud del bus', 'salud'], t: 'Bzzz... La <strong>salud del bus</strong> es como el OEE de tu línea: % de respuestas buenas. 99-100% excelente, 80-98% estable, 60-79% advertencia (programa mantenimiento), menos de 60% crítico (paro no programado en camino). La ves en el Dashboard tras un estrés.' },
    { k: ['mantenimiento', 'preventivo', 'paro', 'falla industrial'], t: 'Bzzz... Regla de planta: si la estabilidad cae bajo 95%, no esperes al paro correctivo. Revisa pull-ups, GND común, conectores y soldaduras. Y documenta todo en Reportes: un técnico con historial vale por dos.' },
    { k: ['multimetro', 'multímetro', 'medir', 'osciloscopio', 'con que mido', 'con qué mido'], t: 'Bzzz... Para I2C: <strong>multímetro</strong> (VCC, continuidad de SDA/SCL/GND, cortos) y si puedes, el <strong>osciloscopio virtual</strong> de la vista Señales para ver la forma de onda. SDA/SCL en reposo deben estar en VCC (pull-ups); si flotan a la mitad, ahí está tu fantasma.' },
  ];
  function localReply(q) {
    const s = q.toLowerCase();
    for (const e of KB) {
      if (e.k.some(k => s.includes(k))) return e.t + '<br><br><small style="opacity:.65">Respuesta local (sin nube) bzzz.</small>';
    }
    return 'Bzzz... Puedo ayudarte con <strong>NACK</strong>, <strong>timeouts</strong>, <strong>soldadura fria</strong>, <strong>pull-ups</strong>, <strong>direcciones</strong>, <strong>SDA/SCL</strong> o <strong>conexion Arduino/ESP32</strong>. Preguntame algo de eso!<br><br><small style="opacity:.65">Respuesta local (sin nube) bzzz.</small>';
  }

  function getKey() {
    const k = window.APP_CONFIG && window.APP_CONFIG.GROQ_API_KEY;
    if (!k || k === 'TU_API_KEY_AQUI' || k.length < 20) return null;
    return k;
  }

  function init() {
    createWidget();
    messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    updateModeBadge();
    if (!getKey()) {
      setTimeout(() => addMessage(
        'Bzzz... Para que responda con inteligencia real (nube Groq) pega tu API key aquí abajo y pulsa Guardar. Es de un solo toque y queda en tu navegador.' +
        '<div style="display:flex;gap:6px;margin-top:8px"><input type="text" id="beeKeyInput" placeholder="gsk_..." style="flex:1;min-width:0;background:var(--bg-secondary);border:1px solid var(--border);color:var(--text-primary);border-radius:8px;padding:7px 9px;font-size:12px">' +
        '<button onclick="Antopupis.saveKey()" style="background:linear-gradient(135deg,#3b82f6,#6366f1);border:0;color:#fff;border-radius:8px;padding:7px 12px;font-size:12px;cursor:pointer">Guardar</button></div>' +
        '<small style="opacity:.65">Sin key igual te ayudo en modo local con datos del laboratorio.</small>', 'bot'), 800);
    }
  }

  async function saveKey() {
    const inp = document.getElementById('beeKeyInput');
    if (!inp) return;
    const v = inp.value.trim();
    if (!v) { addMessage('Bzzz... Pégame una key que empiece con gsk_ y la probamos.', 'bot'); return; }
    addTypingIndicator();
    try {
      const r = await fetch(GROQ_URL.replace('/chat/completions', '/models'), { headers: { 'Authorization': 'Bearer ' + v } });
      removeTypingIndicator();
      if (!r.ok) { addMessage('Bzzz... Esa key no pasó la prueba (error ' + r.status + '). Revísala en console.groq.com y prueba de nuevo.', 'bot'); return; }
      try {
        localStorage.setItem('anto_groq_key', v);
        localStorage.setItem('anto_groq_model', MODEL);
      } catch (e) {}
      if (window.APP_CONFIG) window.APP_CONFIG.GROQ_API_KEY = v;
      cloudOk = true; updateModeBadge();
      addMessage('Bzzz... ¡Key verificada y guardada! Ya estoy conectada a la nube. Pregúntame lo que sea, con chiste incluido.', 'bot');
    } catch (e) {
      removeTypingIndicator();
      addMessage('Bzzz... No pude verificarla por red (' + e.message + '). La guardo igual y la probamos al hablar: ' + (function(){ try { localStorage.setItem("anto_groq_key", v); if (window.APP_CONFIG) window.APP_CONFIG.GROQ_API_KEY = v; return 'guardada.'; } catch(x){ return 'pero no pude guardarla.'; } })(), 'bot');
      updateModeBadge();
    }
  }

  function updateModeBadge() {
    const el = document.getElementById('beeMode');
    if (!el) return;
    el.textContent = cloudOk ? 'nube' : 'local';
    el.className = 'bee-mode ' + (cloudOk ? 'cloud' : 'local');
    el.title = cloudOk ? 'Conectada a Groq' : 'Respuestas locales sin API key';
  }

  function createWidget() {
    if (document.getElementById('antopupis-widget')) return;
    var widget = document.createElement('div');
    widget.id = 'antopupis-widget';
    widget.innerHTML =
      '<div class="bee-chat-toggle" id="beeToggle" role="button" tabindex="0" aria-label="Abrir chat Antopupis">' +
      '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><ellipse cx="16" cy="17" rx="8" ry="7" fill="#F5C518" stroke="#8B6914" stroke-width="1.5"/><rect x="12" y="15" width="8" height="2" rx="1" fill="#1a1a1a"/><rect x="12" y="19" width="8" height="2" rx="1" fill="#1a1a1a"/><circle cx="10" cy="13" r="4" fill="rgba(200,220,255,0.6)"/><circle cx="22" cy="13" r="4" fill="rgba(200,220,255,0.6)"/><circle cx="8" cy="15" r="2" fill="#F5C518" stroke="#8B6914" stroke-width="1"/></svg>' +
      '</div>' +
      '<div class="bee-chat-window" id="beeChatWindow" role="dialog" aria-label="Chat Antopupis">' +
      '<div class="bee-chat-header"><div class="bee-chat-header-info">' +
      '<div class="bee-header-avatar"><svg width="28" height="28" viewBox="0 0 32 32" fill="none"><ellipse cx="16" cy="17" rx="8" ry="7" fill="#F5C518" stroke="#8B6914" stroke-width="1.5"/><rect x="12" y="15" width="8" height="2" rx="1" fill="#1a1a1a"/><rect x="12" y="19" width="8" height="2" rx="1" fill="#1a1a1a"/></svg></div>' +
      '<div><div class="bee-chat-name">Antopupis <span class="bee-mode local" id="beeMode">local</span></div><div class="bee-chat-status">IA disponible 24/7</div></div>' +
      '</div><button class="bee-chat-close" aria-label="Cerrar chat"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button></div>' +
      '<div class="bee-chat-messages" id="beeMessages"><div class="bee-msg bot"><div class="bee-msg-avatar"><svg width="20" height="20" viewBox="0 0 32 32" fill="none"><ellipse cx="16" cy="17" rx="8" ry="7" fill="#F5C518" stroke="#8B6914" stroke-width="1.5"/></svg></div>' +
      '<div class="bee-msg-text">Hola! Soy Antopupis, tu abejita IA. Preguntame de I2C, NACK, soldadura fria y mas.<div class="bee-suggest"><button data-q="Que es un NACK?">Que es NACK?</button><button data-q="Como conecto mi Arduino?">Conectar Arduino</button><button data-q="Que es soldadura fria?">Soldadura fria</button></div></div></div></div>' +
      '<div class="bee-chat-input-area"><input type="text" id="beeInput" placeholder="Escribe tu pregunta..." autocomplete="off"><button class="bee-send-btn" id="beeSendBtn" aria-label="Enviar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></button></div>' +
      '</div>';
    document.body.appendChild(widget);
    const tog = document.getElementById('beeToggle');
    tog.addEventListener('click', toggle);
    tog.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') toggle(); });
    widget.querySelector('.bee-chat-close').addEventListener('click', toggle);
    document.getElementById('beeInput').addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
    document.getElementById('beeSendBtn').addEventListener('click', send);
    widget.querySelectorAll('.bee-suggest button').forEach(b => {
      b.addEventListener('click', () => { document.getElementById('beeInput').value = b.dataset.q; send(); });
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen) toggle(); });
  }

  function toggle() {
    isOpen = !isOpen;
    var win = document.getElementById('beeChatWindow');
    var tog = document.getElementById('beeToggle');
    win.classList.toggle('open', isOpen);
    tog.classList.toggle('active', isOpen);
    if (isOpen) setTimeout(() => document.getElementById('beeInput').focus(), 120);
  }

  function pickContent(data) {
    try {
      const c = data.choices[0].message.content;
      return (c && c.trim()) ? c : null; // gpt-oss a veces devuelve razonamiento sin texto
    } catch (e) { return null; }
  }

  async function tryGroq(key, model, body) {
    const post = (url) => fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body
    });
    // 1) proxy primero: funciona desde el navegador aunque Groq no envíe CORS
    try {
      const r = await post('https://api.allorigins.win/raw?url=' + encodeURIComponent(GROQ_URL));
      if (r.ok) { const d = await r.json(); if (pickContent(d)) return d; }
      console.warn('Proxy:', r.status);
    } catch (e) { console.warn('Proxy fallo:', e.message); }
    // 2) directo
    try {
      const r = await post(GROQ_URL);
      if (r.ok) { const d = await r.json(); if (pickContent(d)) return d; }
      console.warn('Groq directo:', r.status);
    } catch (e) { console.warn('Groq directo fallo (CORS/red):', e.message); }
    // 3) Pollinations (proxy abierto, mismo formato OpenAI)
    try {
      const r = await post('https://text.pollinations.ai/openai');
      if (r.ok) { const d = await r.json(); if (pickContent(d)) return d; }
      console.warn('Pollinations:', r.status);
    } catch (e) { console.warn('Pollinations fallo:', e.message); }
    return null;
  }

  async function send() {
    var input = document.getElementById('beeInput');
    var text = input.value.trim();
    if (!text || isTyping) return;
    input.value = '';
    addMessage(text, 'user');
    // quita sugerencias tras primer mensaje
    const sug = document.querySelector('.bee-suggest');
    if (sug) sug.remove();

    // Técnico del laboratorio: con nube, solo ejecuta comandos; sin nube, también diagnostica con datos
    if (window.LabTech) {
      try {
        const tech = window.LabTech(text, !!getKey());
        if (tech) {
          addTypingIndicator();
          setTimeout(() => {
            removeTypingIndicator();
            messages.push({ role: 'user', content: text });
            messages.push({ role: 'assistant', content: tech.replace(/<[^>]+>/g, '') });
            addMessage(tech, 'bot');
          }, 350);
          return;
        }
      } catch (e) {}
    }

    isTyping = true;
    addTypingIndicator();
    messages.push({ role: 'user', content: text });

    const key = getKey();
    let reply = null;
    if (key) {
      let ctxMsgs = messages.slice(-8);
      try {
        if (window.LabContext) {
          const ctx = window.LabContext();
          if (ctx) ctxMsgs = [{ role: 'system', content: 'Datos del laboratorio para diagnosticar:\n' + ctx }, ...ctxMsgs];
        }
      } catch (e) {}
      const body = JSON.stringify({ model: MODEL, messages: ctxMsgs, max_tokens: 600, temperature: 0.7, reasoning_effort: 'low' });
      const t = setTimeout(() => {}, 12000);
      try {
        // Garantiza respuesta: si la nube tarda >15s, cae al modo local
        const data = await Promise.race([
          tryGroq(key, MODEL, body),
          new Promise(res => setTimeout(() => res(null), 15000))
        ]);
        if (data && data.choices && data.choices[0] && data.choices[0].message) {
          reply = data.choices[0].message.content;
          if (!cloudOk) { cloudOk = true; updateModeBadge(); }
        }
      } catch (e) { console.warn(e); }
      clearTimeout(t);
    }
    if (!reply) {
      reply = localReply(text);
      if (!key && messages.filter(m => m.role === 'user').length <= 1) {
        reply += '<br><br><small style="opacity:.65">Estoy en modo local. Para la nube con humor completo: vista Config → pega tu key de Groq → Guardar. Bzzz.</small>';
      }
    }

    removeTypingIndicator();
    messages.push({ role: 'assistant', content: reply.replace(/<[^>]+>/g, '') });
    if (messages.length > 12) messages = [messages[0]].concat(messages.slice(-11));
    addMessage(reply, 'bot');
    isTyping = false;
  }

  function addMessage(text, sender) {
    var container = document.getElementById('beeMessages');
    var div = document.createElement('div');
    div.className = 'bee-msg ' + sender;
    var avatar = sender === 'bot'
      ? '<svg width="20" height="20" viewBox="0 0 32 32" fill="none"><ellipse cx="16" cy="17" rx="8" ry="7" fill="#F5C518" stroke="#8B6914" stroke-width="1.5"/><rect x="12" y="15" width="8" height="2" rx="1" fill="#1a1a1a"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="#8b95a8" stroke-width="2"/><path d="M4 20c0-4 4-7 8-7s8 3 8 7" stroke="#8b95a8" stroke-width="2" stroke-linecap="round"/></svg>';
    div.innerHTML = '<div class="bee-msg-avatar">' + avatar + '</div><div class="bee-msg-text">' + formatText(text) + '</div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function addTypingIndicator() {
    var container = document.getElementById('beeMessages');
    var div = document.createElement('div');
    div.className = 'bee-msg bot typing-msg';
    div.id = 'typingIndicator';
    div.innerHTML = '<div class="bee-msg-avatar"><svg width="20" height="20" viewBox="0 0 32 32" fill="none"><ellipse cx="16" cy="17" rx="8" ry="7" fill="#F5C518" stroke="#8B6914" stroke-width="1.5"/></svg></div><div class="bee-msg-text"><div class="bee-typing"><span></span><span></span><span></span></div></div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }
  function removeTypingIndicator() {
    var el = document.getElementById('typingIndicator');
    if (el) el.remove();
  }
  function formatText(text) {
    if (/<(strong|em|code|br|small|div)/.test(text)) return text; // ya es HTML local
    return text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  // Arranque blindado: si DOMContentLoaded ya pasó o el widget no quedó, reintenta
  if (document.readyState !== 'loading') { try { init(); } catch (e) { console.warn(e); } }
  else document.addEventListener('DOMContentLoaded', init);
  setTimeout(() => { if (!document.getElementById('antopupis-widget')) { try { init(); } catch (e) { console.warn(e); } } }, 2500);
  return { toggle, send, saveKey, ensure: init };
})();
