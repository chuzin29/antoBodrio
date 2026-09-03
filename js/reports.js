/**
 * reports.js — Reportes técnicos (SIMULACIÓN o HARDWARE REAL según origen).
 * Exporta JSON / CSV / HTML (imprimible a PDF).
 */
const Reports = (() => {
  function collect(origin, stressRes) {
    const st = (window.App && App.getState) ? App.getState() : {};
    const nodes = VLab.getNodes();
    const devs = stressRes ? Object.values(stressRes.results) : [];
    const totalAck = devs.reduce((a, d) => a + d.responses, 0);
    const totalNack = devs.reduce((a, d) => a + d.nack, 0);
    const totalTo = devs.reduce((a, d) => a + d.timeout, 0);
    const recs = [];
    devs.forEach(d => {
      if (d.status === 'danger') recs.push(VLab.fmtAddr(d.address) + ': comportamiento compatible con posible soldadura/conexión defectuosa. Verificar físicamente SDA/SCL, alimentación y soldaduras.');
      else if (d.status === 'suspicious') recs.push(VLab.fmtAddr(d.address) + ': inestabilidad leve. Monitorear; revisar pull-ups y longitud del bus.');
    });
    VLab.validate().forEach(a => { if (a.lvl !== 'ok') recs.push(a.msg); });
    if (!recs.length) recs.push('Sin hallazgos: bus estable.');
    return {
      herramienta: 'Antony el tonto XD — Laboratorio Inteligente de Diagnóstico Electrónico',
      fecha: new Date().toISOString(),
      origen: origin === 'real' ? 'HARDWARE REAL' : 'SIMULACIÓN VIRTUAL',
      master: origin === 'real' ? (st.master || 'Arduino/ESP32') : 'Arduino virtual',
      circuito: nodes.map(n => ({ direccion: VLab.fmtAddr(n.addr), nombre: n.name, sda: n.sda, scl: n.scl, gnd: n.gnd, vcc: n.vcc, estado: n.phys })),
      pruebas: stressRes ? stressRes.iterations : 0,
      resultados: devs.map(d => ({ direccion: VLab.fmtAddr(d.address), nombre: d.commonDevice || d.name, ack: d.responses, nack: d.nack, timeout: d.timeout, errores: d.errors, estabilidad: d.stability + '%', estado: d.statusLabel })),
      totales: { ack: totalAck, nack: totalNack, timeout: totalTo },
      recomendaciones: recs,
      nota: 'Un resultado de posible soldadura fría indica comportamiento eléctrico compatible, no confirmación física.'
    };
  }
  function download(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function toCSV(r) {
    let csv = 'Reporte,' + r.origen + '\nFecha,' + r.fecha + '\n\nDireccion,Nombre,ACK,NACK,Timeout,Errores,Estabilidad,Estado\n';
    r.resultados.forEach(d => { csv += [d.direccion, d.nombre, d.ack, d.nack, d.timeout, d.errores, d.estabilidad, d.estado].join(',') + '\n'; });
    csv += '\nRecomendaciones\n' + r.recomendaciones.map(x => '"' + x.replace(/"/g, "'") + '"').join('\n') + '\n';
    return csv;
  }
  function toHTML(r) {
    const rows = r.resultados.map(d => '<tr><td>' + d.direccion + '</td><td>' + d.nombre + '</td><td>' + d.ack + '</td><td>' + d.nack + '</td><td>' + d.timeout + '</td><td>' + d.estabilidad + '</td><td>' + d.estado + '</td></tr>').join('');
    return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Reporte I2C</title>' +
      '<style>body{font-family:sans-serif;margin:32px;color:#111}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:6px;font-size:13px}h1{font-size:20px}.tag{display:inline-block;padding:2px 10px;border-radius:99px;background:#eee;font-size:12px}</style></head><body>' +
      '<h1>Reporte de diagnóstico I2C</h1><p><span class="tag">' + r.origen + '</span> ' + r.fecha + '</p>' +
      '<p>Master: ' + r.master + ' · Pruebas: ' + r.pruebas + ' · ACK: ' + r.totales.ack + ' · NACK: ' + r.totales.nack + ' · Timeout: ' + r.totales.timeout + '</p>' +
      '<table><tr><th>Dir</th><th>Nombre</th><th>ACK</th><th>NACK</th><th>Timeout</th><th>Estab.</th><th>Estado</th></tr>' + rows + '</table>' +
      '<h3>Recomendaciones</h3><ul><li>' + r.recomendaciones.join('</li><li>') + '</li></ul>' +
      '<p><small>' + r.nota + '</small></p><script>window.onload=function(){window.print()}<\/script></body></html>';
  }
  function generate(origin, stressRes, fmt) {
    const r = collect(origin, stressRes);
    const ts = Date.now();
    if (fmt === 'csv') download(toCSV(r), 'reporte-i2c-' + ts + '.csv', 'text/csv');
    else if (fmt === 'html') {
      const w = window.open('', '_blank');
      if (w) { w.document.write(toHTML(r)); w.document.close(); }
      else download(toHTML(r), 'reporte-i2c-' + ts + '.html', 'text/html');
    }
    else download(JSON.stringify(r, null, 2), 'reporte-i2c-' + ts + '.json', 'application/json');
    Store.save({ type: 'reporte', origen: r.origen, pruebas: r.pruebas, hallazgos: r.recomendaciones.length });
    if (window.LabUI) LabUI.renderHistory();
    return r;
  }
  return { generate, collect };
})();
