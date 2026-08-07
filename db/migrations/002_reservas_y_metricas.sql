-- Migración de la primera versión a la segunda.
-- Ejecutar SOLO si ya tenías la base de datos creada con el esquema inicial:
--   psql "$DATABASE_URL" -f db/migrations/002_reservas_y_metricas.sql
-- Si la creas desde cero, db/schema.sql ya lo incluye todo.

begin;

-- Las fechas dejan de colgar del alojamiento: ahora pertenecen a la reserva.
alter table properties drop column if exists stay_from;
alter table properties drop column if exists stay_to;

-- Sello de la última vez que se cambió el código de entrada: es lo que permite
-- avisar al anfitrión cuando una estancia termina y el código sigue siendo el mismo.
alter table properties add column if not exists access_code_updated_at timestamptz;

create table if not exists stays (
  id                   text primary key,
  property_id          text not null references properties(id) on delete cascade,
  slug                 text not null unique,
  guest_name           text,
  arrival              date not null,
  departure            date not null,
  access_code_override text,
  pin                  text check (pin ~ '^[0-9]{4}$'),
  revoked              boolean not null default false,
  created_at           timestamptz not null default now(),
  constraint stay_range check (departure >= arrival)
);

create index if not exists stays_property_idx on stays(property_id, arrival desc);

create table if not exists metrics (
  property_id text not null references properties(id) on delete cascade,
  day         date not null default current_date,
  kind        text not null check (kind in
                ('apertura','idioma','seccion','busqueda_sin_resultado','llamada')),
  value       text not null default '',
  count       integer not null default 0,
  primary key (property_id, day, kind, value)
);

commit;
