-- Admin access and acquisition source.
-- Run only on an existing database:
--   psql "$DATABASE_URL" -f db/migrations/009_admin.sql

begin;

-- Who can see the business panel. Deliberately a column rather than a separate
-- table: there are two roles and there is no scenario in this product where a
-- third appears without a wider rethink.
alter table hosts add column if not exists role text not null default 'host'
  check (role in ('host','admin'));

-- Where a host came from, captured once at sign-up. The only honest way to
-- report acquisition channels without an analytics vendor: the referrer at the
-- moment of registration, bucketed, never a per-user browsing history.
alter table hosts add column if not exists source text not null default 'directo';

-- The demo account doubles as the admin so a reviewer can open the panel.
update hosts set role = 'admin' where email = 'belen@retorika.es';

commit;
