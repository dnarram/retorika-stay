/* Carga útil del QR de WiFi (formato de Android/iOS): al escanearlo el móvil se
   conecta sin teclear la clave. Es la micro-utilidad con mejor relación entre
   valor para el huésped y coste de implementación de toda la app. */
export function wifiQrPayload(input: {
  ssid: string;
  password: string;
  security: "WPA" | "WEP" | "nopass";
  hidden?: boolean;
}): string {
  const escape = (value: string) => value.replace(/([\\;,:"])/g, "\\$1");
  const security = input.security === "nopass" ? "nopass" : input.security;
  const pass = input.security === "nopass" ? "" : `P:${escape(input.password)};`;
  return `WIFI:T:${security};S:${escape(input.ssid)};${pass}${input.hidden ? "H:true;" : ""};`;
}
