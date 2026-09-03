/** components-db.js — Catálogo de componentes */
const ComponentsDB = (() => {
  const CATS = ['Microcontroladores', 'Pantallas', 'Sensores', 'Memorias', 'RTC', 'Expansores', 'Pasivos', 'Actuadores'];
  const ITEMS = [
    { name: 'Arduino UNO', cat: 'Microcontroladores', addr: null, volt: '5V', desc: 'ATmega328P. Master I2C: SDA=A4, SCL=A5.', spec: 'Rol: MASTER · 100/400kHz · USB-serial CH340 o ATmega16U2' },
    { name: 'ESP32', cat: 'Microcontroladores', addr: null, volt: '3.3V', desc: 'Dual-core con I2C flexible. Default SDA=GPIO21, SCL=GPIO22.', spec: 'Rol: MASTER · OJO: lógica 3.3V, no 5V directo' },
    { name: 'LCD 16x2 I2C (PCF8574)', cat: 'Pantallas', addr: '0x27', volt: '5V', desc: 'Display alfanumérico con expansor PCF8574.', spec: 'Addr 0x20-0x27 según jumpers A0-A2' },
    { name: 'OLED SSD1306 128x64', cat: 'Pantallas', addr: '0x3C', volt: '3.3-5V', desc: 'Pantalla gráfica I2C, muy común en prototipos.', spec: 'Addr 0x3C (SA0=GND) o 0x3D' },
    { name: 'MPU6050', cat: 'Sensores', addr: '0x68', volt: '3.3-5V', desc: 'Acelerómetro + giroscopio 6 ejes.', spec: 'Addr 0x68 (AD0=GND) o 0x69' },
    { name: 'BME280', cat: 'Sensores', addr: '0x76', volt: '3.3V', desc: 'Temperatura, humedad y presión barométrica.', spec: 'Addr 0x76 o 0x77 según SDO' },
    { name: 'AT24C32 EEPROM', cat: 'Memorias', addr: '0x50', volt: '5V', desc: 'Memoria EEPROM 32Kbit para guardar configuración.', spec: 'Addr 0x50-0x57 según A0-A2' },
    { name: 'DS3231 RTC', cat: 'RTC', addr: '0x68', volt: '3.3-5V', desc: 'Reloj de tiempo real de alta precisión con TCXO.', spec: 'Addr fija 0x68 · ¡colisiona con MPU6050!' },
    { name: 'PCF8574 expansor', cat: 'Expansores', addr: '0x27', volt: '5V', desc: '8 pines digitales extra vía I2C.', spec: 'Addr 0x20-0x27' },
    { name: 'ADS1115 ADC 16-bit', cat: 'Sensores', addr: '0x48', volt: '3.3-5V', desc: 'Conversor analógico-digital de 4 canales.', spec: 'Addr 0x48-0x4B según ADDR' },
    { name: 'Resistencia pull-up 4.7k', cat: 'Pasivos', addr: null, volt: '—', desc: 'Obligatoria en SDA y SCL: lleva el bus a VCC en reposo.', spec: 'Una por línea · 2.2k si el bus es largo' },
    { name: 'LED + 220Ω', cat: 'Actuadores', addr: null, volt: '—', desc: 'Indicador visual. No va al bus I2C.', spec: 'Conectar a GPIO con resistencia en serie' },
  ];
  function render(container, filter) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;
    const list = ITEMS.filter(i => !filter || filter === 'Todos' || i.cat === filter);
    el.innerHTML = list.map(i =>
      '<div class="cat-card"><h4>' + i.name + '</h4>' +
      (i.addr ? '<div class="addr">I2C ' + i.addr + '</div>' : '<div class="addr" style="color:var(--text-muted)">Sin bus I2C</div>') +
      '<p>' + i.desc + '</p><div class="spec">' + i.cat + ' · ' + i.volt + '<br>' + i.spec + '</div></div>'
    ).join('');
  }
  return { CATS, ITEMS, render };
})();
