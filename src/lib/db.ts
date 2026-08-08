import postgres from "postgres";

/* A single connection reused across hot reloads in development: without this,
   every reload opens a new pool and PostgreSQL eventually refuses connections. */
const globalForDb = globalThis as unknown as { __sql?: ReturnType<typeof postgres> };

export const hasDatabase = Boolean(process.env.DATABASE_URL);

/* TLS is decided by where the database lives, not by whether the connection
   string happens to spell out sslmode=require. Managed providers hand out URLs
   in several shapes and one of them silently produced an insecure connection in
   production. Anything that is not localhost gets TLS. */
export function requiresTls(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return !["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(host);
  } catch {
    return true;
  }
}

export function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!globalForDb.__sql) {
    globalForDb.__sql = postgres(process.env.DATABASE_URL, {
      ssl: requiresTls(process.env.DATABASE_URL) ? "require" : undefined,
      max: 5,
      idle_timeout: 20,
    });
  }
  return globalForDb.__sql;
}