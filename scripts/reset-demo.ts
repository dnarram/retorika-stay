/* Puts the database back to the state a reviewer first sees.

   Everything created during testing — accounts, properties, guides, bookings,
   metrics — is removed, and the demo accounts are rebuilt exactly as they ship.
   It is a full wipe rather than a surgical delete on purpose: "delete the parts
   that were not there before" is the kind of rule that grows exceptions and
   eventually leaves half a booking behind, while "start again from the seed" is
   the same result every single time.

   Usage: npm run db:reset-demo
   It refuses to run unless CONFIRM=si is set, because the one thing worse than
   a stale demo is a wiped production database.
*/
import postgres from "postgres";
import { requiresTls } from "../src/lib/db.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing.");
  process.exit(1);
}

if (process.env.CONFIRM !== "si") {
  console.error(
    [
      "This deletes EVERY account, property, guide, booking and metric,",
      "and then restores only the demo accounts.",
      "",
      "Run it as:  CONFIRM=si npm run db:reset-demo",
    ].join("\n"),
  );
  process.exit(1);
}

const sql = postgres(url, { ssl: requiresTls(url) ? "require" : undefined, max: 1 });

const [before] = await sql<{ hosts: string; properties: string }[]>`
  select (select count(*) from hosts)::text as hosts,
         (select count(*) from properties)::text as properties`;

/* One statement, because the foreign keys already cascade: deleting a host
   takes their properties, and a property takes its guides, places, bookings and
   metrics with it. */
await sql`delete from hosts`;
await sql`delete from metrics`;

console.log(`Cleared ${before.hosts} accounts and ${before.properties} properties.`);
await sql.end();

/* The seed runs next, from the npm script, so there is exactly one definition
   of what "the demo" is and no chance of the two drifting apart. */
