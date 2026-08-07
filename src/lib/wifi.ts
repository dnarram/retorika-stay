/* Wi-Fi QR payload (the format Android and iOS understand): scanning it joins
   the network without typing the password. Best value-to-effort ratio of any
   feature in the app. */
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
