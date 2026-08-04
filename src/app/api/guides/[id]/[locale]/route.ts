import { NextResponse } from "next/server";
import { currentHostId } from "@/lib/auth";
import { getRepo } from "@/lib/repo";
import { guideSchema, localeSchema } from "@/lib/schema";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string; locale: string }> },
) {
  const hostId = await currentHostId();
  if (!hostId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id, locale } = await context.params;
  const parsedLocale = localeSchema.safeParse(locale);
  if (!parsedLocale.success) return NextResponse.json({ error: "Idioma no soportado" }, { status: 400 });

  const repo = getRepo();
  const property = await repo.getProperty(id);
  if (!property || property.hostId !== hostId) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { content?: unknown; reviewed?: boolean } | null;
  const parsed = guideSchema.safeParse(body?.content);
  if (!parsed.success) {
    return NextResponse.json({ error: "Guía no válida", detail: parsed.error.flatten() }, { status: 422 });
  }

  await repo.saveGuide(id, parsedLocale.data, parsed.data, body?.reviewed ?? true);
  return NextResponse.json({ ok: true, mode: repo.mode });
}
