-- Optional: put existing properties back to Spanish authoring.
--
-- Nothing breaks without this — the editor now works in Spanish regardless of
-- what this column says — but the column is what the "Idiomas" panel reports,
-- so leaving it wrong means the panel keeps announcing the wrong original.
--
--   psql "$DATABASE_URL" -f reparar-idiomas.sql

begin;

update properties set default_locale = 'es' where default_locale <> 'es';

commit;
