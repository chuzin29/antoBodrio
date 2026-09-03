/**
 * i2c.js — I²C Bus Scanning and Protocol Logic
 * Handles I²C scanning commands and response parsing
 */
const I2CScanner = (() => {
  const I2C_MIN_ADDR = 0x03;
  const I2C_MAX_ADDR = 0x77;
  let onLogCallback = null;

  function setLogCallback(cb) {
    onLogCallback = cb;
  }

  function log(message, level = 'info') {
    if (onLogCallback) onLogCallback(message, level);
  }

  /**
   * Scan the I²C bus via the bridge firmware
   * Returns array of found addresses with their status
   */
  async function scanBus() {
    log('Iniciando escaneo del bus I²C...', 'info');

    const results = [];

    // Send scan command to bridge
    const response = await SerialManager.sendCommandAndWait('SCAN', 10000);

    if (!response.success) {
      log('No se recibió respuesta del bridge. Verifica la conexión.', 'error');
      return { success: false, error: response.error, devices: [] };
    }

    const rawData = response.data;
    log(`Respuesta del bridge: ${rawData}`, 'info');

    // Parse the response
    // Expected format from bridge: "FOUND:XX,YY,ZZ" or comma-separated hex addresses
    const parsed = parseBridgeResponse(rawData);

    if (parsed.length === 0) {
      log('No se encontraron dispositivos en el bus I²C', 'warning');
    } else {
      parsed.forEach(addr => {
        log(`Dispositivo encontrado: 0x${addr.toString(16).toUpperCase().padStart(2, '0')}`, 'success');
      });
    }

    return {
      success: true,
      devices: parsed,
      timestamp: Date.now()
    };
  }

  /**
   * Parse bridge response to extract I²C addresses
   */
  function parseBridgeResponse(data) {
    const addresses = [];
    if (!data) return addresses;

    // Try multiple formats
    // Format 1: "FOUND:0x27,0x68,0x3C"
    let match = data.match(/FOUND:(.+)/i);
    if (match) {
      const parts = match[1].split(',');
      parts.forEach(p => {
        const addr = parseInt(p.trim(), 16);
        if (!isNaN(addr) && addr >= I2C_MIN_ADDR && addr <= I2C_MAX_ADDR) {
          addresses.push(addr);
        }
      });
      return addresses;
    }

    // Format 2: comma or space separated hex values
    const hexPattern = /0x([0-9A-Fa-f]{2})/g;
    while ((match = hexPattern.exec(data)) !== null) {
      const addr = parseInt(match[1], 16);
      if (addr >= I2C_MIN_ADDR && addr <= I2C_MAX_ADDR) {
        addresses.push(addr);
      }
    }

    // Format 3: "A:XX" lines
    if (addresses.length === 0) {
      const linePattern = /(?:A|ADDR|DEVICE)[:\s]*0x([0-9A-Fa-f]{2})/gi;
      while ((match = linePattern.exec(data)) !== null) {
        const addr = parseInt(match[1], 16);
        if (addr >= I2C_MIN_ADDR && addr <= I2C_MAX_ADDR) {
          addresses.push(addr);
        }
      }
    }

    // Remove duplicates
    return [...new Set(addresses)].sort((a, b) => a - b);
  }

  /**
   * Probe a single I²C address
   */
  async function probeAddress(addr) {
    const hex = '0x' + addr.toString(16).toUpperCase().padStart(2, '0');
    const response = await SerialManager.sendCommandAndWait(`PROBE ${hex}`, 3000);

    if (!response.success) return { found: false, error: 'timeout' };

    const data = response.data.toLowerCase();
    if (data.includes('ack') || data.includes('found') || data.includes('ok')) {
      return { found: true, responseTime: Date.now() };
    }
    if (data.includes('nack') || data.includes('error')) {
      return { found: false, error: 'nack' };
    }
    return { found: false, error: 'unknown' };
  }

  /**
   * Full bus scan with timing info
   */
  async function fullScan() {
    const startTime = Date.now();
    const result = await scanBus();
    result.scanTime = Date.now() - startTime;
    return result;
  }

  /**
   * Multiple scans for stability testing
   */
  async function repeatScan(count, onProgress) {
    const results = [];
    for (let i = 0; i < count; i++) {
      const scan = await fullScan();
      scan.iteration = i + 1;
      results.push(scan);
      if (onProgress) onProgress(i + 1, count, scan);
      // Small delay between scans
      await new Promise(r => setTimeout(r, 200));
    }
    return results;
  }

  /**
   * Generate the I²C address grid (0x03 - 0x77 for 7-bit)
   */
  function generateAddressGrid() {
    const addresses = [];
    for (let i = 0; i <= 0x7F; i++) {
      addresses.push(i);
    }
    return addresses;
  }

  /**
   * Format address for display
   */
  function formatAddress(addr) {
    return '0x' + addr.toString(16).toUpperCase().padStart(2, '0');
  }

  /**
   * Get common device name for address (best-effort, not reliable)
   */
  function getCommonDevice(addr) {
    const known = {
      0x20: 'PCF8574 (I/O Expander)',
      0x27: 'PCF8574A (LCD)',
      0x3C: 'SSD1306 (OLED 128x64)',
      0x3D: 'SSD1306 (OLED 128x64)',
      0x48: 'ADS1115 / TMP102',
      0x50: 'AT24C32 (EEPROM)',
      0x57: 'AT24C32 (EEPROM)',
      0x68: 'DS3231 (RTC) / MPU6050',
      0x76: 'BME280 / BMP280',
      0x77: 'BME280 / BMP280',
      0x23: 'BH1750 (Luminosidad)',
      0x40: 'INA219 (Corriente)',
      0x44: 'SHT30 (Temperatura)',
      0x5A: 'MLX90614 (IR Temp)',
      0x08: 'Arduino (Possibly)',
      0x10: 'VEML6075 / PCF8563'
    };
    return known[addr] || null;
  }

  return {
    scanBus,
    fullScan,
    repeatScan,
    probeAddress,
    generateAddressGrid,
    formatAddress,
    getCommonDevice,
    parseBridgeResponse,
    setLogCallback,
    I2C_MIN_ADDR,
    I2C_MAX_ADDR
  };
})();
