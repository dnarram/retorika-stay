-- One more metric kind: the guest tapped "share".
-- Run only on an existing database:
--   psql "$DATABASE_URL" -f db/migrations/010_share_metric.sql

begin;

alter table metrics drop constraint if exists metrics_kind_check;
alter table metrics add constraint metrics_kind_check
  check (kind in ('open','unique','language','section','search_miss','call',
                  'device','helpful','reveal','directions','keepsake','print','share'));

commit;
