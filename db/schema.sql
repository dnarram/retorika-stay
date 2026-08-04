-- Esquema de Retorika Stay (PostgreSQL 15+)
-- Ejecutar:  psql "$DATABASE_URL" -f db/schema.sql
--
-- Criterio de modelado: los HECHOS son relacionales (coordenadas, categorías,
-- teléfonos: se filtran, se ordenan y se calculan) y el TEXTO multiidioma va en
-- JSONB validado con Zod antes de entrar. Normalizar cada párrafo en su fila
-- multiplicaría por cuatro las filas y por diez los JOIN sin que nunca se
-- consulte un párrafo suelto.

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
  -- slug irreproducible (nanoid de 8): la guía es pública pero no adivinable
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
  stay_from      date,
  stay_to        date,
  contacts       jsonb not null default '[]'::jsonb,
  default_locale text not null default 'es' check (default_locale in ('es','en','fr','pt')),
  published      boolean not null default false,
  pin            text check (pin ~ '^[0-9]{4}$'),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint stay_range check (stay_from is null or stay_to is null or stay_to >= stay_from)
);

create index if not exists properties_host_idx on properties(host_id);

create table if not exists guides (
  property_id text not null references properties(id) on delete cascade,
  locale      text not null check (locale in ('es','en','fr','pt')),
  content     jsonb not null,
  -- false = traducción asistida sin revisar; la guía avisa al huésped
  reviewed    boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (property_id, locale)
);

create table if not exists places (
  id          text primary key,
  property_id text not null references properties(id) on delete cascade,
  category    text not null check (category in
                ('comer','tapas','cafe','ver','naturaleza','compras','noche','servicios')),
  name        text not null,
  lat         numeric(9,6) not null,
  lng         numeric(9,6) not null,
  price       smallint check (price between 1 and 3),
  url         text,
  phone       text,
  -- { "es": {"tagline": "...", "note": "..."}, "en": {...} }
  notes       jsonb not null default '{}'::jsonb,
  sort_order  smallint not null default 0
);

create index if not exists places_property_idx on places(property_id, category);

commit;
