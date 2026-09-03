/** learn.js — Centro de aprendizaje: explicaciones cortas y prácticas */
const Learn = (() => {
  const ARTICLES = [
    { t: '¿Qué es I2C?', b: 'Bus de 2 líneas (SDA datos + SCL reloj) que conecta muchos dispositivos con solo 2 pines del microcontrolador. Velocidades típicas: 100 kHz (estándar) y 400 kHz (rápido).' },
    { t: '¿Qué es SDA?', b: 'Serial Data: línea bidireccional por donde viajan direcciones y datos. Es open-drain: necesita pull-up a VCC.' },
    { t: '¿Qué es SCL?', b: 'Serial Clock: el MASTER genera el reloj que sincroniza cada bit. Sin SCL no hay comunicación.' },
    { t: '¿Qué es ACK?', b: 'Acknowledge: el esclavo baja SDA a 0 en el 9.º pulso para confirmar "recibido".' },
    { t: '¿Qué es NACK?', b: 'No-acknowledge: SDA queda en 1. Significa que nadie respondió: revisa dirección, alimentación y cableado.' },
    { t: '¿Qué es un MASTER?', b: 'El que inicia y controla la comunicación (tu Arduino/ESP32). Genera START, direcciones y STOP.' },
    { t: '¿Qué es un SLAVE / TARGET?', b: 'El dispositivo que responde cuando lo llaman por su dirección (sensores, pantallas, memorias).' },
    { t: '¿Qué es una dirección I2C?', b: 'Identificador de 7 bits (0x03–0x77). Cada esclavo tiene la suya; si dos comparten, hay conflicto y el bus falla.' },
    { t: '¿Qué es una soldadura fría?', b: 'Unión defectuosa que conduce a ratos: el síntoma es intermitencia (ACK a veces, NACK/timeouts aleatorios). El software solo detecta el comportamiento compatible; la confirmación es visual y física.' },
    { t: '¿Cómo diagnosticar un bus I2C?', b: '1) Escanea y anota quién responde. 2) Corre 100+ pruebas y mira estabilidad. 3) Si hay intermitencia: revisa pull-ups (4.7k), GND común, VCC correcto y soldaduras. 4) Compara simulación vs hardware real.' },
  ];
  function render(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = ARTICLES.map(a => '<details class="learn-article"><summary>' + a.t + '</summary><div>' + a.b + '</div></details>').join('');
  }
  return { render };
})();
