-- Migration from the first version to the second.
-- Run this ONLY if the database was already created with the initial schema:
--   psql "$DATABASE_URL" -f db/migrations/002_bookings_and_metrics.sql
-- On a fresh database db/schema.sql already contains everything.

begin;

-- Dates no longer hang off the property: they belong to the booking now.
alter table properties drop column if exists stay_from;
alter table properties drop column if exists stay_to;

-- Timestamp of the last access-code change: this is what lets the app warn the
-- host when a booking ends and the code is still the same one.
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
                ('open','language','section','search_miss','call')),
  value       text not null default '',
  count       integer not null default 0,
  primary key (property_id, day, kind, value)
);

commit;
