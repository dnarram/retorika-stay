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
export async function POST(request: Request) {
  const parsed = trackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const { slug, kind, value } = parsed.data;
  const repo = getRepo();
  const stay = await repo.getStayBySlug(slug);
  const property = stay ? await repo.getProperty(stay.propertyId) : await repo.getPropertyBySlug(slug);
  if (!property) return NextResponse.json({ ok: false }, { status: 404 });

  await repo.track(property.id, kind, value.slice(0, 60));
  /* 204: nothing is sent back to the guest, not even a body to download. */
  return new NextResponse(null, { status: 204 });
}
