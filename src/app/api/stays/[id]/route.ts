import { NextResponse } from "next/server";
import { currentHostId } from "@/lib/auth";
import { getRepo } from "@/lib/repo";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const hostId = await currentHostId();
  if (!hostId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await context.params;
  const repo = getRepo();
  for (const property of await repo.listProperties(hostId)) {
    const stays = await repo.listStays(property.id);
    if (stays.some((stay) => stay.id === id)) {
      await repo.deleteStay(id);
      return NextResponse.json({ ok: true });
    }
  }
  return NextResponse.json({ error: "No encontrado" }, { status: 404 });
}
