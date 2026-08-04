import { GUIDES, HOSTS, PLACES, PROPERTIES, type GuideRecord } from "@/data/seed";
import { getSql, hasDatabase } from "./db";
import type { Guide, Locale, Place, Property } from "./schema";

/* ---------------------------------------------------------------------------
   Un único contrato de datos con dos implementaciones:

     · PostgreSQL  — la real, si hay DATABASE_URL.
     · Memoria     — copia de los datos semilla, si no la hay.

   El motivo no es lucirse con una abstracción: es que quien revise esto pueda
   clonar el repo, hacer `npm run dev` y ver la app entera funcionando en
   quince segundos, sin levantar una base de datos. En modo demo las escrituras
   funcionan pero se pierden al reiniciar, y la interfaz lo dice.
--------------------------------------------------------------------------- */

export type Host = { id: string; email: string; name: string; passwordHash: string };

export interface Repo {
  mode: "postgres" | "demo";
  getHostByEmail(email: string): Promise<Host | null>;
  listProperties(hostId: string): Promise<Property[]>;
  getProperty(id: string): Promise<Property | null>;
  getPropertyBySlug(slug: string): Promise<Property | null>;
  updateProperty(id: string, patch: Partial<Property>): Promise<Property | null>;
  getGuide(propertyId: string, locale: Locale): Promise<GuideRecord | null>;
  listGuides(propertyId: string): Promise<GuideRecord[]>;
  saveGuide(propertyId: string, locale: Locale, content: Guide, reviewed: boolean): Promise<void>;
  listPlaces(propertyId: string): Promise<Place[]>;
  savePlace(place: Place): Promise<void>;
  deletePlace(id: string): Promise<void>;
}

/* --------------------------------- memoria -------------------------------- */

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const memory = {
  hosts: clone(HOSTS) as Host[],
  properties: clone(PROPERTIES),
  guides: clone(GUIDES),
  places: clone(PLACES),
};

const demoRepo: Repo = {
  mode: "demo",
  async getHostByEmail(email) {
    return memory.hosts.find((h) => h.email === email.toLowerCase()) ?? null;
  },
  async listProperties(hostId) {
    return memory.properties.filter((p) => p.hostId === hostId);
  },
  async getProperty(id) {
    return memory.properties.find((p) => p.id === id) ?? null;
  },
  async getPropertyBySlug(slug) {
    return memory.properties.find((p) => p.slug === slug) ?? null;
  },
  async updateProperty(id, patch) {
    const index = memory.properties.findIndex((p) => p.id === id);
    if (index < 0) return null;
    memory.properties[index] = { ...memory.properties[index], ...patch };
    return memory.properties[index];
  },
  async getGuide(propertyId, locale) {
    return memory.guides.find((g) => g.propertyId === propertyId && g.locale === locale) ?? null;
  },
  async listGuides(propertyId) {
    return memory.guides.filter((g) => g.propertyId === propertyId);
  },
  async saveGuide(propertyId, locale, content, reviewed) {
    const index = memory.guides.findIndex((g) => g.propertyId === propertyId && g.locale === locale);
    const record: GuideRecord = { propertyId, locale, content, reviewed };
    if (index < 0) memory.guides.push(record);
    else memory.guides[index] = record;
  },
  async listPlaces(propertyId) {
    return memory.places.filter((p) => p.propertyId === propertyId);
  },
  async savePlace(place) {
    const index = memory.places.findIndex((p) => p.id === place.id);
    if (index < 0) memory.places.push(place);
    else memory.places[index] = place;
  },
  async deletePlace(id) {
    memory.places = memory.places.filter((p) => p.id !== id);
  },
};

/* -------------------------------- postgres -------------------------------- */

type PropertyRow = {
  id: string;
  host_id: string;
  slug: string;
  name: string;
  city: string;
  address: string;
  lat: string | number;
  lng: string | number;
  host_name: string;
  host_phone: string;
  wifi_ssid: string;
  wifi_password: string;
  wifi_security: Property["wifiSecurity"];
  access_code: string;
  checkin_from: string;
  checkout_until: string;
  stay_from: string | null;
  stay_to: string | null;
  contacts: Property["contacts"];
  default_locale: Locale;
  published: boolean;
  pin: string | null;
};

const toProperty = (row: PropertyRow): Property => ({
  id: row.id,
  hostId: row.host_id,
  slug: row.slug,
  name: row.name,
  city: row.city,
  address: row.address,
  lat: Number(row.lat),
  lng: Number(row.lng),
  hostName: row.host_name,
  hostPhone: row.host_phone,
  wifiSsid: row.wifi_ssid,
  wifiPassword: row.wifi_password,
  wifiSecurity: row.wifi_security,
  accessCode: row.access_code,
  checkinFrom: row.checkin_from.slice(0, 5),
  checkoutUntil: row.checkout_until.slice(0, 5),
  stayFrom: row.stay_from ? String(row.stay_from).slice(0, 10) : null,
  stayTo: row.stay_to ? String(row.stay_to).slice(0, 10) : null,
  contacts: row.contacts ?? [],
  defaultLocale: row.default_locale,
  published: row.published,
  pin: row.pin,
});

