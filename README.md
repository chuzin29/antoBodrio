# Antony el tonto XD — I²C Diagnostic Tool

> Herramienta de diagnóstico inteligente de dispositivos I²C con detección de posible soldadura fría

## ¿Qué es este proyecto?

Una aplicación web completa que diagnostica dispositivos conectados mediante el protocolo I²C. Permite escanear el bus, detectar dispositivos, ejecutar pruebas de estabilidad y detectar síntomas compatibles con conexiones defectuosas (soldadura fría).

**Características principales:**
- Escaneo completo del bus I²C (direcciones 0x03 - 0x77)
- Detección de dispositivos MASTER y SLAVE
- Pruebas de estabilidad con múltiples iteraciones
- Detección de comportamiento intermitente (NACK, timeouts, desapariciones)
- Diagnóstico de posible soldadura fría (con advertencia)
- Modo Demo con datos simulados
- Exportación de reportes en JSON y CSV
- Interfaz moderna, responsive, compatible con móvil y PC
- Compatible con Arduino y ESP32

## ¿Qué es I²C?

I²C (Inter-Integrated Circuit) es un protocolo de comunicación serial que utiliza dos líneas:

- **SDA** (Serial Data) — Línea de datos
- **SCL** (Serial Clock) — Línea de reloj

Permite conectar múltiples dispositivos en un mismo bus. Cada dispositivo tiene una dirección única de 7 bits (0x03 - 0x77). Un dispositivo **MASTER** inicia la comunicación y los **SLAVE/TARGET** responden.

## Arquitectura

```
NAVEGADOR (Web App)
    │
    ▼
Web Serial API
    │
    ▼
Arduino/ESP32 (Bridge Firmware)
    │
    ▼
BUS I²C (SDA + SCL)
    │
    ▼
DISPOSITIVOS I²C (SLAVE/TARGET)
```

### Limitaciones del navegador

Los navegadores **NO** pueden acceder directamente al hardware I²C. Se requiere un microcontrolador (Arduino/ESP32) como bridge entre el navegador y el bus I²C. La comunicación se realiza mediante:

- **Web Serial API** — Para navegadores Chromium (Chrome, Edge, Opera)
- **WebUSB** — Alternativa para algunos dispositivos

## Cómo conectar Arduino/ESP32

### Conexiones físicas

| Señal | Arduino Uno/Nano | ESP32 | ESP8266 |
|-------|-----------------|-------|---------|
| SDA   | A4              | GPIO21 | GPIO4 (D2) |
| SCL   | A5              | GPIO22 | GPIO5 (D1) |
| VCC   | 5V o 3.3V      | 3.3V  | 3.3V    |
| GND   | GND             | GND   | GND     |

### Conexiones del bus I²C

```
Arduino/ESP32          Dispositivos I²C
┌─────────────┐       ┌─────────────┐
│         SDA ├───────┤ SDA         │
│         SCL ├───────┤ SCL         │
│         GND ├───────┤ GND         │
│         VCC ├───────┤ VCC         │
└─────────────┘       └─────────────┘

Nota: Agrega resistencias pull-up de 4.7kΩ en SDA y SCL a VCC
si tu módulo no las incluye.
```

## Cómo instalar el firmware

