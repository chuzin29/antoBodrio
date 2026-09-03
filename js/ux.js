/**
 * ux.js — Mejoras premium: reveal on scroll, canvas bg, ripple,
 * theme toggle, sonidos WebAudio, tilt 3D, dashboard Chart.js
 * Sin dependencias. Respeta prefers-reduced-motion.
 */
const UX = (() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let soundOn = JSON.parse(localStorage.getItem('anto_sound') || 'false');
  let chartRefs = [];

  function init() {
    initTheme();
    initReveal();
    initRipple();
    initCanvas();
    initTilt();
    initSoundBtn();
    staggerCells();
  }

  /* ---------- Theme ---------- */
  function initTheme() {
    const saved = localStorage.getItem('anto_theme') || 'dark';
    document.documentElement.dataset.theme = saved;
    const btn = document.getElementById('btnTheme');
    if (btn) btn.classList.toggle('active', saved === 'light');
  }
  function toggleTheme() {
    const cur = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = cur;
    localStorage.setItem('anto_theme', cur);
    const btn = document.getElementById('btnTheme');
    if (btn) btn.classList.toggle('active', cur === 'light');
  }

  /* ---------- Reveal on scroll ---------- */
  let observer = null;
  function initReveal() {
    const cards = document.querySelectorAll('main .card');
    cards.forEach((c, i) => {
      c.classList.add('reveal', 'reveal-d' + ((i % 4) + 1));
    });
    if (reduceMotion || !('IntersectionObserver' in window)) {
      cards.forEach(c => c.classList.add('visible'));
      return;
    }
    observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
      });
    }, { threshold: 0.08 });
    cards.forEach(c => observer.observe(c));
  }
  function refreshReveal() {
    document.querySelectorAll('.reveal:not(.visible)').forEach(el => {
      if (observer) observer.observe(el); else el.classList.add('visible');
    });
  }

  /* ---------- Ripple ---------- */
  function initRipple() {
    document.addEventListener('click', e => {
      const btn = e.target.closest('.btn');
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const s = Math.max(rect.width, rect.height);
      const r = document.createElement('span');
      r.className = 'ripple';
      r.style.width = r.style.height = s + 'px';
      r.style.left = (e.clientX - rect.left - s / 2) + 'px';
      r.style.top = (e.clientY - rect.top - s / 2) + 'px';
      btn.appendChild(r);
      setTimeout(() => r.remove(), 600);
    });
  }

  /* ---------- Canvas fondo ligero ---------- */
  function initCanvas() {
    if (reduceMotion) return;
    let cv = document.getElementById('bgCanvas');
    if (!cv) {
      cv = document.createElement('canvas');
      cv.id = 'bgCanvas';
      document.body.prepend(cv);
    }
    const ctx = cv.getContext('2d');
    let W, H, pts = [];
    const N = window.innerWidth < 720 ? 28 : 55;
    function resize() {
      W = cv.width = window.innerWidth;
      H = cv.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);
    for (let i = 0; i < N; i++) {
      pts.push({ x: Math.random() * 2000, y: Math.random() * 1200, vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25, r: 1 + Math.random() * 1.8 });
    }
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3b82f6';
    (function frame() {
      if (document.hidden) { requestAnimationFrame(frame); return; }
      ctx.clearRect(0, 0, W, H);
      const sx = W / 2000, sy = H / 1200, s = Math.max(sx, sy);
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > 2000) p.vx *= -1;
        if (p.y < 0 || p.y > 1200) p.vy *= -1;
      });
      ctx.strokeStyle = 'rgba(59,130,246,0.10)';
      ctx.lineWidth = 1;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          if (dx * dx + dy * dy < 220 * 220) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x * s, pts[i].y * s);
            ctx.lineTo(pts[j].x * s, pts[j].y * s);
            ctx.stroke();
          }
        }
      }
      ctx.fillStyle = accent;
      pts.forEach(p => { ctx.globalAlpha = .5; ctx.beginPath(); ctx.arc(p.x * s, p.y * s, p.r, 0, 7); ctx.fill(); });
      ctx.globalAlpha = 1;
      requestAnimationFrame(frame);
    })();
  }

  /* ---------- Tilt 3D ---------- */
  function initTilt() {
    const scene = document.getElementById('bus3dScene');
    if (!scene || reduceMotion) return;
    const inner = scene.querySelector('.bus3d-container');
    if (!inner) return;
    scene.addEventListener('mousemove', e => {
      const r = scene.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - .5;
      const y = (e.clientY - r.top) / r.height - .5;
      inner.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
    });
    scene.addEventListener('mouseleave', () => { inner.style.transform = 'rotateY(0) rotateX(0)'; });
  }

  /* ---------- Sonidos ---------- */
  let audioCtx = null;
  function beep(freq, dur, type) {
    if (!soundOn) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq || 660;
      g.gain.setValueAtTime(0.08, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (dur || .12));
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + (dur || .12));
    } catch (e) {}
  }
  function initSoundBtn() {
    const btn = document.getElementById('btnSound');
    if (btn) btn.classList.toggle('active', soundOn);
  }
  function toggleSound() {
    soundOn = !soundOn;
    localStorage.setItem('anto_sound', JSON.stringify(soundOn));
    const btn = document.getElementById('btnSound');
    if (btn) btn.classList.toggle('active', soundOn);
    beep(660, .1);
  }
  const sfx = {
    scan: () => beep(520, .09),
    found: () => { beep(660, .09); setTimeout(() => beep(880, .12), 100); },
    error: () => beep(220, .2, 'sawtooth'),
    done: () => { beep(620, .1); setTimeout(() => beep(830, .14), 120); }
  };

  /* ---------- Stagger grid ---------- */
  function staggerCells() {
    const grid = document.getElementById('i2cGrid');
    if (!grid) return;
    const mo = new MutationObserver(() => {
      grid.querySelectorAll('.i2c-cell.found').forEach((c, i) => {
        c.style.animationDelay = Math.min(i * 12, 600) + 'ms';
      });
    });
    mo.observe(grid, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  /* ---------- Skeleton ---------- */
  function showSkeleton(rows) {
    const tbody = document.getElementById('devicesBody');
    if (!tbody) return;
    rows = rows || 4;
    let html = '';
    for (let i = 0; i < rows; i++) html += '<tr class="skeleton-row"><td><span></span></td><td><span></span></td><td><span></span></td><td><span></span></td><td><span></span></td><td><span></span></td><td><span></span></td><td><span></span></td></tr>';
    tbody.innerHTML = html;
  }

  /* ---------- Loading botón ---------- */
  function setLoading(id, on) {
    const b = document.getElementById(id);
    if (b) b.classList.toggle('loading', !!on);
  }

  /* ---------- Count-up ---------- */
  function countUp(el, to) {
    if (!el) return;
    to = parseInt(to) || 0;
    if (reduceMotion) { el.textContent = to; return; }
    const from = parseInt(el.textContent) || 0;
    const t0 = performance.now(), dur = 600;
    (function step(t) {
      const k = Math.min((t - t0) / dur, 1);
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  /* ---------- Dashboard Chart.js (lazy) ---------- */
  function loadChartJs(cb) {
    if (window.Chart) return cb();
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
    s.onload = cb;
    s.onerror = () => {};
    document.head.appendChild(s);
  }
  function renderDashboard(results) {
    if (!results || !results.results) return;
    loadChartJs(() => {
      try {
        chartRefs.forEach(c => { try { c.destroy(); } catch (e) {} });
        chartRefs = [];
        const devs = Object.values(results.results);
        const dark = document.documentElement.dataset.theme !== 'light';
        const tc = dark ? '#e8eaf0' : '#101828';
        const c1 = document.getElementById('chartStability');
        if (c1) {
          chartRefs.push(new Chart(c1, {
            type: 'doughnut',
            data: { labels: devs.map(d => fmtAddr(d.address)), datasets: [{ data: devs.map(d => d.responses), backgroundColor: devs.map(d => d.status === 'stable' ? '#22c55e' : d.status === 'suspicious' ? '#eab308' : '#ef4444'), borderWidth: 0 }] },
            options: { plugins: { legend: { labels: { color: tc, font: { size: 11 } } } }, cutout: '62%' }
          }));
        }
        const c2 = document.getElementById('chartErrors');
        if (c2) {
          chartRefs.push(new Chart(c2, {
            type: 'bar',
            data: { labels: devs.map(d => fmtAddr(d.address)), datasets: [
              { label: 'NACK', data: devs.map(d => d.nack), backgroundColor: '#eab308' },
              { label: 'Timeout', data: devs.map(d => d.timeout), backgroundColor: '#ef4444' }
            ]},
            options: { scales: { x: { ticks: { color: tc } }, y: { ticks: { color: tc }, beginAtZero: true } }, plugins: { legend: { labels: { color: tc } } } }
          }));
        }
      } catch (e) { console.warn('charts:', e); }
    });
  }
  function fmtAddr(a) { return '0x' + a.toString(16).toUpperCase().padStart(2, '0'); }

  document.addEventListener('DOMContentLoaded', init);

  return { toggleTheme, toggleSound, beep, sfx, showSkeleton, setLoading, countUp, renderDashboard, refreshReveal };
})();
