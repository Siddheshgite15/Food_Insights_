/*
 * =====================================================================
 * Banana Food Insight - Arduino UNO + DHT22 Firmware
 * =====================================================================
 *
 * IMPORTANT NOTE:
 * You only need to upload this sketch to your Arduino ONCE!
 * The code is stored permanently in the Arduino's non-volatile Flash memory.
 * Every time you plug the Arduino into your PC's USB port, this code starts
 * running automatically within 1 second.
 *
 * DO NOT keep the Arduino IDE Serial Monitor open when running the Python
 * or web application, as Windows allows only one program to use COM3 at a time.
 *
 * Hardware Wiring:
 *   - DHT22 Pin 1 (VCC)  -> Arduino 5V
 *   - DHT22 Pin 2 (DATA) -> Arduino Digital Pin 2
 *   - DHT22 Pin 3 (NC)   -> Not connected
 *   - DHT22 Pin 4 (GND)  -> Arduino GND
 *   (If using a bare 4-pin DHT22, connect a 10k resistor between VCC and DATA)
 * =====================================================================
 */

#include "DHT.h"

#define DHTPIN 2     // Digital pin connected to the DHT sensor
#define DHTTYPE DHT22   // DHT 22 (AM2302, AM2321)

DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(9600);
  dht.begin();
  delay(1500); // Allow sensor voltage stabilization
}

void loop() {
  // Reading temperature or humidity takes about 250 milliseconds!
  // Sensor readings may also be up to 2 seconds old (slow sensor).
  delay(2000);

  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature(); // Celsius

  // Check if any reads failed and exit early (to try again).
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("ERROR: DHT22 sensor read failed!");
    return;
  }

  // Standard output format recognized by Banana Food Insight reader:
  Serial.print("Temperature: ");
  Serial.print(temperature, 1);
  Serial.print(", Humidity: ");
  Serial.println(humidity, 1);
}
