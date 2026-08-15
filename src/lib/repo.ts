import { GUIDES, HOSTS, PLACES, PROPERTIES, STAYS, type GuideRecord } from "@/data/seed";
import { getSql, hasDatabase } from "./db";
import type { Guide, Locale, MetricKind, Place, Property, Stay } from "./schema";

/* ---------------------------------------------------------------------------
   One data contract, two implementations:

     · PostgreSQL — the real one, used when DATABASE_URL is set.
     · In-memory  — a copy of the seed data, used when it is not.

   The point is not to show off an abstraction. It is that whoever reviews this
   can clone the repo, run `npm run dev` and see the whole app working in
   fifteen seconds without provisioning a database. In demo mode writes do work
   but are lost on restart, and the UI says so.
--------------------------------------------------------------------------- */

export type Host = { id: string; email: string; name: string; passwordHash: string };

export interface Repo {
  mode: "postgres" | "demo";
  getHostByEmail(email: string): Promise<Host | null>;
  getHostById(id: string): Promise<Host | null>;
  listProperties(hostId: string): Promise<Property[]>;
  getProperty(id: string): Promise<Property | null>;
  getPropertyBySlug(slug: string): Promise<Property | null>;
  updateProperty(id: string, patch: Partial<Property>): Promise<Property | null>;
  createProperty(property: Property): Promise<Property>;
  deleteProperty(id: string): Promise<void>;
  listStays(propertyId: string): Promise<Stay[]>;
  getStayBySlug(slug: string): Promise<Stay | null>;
  saveStay(stay: Stay): Promise<void>;
  markStayOpened(id: string): Promise<void>;
  deleteStay(id: string): Promise<void>;
  createHost(host: Host): Promise<void>;
  track(propertyId: string, kind: MetricKind, value: string): Promise<void>;
  metrics(propertyId: string): Promise<{ kind: MetricKind; value: string; count: number; day?: string }[]>;
  getGuide(propertyId: string, locale: Locale): Promise<GuideRecord | null>;
  listGuides(propertyId: string): Promise<GuideRecord[]>;
  saveGuide(propertyId: string, locale: Locale, content: Guide, reviewed: boolean): Promise<void>;
  listPlaces(propertyId: string): Promise<Place[]>;
  savePlace(place: Place): Promise<void>;
  deletePlace(id: string): Promise<void>;
}

/* -------------------------------- in-memory ------------------------------- */

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/* PostgreSQL returns date and timestamptz columns as JavaScript Date objects,
   not strings. String(date).slice(0, 10) produced "Wed Aug 06" instead of
   "2026-08-06" and broke every date comparison in the booking life cycle. Demo
   mode never showed it because there the values are already strings: this bug
   only surfaces when running against a real database. */
const toISODate = (value: unknown): string =>
  value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

const toISOStamp = (value: unknown): string | null => {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
};

const memory = {
  hosts: clone(HOSTS) as Host[],
  properties: clone(PROPERTIES),
  guides: clone(GUIDES),
  places: clone(PLACES),
  stays: clone(STAYS),
  metrics: [] as { propertyId: string; kind: MetricKind; value: string; count: number }[],
};

