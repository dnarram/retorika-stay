import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

/* Autenticación mínima y correcta, sin dependencias de terceros:
   · scrypt para el hash (viene en Node, es resistente a GPU y no arrastra las
     dependencias nativas de bcrypt, que complican el despliegue serverless).
   · JWT firmado en cookie httpOnly + sameSite=lax: no accesible desde
     JavaScript, no viaja en peticiones entre sitios. */

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

/* Puerta del PIN de la guía: cookie por alojamiento, firmada con el mismo
   secreto para que no se pueda falsificar escribiéndola a mano. */
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
