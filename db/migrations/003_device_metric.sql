-- Adds the "device" metric kind. Run only on an existing database:
--   psql "$DATABASE_URL" -f db/migrations/003_device_metric.sql

begin;

alter table metrics drop constraint if exists metrics_kind_check;
alter table metrics add constraint metrics_kind_check
  check (kind in ('open','language','section','search_miss','call','device'));

commit;