### Requisitos
- [Arduino IDE](https://www.arduino.cc/en/software) o [PlatformIO](https://platformio.org/)
- Arduino Uno/Nano/Mega, ESP32 o ESP8266

### Pasos

1. Abre `firmware/i2c_bridge.ino` en Arduino IDE
2. Selecciona tu placa en Herramientas > Placa
3. Selecciona el puerto COM
4. Sube el sketch

### Verificación

1. Abre el Monitor Serial (115200 baud)
2. Deberías ver: `I²C Bridge v1.0.0 ready`
3. Escribe `PING` y presiona Enter
4. Deberías ver: `PONG`

## Cómo ejecutar la aplicación

### Opción 1: GitHub Pages (recomendado)

1. Sube el código a GitHub
2. Ve a Settings > Pages
3. Selecciona la rama `main` y la carpeta raíz `/`
4. La app estará disponible en: `https://tuousuario.github.io/ANTONY-GAY/`

### Opción 2: Local

1. Abre `index.html` en tu navegador (Chrome o Edge)
2. O usa un servidor local:
   ```bash
   # Python
   python -m http.server 8000
   
   # Node.js
   npx serve .
   ```

## Cómo usar Web Serial

1. Conecta tu Arduino/ESP32 por USB
2. Abre la app en Chrome o Edge
3. Haz clic en **"Conectar dispositivo"**
4. Selecciona el puerto COM en el diálogo del navegador
5. El estado cambiará a "Conectado"
6. Haz clic en **"Escanear bus"**

## Cómo ejecutar un escaneo

1. Conecta el hardware o activa el Modo Demo
2. Haz clic en **"Escanear bus"**
3. Las direcciones encontradas se resaltarán en la cuadrícula
4. Los dispositivos aparecerán en la tabla de "Dispositivos Detectados"

## Cómo ejecutar pruebas de estabilidad

1. Primero ejecuta un escaneo
2. Selecciona el número de pruebas (10, 50, 100 o 500)
3. Haz clic en **"Iniciar prueba"**
4. Observa el progreso en tiempo real
5. Los resultados aparecerán en las secciones de Diagnóstico y Resultado Final

## Cómo interpretar los resultados

### Estados

| Estado | Significado |
|--------|-------------|
| 🟢 ESTABLE | El dispositivo responde consistentemente (≥95% estabilidad) |
| 🟡 SOSPECHOSO | Comportamiento ligeramente inestable (70-94% estabilidad) |
| 🔴 POSIBLE FALLA | Comportamiento muy inestable (<70% estabilidad) |

### Métricas

- **Respuestas**: Número de veces que el dispositivo respondió correctamente
- **Errores**: Fallos totales de comunicación
- **NACK**: "Not Acknowledged" — El dispositivo no reconoció la dirección
- **Timeout**: No se recibió respuesta en el tiempo límite
- **Desapariciones**: El dispositivo dejó de responder después de haber respondido
- **Estabilidad**: Porcentaje de respuestas exitosas

## Soldadura fría — Limitaciones importantes

**ESTA HERRAMIENTA NO PUEDE CONFIRMAR SOLDADURA FRÍA ÚNICAMENTE MEDIANTE SOFTWARE.**

Lo que sí puede hacer:
- ✅ Detectar comportamiento intermitente
- ✅ Identificar dispositivos que aparecen y desaparecen
- ✅ Medir porcentaje de estabilidad
- ✅ Detectar NACK y timeouts frecuentes

Lo que **NO** puede hacer:
- ❌ Confirmar soldadura fría (requiere verificación visual/física)
- ❌ Medir resistencia de contacto
- ❌ Verificar calidad de la unión metálica
- ❌ Detectar micro-fisuras en la soldadura

**Recomendación:** Si los resultados muestran comportamiento inestable, verifica físicamente las conexiones con un multímetro y/o lupa/microscopio.

## Despliegue en GitHub Pages

1. Crea un repositorio en GitHub
2. Sube el código:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: I²C Diagnostic Tool"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/ANTONY-GAY.git
   git push -u origin main
   ```
3. Ve a **Settings > Pages**
4. En **Source**, selecciona **Deploy from a branch**
5. Selecciona la rama **main** y la carpeta **/(root)**
6. Guarda
7. Espera 1-2 minutos
8. Tu app estará en: `https://tuousuario.github.io/ANTONY-GAY/`

### GitHub Actions

El archivo `.github/workflows/deploy.yml` está configurado para desplegar automáticamente a GitHub Pages en cada push a la rama `main`.

## Estructura del proyecto

```
├── index.html              # Página principal
├── css/
│   └── style.css           # Estilos (responsive)
├── js/
│   ├── app.js              # Orquestador principal
│   ├── serial.js           # Comunicación Web Serial
│   ├── i2c.js              # Lógica de escaneo I²C
│   ├── diagnostics.js      # Pruebas y diagnóstico
│   └── demo.js             # Modo demo
├── firmware/
│   └── i2c_bridge.ino      # Firmware para Arduino/ESP32
├── .github/
│   └── workflows/
│       └── deploy.yml      # Despliegue automático
└── README.md               # Esta documentación
```

## Navegadores compatibles

| Navegador | Web Serial | WebUSB | Estado |
|-----------|-----------|--------|--------|
| Chrome 89+ | ✅ | ✅ | Completo |
| Edge 89+ | ✅ | ✅ | Completo |
| Opera 75+ | ✅ | ✅ | Completo |
| Firefox | ❌ | ❌ | Solo Modo Demo |
| Safari | ❌ | ❌ | Solo Modo Demo |
| Chrome Móvil | ❌ | ❌ | Solo Modo Demo |

## Limitaciones reales

1. **No hay acceso directo al hardware I²C desde el navegador** — Se requiere un bridge firmware
2. **Web Serial API no está soportada en todos los navegadores** — Solo Chromium
3. **No se puede confirmar soldadura fría por software** — Solo detectar síntomas
4. **La detección de MASTER múltiple es limitada** — Solo se detecta el MASTER de prueba
5. **No se puede identificar el tipo exacto de dispositivo** — Solo la dirección

## Licencia

MIT — Para uso educativo y personal.

---

**Antony el tonto XD** — Porque diagnosticar I²C también puede ser divertido. 🔌
