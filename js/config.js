// config.js — Configuración de API (sin secretos: GitHub bloquea keys en el repo)
// Pega tu key en la app: vista Config → API Key → Guardar (queda en tu navegador).
const APP_CONFIG = {
  GROQ_API_KEY: 'TU_API_KEY_AQUI',
  GROQ_MODEL: 'openai/gpt-oss-20b'
};
// Si guardaste tu key en Config, esa manda (localStorage, no se publica).
try {
  const k = localStorage.getItem('anto_groq_key');
  if (k) APP_CONFIG.GROQ_API_KEY = k;
  const m = localStorage.getItem('anto_groq_model');
  if (m) APP_CONFIG.GROQ_MODEL = m;
} catch (e) {}
