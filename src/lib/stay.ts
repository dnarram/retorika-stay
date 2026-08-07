import type { Property, Stay } from "./schema";

/* ---------------------------------------------------------------------------
   El ciclo de vida de una guía.

   Una guía de alojamiento contiene la llave de una casa habitada. Mientras el
   enlace fuese eterno, quien lo tuvo una vez lo tenía para siempre. Con la
   estancia como entidad, el enlace tiene principio y final:

     antes → llegada → estancia → salida → recuerdo

   En "recuerdo" la guía NO se apaga: se degrada. El código de acceso, la clave
   del WiFi y las instrucciones de entrada dejan de servirse desde el servidor;
   las recomendaciones, el mapa y el resumen del viaje siguen ahí. El huésped no
   se encuentra una puerta cerrada, se encuentra una guía que ya no abre puertas.

   Esto no impide una captura de pantalla, y no pretende hacerlo: reduce la
   ventana de exposición de "para siempre" a "los días de la reserva".
--------------------------------------------------------------------------- */

export const PHASES = ["antes", "llegada", "estancia", "salida", "recuerdo"] as const;
export type StayPhase = (typeof PHASES)[number];

/* Margen tras la salida antes de cortar los datos sensibles: un vuelo se
   retrasa, un huésped vuelve a por algo olvidado. Un día es suficiente. */
const GRACE_DAYS = 1;

export function isPhase(value: unknown): value is StayPhase {
  return typeof value === "string" && (PHASES as readonly string[]).includes(value);
}

export function todayISO(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function shiftDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function stayPhase(stay: Pick<Stay, "arrival" | "departure">, now = new Date()): StayPhase {
  const today = todayISO(now);
  if (today < stay.arrival) return "antes";
  if (today === stay.arrival) return "llegada";
  if (today === stay.departure) return "salida";
  if (today > stay.departure) return "recuerdo";
  return "estancia";
}

/* Los datos sensibles viajan al navegador desde el día antes de la llegada
   hasta un día después de la salida. Fuera de esa ventana no están ocultos por
   CSS: no existen en el HTML. */
export function canRevealAccess(
  stay: Pick<Stay, "arrival" | "departure" | "revoked">,
  now = new Date(),
): boolean {
  if (stay.revoked) return false;
  const today = todayISO(now);
  return today >= shiftDays(stay.arrival, -1) && today <= shiftDays(stay.departure, GRACE_DAYS);
}

export function nightsBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return ms > 0 ? Math.round(ms / 86400000) : 0;
}

/* El código de acceso de una estancia terminada sigue abriendo la puerta para
   la siguiente mientras el anfitrión no lo cambie: la app no puede girar una
   caja de llaves física, pero sí puede avisar de que toca hacerlo. */
export function needsCodeRotation(
  property: Pick<Property, "accessCodeUpdatedAt">,
  stays: Pick<Stay, "departure" | "accessCodeOverride">[],
  now = new Date(),
): boolean {
  const today = todayISO(now);
  const lastFinished = stays
    .filter((stay) => !stay.accessCodeOverride && stay.departure < today)
    .map((stay) => stay.departure)
    .sort()
    .at(-1);
  if (!lastFinished) return false;
  if (!property.accessCodeUpdatedAt) return true;
  return property.accessCodeUpdatedAt.slice(0, 10) < lastFinished;
}

/* Dos tipos de enlace, y esa es la decisión de seguridad más importante del
   rediseño:

   · muestra   → el que el anfitrión pega en el anuncio. Enseña la guía entera
                 MENOS lo que abre la casa. Se puede compartir con desconocidos.
   · estancia  → el del QR de la nevera. Da acceso completo, y solo mientras
                 dura la reserva. */
export type Audience =
  | { kind: "estancia"; phase: StayPhase; reveal: boolean }
  | { kind: "muestra"; phase: StayPhase; reveal: false };
