import postgres from "postgres";

/* A single connection reused across hot reloads in development: without this,
   every reload opens a new pool and PostgreSQL eventually refuses connections. */
const globalForDb = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };

export const hasDatabase = Boolean(process.env.DATABASE_URL);

export function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está configurada");
  }
  if (!globalForDb.__sql) {
    globalForDb.__sql = postgres(process.env.DATABASE_URL, {
      ssl: process.env.DATABASE_URL.includes("sslmode=require") ? "require" : undefined,
      max: 5,
      idle_timeout: 20,
    });
  }
  return globalForDb.__sql;
}
