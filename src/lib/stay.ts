import type { Property } from "./schema";

/* La guía se reordena según el momento de la estancia. Un huésped que aún no ha
   llegado necesita la dirección y el código de la puerta; el del último día
   necesita la hora de salida y qué hacer con la basura. Es la decisión de
   arquitectura de la información que sostiene toda la vista del huésped. */
export const PHASES = ["antes", "llegada", "estancia", "salida", "despues"] as const;
export type StayPhase = (typeof PHASES)[number];

export function isPhase(value: unknown): value is StayPhase {
  return typeof value === "string" && (PHASES as readonly string[]).includes(value);
}

export function todayISO(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function stayPhase(property: Pick<Property, "stayFrom" | "stayTo">, now = new Date()): StayPhase {
  const { stayFrom, stayTo } = property;
  if (!stayFrom || !stayTo) return "estancia";
  const today = todayISO(now);
  if (today < stayFrom) return "antes";
  if (today === stayFrom) return "llegada";
  if (today === stayTo) return "salida";
  if (today > stayTo) return "despues";
  return "estancia";
}

/* El código de acceso solo sale del servidor durante la ventana de la reserva
   (con un día de margen por vuelos que se retrasan). Fuera de ella, la guía se
   puede leer entera pero el código no existe en el HTML. */
export function canRevealAccessCode(
  property: Pick<Property, "stayFrom" | "stayTo">,
  now = new Date(),
): boolean {
  const { stayFrom, stayTo } = property;
  if (!stayFrom || !stayTo) return true;
  const today = todayISO(now);
  const from = new Date(`${stayFrom}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 1);
  return today >= from.toISOString().slice(0, 10) && today <= stayTo;
}

export function nightsBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return ms > 0 ? Math.round(ms / 86400000) : null;
}
