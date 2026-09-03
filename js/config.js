// config.js — Configuración de API
// 1) Ve a https://console.groq.com y genera una key NUEVA (la del repo fue revocada).
// 2) Pégala abajo entre comillas. Sin key, Antopupis responde en modo local.
// Opcional recomendado: mover la key a un Cloudflare Worker proxy y dejar esto vacío.
const APP_CONFIG = {
  GROQ_API_KEY: 'TU_API_KEY_AQUI',
  GROQ_MODEL: 'llama-3.1-8b-instant'
};
