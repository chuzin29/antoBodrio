/*
 * i2c_bridge.ino — I²C Bridge Firmware for Arduino/ESP32
 * 
 * Receives commands via Serial (115200 baud) and performs I²C bus operations.
 * 
 * Supported commands:
 *   SCAN          — Scan all I²C addresses (0x03-0x77) and return found addresses
 *   PROBE 0xXX    — Probe a specific address
 *   PING          — Heartbeat / connection test
 *   STATUS        — Return bridge status
 *   SPEED <val>   — Set I²C speed (100, 400, 1000 kHz)
 *   VERSION       — Return firmware version
 * 
 * Response format:
 *   FOUND:0x27,0x68,0x3C   (for SCAN)
 *   ACK                     (for PROBE if device responds)
 *   NACK                    (for PROBE if no response)
 *   PONG                    (for PING)
 * 
 * Compatible with:
 *   - Arduino Uno/Nano/Mega (Wire library)
 *   - ESP32 (Wire library)
 *   - ESP8266 (Wire library)
 * 
 * Wire connections:
 *   Arduino:  SDA=A4, SCL=A5
 *   ESP32:    SDA=GPIO21, SCL=GPIO22
 *   ESP8266:  SDA=GPIO4(D2), SCL=GPIO5(D1)
 */

#include <Wire.h>

#define FIRMWARE_VERSION "1.0.0"
#define I2C_MIN_ADDR 0x03
#define I2C_MAX_ADDR 0x77
#define DEFAULT_SDA 21   // ESP32 default, adjust for your board
#define DEFAULT_SCL 22   // ESP32 default, adjust for your board
#define DEFAULT_SPEED 100000

String inputBuffer = "";
bool i2cInitialized = false;

void setup() {
  Serial.begin(115200);
  while (!Serial) { ; }
  
  Serial.println("I²C Bridge v" FIRMWARE_VERSION " ready");
  Serial.println("Commands: SCAN, PROBE 0xXX, PING, STATUS, SPEED <kHz>, VERSION");
  
  // Initialize I²C with default settings
  Wire.begin(DEFAULT_SDA, DEFAULT_SCL, DEFAULT_SPEED);
  i2cInitialized = true;
  
  Serial.println("I²C bus initialized (SDA:" + String(DEFAULT_SDA) + " SCL:" + String(DEFAULT_SCL) + ")");
}

void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (inputBuffer.length() > 0) {
        processCommand(inputBuffer);
        inputBuffer = "";
      }
    } else {
      inputBuffer += c;
    }
  }
}

void processCommand(String cmd) {
  cmd.trim();
  cmd.toUpperCase();
  
  if (cmd == "PING") {
    handlePing();
  }
  else if (cmd == "SCAN") {
    handleScan();
  }
  else if (cmd.startsWith("PROBE")) {
    handleProbe(cmd);
  }
  else if (cmd == "STATUS") {
    handleStatus();
  }
  else if (cmd.startsWith("SPEED")) {
    handleSpeed(cmd);
  }
  else if (cmd == "VERSION") {
    handleVersion();
  }
  else {
    Serial.println("ERR:Unknown command '" + cmd + "'");
  }
}

void handlePing() {
  Serial.println("PONG");
}

void handleVersion() {
  Serial.println("VERSION:" FIRMWARE_VERSION);
}

void handleStatus() {
  String status = "STATUS:";
  status += "INIT=" + String(i2cInitialized ? "YES" : "NO");
  status += ",SPEED=" + String(Wire.getClock() / 1000) + "kHz";
  status += ",SDA=" + String(DEFAULT_SDA);
  status += ",SCL=" + String(DEFAULT_SCL);
  Serial.println(status);
}

