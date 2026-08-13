-- Per-property look and feel for the guest guide.
-- Run only on an existing database:
--   psql "$DATABASE_URL" -f db/migrations/006_theme.sql

begin;

-- Four choices, each between composed options: palette, type pairing, corner
-- radius and header ornament. Stored as JSONB because it is read whole, written
-- whole and never queried by part.
alter table properties add column if not exists theme jsonb not null
  default '{"palette":"retorika","font":"moderna","radius":"suave","ornament":"ninguno"}'::jsonb;

commit;
