/** store.js — Estado global, historial local, salud del bus */
const Store = (() => {
  const HKEY = 'anto_history_v1';
  function loadHist() {
    try { return JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch (e) { return []; }
  }
  function save(entry) {
    const h = loadHist();
    h.unshift(Object.assign({ ts: Date.now() }, entry));
    try { localStorage.setItem(HKEY, JSON.stringify(h.slice(0, 50))); } catch (e) {}
  }
  function hist() { return loadHist(); }
  function clearHist() { localStorage.removeItem(HKEY); }
  /** Salud 0-100 desde resultados {addr:{responses,errors,...}} + iteraciones */
  function busHealth(results, iterations) {
    const devs = Object.values(results || {});
    if (!devs.length || !iterations) return { score: 0, label: 'SIN DATOS', cls: 'o' };
    let acc = 0;
    devs.forEach(d => { acc += (d.responses / iterations); });
    const score = Math.round(acc / devs.length * 100);
    let label = 'FALLO', cls = 'r';
    if (score >= 99) { label = 'EXCELENTE'; cls = 'g'; }
    else if (score >= 80) { label = 'ESTABLE'; cls = 'g'; }
    else if (score >= 60) { label = 'ADVERTENCIA'; cls = 'y'; }
    else if (score >= 30) { label = 'CRÍTICO'; cls = 'r'; }
    return { score, label, cls };
  }
  return { save, hist, clearHist, busHealth };
})();
