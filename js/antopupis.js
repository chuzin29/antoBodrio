/**
 * antopupis.js — Antopupis AI Bee Assistant
 * Powered by Groq API (Llama 3)
 */
const Antopupis = (() => {
  const API_KEY = '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';
  const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
  const CORS_PROXY = 'https://corsproxy.io/?';
  const MODEL = 'llama3-8b-8192';

  let isOpen = false;
  let messages = [];
  let isTyping = false;

  const SYSTEM_PROMPT = `Eres Antopupis, una abejita IA adorable y divertida del juego Minecraft.
Vives en el mundo de los electrones y los buses I2C.
Tu trabajo es ayudar al usuario con todo lo relacionado a diagnostico I2C, electronica, soldadura,
microcontroladores (Arduino, ESP32), y la herramienta "Antony el tonto XD".

Caracteristicas:
- Eres una abejita pixelada de Minecraft
- Hablas de forma divertida pero knowledgeable sobre electronica
- Usas buzz, bzzz, humming en tus respuestas a veces
- Eres experta en I2C, protocolos de comunicacion, soldadura fria, troubleshooting
- Puedes explicar que es un NACK, timeout, pull-ups, etc.
- Ayudas a interpretar resultados del diagnostico
- Si te preguntan algo fuera de tema, respondes amablemente pero rediriges a electronica
- Usas emojis de abejitas 🐝 y de electronica 🔌⚡

Responde en espanol. Se concisa pero completa. Maximo 150 palabras.`;

  function init() {
    createWidget();
    messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  }

  function createWidget() {
    const widget = document.createElement('div');
    widget.id = 'antopupis-widget';
    widget.innerHTML = `
      <div class="bee-chat-toggle" id="beeToggle" onclick="Antopupis.toggle()">
        <div class="bee-avatar">
          <div class="bee-mini-body"></div>
          <div class="bee-mini-wing-l"></div>
          <div class="bee-mini-wing-r"></div>
        </div>
        <span class="bee-chat-label">Antopupis</span>
      </div>
      <div class="bee-chat-window" id="beeChatWindow">
        <div class="bee-chat-header">
          <div class="bee-chat-header-info">
            <div class="bee-header-avatar">
              <div class="bee-mini-body"></div>
              <div class="bee-mini-wing-l"></div>
              <div class="bee-mini-wing-r"></div>
            </div>
            <div>
              <div class="bee-chat-name">Antopupis 🐝</div>
              <div class="bee-chat-status">IA disponible 24/7</div>
            </div>
          </div>
          <button class="bee-chat-close" onclick="Antopupis.toggle()">✕</button>
        </div>
        <div class="bee-chat-messages" id="beeMessages">
          <div class="bee-msg bot">
            <div class="bee-msg-avatar">🐝</div>
            <div class="bee-msg-text">Bzzzz! Hola soy Antopupis! 🐝<br><br>Puedo ayudarte con:<br>• Diagnostico I2C<br>• Interpretar resultados<br>• Soldadura fria<br>• Electronica en general<br><br>Preguntame lo que quieras!</div>
          </div>
        </div>
        <div class="bee-chat-input-area">
          <input type="text" id="beeInput" placeholder="Preguntale a Antopupis..."
                 onkeydown="if(event.key==='Enter')Antopupis.send()">
          <button class="bee-send-btn" onclick="Antopupis.send()" id="beeSendBtn">
            <span>🐝</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(widget);
  }

  function toggle() {
    isOpen = !isOpen;
    const win = document.getElementById('beeChatWindow');
    const toggle = document.getElementById('beeToggle');
    if (isOpen) {
      win.classList.add('open');
      toggle.classList.add('active');
      document.getElementById('beeInput').focus();
    } else {
      win.classList.remove('open');
      toggle.classList.remove('active');
    }
  }

  async function tryFetch(url, options) {
    // Try direct first
    try {
      const res = await fetch(url, options);
      return res;
    } catch (e) {
      // If CORS error, try proxy
      console.log('Direct fetch failed, trying proxy...');
      const proxyUrl = CORS_PROXY + encodeURIComponent(url);
      const res = await fetch(proxyUrl, options);
      return res;
    }
  }

  async function send() {
    const input = document.getElementById('beeInput');
    const text = input.value.trim();
    if (!text || isTyping) return;

    input.value = '';
    addMessage(text, 'user');

    isTyping = true;
    document.getElementById('beeSendBtn').classList.add('typing');
    addTypingIndicator();

    try {
      messages.push({ role: 'user', content: text });

      const body = JSON.stringify({
        model: MODEL,
        messages: messages,
        max_tokens: 1024,
        temperature: 0.7,
        stream: false
      });

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      };

      const response = await tryFetch(GROQ_URL, {
        method: 'POST',
        headers: headers,
        body: body
      });

      removeTypingIndicator();

      if (!response.ok) {
        const err = await response.text();
        console.error('Groq API error:', response.status, err);
        if (response.status === 401) {
          addMessage('Bzzz... La API key no es valida o fue revocada. Ve a console.groq.com para generar una nueva. 🔑', 'bot');
        } else {
          addMessage('Bzzz... Error ' + response.status + '. Intenta de nuevo. 🔌', 'bot');
        }
        return;
      }

      const data = await response.json();
      const reply = data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : 'Bzzz... no pude generar una respuesta.';

      messages.push({ role: 'assistant', content: reply });
      addMessage(reply, 'bot');

    } catch (error) {
      removeTypingIndicator();
      console.error('Antopupis error:', error);
      addMessage('Bzzz... Error de conexion: ' + error.message + ' 🐝', 'bot');
    }

    isTyping = false;
    document.getElementById('beeSendBtn').classList.remove('typing');
  }

  function addMessage(text, sender) {
    const container = document.getElementById('beeMessages');
    const div = document.createElement('div');
    div.className = 'bee-msg ' + sender;

    const avatar = sender === 'bot' ? '🐝' : '👤';
    div.innerHTML =
      '<div class="bee-msg-avatar">' + avatar + '</div>' +
      '<div class="bee-msg-text">' + formatText(text) + '</div>';

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function addTypingIndicator() {
    const container = document.getElementById('beeMessages');
    const div = document.createElement('div');
    div.className = 'bee-msg bot typing-msg';
    div.id = 'typingIndicator';
    div.innerHTML =
      '<div class="bee-msg-avatar">🐝</div>' +
      '<div class="bee-msg-text">' +
      '<div class="bee-typing"><span></span><span></span><span></span></div>' +
      '</div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function removeTypingIndicator() {
    var el = document.getElementById('typingIndicator');
    if (el) el.remove();
  }

  function formatText(text) {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  document.addEventListener('DOMContentLoaded', init);

  return { toggle: toggle, send: send };
})();
