import { NextResponse } from "next/server";
import { getRepo } from "@/lib/repo";
import { trackSchema } from "@/lib/schema";

/* Métrica sin analítica de terceros y sin identificar a nadie.

   Lo que se guarda: un contador por alojamiento, día, tipo y valor.
   Lo que NO se guarda: cookies, huella del dispositivo, IP, identificador de
   huésped ni nada que permita reconstruir el recorrido de una persona. Al
   anfitrión le interesa "el 60% de mis huéspedes abre la guía en inglés", no
   "Claire miró la sección de normas a las 23:40".

   Agregar a nivel de alojamiento es además lo que mantiene esto lejos de ser
   dato personal, que es exactamente donde queremos estar. */
export async function POST(request: Request) {
  const parsed = trackSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const { slug, kind, value } = parsed.data;
  const repo = getRepo();
  const stay = await repo.getStayBySlug(slug);
  const property = stay ? await repo.getProperty(stay.propertyId) : await repo.getPropertyBySlug(slug);
  if (!property) return NextResponse.json({ ok: false }, { status: 404 });

  await repo.track(property.id, kind, value.slice(0, 60));
  /* 204: al huésped no le devolvemos nada, ni siquiera un cuerpo que descargar. */
  return new NextResponse(null, { status: 204 });
}