const demoRepo: Repo = {
  mode: "demo",
  async getHostByEmail(email) {
    return memory.hosts.find((h) => h.email === email.toLowerCase()) ?? null;
  },
  async getHostById(id) {
    return memory.hosts.find((h) => h.id === id) ?? null;
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
  async createProperty(property) {
    memory.properties.push(property);
    return property;
  },
  async deleteProperty(id) {
    memory.properties = memory.properties.filter((p) => p.id !== id);
    memory.guides = memory.guides.filter((g) => g.propertyId !== id);
    memory.places = memory.places.filter((p) => p.propertyId !== id);
    memory.stays = memory.stays.filter((s) => s.propertyId !== id);
  },
  async listStays(propertyId) {
    return memory.stays
      .filter((s) => s.propertyId === propertyId)
      .sort((a, b) => b.arrival.localeCompare(a.arrival));
  },
  async getStayBySlug(slug) {
    return memory.stays.find((s) => s.slug === slug) ?? null;
  },
  async saveStay(stay) {
    const index = memory.stays.findIndex((s) => s.id === stay.id);
    if (index < 0) memory.stays.push(stay);
    else memory.stays[index] = stay;
  },
  async markStayOpened(id) {
    const stay = memory.stays.find((s) => s.id === id);
    if (stay && !stay.openedAt) stay.openedAt = new Date().toISOString();
  },
  async deleteStay(id) {
    memory.stays = memory.stays.filter((s) => s.id !== id);
  },
  async createHost(host) {
    memory.hosts.push(host);
  },
  async track(propertyId, kind, value) {
    const row = memory.metrics.find(
      (m) => m.propertyId === propertyId && m.kind === kind && m.value === value,
    );
    if (row) row.count += 1;
    else memory.metrics.push({ propertyId, kind, value, count: 1 });
  },
  async metrics(propertyId) {
    const day = new Date().toISOString().slice(0, 10);
    return memory.metrics
      .filter((m) => m.propertyId === propertyId)
      .map(({ kind, value, count }) => ({ kind, value, count, day }))
      .sort((a, b) => b.count - a.count);
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
  access_code_updated_at: string | null;
  contacts: Property["contacts"];
  hidden_sections: string[];
  theme: Property["theme"];
  visited_steps: number[];
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
  checkinFrom: String(row.checkin_from).slice(0, 5),
  checkoutUntil: String(row.checkout_until).slice(0, 5),
  accessCodeUpdatedAt: toISOStamp(row.access_code_updated_at),
  contacts: row.contacts ?? [],
  hiddenSections: row.hidden_sections ?? [],
  visitedSteps: row.visited_steps ?? [],
  theme: row.theme ?? { palette: "retorika", font: "moderna", radius: "suave", style: "sereno" },
  defaultLocale: row.default_locale,
  published: row.published,
  pin: row.pin,
});

/* Domain field -> column map. Written by hand rather than generated so that a
   partial PATCH cannot reach columns the host must not change. */
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
  accessCodeUpdatedAt: "access_code_updated_at",
  contacts: "contacts",
  hiddenSections: "hidden_sections",
  visitedSteps: "visited_steps",
  theme: "theme",
  defaultLocale: "default_locale",
  published: "published",
  pin: "pin",
};

const toStay = (row: {
  id: string;
  property_id: string;
  slug: string;
  guest_name: string | null;
  arrival: string;
  departure: string;
  access_code_override: string | null;
  pin: string | null;
  revoked: boolean;
  opened_at: string | Date | null;
}): Stay => ({
  id: row.id,
  propertyId: row.property_id,
  slug: row.slug,
  guestName: row.guest_name,
  arrival: toISODate(row.arrival),
  departure: toISODate(row.departure),
  accessCodeOverride: row.access_code_override,
  pin: row.pin,
  revoked: row.revoked,
  openedAt: toISOStamp(row.opened_at),
});

