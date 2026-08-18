import { z } from "zod";
import { DEFAULT_THEME, themeSchema } from "./theme";

/* ---------------------------------------------------------------------------
   Single source of truth for the domain. The same schema validates the host's
   form (client), the request bodies hitting the API (server) and the JSONB that
   goes into PostgreSQL. Change it here and it changes in all three places.
--------------------------------------------------------------------------- */

export const LOCALES = ["es", "en", "fr", "pt"] as const;
export const localeSchema = z.enum(LOCALES);
export type Locale = (typeof LOCALES)[number];

/* Categories and contact types are ENUMS, not free text: the label the guest
   sees comes from the language dictionary, so one value the host picks is
   translated into four languages without them typing anything. */
export const PLACE_CATEGORIES = [
  "restaurant",
  "tapas",
  "cafe",
  "sights",
  "outdoors",
  "shopping",
  "nightlife",
  "services",
] as const;
export const placeCategorySchema = z.enum(PLACE_CATEGORIES);
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export const CONTACT_KINDS = [
  "emergency",
  "police",
  "health",
  "pharmacy",
  "taxi",
  "host",
  "maintenance",
] as const;
export const contactKindSchema = z.enum(CONTACT_KINDS);
export type ContactKind = (typeof CONTACT_KINDS)[number];

export const contactSchema = z.object({
  kind: contactKindSchema,
  phone: z.string().min(3).max(32),
  detail: z.string().max(120).optional(),
});

/* A draft is allowed to be incomplete.

   The first version enforced minimum lengths here (hostName >= 2, hostPhone >=
   6...), which meant a freshly created property — whose fields are empty by
   design — failed validation on every single autosave. The editor showed
   "could not save" and nothing persisted, including the publish flag.

   The rule that was wrong is the placement, not the requirement: storage
   accepts a half-written draft, and the bar for PUBLISHING is enforced in the
   publish path (see publishableProperty below). Formats that would corrupt data
   are still enforced here — coordinates, times, PIN shape, enums. */
export const propertySchema = z.object({
  id: z.string(),
  hostId: z.string(),
  slug: z.string().min(6),
  name: z.string().max(80),
  city: z.string().max(80),
  address: z.string().max(160),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  hostName: z.string().max(60),
  hostPhone: z.string().max(32),
  wifiSsid: z.string().max(64),
  wifiPassword: z.string().max(64),
  wifiSecurity: z.enum(["WPA", "WEP", "nopass"]).default("WPA"),
  /* Sensitive: never sent to the client outside the booking window. */
  accessCode: z.string().max(32),
  accessCodeUpdatedAt: z.string().nullable(),
  checkinFrom: z.string().regex(/^\d{2}:\d{2}$/),
  checkoutUntil: z.string().regex(/^\d{2}:\d{2}$/),
  contacts: z.array(contactSchema).max(12),
  /* Sections the host has switched off. Hiding is not deleting: the content
     stays exactly where it was and comes back the moment the switch is flipped.
     A host who runs a flat with no rules should not have to erase them to stop
     showing them. */
  hiddenSections: z.array(z.string().max(24)).max(20).default([]),
  theme: themeSchema.default(DEFAULT_THEME),
  /* Steps the host has actually opened. Content alone is not agreement: a guide
     arrives with starter rules and a checkout list, and ticking those off
     before the host has ever laid eyes on them tells them their guide is ready
     when nobody has read a word of it. A step counts as done when it holds
     something AND somebody looked at it. */
  visitedSteps: z.array(z.number().int().min(1).max(12)).max(12).default([]),
  defaultLocale: localeSchema,
  published: z.boolean(),
  pin: z.string().regex(/^\d{4}$/).nullable().or(z.literal("")).transform((v) => (v === "" ? null : v)),
});
export type Property = z.infer<typeof propertySchema>;

/* The bar a guide has to clear before it can be published.

   It only asks for what the app cannot know on its own and what a guide is
   useless without: which flat this is and where it is. The host's name comes
   from their account, and their phone belongs in the emergency contacts, where
   the host decides whether to publish it at all — asking for it twice, as a
   blocking requirement, with no field to type it in, was a requirement invented
   for the schema's convenience rather than the host's. */
export function publishBlockers(property: { name: string; address: string }): string[] {
  const missing: string[] = [];
  if (property.name.trim().length < 2) missing.push("el nombre del alojamiento");
  if (property.address.trim().length < 4) missing.push("la dirección");
  return missing;
}

export const ruleSchema = z.object({
  text: z.string().max(160),
  /* true = allowed, false = forbidden, null = nuance. Icon and colour are
     derived from this, not from parsing the text, and colour is never the only
     signal carrying the meaning. */
  allowed: z.boolean().nullable(),
});

