-- Which editor steps the host has actually opened.
-- Run only on an existing database:
--   psql "$DATABASE_URL" -f db/migrations/007_visited_steps.sql

begin;

-- A section counts as done when it holds content AND somebody looked at it.
-- Existing guides are assumed reviewed: their hosts have been editing them.
alter table properties add column if not exists visited_steps jsonb not null default '[]'::jsonb;
update properties set visited_steps = '[1,2,3,4,5,6,7]'::jsonb
  where visited_steps = '[]'::jsonb and published = true;

commit;
