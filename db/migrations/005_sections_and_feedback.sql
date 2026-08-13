-- Hidden sections and guest feedback.
-- Run only on an existing database:
--   psql "$DATABASE_URL" -f db/migrations/005_sections_and_feedback.sql

begin;

-- Sections the host has switched off. Hiding is not deleting: the content stays
-- and reappears the moment the switch is flipped back.
alter table properties add column if not exists hidden_sections jsonb not null default '[]'::jsonb;

-- One more metric kind: was this section useful, yes or no.
alter table metrics drop constraint if exists metrics_kind_check;
alter table metrics add constraint metrics_kind_check
  check (kind in ('open','language','section','search_miss','call','device','helpful'));

commit;
