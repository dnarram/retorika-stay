-- Emergency places and the extra details Overpass gives us for free.
-- Run only on an existing database:
--   psql "$DATABASE_URL" -f db/migrations/004_place_scope.sql

begin;

-- A hospital is a place, but it is not a recommendation: each section draws its
-- own map from its own scope.
alter table places add column if not exists scope text not null default 'recommendation';
alter table places drop constraint if exists places_scope_check;
alter table places add constraint places_scope_check
  check (scope in ('recommendation','emergency'));

-- Opening hours in OpenStreetMap's own notation ("Mo-Sa 09:00-21:30").
alter table places add column if not exists hours text;

create index if not exists places_scope_idx on places(property_id, scope);

commit;
