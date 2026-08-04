/* Aplica db/schema.sql. Uso: npm run db:migrate  (requiere DATABASE_URL) */
import { readFileSync } from "node:fs";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL. Copia .env.example a .env y rellénala.");
  process.exit(1);
}

const sql = postgres(url, { ssl: url.includes("sslmode=require") ? "require" : undefined });
const ddl = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

await sql.unsafe(ddl);
console.log("Esquema aplicado.");
await sql.end();
