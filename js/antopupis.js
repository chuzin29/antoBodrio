/**
 * antopupis.js — Antopupis AI Bee Assistant
 * Powered by Groq API (Llama 3)
 */
const Antopupis = (() => {
  const API_KEY = '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';
  const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
  const MODEL = 'llama3-8b-8192';

  let isOpen = false;
  let messages = [];
  let isTyping = false;

  const SYSTEM_PROMPT = 'Eres Antopupis, una abejita IA del juego Minecraft que ayuda con electronica e I2C. Hablas en espanol, eres divertida pero experta. Usas bzzz a veces. Maximo 100 palabras.';

  function init() {
    createWidget();
    messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  }

  function createWidget() {
    var widget = document.createElement('div');
    widget.id = 'antopupis-widget';
    widget.innerHTML = '<div class="bee-chat-toggle" id="beeToggle" onclick="Antopupis.toggle()">' +
      '<svg width="32" height="32" viewBox="0 0 32 32" fill="none"><ellipse cx="16" cy="17" rx="8" ry="7" fill="#F5C518" stroke="#8B6914" stroke-width="1.5"/><rect x="12" y="15" width="8" height="2" rx="1" fill="#1a1a1a"/><rect x="12" y="19" width="8" height="2" rx="1" fill="#1a1a1a"/><circle cx="10" cy="13" r="4" fill="rgba(200,220,255,0.6)" stroke="rgba(150,180,220,0.5)" stroke-width="0.5"><animateTransform attributeName="transform" type="rotate" from="-15 10 17" to="15 10 17" dur="0.15s" repeatCount="indefinite" values="-15 10 17;15 10 17" keyTimes="0;1"/></circle><circle cx="22" cy="13" r="4" fill="rgba(200,220,255,0.6)" stroke="rgba(150,180,220,0.5)" stroke-width="0.5"><animateTransform attributeName="transform" type="rotate" from="15 22 17" to="-15 22 17" dur="0.15s" repeatCount="indefinite" values="15 22 17;-15 22 17" keyTimes="0;1"/></circle><circle cx="8" cy="15" r="2" fill="#F5C518" stroke="#8B6914" stroke-width="1"/></svg>' +
      '</div>' +
      '<div class="bee-chat-window" id="beeChatWindow">' +
      '<div class="bee-chat-header">' +
      '<div class="bee-chat-header-info">' +
      '<div class="bee-header-avatar"><svg width="28" height="28" viewBox="0 0 32 32" fill="none"><ellipse cx="16" cy="17" rx="8" ry="7" fill="#F5C518" stroke="#8B6914" stroke-width="1.5"/><rect x="12" y="15" width="8" height="2" rx="1" fill="#1a1a1a"/><rect x="12" y="19" width="8" height="2" rx="1" fill="#1a1a1a"/><circle cx="8" cy="15" r="2" fill="#F5C518" stroke="#8B6914" stroke-width="1"/></svg></div>' +
      '<div><div class="bee-chat-name">Antopupis</div><div class="bee-chat-status">IA disponible 24/7</div></div>' +
      '</div>' +
      '<button class="bee-chat-close" onclick="Antopupis.toggle()"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>' +
      '</div>' +
      '<div class="bee-chat-messages" id="beeMessages">' +
      '<div class="bee-msg bot"><div class="bee-msg-avatar"><svg width="20" height="20" viewBox="0 0 32 32" fill="none"><ellipse cx="16" cy="17" rx="8" ry="7" fill="#F5C518" stroke="#8B6914" stroke-width="1.5"/></svg></div><div class="bee-msg-text">Hola! Soy Antopupis, tu abejita IA. Puedo ayudarte con diagnostico I2C, electronica, soldadura fria y mas. Preguntame lo que quieras!</div></div>' +
      '</div>' +
      '<div class="bee-chat-input-area">' +
      '<input type="text" id="beeInput" placeholder="Escribe tu pregunta...">' +
      '<button class="bee-send-btn" id="beeSendBtn"><svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(widget);

    document.getElementById('beeInput').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') Antopupis.send();
    });
    document.getElementById('beeSendBtn').addEventListener('click', function() {
      Antopupis.send();
    });
  }

  function toggle() {
    isOpen = !isOpen;
    var win = document.getElementById('beeChatWindow');
    var tog = document.getElementById('beeToggle');
    if (isOpen) {
      win.classList.add('open');
      tog.classList.add('active');
      document.getElementById('beeInput').focus();
    } else {
      win.classList.remove('open');
      tog.classList.remove('active');
    }
  }

  async function send() {
    var input = document.getElementById('beeInput');
    var text = input.value.trim();
    if (!text || isTyping) return;

    input.value = '';
    addMessage(text, 'user');

    isTyping = true;
    document.getElementById('beeSendBtn').classList.add('typing');
    addTypingIndicator();

    try {
      messages.push({ role: 'user', content: text });

      var body = JSON.stringify({
        model: MODEL,
        messages: messages,
        max_tokens: 512,
        temperature: 0.7
      });

      var response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + API_KEY
        },
        body: body
      });

      removeTypingIndicator();

      if (!response.ok) {
        var errText = '';
        try { errText = await response.text(); } catch(e) {}
        console.error('Groq API:', response.status, errText);
        if (response.status === 401) {
          addMessage('Error de autenticacion. La API key puede estar invalida. Ve a console.groq.com para generar una nueva.', 'bot');
        } else if (response.status === 400) {
          addMessage('Error en la solicitud. Intenta con otra pregunta.', 'bot');
        } else {
          addMessage('Error ' + response.status + '. Intenta de nuevo.', 'bot');
        }
        return;
      }

      var data = await response.json();
      var reply = (data.choices && data.choices[0] && data.choices[0].message)
        ? data.choices[0].message.content
        : 'No pude generar una respuesta.';

      messages.push({ role: 'assistant', content: reply });
      addMessage(reply, 'bot');

    } catch (error) {
      removeTypingIndicator();
      console.error('Antopupis:', error);
      addMessage('Error de conexion: ' + error.message, 'bot');
    }

    isTyping = false;
    document.getElementById('beeSendBtn').classList.remove('typing');
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
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  document.addEventListener('DOMContentLoaded', init);

  return { toggle: toggle, send: send };
})();
