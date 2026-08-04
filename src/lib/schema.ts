import { z } from "zod";

/* ---------------------------------------------------------------------------
   Fuente única de verdad del dominio. El mismo esquema valida el formulario del
   anfitrión (cliente), el cuerpo de las peticiones a la API (servidor) y el
   JSONB que entra en PostgreSQL. Si cambia aquí, cambia en los tres sitios.
--------------------------------------------------------------------------- */

export const LOCALES = ["es", "en", "fr", "pt"] as const;
export const localeSchema = z.enum(LOCALES);
export type Locale = (typeof LOCALES)[number];

/* Categorías y tipos de teléfono son ENUMERADOS, no texto libre: el rótulo que
   ve el huésped sale del diccionario de idiomas, así que un dato se traduce a
   cuatro idiomas sin que el anfitrión escriba nada. */
export const PLACE_CATEGORIES = [
  "comer",
  "tapas",
  "cafe",
  "ver",
  "naturaleza",
  "compras",
  "noche",
  "servicios",
] as const;
export const placeCategorySchema = z.enum(PLACE_CATEGORIES);
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export const CONTACT_KINDS = [
  "emergencias",
  "policia",
  "salud",
  "farmacia",
  "taxi",
  "anfitrion",
  "averias",
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
  /* Dato sensible: nunca viaja al cliente fuera de la ventana de estancia. */
  accessCode: z.string().max(32),
  checkinFrom: z.string().regex(/^\d{2}:\d{2}$/),
  checkoutUntil: z.string().regex(/^\d{2}:\d{2}$/),
  stayFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  stayTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  contacts: z.array(contactSchema).max(12),
  defaultLocale: localeSchema,
  published: z.boolean(),
  pin: z.string().regex(/^\d{4}$/).nullable(),
});
export type Property = z.infer<typeof propertySchema>;

export const ruleSchema = z.object({
  text: z.string().min(2).max(160),
  /* true = permitido, false = prohibido, null = matiz. El icono y el color se
     derivan de aquí, no de leer el texto: el color nunca es la única señal. */
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
  /* La nota personal del anfitrión es lo que diferencia esta guía de un mapa:
     se guarda por idioma y es el campo que más se traduce. */
  notes: z.record(localeSchema, placeNoteSchema),
});
export type Place = z.infer<typeof placeSchema>;

/* Parciales aceptados por la API al autoguardar el editor. */
export const propertyPatchSchema = propertySchema
  .omit({ id: true, hostId: true, slug: true })
  .partial();
export const guidePatchSchema = guideSchema.partial();
export const placeInputSchema = placeSchema.omit({ id: true, propertyId: true });

export type PropertyPatch = z.infer<typeof propertyPatchSchema>;
export type GuidePatch = z.infer<typeof guidePatchSchema>;