const pgRepo: Repo = {
  mode: "postgres",
  async getHostByEmail(email) {
    const sql = getSql();
    const rows = await sql<{ id: string; email: string; name: string; password_hash: string }[]>`
      select id, email, name, password_hash from hosts where email = ${email.toLowerCase()} limit 1`;
    const row = rows[0];
    return row ? { id: row.id, email: row.email, name: row.name, passwordHash: row.password_hash } : null;
  },
  async getHostById(id) {
    const sql = getSql();
    const rows = await sql<{ id: string; email: string; name: string; password_hash: string }[]>`
      select id, email, name, password_hash from hosts where id = ${id} limit 1`;
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
      const payload =
        column === "contacts" ||
        column === "hidden_sections" ||
        column === "theme" ||
        column === "visited_steps"
          ? sql.json(value as never)
          : (value as never);
      return sql`${sql(column)} = ${payload}`;
    });
    const merged = assignments.reduce((acc, fragment, index) =>
      index === 0 ? fragment : sql`${acc}, ${fragment}`,
    );
    await sql`update properties set ${merged}, updated_at = now() where id = ${id}`;
    return this.getProperty(id);
  },
  async createProperty(property) {
    const sql = getSql();
    await sql`
      insert into properties (id, host_id, slug, name, city, address, lat, lng, host_name,
        host_phone, wifi_ssid, wifi_password, wifi_security, access_code, checkin_from,
        checkout_until, contacts, hidden_sections, theme, visited_steps, default_locale,
        published, pin)
      values (${property.id}, ${property.hostId}, ${property.slug}, ${property.name},
        ${property.city}, ${property.address}, ${property.lat}, ${property.lng},
        ${property.hostName}, ${property.hostPhone}, ${property.wifiSsid},
        ${property.wifiPassword}, ${property.wifiSecurity}, ${property.accessCode},
        ${property.checkinFrom}, ${property.checkoutUntil}, ${sql.json(property.contacts as never)},
        ${sql.json(property.hiddenSections as never)}, ${sql.json(property.theme as never)},
        ${sql.json(property.visitedSteps as never)},
        ${property.defaultLocale},
        ${property.published}, ${property.pin})`;
    return property;
  },
  async deleteProperty(id) {
    /* Guides, places and bookings go with the property thanks to the schema's
       on delete cascade: a single statement does it. */
    const sql = getSql();
    await sql`delete from properties where id = ${id}`;
  },
  async listStays(propertyId) {
    const sql = getSql();
    const rows = await sql<
      {
        id: string;
        property_id: string;
        slug: string;
        guest_name: string | null;
        arrival: string;
        departure: string;
        access_code_override: string | null;
        pin: string | null;
        revoked: boolean;
        opened_at: string | Date | null;
      }[]
    >`select * from stays where property_id = ${propertyId} order by arrival desc`;
    return rows.map(toStay);
  },
  async getStayBySlug(slug) {
    const sql = getSql();
    const rows = await sql`select * from stays where slug = ${slug} limit 1`;
    return rows[0] ? toStay(rows[0] as never) : null;
  },
  async saveStay(stay) {
    const sql = getSql();
    await sql`
      insert into stays (id, property_id, slug, guest_name, arrival, departure,
        access_code_override, pin, revoked)
      values (${stay.id}, ${stay.propertyId}, ${stay.slug}, ${stay.guestName}, ${stay.arrival},
        ${stay.departure}, ${stay.accessCodeOverride}, ${stay.pin}, ${stay.revoked})
      on conflict (id) do update set
        guest_name = excluded.guest_name, arrival = excluded.arrival,
        departure = excluded.departure, access_code_override = excluded.access_code_override,
        pin = excluded.pin, revoked = excluded.revoked`;
  },
  async markStayOpened(id) {
    /* Only the first open is recorded: the flag answers "did they ever see
       it", and rewriting it on every visit would turn it into a log. */
    const sql = getSql();
    await sql`update stays set opened_at = now() where id = ${id} and opened_at is null`;
  },
  async deleteStay(id) {
    const sql = getSql();
    await sql`delete from stays where id = ${id}`;
  },
  async createHost(host) {
    const sql = getSql();
    await sql`insert into hosts (id, email, name, password_hash)
              values (${host.id}, ${host.email}, ${host.name}, ${host.passwordHash})`;
  },
  async track(propertyId, kind, value) {
    /* Counter aggregated per property and day. No device or guest identifier:
       there is no personal data to protect. */
    const sql = getSql();
    await sql`
      insert into metrics (property_id, day, kind, value, count)
      values (${propertyId}, current_date, ${kind}, ${value}, 1)
      on conflict (property_id, day, kind, value)
      do update set count = metrics.count + 1`;
  },
  async metrics(propertyId) {
    const sql = getSql();
    /* Kept split by month rather than summed flat: the trend needs the time
       axis, and ninety days of one property is a handful of rows. */
    const rows = await sql<{ kind: MetricKind; value: string; count: string; day: string }[]>`
      select kind, value, sum(count)::int as count, to_char(day, 'YYYY-MM') as day
      from metrics
      where property_id = ${propertyId} and day > current_date - interval '180 days'
      group by kind, value, to_char(day, 'YYYY-MM')
      order by count desc limit 300`;
    return rows.map((row) => ({
      kind: row.kind,
      value: row.value,
      count: Number(row.count),
      day: row.day,
    }));
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
        scope: Place["scope"];
        hours: string | null;
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
      scope: row.scope ?? "recommendation",
      hours: row.hours,
      notes: row.notes,
    }));
  },
  async savePlace(place) {
    const sql = getSql();
    await sql`
      insert into places (id, property_id, category, name, lat, lng, price, url, phone, scope, hours, notes)
      values (${place.id}, ${place.propertyId}, ${place.category}, ${place.name}, ${place.lat},
              ${place.lng}, ${place.price}, ${place.url}, ${place.phone}, ${place.scope},
              ${place.hours}, ${sql.json(place.notes as never)})
      on conflict (id) do update set
        category = excluded.category, name = excluded.name, lat = excluded.lat, lng = excluded.lng,
        price = excluded.price, url = excluded.url, phone = excluded.phone,
        scope = excluded.scope, hours = excluded.hours, notes = excluded.notes`;
  },
  async deletePlace(id) {
    const sql = getSql();
    await sql`delete from places where id = ${id}`;
  },
};

export function getRepo(): Repo {
  return hasDatabase ? pgRepo : demoRepo;
}
