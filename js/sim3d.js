/**
 * sim3d.js — Vista 3D real con Three.js (SIMULACIÓN VISUAL).
 * Objetos 3D por componente, color por estado, órbita/zoom/selección propios.
 */
const Sim3D = (() => {
  let renderer, scene, camera, meshes = [], loaded = false, loading = false;
  let theta = 0.7, phi = 1.0, radius = 14, tx = 0, ty = 0;
  let selected = null;

  function statusOf(addr) {
    const st = window.__lastDiag && window.__lastDiag[addr];
    return st || 'stable';
  }
  function colorFor(st) { return st === 'stable' ? 0x22c55e : st === 'suspicious' ? 0xeab308 : 0xef4444; }

  function loadThree(cb) {
    if (window.THREE) return cb();
    if (loading) { const w = setInterval(() => { if (window.THREE) { clearInterval(w); cb(); } }, 300); return; }
    loading = true;
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js';
    s.onload = () => { loading = false; cb(); };
    s.onerror = () => {
      loading = false;
      const el = document.getElementById('sim3dInfo');
      if (el) el.textContent = 'No se pudo cargar Three.js (sin internet). La simulación 3D requiere conexión.';
    };
    document.head.appendChild(s);
  }

  function init() {
    loadThree(() => {
      const cv = document.getElementById('sim3dCanvas');
      if (!cv || loaded) { if (loaded) rebuild(); return; }
      renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x05080f);
      scene.fog = new THREE.Fog(0x05080f, 20, 45);
      camera = new THREE.PerspectiveCamera(50, cv.clientWidth / 340, 0.1, 100);
      scene.add(new THREE.AmbientLight(0xffffff, 0.55));
      const key = new THREE.DirectionalLight(0xffffff, 0.9);
      key.position.set(6, 10, 6);
      scene.add(key);
      const grid = new THREE.GridHelper(24, 24, 0x3b82f6, 0x1a2235);
      scene.add(grid);
      bindOrbit(cv);
      loaded = true;
      rebuild();
      (function loop() { requestAnimationFrame(loop); if (!document.hidden) { updateCam(); renderer.render(scene, camera); } })();
    });
  }

  function updateCam() {
    camera.position.set(
      tx + radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
      ty + radius * Math.sin(phi) * Math.cos(theta)
    );
    camera.lookAt(tx, 0, ty);
  }

  function bindOrbit(cv) {
    let drag = false, px = 0, py = 0, moved = 0;
    cv.addEventListener('mousedown', e => { drag = true; px = e.clientX; py = e.clientY; moved = 0; });
    window.addEventListener('mouseup', e => {
      if (drag && moved < 5) pick(e);
      drag = false;
    });
    cv.addEventListener('mousemove', e => {
      if (!drag) return;
      const dx = e.clientX - px, dy = e.clientY - py;
      moved += Math.abs(dx) + Math.abs(dy);
      if (e.shiftKey) { tx -= dx * 0.02; ty -= dy * 0.02; }
      else { theta -= dx * 0.008; phi = Math.max(0.25, Math.min(1.45, phi - dy * 0.006)); }
      px = e.clientX; py = e.clientY;
    });
    cv.addEventListener('wheel', e => { e.preventDefault(); radius = Math.max(6, Math.min(30, radius + e.deltaY * 0.01)); }, { passive: false });
    cv.addEventListener('touchstart', e => { const t = e.touches[0]; drag = true; px = t.clientX; py = t.clientY; moved = 0; }, { passive: true });
    cv.addEventListener('touchmove', e => {
      if (!drag) return;
      const t = e.touches[0];
      theta -= (t.clientX - px) * 0.01; phi = Math.max(0.25, Math.min(1.45, phi - (t.clientY - py) * 0.008));
      px = t.clientX; py = t.clientY;
    }, { passive: true });
    cv.addEventListener('touchend', () => drag = false);
  }

  const ray = { x: 0, y: 0 };
  function pick(e) {
    if (!loaded) return;
    const cv = document.getElementById('sim3dCanvas');
    const r = cv.getBoundingClientRect();
    const mouse = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(mouse, camera);
    const hits = rc.intersectObjects(meshes.map(m => m.grp), true);
    if (hits.length) {
      let o = hits[0].object;
      while (o && !o.userData.addr && o.parent) o = o.parent;
      if (o) select(o.userData.addr);
    }
  }

  function board(w, d, color) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), new THREE.MeshStandardMaterial({ color, roughness: 0.7 }));
    g.add(base);
    return g;
  }

  function rebuild() {
    if (!loaded) return;
    meshes.forEach(m => scene.remove(m.grp));
    meshes = [];
    const nodes = VLab.getNodes();
    // breadboard central
    const bb = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 7), new THREE.MeshStandardMaterial({ color: 0xe8eaf0, roughness: 0.9 }));
    bb.position.y = -0.2;
    scene.add(bb);
    meshes.push({ grp: bb, addr: null });
    // master a la izquierda
    const master = board(2.2, 3.4, 0x1e3a5f);
    master.position.set(-7.5, 0.4, 0);
    master.userData = { addr: 'master' };
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.22), new THREE.MeshBasicMaterial({ color: 0x22c55e }));
    led.position.set(0.6, 0.5, -1.2);
    master.add(led);
    scene.add(master);
    meshes.push({ grp: master, addr: 'master' });
    // esclavos sobre el breadboard
    nodes.forEach((n, i) => {
      const st = statusOf(n.addr);
      const g = board(1.6, 1.6, 0x111827);
      const chip = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.35, 1.0), new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 0.5 }));
      chip.position.y = 0.32;
      g.add(chip);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial({ color: colorFor(st) }));
      dot.position.set(0.55, 0.45, 0.55);
      g.add(dot);
      const cols = 3;
      g.position.set(-3.6 + (i % cols) * 3.2, 0.35, n && i >= cols ? 2.2 : -1.8);
      g.userData = { addr: n.addr, name: n.name };
      scene.add(g);
      meshes.push({ grp: g, addr: n.addr });
      // cable SDA/SCL (líneas simples al master)
      const mat = new THREE.LineBasicMaterial({ color: st === 'danger' ? 0xef4444 : 0x3b82f6 });
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-6.4, 0.6, -0.8 + i * 0.25), new THREE.Vector3(g.position.x, 0.6, g.position.z)
      ]);
      scene.add(new THREE.Line(geo, mat));
      meshes.push({ grp: new THREE.Group(), addr: null, line: scene.children[scene.children.length - 1] });
    });
    const info = document.getElementById('sim3dInfo');
    if (info) info.textContent = nodes.length + ' esclavo(s) virtuales. Arrastra para rotar · rueda = zoom · Shift+arrastrar = mover · clic = seleccionar.';
  }

  function select(addr) {
    selected = addr;
    meshes.forEach(m => {
      m.grp.traverse ? m.grp.traverse(o => { if (o.material && o.material.emissive) o.material.emissive.setHex(0x000000); }) : null;
    });
    const found = meshes.find(m => m.addr === addr);
    if (found && found.grp.traverse) found.grp.traverse(o => { if (o.material && o.material.emissive) o.material.emissive.setHex(0x1e3a5f); });
    const el = document.getElementById('sim3dInfo');
    if (el) {
      if (addr === 'master') el.textContent = 'MASTER: Arduino/ESP32 virtual — inicia la comunicación I2C.';
      else {
        const n = VLab.getNodes().find(x => x.addr === addr);
        el.textContent = n ? VLab.fmtAddr(n.addr) + ' ' + n.name + ' · SDA:' + (n.sda ? 'OK' : 'CORTADO') + ' SCL:' + (n.scl ? 'OK' : 'CORTADO') + ' GND:' + (n.gnd ? 'OK' : 'FALTA') + ' VCC:' + n.vcc + ' · ' + n.phys : 'Dispositivo ' + addr;
      }
    }
  }

  return { init, rebuild, select };
})();
