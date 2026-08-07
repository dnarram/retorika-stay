import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { currentHostId } from "@/lib/auth";
import { getRepo } from "@/lib/repo";
import { stayInputSchema } from "@/lib/schema";

export async function POST(request: Request) {
  const hostId = await currentHostId();
  if (!hostId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { propertyId?: string; id?: string; stay?: unknown; revoked?: boolean }
    | null;

  const repo = getRepo();
  const property = body?.propertyId ? await repo.getProperty(body.propertyId) : null;
  if (!property || property.hostId !== hostId) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const parsed = stayInputSchema.safeParse(body?.stay);
  if (!parsed.success) {
    return NextResponse.json({ error: "Estancia no válida", detail: parsed.error.flatten() }, { status: 422 });
  }
  if (parsed.data.departure < parsed.data.arrival) {
    return NextResponse.json({ error: "La salida no puede ser anterior a la llegada" }, { status: 422 });
  }

  /* Cada reserva estrena enlace. Ese es todo el truco: revocar una no afecta a
     las demás, y un enlace filtrado se agota con su propia reserva. */
  const existing = body?.id ? (await repo.listStays(property.id)).find((s) => s.id === body.id) : null;
  const stay = {
    ...parsed.data,
    id: existing?.id ?? `stay_${nanoid(10)}`,
    propertyId: property.id,
    slug: existing?.slug ?? nanoid(8),
    revoked: body?.revoked ?? existing?.revoked ?? false,
  };

  await repo.saveStay(stay);
  return NextResponse.json({ stay });
}
