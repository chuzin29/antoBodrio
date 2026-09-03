/** scenarios.js — Escenarios predefinidos del laboratorio (SIMULACIÓN) */
const Scenarios = (() => {
  const LIST = [
    { id: 'perfect', name: 'Sistema perfecto', desc: 'Todo conectado, sin fallas.' },
    { id: 'intermit', name: 'Dispositivo intermitente', desc: 'Un nodo con conexión floja.' },
    { id: 'cold', name: 'Posible soldadura fría', desc: 'Nodo con soldadura fría (ACK ~80%).' },
    { id: 'disconn', name: 'Dispositivo desconectado', desc: 'Un nodo sin alimentación.' },
    { id: 'sdacut', name: 'SDA cortado', desc: 'Falla global: SDA desconectado.' },
    { id: 'sclcut', name: 'SCL cortado', desc: 'Falla global: SCL desconectado.' },
    { id: 'dupaddr', name: 'Dirección duplicada', desc: 'Dos nodos en 0x68.' },
    { id: 'dead', name: 'Componente dañado', desc: 'Un nodo dañado, resto OK.' },
    { id: 'chaos', name: 'Caos total', desc: 'Ruido + NACK + timeouts + sin pull-ups.' },
  ];
  function apply(id) {
    VLab.reset();
    VLab.setFaults({ sdaCut: false, sclCut: false, gndCut: false, badVcc: false, dupAddr: false, randNack: false, timeout: false, noise: false, intermittent: false, coldSolder: false, deadDev: false });
    VLab.setPullups(true);
    const nodes = VLab.getNodes();
    const byAddr = a => nodes.find(n => n.addr === a);
    switch (id) {
      case 'perfect': break;
      case 'intermit': byAddr(0x68).phys = 'CONEXIÓN FLOJA'; VLab.setFaults({ intermittent: true }); break;
      case 'cold': byAddr(0x50) ? byAddr(0x50).phys = 'SOLDADURA FRÍA' : byAddr(0x68).phys = 'SOLDADURA FRÍA'; VLab.setFaults({ coldSolder: true }); break;
      case 'disconn': byAddr(0x3C).vcc = 'OFF'; break;
      case 'sdacut': VLab.setFaults({ sdaCut: true }); break;
      case 'sclcut': VLab.setFaults({ sclCut: true }); break;
      case 'dupaddr': VLab.addNode(0x68, 'DS3231 (duplicado)'); VLab.setFaults({ dupAddr: true }); break;
      case 'dead': byAddr(0x76).phys = 'COMPONENTE DAÑADO'; VLab.setFaults({ deadDev: true }); break;
      case 'chaos': VLab.setFaults({ randNack: true, timeout: true, noise: true, intermittent: true }); VLab.setPullups(false); nodes[0].phys = 'SOLDADURA FRÍA'; break;
    }
    return LIST.find(s => s.id === id);
  }
  return { LIST, apply };
})();
