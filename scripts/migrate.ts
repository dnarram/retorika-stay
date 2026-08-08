/* Applies db/schema.sql. Usage: npm run db:migrate (requires DATABASE_URL) */
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { requiresTls } from "../src/lib/db.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

/* max: 1 pins a single connection, which is what postgres.js requires to run a
   script containing begin/commit; .simple() switches to the simple protocol,
   the only one that accepts several statements in one call. */
const sql = postgres(url, { ssl: requiresTls(url) ? "require" : undefined, max: 1 });
const ddl = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

/* .simple() usa el protocolo simple de PostgreSQL, que es el único que acepta
   varias sentencias (y el begin/commit del fichero) en una sola llamada. */
await sql.unsafe(ddl).simple();
console.log("Schema applied.");
await sql.end();
