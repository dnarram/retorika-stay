import type { Property, Stay } from "./schema";

/* ---------------------------------------------------------------------------
   The life cycle of a guide.

   A property guide holds the key to a home someone lives in. While the link
   never expired, whoever held it once held it forever. With the booking as a
   first-class entity, the link now has a beginning and an end:

     before → arrival → staying → departure → memories

   In "memories" the guide is NOT switched off: it degrades. The access code,
   the Wi-Fi password and the entry instructions stop being served; the
   recommendations, the map and the trip summary stay. The guest does not hit a
   closed door — they find a guide that no longer opens doors.

   This does not prevent a screenshot, and it does not pretend to: it shrinks
   the exposure window from "forever" down to "the days of the booking".
--------------------------------------------------------------------------- */

export const PHASES = ["before", "arrival", "staying", "departure", "memories"] as const;
export type StayPhase = (typeof PHASES)[number];

/* Grace period after check-out before sensitive data is cut off: flights get
   delayed, guests come back for something they forgot. One day is enough. */
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
  if (today < stay.arrival) return "before";
  if (today === stay.arrival) return "arrival";
  if (today === stay.departure) return "departure";
  if (today > stay.departure) return "memories";
  return "staying";
}

/* Sensitive data reaches the browser from the day before arrival until one day
   after departure. Outside that window it is not hidden with CSS: it does not
   exist in the HTML at all. */
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

/* A finished booking's access code still opens the door for the next guest
   until the host changes it. The app cannot turn a physical key box, but it can
   say out loud that it is time to do so. */
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

/* Two kinds of link, and this is the most important security decision of the
   redesign:

   · listing → the one the host pastes into the rental ad. Shows the whole guide
               EXCEPT anything that opens the home. Safe to share with strangers.
   · booking → the one on the fridge QR. Full access, and only for as long as
               the booking lasts. */
export type Audience =
  | { kind: "booking"; phase: StayPhase; reveal: boolean }
  | { kind: "listing"; phase: StayPhase; reveal: false };
