import { NextResponse } from "next/server";
import { currentHostId } from "@/lib/auth";
import { getRepo } from "@/lib/repo";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const hostId = await currentHostId();
  if (!hostId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await context.params;
  const repo = getRepo();

  /* Se comprueba que el sitio cuelga de un alojamiento del anfitrión antes de
     borrar nada. */
  const properties = await repo.listProperties(hostId);
  for (const property of properties) {
    const places = await repo.listPlaces(property.id);
    if (places.some((place) => place.id === id)) {
      await repo.deletePlace(id);
      return NextResponse.json({ ok: true });
    }
  }
  return NextResponse.json({ error: "No encontrado" }, { status: 404 });
}
