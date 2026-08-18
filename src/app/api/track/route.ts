import { NextResponse } from "next/server";
import { currentHostId } from "@/lib/auth";
import { attempt, clientKey } from "@/lib/throttle";
import { getRepo } from "@/lib/repo";
import { LOCALES, trackSchema, type MetricKind } from "@/lib/schema";

/* Metrics without third-party analytics and without identifying anyone.

   What is stored: a counter per property, day, kind and value.
   What is NOT stored: cookies, device fingerprints, IP addresses, guest ids or
   anything that would let us reconstruct one person's path through the guide.
   The host benefits from "60% of my guests open the guide in English", not from
   "Claire read the house rules at 23:40".

   Aggregating at property level is also what keeps this well clear of being
   personal data, which is exactly where we want to be. */
/* The endpoint has to stay open — a guest has no account and never will — but
   open does not mean it should accept anything. It was storing whatever string
   arrived, so a prankster with the guide link could fill a host's dashboard
   with invented section names and phantom ratings. Not a security hole: React
   escapes the output and nothing is executed. It is worse in a way that matters
   more here, because a dashboard that shows made-up sections is a dashboard the
   host stops believing.

   So the vocabulary is closed where a vocabulary exists, and left open exactly
   where the value IS the point: what a guest searched for and did not find, and
   which recommendation they tapped, are free text by design. */
const SECTIONS = new Set([
  "arrival",
  "entry",
  "wifi",
  "house",
  "rules",
  "places",
  "transport",
  "emergency",
  "checkout",
  "faq",
]);

function acceptedValue(kind: MetricKind, raw: string): string | null {
  const value = raw.trim().slice(0, 60);
  switch (kind) {
    case "section":
      return SECTIONS.has(value) ? value : null;
    case "helpful": {
      /* "<section>:si" or "guide:no" — anything else is noise. */
      const [section, verdict, ...rest] = value.split(":");
      if (rest.length > 0) return null;
      if (verdict !== "si" && verdict !== "no") return null;
      return section === "guide" || SECTIONS.has(section) ? value : null;
    }
    case "language":
      /* Kept accepted for older clients still in somebody's phone cache, but no
         current page sends it: the server derives it from the open event. */
      return LOCALES.includes(value as (typeof LOCALES)[number]) ? value : null;
    case "keepsake":
      return value === "carrusel" || value === "historia" ? value : null;
    case "device":
      /* Decided by the server from the User-Agent; whatever the client sends is
         discarded rather than trusted. */
      return "";
    case "open":
      /* The open event now carries the language it was read in, and the server
         records both from it. Two beacons could drift apart — and did: ten
         opens against nine languages, because any beacon that fails to leave
         the phone breaks the pair. One request cannot disagree with itself. */
      return LOCALES.includes(value as (typeof LOCALES)[number]) ? value : "";
    case "unique":
    case "reveal":
    case "print":
    case "share":
      /* These are counters, not labels: the value is meaningless and storing
         one would only fragment the count. */
      return "";
    default:
      /* search_miss, call, directions: the guest's own words and the host's own
         place names. Trimmed and capped, never vetted. */
      return value;
  }
}

export async function POST(request: Request) {
  const parsed = trackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const { slug, kind, value } = parsed.data;

  /* Counters that anybody can post to are counters anybody can invent, so there
     is a ceiling far above what a real guest generates in a session and far
     below what it takes to move a host's dashboard. Silently accepted and
     dropped rather than refused: an attacker learns nothing from the response,
     and a real guest never sees it either way. */
  if (!attempt(`${clientKey(request, "track")}:${slug}`, 120, 10 * 60 * 1000).allowed) {
    return new NextResponse(null, { status: 204 });
  }
  const repo = getRepo();
  const stay = await repo.getStayBySlug(slug);
  const property = stay ? await repo.getProperty(stay.propertyId) : await repo.getPropertyBySlug(slug);
  if (!property) return NextResponse.json({ ok: false }, { status: 404 });

  /* THE OWNER DOES NOT COUNT.

     A host opening their own guide is checking their work, not using it, and
     every one of those visits was quietly inflating their own dashboard —
     "vista de muestra", "ver la guía como huésped" and every preview from the
     editor landed in the same counters as a real guest.

     The check is deliberately narrow: it excludes the owner OF THIS PROPERTY,
     not anyone who happens to have an account. Someone who hosts a flat in
     Ronda and stays in one in Madrid is a guest in Madrid, and their reading
     counts there exactly as anybody else's would.

     And it lives on the server, not in the browser: the beacon carries the
     session cookie, so ownership is established from the session rather than
     from something the page could claim about itself. */
  const viewerId = await currentHostId();
  if (viewerId && viewerId === property.hostId) {
    /* Accepted and dropped. The guest-side code never learns whether an event
       was counted, which is also why no attacker learns anything here. */
    return new NextResponse(null, { status: 204 });
  }

  const clean = acceptedValue(kind, value);
  /* Silently dropped, like everything else here: the guest's page learns
     nothing either way and a real guest never sends one of these. */
  if (clean === null) return new NextResponse(null, { status: 204 });

  if (kind === "open") {
    /* Stored with an empty value so the counter stays a single series, and the
       language it came in goes to its own counter from the same request. */
    await repo.track(property.id, "open", "");
    if (clean) await repo.track(property.id, "language", clean);
  } else {
    await repo.track(property.id, kind, clean);
  }

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
