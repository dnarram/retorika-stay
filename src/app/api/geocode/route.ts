import { NextResponse } from "next/server";
import { currentHostId } from "@/lib/auth";

/* Geocoding through Nominatim (OpenStreetMap): the host types an address and
   the coordinates appear. That removes the "latitude" field, one of the classic
   reasons people abandon a form halfway through.

   Why this and not Google Places: no key, no credit card, no quota and no
   lock-in to a paid provider for something the open map solves just as well for
   a Spanish postal address.

   Nominatim requires a real User-Agent and limits callers to one request per
   second, which is why this runs server-side and only for authenticated hosts:
   the rate limit is ours to respect, not a random visitor's to burn. */
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
    /* If the external service is down the host can still type the coordinates
       by hand: the app does not depend on this to work. */
    return NextResponse.json({ error: "No se pudo consultar el mapa" }, { status: 502 });
  }
}