/* Mapa campo de dominio -> columna. Escrito a mano y no generado para que el
   PATCH parcial no pueda tocar columnas que el anfitrión no debe cambiar. */
const COLUMN: Record<string, string> = {
  name: "name",
  city: "city",
  address: "address",
  lat: "lat",
  lng: "lng",
  hostName: "host_name",
  hostPhone: "host_phone",
  wifiSsid: "wifi_ssid",
  wifiPassword: "wifi_password",
  wifiSecurity: "wifi_security",
  accessCode: "access_code",
  checkinFrom: "checkin_from",
  checkoutUntil: "checkout_until",
  stayFrom: "stay_from",
  stayTo: "stay_to",
  contacts: "contacts",
  defaultLocale: "default_locale",
  published: "published",
  pin: "pin",
};

const pgRepo: Repo = {
  mode: "postgres",
  async getHostByEmail(email) {
    const sql = getSql();
    const rows = await sql<{ id: string; email: string; name: string; password_hash: string }[]>`
      select id, email, name, password_hash from hosts where email = ${email.toLowerCase()} limit 1`;
    const row = rows[0];
    return row ? { id: row.id, email: row.email, name: row.name, passwordHash: row.password_hash } : null;
  },
  async listProperties(hostId) {
    const sql = getSql();
    const rows = await sql<PropertyRow[]>`
      select * from properties where host_id = ${hostId} order by name`;
    return rows.map(toProperty);
  },
  async getProperty(id) {
    const sql = getSql();
    const rows = await sql<PropertyRow[]>`select * from properties where id = ${id} limit 1`;
    return rows[0] ? toProperty(rows[0]) : null;
  },
  async getPropertyBySlug(slug) {
    const sql = getSql();
    const rows = await sql<PropertyRow[]>`select * from properties where slug = ${slug} limit 1`;
    return rows[0] ? toProperty(rows[0]) : null;
  },
  async updateProperty(id, patch) {
    const sql = getSql();
    const entries = Object.entries(patch).filter(([key]) => key in COLUMN);
    if (entries.length === 0) return this.getProperty(id);
    const assignments = entries.map(([key, value]) => {
      const column = COLUMN[key];
      const payload = column === "contacts" ? sql.json(value as never) : (value as never);
      return sql`${sql(column)} = ${payload}`;
    });
    const merged = assignments.reduce((acc, fragment, index) =>
      index === 0 ? fragment : sql`${acc}, ${fragment}`,
    );
    await sql`update properties set ${merged}, updated_at = now() where id = ${id}`;
    return this.getProperty(id);
  },
  async getGuide(propertyId, locale) {
    const sql = getSql();
    const rows = await sql<{ content: Guide; reviewed: boolean }[]>`
      select content, reviewed from guides where property_id = ${propertyId} and locale = ${locale} limit 1`;
    return rows[0] ? { propertyId, locale, content: rows[0].content, reviewed: rows[0].reviewed } : null;
  },
  async listGuides(propertyId) {
    const sql = getSql();
    const rows = await sql<{ locale: Locale; content: Guide; reviewed: boolean }[]>`
      select locale, content, reviewed from guides where property_id = ${propertyId}`;
    return rows.map((row) => ({ propertyId, locale: row.locale, content: row.content, reviewed: row.reviewed }));
  },
  async saveGuide(propertyId, locale, content, reviewed) {
    const sql = getSql();
    await sql`
      insert into guides (property_id, locale, content, reviewed, updated_at)
      values (${propertyId}, ${locale}, ${sql.json(content as never)}, ${reviewed}, now())
      on conflict (property_id, locale)
      do update set content = excluded.content, reviewed = excluded.reviewed, updated_at = now()`;
  },
  async listPlaces(propertyId) {
    const sql = getSql();
    const rows = await sql<
      {
        id: string;
        property_id: string;
        category: Place["category"];
        name: string;
        lat: string;
        lng: string;
        price: number | null;
        url: string | null;
        phone: string | null;
        notes: Place["notes"];
      }[]
    >`select * from places where property_id = ${propertyId} order by sort_order, name`;
    return rows.map((row) => ({
      id: row.id,
      propertyId: row.property_id,
      category: row.category,
      name: row.name,
      lat: Number(row.lat),
      lng: Number(row.lng),
      price: row.price,
      url: row.url,
      phone: row.phone,
      notes: row.notes,
    }));
  },
  async savePlace(place) {
    const sql = getSql();
    await sql`
      insert into places (id, property_id, category, name, lat, lng, price, url, phone, notes)
      values (${place.id}, ${place.propertyId}, ${place.category}, ${place.name}, ${place.lat},
              ${place.lng}, ${place.price}, ${place.url}, ${place.phone}, ${sql.json(place.notes as never)})
      on conflict (id) do update set
        category = excluded.category, name = excluded.name, lat = excluded.lat, lng = excluded.lng,
        price = excluded.price, url = excluded.url, phone = excluded.phone, notes = excluded.notes`;
  },
  async deletePlace(id) {
    const sql = getSql();
    await sql`delete from places where id = ${id}`;
  },
};

export function getRepo(): Repo {
  return hasDatabase ? pgRepo : demoRepo;
}
