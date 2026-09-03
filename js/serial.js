/**
 * serial.js — Web Serial API Communication Layer
 * Handles connection to Arduino/ESP32 bridge via Web Serial
 */
const SerialManager = (() => {
  let port = null;
  let reader = null;
  let writer = null;
  let readableStreamClosed = null;
  let isConnected = false;
  let onLogCallback = null;

  function setLogCallback(cb) {
    onLogCallback = cb;
  }

  function log(message, level = 'info') {
    if (onLogCallback) onLogCallback(message, level);
  }

  async function connect() {
    if (!('serial' in navigator)) {
      log('Web Serial API no soportada en este navegador', 'error');
      return { success: false, error: 'Web Serial API no disponible. Usa Chrome o Edge.' };
    }

    try {
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });

      const decoder = new TextDecoderStream();
      readableStreamClosed = port.readable.pipeTo(decoder.writable);
      reader = decoder.readable.getReader();

      const encoder = new TextEncoder();
      writer = port.writable.getWriter();

      isConnected = true;
      log('Puerto serial abierto correctamente', 'success');

      // Try to identify the bridge
      const info = port.getInfo();
      const usbVendorId = info.usbVendorId;
      const usbProductId = info.usbProductId;

      let deviceName = 'Desconocido';
      if (usbVendorId === 0x2341) deviceName = 'Arduino';
      else if (usbVendorId === 0x10C4) deviceName = 'ESP32 (Silicon Labs)';
      else if (usbVendorId === 0x303A) deviceName = 'ESP32 (Espressif)';
      else if (usbVendorId === 0x1A86) deviceName = 'CH340/CH341';
      else deviceName = `USB Vendor:${usbVendorId || 'N/A'}`;

      log(`Dispositivo detectado: ${deviceName}`, 'success');

      // Start reading loop
      startReading();

      return {
        success: true,
        deviceName,
        portInfo: `VID:${usbVendorId || 'N/A'} PID:${usbProductId || 'N/A'}`
      };
    } catch (err) {
      log(`Error de conexión: ${err.message}`, 'error');
      return { success: false, error: err.message };
    }
  }

  function startReading() {
    const readLoop = async () => {
      while (isConnected && reader) {
        try {
          const { value, done } = await reader.read();
          if (done) {
            log('Conexión serial cerrada', 'warning');
            break;
          }
          if (value) {
            // Dispatch event for other modules
            window.dispatchEvent(new CustomEvent('serial-data', { detail: value }));
          }
        } catch (err) {
          if (isConnected) {
            log(`Error de lectura: ${err.message}`, 'error');
          }
          break;
        }
      }
    };
    readLoop();
  }

  async function sendCommand(cmd) {
    if (!writer || !isConnected) {
      log('No hay conexión serial activa', 'error');
      return false;
    }
    try {
      await writer.write(new TextEncoder().encode(cmd + '\n'));
      log(`TX: ${cmd}`, 'info');
      return true;
    } catch (err) {
      log(`Error de escritura: ${err.message}`, 'error');
      return false;
    }
  }

  async function sendCommandAndWait(cmd, timeout = 5000) {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        window.removeEventListener('serial-data', handler);
        resolve({ success: false, error: 'Timeout esperando respuesta' });
      }, timeout);

      const handler = (e) => {
        clearTimeout(timeoutId);
        window.removeEventListener('serial-data', handler);
        resolve({ success: true, data: e.detail });
      };

      window.addEventListener('serial-data', handler);
      sendCommand(cmd);
    });
  }

  async function disconnect() {
    isConnected = false;
    try {
      if (reader) {
        await reader.cancel();
        reader.releaseLock();
      }
      if (writer) {
        writer.releaseLock();
      }
      if (port) {
        await port.close();
      }
      log('Desconectado del puerto serial', 'info');
    } catch (err) {
      // Ignore close errors
    }
    port = null;
    reader = null;
    writer = null;
    readableStreamClosed = null;
  }

  function getConnectionState() {
    return {
      connected: isConnected,
      port: port ? port.getInfo() : null
    };
  }

  return {
    connect,
    disconnect,
    sendCommand,
    sendCommandAndWait,
    getConnectionState,
    setLogCallback
  };
})();