export const guideSchema = z.object({
  welcomeTitle: z.string().max(80),
  welcomeIntro: z.string().max(600),
  arrivalSteps: z.array(z.string().max(300)).max(10),
  parking: z.string().max(400),
  wifiNote: z.string().max(300),
  house: z.array(z.object({ title: z.string().max(60), body: z.string().max(600) })).max(20),
  rules: z.array(ruleSchema).max(20),
  /* Coordinates are optional because most transport entries are advice ("the
     bus takes two hours"), but the ones that are places — the airport, the
     station, the taxi rank — become a tappable destination when the host
     pins them. */
  transport: z
    .array(
      z.object({
        title: z.string().max(60),
        body: z.string().max(400),
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
      }),
    )
    .max(12),
  emergencyNote: z.string().max(400),
  checkoutSteps: z.array(z.string().max(240)).max(12),
  faqs: z.array(z.object({ q: z.string().max(140), a: z.string().max(600) })).max(20),
});
export type Guide = z.infer<typeof guideSchema>;

export const placeNoteSchema = z.object({
  tagline: z.string().max(80),
  note: z.string().max(400),
});

/* A place is either somewhere the host recommends or somewhere the guest hopes
   never to need. Mixing a hospital into the restaurant map is jarring in both
   directions, so the scope travels with the place and each section draws its
   own map. */
export const PLACE_SCOPES = ["recommendation", "emergency"] as const;
export const placeScopeSchema = z.enum(PLACE_SCOPES);
export type PlaceScope = (typeof PLACE_SCOPES)[number];

export const placeSchema = z.object({
  id: z.string(),
  propertyId: z.string(),
  category: placeCategorySchema,
  name: z.string().max(80),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  scope: placeScopeSchema.default("recommendation"),
  price: z.number().int().min(1).max(3).nullable(),
  url: z.string().url().nullable(),
  phone: z.string().max(32).nullable(),
  /* Opening hours as OpenStreetMap writes them ("Mo-Sa 09:00-21:30"). Stored
     raw and shown raw: parsing them into a weekly table is a rabbit hole with
     public holidays at the bottom, and the string is already readable. */
  hours: z.string().max(120).nullable().default(null),
  /* The host's personal note is what makes this a guide rather than a map: it
     is stored per language and is the most translated field in the app. */
  notes: z.record(localeSchema, placeNoteSchema),
});
export type Place = z.infer<typeof placeSchema>;

/* Partial payloads accepted by the API while the editor autosaves. */
export const propertyPatchSchema = propertySchema
  .omit({ id: true, hostId: true, slug: true })
  .partial();
export const placeInputSchema = placeSchema.omit({ id: true, propertyId: true });

export type PropertyPatch = z.infer<typeof propertyPatchSchema>;

/* ---------------------------------------------------------------------------
   Booking. This was the missing piece: dates used to hang off the property, so
   a guide link was a credential that never expired. With bookings, each stay
   gets its own link, can be revoked on its own, and access stops being served
   once the guest leaves.
--------------------------------------------------------------------------- */
export const staySchema = z.object({
  id: z.string(),
  propertyId: z.string(),
  /* The booking's own link, distinct from the property's listing link. */
  slug: z.string().min(6),
  guestName: z.string().max(60).nullable(),
  arrival: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departure: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /* Per-booking code, for smart locks. When null, the property code is used. */
  accessCodeOverride: z.string().max(32).nullable(),
  pin: z.string().regex(/^\d{4}$/).nullable(),
  revoked: z.boolean(),
  /* The single most useful number a host can have, and the only one that
     touches a named booking: did this guest ever open their guide. A date, not
     a behaviour log — enough to send a reminder, not enough to reconstruct
     somebody's evening. */
  openedAt: z.string().nullable().default(null),
});
export type Stay = z.infer<typeof staySchema>;

export const stayInputSchema = staySchema.omit({ id: true, propertyId: true, slug: true, revoked: true });

/* Metrics aggregated per property and day. Never per guest or per device: with
   no identifiers there is no personal data to protect. */
/* Four questions a host actually asks about their guide, and the events that
   answer them:
     ¿llega?        open, unique, language, device
     ¿sirve?        section, helpful, search_miss
     ¿ahorra?       call, reveal, directions
     ¿se comparte?  keepsake, print
   Nothing here identifies anybody: every event is a counter on a property and
   a day. */
export const METRIC_KINDS = [
  "open",
  "unique",
  "language",
  "section",
  "search_miss",
  "call",
  "device",
  "helpful",
  "reveal",
  "directions",
  "keepsake",
  "print",
  "share",
] as const;
export const metricKindSchema = z.enum(METRIC_KINDS);
export type MetricKind = (typeof METRIC_KINDS)[number];

export const trackSchema = z.object({
  slug: z.string().min(6),
  kind: metricKindSchema,
  value: z.string().max(60).default(""),
});
