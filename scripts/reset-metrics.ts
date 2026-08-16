/* Wipes every guest counter so a demo starts from zero.

   Deliberately a script and not a button: erasing analytics is not something a
   host should be able to do by mis-tapping, and there is no scenario in the
   product where it belongs in the interface. Run it before recording a demo or
   before testing the panel with fresh numbers.

   Usage: npm run db:reset-metrics
   Add --all to also clear the "was this booking's guide opened" stamps. */
import postgres from "postgres";
import { requiresTls } from "../src/lib/db.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing.");
  process.exit(1);
}

const alsoBookings = process.argv.includes("--all");
const sql = postgres(url, { ssl: requiresTls(url) ? "require" : undefined, max: 1 });

const [{ count }] = await sql<{ count: string }[]>`select count(*)::text from metrics`;
await sql`delete from metrics`;

let bookings = 0;
if (alsoBookings) {
  const rows = await sql`update stays set opened_at = null where opened_at is not null returning id`;
  bookings = rows.length;
}

console.log(
  `Cleared ${count} metric rows${alsoBookings ? ` and ${bookings} booking open stamps` : ""}.`,
);
await sql.end();
