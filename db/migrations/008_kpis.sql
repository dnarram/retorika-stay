-- Guide analytics: four levels of counters, plus one flag per booking.
-- Run only on an existing database:
--   psql "$DATABASE_URL" -f db/migrations/008_kpis.sql

begin;

alter table metrics drop constraint if exists metrics_kind_check;
alter table metrics add constraint metrics_kind_check
  check (kind in ('open','unique','language','section','search_miss','call',
                  'device','helpful','reveal','directions','keepsake','print'));

-- Whether a booking's guide was ever opened, and when. A date rather than a
-- behaviour log: enough to chase the guest who never saw it, not enough to
-- reconstruct what they did with it.
alter table stays add column if not exists opened_at timestamptz;

commit;
