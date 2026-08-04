import { NextResponse } from "next/server";
import { guidePinCookie, issuePinToken } from "@/lib/auth";
import { getRepo } from "@/lib/repo";

/* Un PIN de cuatro cifras son diez mil combinaciones: sin freno, un script las
   prueba en minutos. Cinco intentos por IP y alojamiento cada diez minutos lo
   convierten en inviable. En memoria es suficiente aquí; con varias instancias
   habría que moverlo a Redis o a la base de datos, y así está anotado. */
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
