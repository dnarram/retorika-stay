import { NextResponse } from "next/server";
import { currentHostId } from "@/lib/auth";
import { getRepo } from "@/lib/repo";
import { propertyPatchSchema } from "@/lib/schema";

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

  const updated = await repo.updateProperty(id, parsed.data);
  return NextResponse.json({ property: updated, mode: repo.mode });
}
