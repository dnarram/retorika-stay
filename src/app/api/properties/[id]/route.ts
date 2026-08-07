import { NextResponse } from "next/server";
import { currentHostId } from "@/lib/auth";
import { getRepo } from "@/lib/repo";
import { LOCALES, propertyPatchSchema } from "@/lib/schema";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const hostId = await currentHostId();
  if (!hostId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await context.params;
  const repo = getRepo();
  const property = await repo.getProperty(id);
  /* Autorización, no solo autenticación: un anfitrión no puede editar la ficha
     de otro cambiando el id de la URL. */
  if (!property || property.hostId !== hostId) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const parsed = propertyPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos no válidos", detail: parsed.error.flatten() }, { status: 422 });
  }

  /* Si cambia el código de acceso, se sella la fecha: es lo que permite avisar
     al anfitrión cuando una estancia termina y el código sigue siendo el mismo. */
  const patch = { ...parsed.data };
  if (patch.accessCode !== undefined && patch.accessCode !== property.accessCode) {
    patch.accessCodeUpdatedAt = new Date().toISOString();
  }

  const updated = await repo.updateProperty(id, patch);

  /* Al publicar, los cuatro idiomas se generan solos.
     El anfitrión no habla francés ni portugués: pedirle que "revise" esas
     versiones sería pedirle un imposible y dejarle una tarea abierta para
     siempre en el panel. La guía se lo dice al huésped y ahí acaba el asunto. */
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
