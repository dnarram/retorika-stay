import postgres from "postgres";

/* Una sola conexión reutilizada entre recargas en desarrollo: sin esto, cada
   hot reload abre un pool nuevo y PostgreSQL acaba rechazando conexiones. */
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
