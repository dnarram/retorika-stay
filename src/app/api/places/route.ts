import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { currentHostId } from "@/lib/auth";
import { getRepo } from "@/lib/repo";
import { placeInputSchema } from "@/lib/schema";

export async function POST(request: Request) {
  const hostId = await currentHostId();
  if (!hostId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as
    | { propertyId?: string; id?: string; place?: unknown }
    | null;

  const repo = getRepo();
  const property = body?.propertyId ? await repo.getProperty(body.propertyId) : null;
  if (!property || property.hostId !== hostId) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const parsed = placeInputSchema.safeParse(body?.place);
  if (!parsed.success) {
    return NextResponse.json({ error: "Sitio no válido", detail: parsed.error.flatten() }, { status: 422 });
  }

  const place = { ...parsed.data, id: body?.id ?? `pl_${nanoid(10)}`, propertyId: property.id };
  await repo.savePlace(place);
  return NextResponse.json({ place, mode: repo.mode });
}
