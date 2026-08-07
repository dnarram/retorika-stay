import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

/* Minimal but correct authentication, with no third-party dependencies:
   · scrypt for hashing — ships with Node, is GPU-resistant and avoids bcrypt's
     native build step, which complicates serverless deployment.
   · Signed JWT in an httpOnly, sameSite=lax cookie: unreachable from
     JavaScript and never sent on cross-site requests. */

const SESSION_COOKIE = "retorika_host";
const SESSION_TTL = "7d";
const KEY_LENGTH = 32;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${key}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const candidate = scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(key, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET ?? "clave-de-desarrollo-solo-para-local-32chars";
  return new TextEncoder().encode(value);
}

export async function createSession(hostId: string): Promise<void> {
  const token = await new SignJWT({ sub: hostId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(secret());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function currentHostId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

/* Guide PIN gate: one cookie per guide, signed with the same secret so it
   cannot be forged by hand. */
export function guidePinCookie(slug: string): string {
  return `guide_pin_${slug}`;
}

export async function issuePinToken(slug: string): Promise<string> {
  return new SignJWT({ slug })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function verifyPinToken(token: string | undefined, slug: string): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.slug === slug;
  } catch {
    return false;
  }
}
