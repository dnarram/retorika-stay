import { z } from "zod";

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

export const propertySchema = z.object({
  id: z.string(),
  hostId: z.string(),
  slug: z.string().min(6),
  name: z.string().min(2).max(80),
  city: z.string().min(2).max(80),
  address: z.string().min(4).max(160),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  hostName: z.string().min(2).max(60),
  hostPhone: z.string().min(6).max(32),
  wifiSsid: z.string().max(64),
  wifiPassword: z.string().max(64),
  wifiSecurity: z.enum(["WPA", "WEP", "nopass"]).default("WPA"),
  /* Sensitive: never sent to the client outside the booking window. */
  accessCode: z.string().max(32),
  accessCodeUpdatedAt: z.string().nullable(),
  checkinFrom: z.string().regex(/^\d{2}:\d{2}$/),
  checkoutUntil: z.string().regex(/^\d{2}:\d{2}$/),
  contacts: z.array(contactSchema).max(12),
  defaultLocale: localeSchema,
  published: z.boolean(),
  pin: z.string().regex(/^\d{4}$/).nullable(),
});
export type Property = z.infer<typeof propertySchema>;

export const ruleSchema = z.object({
  text: z.string().min(2).max(160),
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
  transport: z.array(z.object({ title: z.string().max(60), body: z.string().max(400) })).max(12),
  emergencyNote: z.string().max(400),
  checkoutSteps: z.array(z.string().max(240)).max(12),
  faqs: z.array(z.object({ q: z.string().max(140), a: z.string().max(600) })).max(20),
});
export type Guide = z.infer<typeof guideSchema>;

export const placeNoteSchema = z.object({
  tagline: z.string().max(80),
  note: z.string().max(400),
});

export const placeSchema = z.object({
  id: z.string(),
  propertyId: z.string(),
  category: placeCategorySchema,
  name: z.string().min(2).max(80),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  price: z.number().int().min(1).max(3).nullable(),
  url: z.string().url().nullable(),
  phone: z.string().max(32).nullable(),
  /* The host's personal note is what makes this a guide rather than a map: it
     is stored per language and is the most translated field in the app. */
  notes: z.record(localeSchema, placeNoteSchema),
});
export type Place = z.infer<typeof placeSchema>;

/* Partial payloads accepted by the API while the editor autosaves. */
export const propertyPatchSchema = propertySchema
  .omit({ id: true, hostId: true, slug: true })
  .partial();
export const guidePatchSchema = guideSchema.partial();
export const placeInputSchema = placeSchema.omit({ id: true, propertyId: true });

export type PropertyPatch = z.infer<typeof propertyPatchSchema>;
export type GuidePatch = z.infer<typeof guidePatchSchema>;

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
});
export type Stay = z.infer<typeof staySchema>;

export const stayInputSchema = staySchema.omit({ id: true, propertyId: true, slug: true, revoked: true });

/* Metrics aggregated per property and day. Never per guest or per device: with
   no identifiers there is no personal data to protect. */
export const METRIC_KINDS = ["open", "language", "section", "search_miss", "call"] as const;
export const metricKindSchema = z.enum(METRIC_KINDS);
export type MetricKind = (typeof METRIC_KINDS)[number];

export const trackSchema = z.object({
  slug: z.string().min(6),
  kind: metricKindSchema,
  value: z.string().max(60).default(""),
});
