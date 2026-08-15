-- Retorika Stay schema (PostgreSQL 15+)
-- Run with:  psql "$DATABASE_URL" -f db/schema.sql
--
-- Modelling rule: FACTS are relational (coordinates, categories, phone numbers
-- are filtered, sorted and computed on) and multilingual TEXT goes into JSONB,
-- validated with Zod before it lands. Normalising every paragraph into its own
-- row would multiply rows by four and joins by ten to serve a query nobody
-- makes: a single paragraph is never read on its own.

begin;

create table if not exists hosts (
  id            text primary key,
  email         text not null unique,
  name          text not null,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

create table if not exists properties (
  id             text primary key,
  host_id        text not null references hosts(id) on delete cascade,
  -- unguessable slug (8-char nanoid): the guide is public but not discoverable
  slug           text not null unique,
  name           text not null,
  city           text not null,
  address        text not null,
  lat            numeric(9,6) not null,
  lng            numeric(9,6) not null,
  host_name      text not null,
  host_phone     text not null,
  wifi_ssid      text not null default '',
  wifi_password  text not null default '',
  wifi_security  text not null default 'WPA' check (wifi_security in ('WPA','WEP','nopass')),
  access_code    text not null default '',
  checkin_from   time not null default '15:00',
  checkout_until time not null default '11:00',
  access_code_updated_at timestamptz,
  contacts       jsonb not null default '[]'::jsonb,
  -- sections the host switched off; hiding never deletes content
  hidden_sections jsonb not null default '[]'::jsonb,
  -- palette, type pairing, corner radius and header ornament
  theme          jsonb not null default
                 '{"palette":"retorika","font":"moderna","radius":"suave","style":"sereno"}'::jsonb,
  -- steps the host has actually opened; content alone is not agreement
  visited_steps  jsonb not null default '[]'::jsonb,
  default_locale text not null default 'es' check (default_locale in ('es','en','fr','pt')),
  published      boolean not null default false,
  pin            text check (pin ~ '^[0-9]{4}$'),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint pin_format check (pin is null or pin ~ '^[0-9]{4}$')
);

create index if not exists properties_host_idx on properties(host_id);

-- A booking. This is what turns a guide link into a credential with an expiry
-- date: each stay owns its slug, is revoked on its own, and outside its dates
-- the server stops sending the access code.
create table if not exists stays (
  id                   text primary key,
  property_id          text not null references properties(id) on delete cascade,
  slug                 text not null unique,
  guest_name           text,
  arrival              date not null,
  departure            date not null,
  -- per-booking code for smart locks; when null the property code is used and
  -- the app reminds the host to rotate it once the booking ends
  access_code_override text,
  pin                  text check (pin ~ '^[0-9]{4}$'),
  revoked              boolean not null default false,
  created_at           timestamptz not null default now(),
  constraint stay_range check (departure >= arrival)
);

create index if not exists stays_property_idx on stays(property_id, arrival desc);

-- Metrics aggregated per property and day. Deliberately WITHOUT any guest or
-- device identifier: there is no personal data to safeguard and the guide still
-- asks nothing of whoever opens it.
create table if not exists metrics (
  property_id text not null references properties(id) on delete cascade,
  day         date not null default current_date,
  kind        text not null check (kind in
                ('open','language','section','search_miss','call','device','helpful')),
  value       text not null default '',
  count       integer not null default 0,
  primary key (property_id, day, kind, value)
);

create table if not exists guides (
  property_id text not null references properties(id) on delete cascade,
  locale      text not null check (locale in ('es','en','fr','pt')),
  content     jsonb not null,
  -- false = machine translation; the guide tells the guest so
  reviewed    boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (property_id, locale)
);

create table if not exists places (
  id          text primary key,
  property_id text not null references properties(id) on delete cascade,
  category    text not null check (category in
                ('restaurant','tapas','cafe','sights','outdoors','shopping','nightlife','services')),
  name        text not null,
  lat         numeric(9,6) not null,
  lng         numeric(9,6) not null,
  price       smallint check (price between 1 and 3),
  url         text,
  phone       text,
  -- a hospital is a place, but not a recommendation: each section has its map
  scope       text not null default 'recommendation'
                check (scope in ('recommendation','emergency')),
  -- opening hours in OpenStreetMap notation, stored and shown raw
  hours       text,
  -- { "es": {"tagline": "...", "note": "..."}, "en": {...} }
  notes       jsonb not null default '{}'::jsonb,
  sort_order  smallint not null default 0
);

create index if not exists places_property_idx on places(property_id, category);
create index if not exists places_scope_idx on places(property_id, scope);

commit;