void handleSpeed(String cmd) {
  // Extract speed value: "SPEED 400" -> 400 kHz
  int spaceIdx = cmd.indexOf(' ');
  if (spaceIdx < 0) {
    Serial.println("ERR:Missing speed value. Usage: SPEED <100|400|1000>");
    return;
  }
  
  String speedStr = cmd.substring(spaceIdx + 1);
  speedStr.trim();
  long speedKHz = speedStr.toInt();
  
  if (speedKHz != 100 && speedKHz != 400 && speedKHz != 1000) {
    Serial.println("ERR:Invalid speed. Use 100, 400, or 1000 kHz");
    return;
  }
  
  long speedHz = speedKHz * 1000;
  
  Wire.end();
  delay(10);
  Wire.begin(DEFAULT_SDA, DEFAULT_SCL, speedHz);
  i2cInitialized = true;
  
  Serial.println("OK:SPEED=" + String(speedKHz) + "kHz");
}

void handleScan() {
  Serial.println("SCANNING...");
  
  String foundList = "";
  int count = 0;
  
  for (byte addr = I2C_MIN_ADDR; addr <= I2C_MAX_ADDR; addr++) {
    Wire.beginTransmission(addr);
    byte error = Wire.endTransmission();
    
    if (error == 0) {
      // Device found (ACK)
      if (count > 0) foundList += ",";
      foundList += "0x";
      if (addr < 16) foundList += "0";
      foundList += String(addr, HEX);
      count++;
    }
    else if (error == 4) {
      // Unknown error (could be electrical issue)
      // We skip these for clean results
    }
    
    // Small delay for stability
    delay(2);
  }
  
  if (count > 0) {
    Serial.println("FOUND:" + foundList);
  } else {
    Serial.println("FOUND:NONE");
  }
  
  Serial.println("SCAN_COMPLETE:" + String(count));
}

void handleProbe(String cmd) {
  // Extract address: "PROBE 0x27" -> 0x27
  int spaceIdx = cmd.indexOf(' ');
  if (spaceIdx < 0) {
    Serial.println("ERR:Missing address. Usage: PROBE 0xXX");
    return;
  }
  
  String addrStr = cmd.substring(spaceIdx + 1);
  addrStr.trim();
  
  // Parse hex address
  long addr;
  if (addrStr.startsWith("0X")) {
    addr = strtol(addrStr.c_str(), NULL, 16);
  } else {
    addr = addrStr.toInt();
  }
  
  if (addr < 1 || addr > 127) {
    Serial.println("ERR:Invalid address. Range: 0x01-0x7F");
    return;
  }
  
  Wire.beginTransmission((byte)addr);
  byte error = Wire.endTransmission();
  
  if (error == 0) {
    Serial.println("ACK");
  } else if (error == 2) {
    Serial.println("NACK");
  } else if (error == 3) {
    Serial.println("NACK");
  } else {
    Serial.println("ERR:Code=" + String(error));
  }
}

/*
 * Advanced scan with retry (for diagnosing intermittent connections)
 * 
 * Uncomment to enable:
 * 
 * void handleAdvancedScan() {
 *   int retries = 5;
 *   byte results[128] = {0};
 *   
 *   for (int r = 0; r < retries; r++) {
 *     for (byte addr = I2C_MIN_ADDR; addr <= I2C_MAX_ADDR; addr++) {
 *       Wire.beginTransmission(addr);
 *       byte error = Wire.endTransmission();
 *       if (error == 0) {
 *         results[addr]++;
 *       }
 *       delay(1);
 *     }
 *     delay(100);
 *   }
 *   
 *   String output = "ADVSCAN:";
 *   for (byte addr = I2C_MIN_ADDR; addr <= I2C_MAX_ADDR; addr++) {
 *     if (results[addr] > 0) {
 *       if (output.length() > 8) output += ",";
 *       output += "0x";
 *       if (addr < 16) output += "0";
 *       output += String(addr, HEX);
 *       output += "(" + String(results[addr]) + "/" + String(retries) + ")";
 *     }
 *   }
 *   Serial.println(output);
 * }
 */
