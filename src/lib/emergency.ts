import type { ContactKind } from "./schema";

/* ---------------------------------------------------------------------------
   Emergency numbers, as a curated table rather than an API call.

   There is no free, reliable, worldwide "emergency numbers" API, and this is
   precisely the data that must not depend on one: it has to be right, it has to
   work offline, and it must not change under the host's feet. A table of a few
   dozen countries is small, auditable and versionable — and the country comes
   from the coordinates the host has already placed on the map, so they are
   offered without being asked anything.

   112 is the single European emergency number and works in every EU country,
   from any phone, including one with no SIM or no credit. Countries listed
   below add their national numbers where they still differ.

   These are suggestions the host ticks, never data published on their behalf:
   an emergency number shown on a guide is a promise, and the person making the
   promise should be the one who chose it.

   Note on the `kind` values: they are deliberately GENERIC — "police", not
   "local police". Spain has three police forces with three numbers, and filing
   the Guardia Civil under a label that reads "local police" is simply wrong.
   Which force it is belongs in the detail line, where it is a fact rather than
   a miscategorisation.
--------------------------------------------------------------------------- */

export type Suggestion = { kind: ContactKind; phone: string; detail: string };

const EU_112: Suggestion = {
  kind: "emergency",
  phone: "112",
  detail: "Emergencias — funciona sin cobertura contratada",
};

const BY_COUNTRY: Record<string, Suggestion[]> = {
  ES: [
    EU_112,
    { kind: "police", phone: "091", detail: "Policía Nacional" },
    { kind: "police", phone: "062", detail: "Guardia Civil" },
    { kind: "health", phone: "061", detail: "Urgencias sanitarias" },
  ],
  PT: [EU_112, { kind: "health", phone: "808 24 24 24", detail: "SNS 24" }],
  FR: [
    EU_112,
    { kind: "police", phone: "17", detail: "Police secours" },
    { kind: "health", phone: "15", detail: "SAMU" },
  ],
  IT: [EU_112, { kind: "health", phone: "118", detail: "Emergenza sanitaria" }],
  DE: [EU_112, { kind: "police", phone: "110", detail: "Polizei" }],
  NL: [EU_112],
  BE: [EU_112],
  IE: [EU_112, { kind: "emergency", phone: "999", detail: "Emergencias" }],
  AT: [EU_112],
  PL: [EU_112, { kind: "police", phone: "997", detail: "Policja" }],
  GR: [EU_112, { kind: "health", phone: "166", detail: "Ασθενοφόρο" }],
  GB: [
    { kind: "emergency", phone: "999", detail: "Emergencias" },
    { kind: "emergency", phone: "112", detail: "Emergencias (también válido)" },
    { kind: "health", phone: "111", detail: "NHS, urgencias no vitales" },
  ],
  US: [{ kind: "emergency", phone: "911", detail: "Emergencias" }],
  CA: [{ kind: "emergency", phone: "911", detail: "Emergencias" }],
  MX: [{ kind: "emergency", phone: "911", detail: "Emergencias" }],
  AR: [
    { kind: "emergency", phone: "911", detail: "Emergencias" },
    { kind: "health", phone: "107", detail: "Emergencias médicas" },
  ],
  MA: [
    { kind: "police", phone: "19", detail: "Police" },
    { kind: "health", phone: "15", detail: "SAMU" },
  ],
};

/* European Economic Area plus the countries that adopted 112: anything here
   without its own entry still gets the single European number. */
const EU_112_ONLY = [
  "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "HU", "LV", "LT", "LU", "MT", "RO",
  "SK", "SI", "SE", "NO", "IS", "LI", "CH", "RS", "ME", "AL", "MK", "TR", "UA",
];

export function suggestedContacts(countryCode: string | undefined): Suggestion[] {
  if (!countryCode) return [];
  const code = countryCode.toUpperCase();
  if (BY_COUNTRY[code]) return BY_COUNTRY[code];
  if (EU_112_ONLY.includes(code)) return [EU_112];
  return [];
}

/* Everything above is a number that works nationwide. The pharmacy, the local
   police station and the nearest health centre are specific to the address and
   are found on the map instead — see the "nearby" search in the editor. */
export const LOCAL_KINDS: ContactKind[] = ["pharmacy", "health", "police"];
