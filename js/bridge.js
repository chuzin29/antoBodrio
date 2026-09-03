/**
 * bridge.js — Expone los módulos a window.
 * Los archivos usan `const` de nivel superior, que NO crea propiedades en
 * window; pero la app se comunica con `window.App`, `window.LabUI`, etc.
 * Este puente (cargado al último) los conecta. Sin esto, nada entre
 * módulos funciona: ni el cambio de vistas ni la nube de la IA.
 */
(function () {
  var mods = ['App', 'UX', 'Store', 'ComponentsDB', 'VLab', 'Scenarios', 'Protocol', 'Scope', 'Sim3D', 'Reports', 'Learn', 'LabUI', 'Nav2', 'Antopupis', 'DemoMode', 'SerialManager', 'I2CScanner', 'Diagnostics', 'APP_CONFIG'];
  var missing = [];
  mods.forEach(function (name) {
    try {
      var ref = (typeof window[name] !== 'undefined') ? window[name] : eval(name);
      if (typeof ref !== 'undefined') window[name] = ref;
      else missing.push(name);
    } catch (e) { missing.push(name); }
  });
  if (missing.length && window.console) console.warn('bridge: no expuestos:', missing.join(', '));
})();
