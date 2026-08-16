import { NextResponse } from "next/server";
import { getRepo } from "@/lib/repo";
import { trackSchema } from "@/lib/schema";

/* Metrics without third-party analytics and without identifying anyone.

   What is stored: a counter per property, day, kind and value.
   What is NOT stored: cookies, device fingerprints, IP addresses, guest ids or
   anything that would let us reconstruct one person's path through the guide.
   The host benefits from "60% of my guests open the guide in English", not from
   "Claire read the house rules at 23:40".

   Aggregating at property level is also what keeps this well clear of being
   personal data, which is exactly where we want to be. */
/* Counters that anybody can post to are counters anybody can invent. The
   endpoint has to stay open — the guest has no account and never will — so the
   protection is a cheap per-IP, per-guide ceiling: far above what a real guest
   generates in a session, far below what it takes to move a host's dashboard.

   In memory is enough here; with several instances this belongs in the database
   or in Redis, and that is noted rather than pretended. */
const seen = new Map<string, { count: number; until: number }>();
const CEILING = 120;
const WINDOW_MS = 10 * 60 * 1000;

function overCeiling(key: string): boolean {
  const now = Date.now();
  const entry = seen.get(key);
  if (!entry || entry.until < now) {
    seen.set(key, { count: 1, until: now + WINDOW_MS });
    /* The map is bounded so a burst of unique IPs cannot grow it forever. */
    if (seen.size > 5000) seen.clear();
    return false;
  }
  entry.count += 1;
  return entry.count > CEILING;
}

export async function POST(request: Request) {
  const parsed = trackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const { slug, kind, value } = parsed.data;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  /* Silently accepted and dropped: an attacker learns nothing from a 429 here,
     and a real guest never sees it. */
  if (overCeiling(`${ip}:${slug}`)) return new NextResponse(null, { status: 204 });
  const repo = getRepo();
  const stay = await repo.getStayBySlug(slug);
  const property = stay ? await repo.getProperty(stay.propertyId) : await repo.getPropertyBySlug(slug);
  if (!property) return NextResponse.json({ ok: false }, { status: 404 });

  await repo.track(property.id, kind, value.slice(0, 60));

  /* If the link belongs to a booking, the first open is stamped on it. This is
     the only place a metric touches something the host can put a name to, and
     it stops at a date on purpose. */
  if (kind === "open" && stay) await repo.markStayOpened(stay.id);

  /* Device shape, recorded alongside the "open" event and nowhere else.

     It is an ESTIMATE, not a fact: it reads the User-Agent, which is spoofable
     and which Chromium has been freezing for years. Anything more precise means
     fingerprinting the guest, and this app promises the opposite. Three buckets
     aggregated per property answer the only question the host actually has —
     "should I write this guide for a phone?" — and answer nothing about any
     individual. */
  if (kind === "open") {
    const ua = request.headers.get("user-agent") ?? "";
    const mobileHint = request.headers.get("sec-ch-ua-mobile");
    const device =
      /ipad|tablet|playbook|silk|android(?!.*mobile)/i.test(ua)
        ? "tablet"
        : mobileHint === "?1" || /mobile|iphone|ipod|android/i.test(ua)
          ? "movil"
          : "escritorio";
    await repo.track(property.id, "device", device);
  }
  /* 204: nothing is sent back to the guest, not even a body to download. */
  return new NextResponse(null, { status: 204 });
}
