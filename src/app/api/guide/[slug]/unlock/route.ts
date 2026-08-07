import { NextResponse } from "next/server";
import { guidePinCookie, issuePinToken } from "@/lib/auth";
import { getRepo } from "@/lib/repo";

/* A four-digit PIN is ten thousand combinations: unthrottled, a script works
   through them in minutes. Five attempts per IP and guide every ten minutes
   makes that impractical. In-memory is enough here; with several instances this
   needs to move to Redis or the database, which is noted in DECISIONS. */
const attempts = new Map<string, { count: number; until: number }>();
const LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;

function tooManyAttempts(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.until < now) {
    attempts.set(key, { count: 1, until: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > LIMIT;
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";

  if (tooManyAttempts(`${ip}:${slug}`)) {
    return NextResponse.json({ error: "Demasiados intentos" }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as { pin?: string } | null;
  const property = await getRepo().getPropertyBySlug(slug);

  if (!property || !property.pin || body?.pin !== property.pin) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(guidePinCookie(slug), await issuePinToken(slug), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
