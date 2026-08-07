import { NextResponse } from "next/server";
import { currentHostId } from "@/lib/auth";

/* Geocodificación con Nominatim (OpenStreetMap): el anfitrión escribe su
   dirección y salen las coordenadas. Así deja de existir el campo "latitud",
   que es de los que hacen abandonar un formulario.

   Por qué esto y no Google Places: sin clave, sin tarjeta, sin cuota y sin
   atarse a un proveedor de pago para resolver un problema que el mapa abierto
   resuelve igual de bien en una dirección postal española.

   Nominatim exige identificarse con un User-Agent real y limita a una petición
   por segundo, por eso se hace desde el servidor y solo para anfitriones
   autenticados: así el límite lo controlamos nosotros y no un visitante. */
export async function GET(request: Request) {
  const hostId = await currentHostId();
  if (!hostId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query || query.length < 5) {
    return NextResponse.json({ error: "Escribe la dirección completa" }, { status: 400 });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "1");

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "RetorikaStay/1.0 (prueba tecnica; contacto naranjoramirez.d@gmail.com)",
        "Accept-Language": "es",
      },
      next: { revalidate: 86400 },
    });
    if (!response.ok) {
      return NextResponse.json({ error: "El servicio de mapas no responde" }, { status: 502 });
    }
    const raw = (await response.json()) as {
      display_name: string;
      lat: string;
      lon: string;
      address?: { city?: string; town?: string; village?: string; municipality?: string };
    }[];

    return NextResponse.json({
      results: raw.map((item) => ({
        label: item.display_name,
        lat: Number(item.lat),
        lng: Number(item.lon),
        city:
          item.address?.city ??
          item.address?.town ??
          item.address?.village ??
          item.address?.municipality ??
          "",
      })),
    });
  } catch {
    /* Si el servicio externo cae, el anfitrión sigue pudiendo escribir las
       coordenadas a mano: la app no depende de esto para funcionar. */
    return NextResponse.json({ error: "No se pudo consultar el mapa" }, { status: 502 });
  }
}
