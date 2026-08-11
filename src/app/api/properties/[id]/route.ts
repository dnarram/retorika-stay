import { NextResponse } from "next/server";
import { currentHostId } from "@/lib/auth";
import { getRepo } from "@/lib/repo";
import { LOCALES, propertyPatchSchema, publishBlockers } from "@/lib/schema";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const hostId = await currentHostId();
  if (!hostId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await context.params;
  const repo = getRepo();
  const property = await repo.getProperty(id);
  /* Authorisation, not just authentication: a host cannot edit someone else's
     property by changing the id in the URL. */
  if (!property || property.hostId !== hostId) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const parsed = propertyPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos no válidos", detail: parsed.error.flatten() }, { status: 422 });
  }

  /* Publishing is the moment the guide stops being private, so it is the moment
     to check it is worth showing. Refusing here with a readable list beats
     refusing on every keystroke. */
  if (parsed.data.published === true) {
    const merged = { ...property, ...parsed.data };
    const missing = publishBlockers(merged);
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Antes de publicar, completa: ${missing.join(", ")}.`, missing },
        { status: 422 },
      );
    }
  }

  /* When the access code changes we stamp the date: that is what lets us warn
     the host when a booking ends and the code is still the same one. */
  const patch = { ...parsed.data };
  if (patch.accessCode !== undefined && patch.accessCode !== property.accessCode) {
    patch.accessCodeUpdatedAt = new Date().toISOString();
  }

  const updated = await repo.updateProperty(id, patch);

  /* Publishing generates all four languages.
     The host speaks neither French nor Portuguese: asking them to "review"
     those versions would be asking for the impossible and would leave a task
     open in their dashboard forever. The guide tells the guest instead, and
     that closes the matter. */
  let translated: string[] = [];
  if (patch.published === true && process.env.GROQ_API_KEY) {
    const source = updated?.defaultLocale ?? property.defaultLocale;
    const existing = new Set((await repo.listGuides(id)).map((g) => g.locale));
    const missing = LOCALES.filter((locale) => locale !== source && !existing.has(locale));
    for (const locale of missing) {
      const response = await fetch(new URL("/api/translate", request.url), {
        method: "POST",
        headers: { "content-type": "application/json", cookie: request.headers.get("cookie") ?? "" },
        body: JSON.stringify({ propertyId: id, from: source, to: locale }),
      });
      if (response.ok) translated.push(locale);
    }
  }

  return NextResponse.json({ property: updated, translated, mode: repo.mode });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const hostId = await currentHostId();
  if (!hostId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await context.params;
  const repo = getRepo();
  const property = await repo.getProperty(id);
  if (!property || property.hostId !== hostId) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await repo.deleteProperty(id);
  return NextResponse.json({ ok: true });
}
