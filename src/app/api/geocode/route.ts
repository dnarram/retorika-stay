import { NextResponse } from "next/server";
import { currentHostId } from "@/lib/auth";

/* Geocoding through Nominatim (OpenStreetMap).

   Why this and not Google Places: no key, no credit card, no quota and no
   lock-in to a paid provider for something the open map solves well enough for
   a Spanish postal address.

   Nominatim requires a real User-Agent and limits callers to one request per
   second, which is why this runs server-side and only for authenticated hosts:
   the rate limit is ours to respect, not a random visitor's to burn.

   Three modes, one endpoint:
     · q=            free-text search, returns every candidate so the host picks
     · q= + near=    same, biased towards a point (used to find restaurants)
     · lat/lng       reverse geocoding, for the map picker: drop a pin, get an
                     address and a country back
--------------------------------------------------------------------------- */

const NOMINATIM = "https://nominatim.openstreetmap.org";
const HEADERS = {
  "User-Agent": "RetorikaStay/1.0 (technical test; naranjoramirez.d@gmail.com)",
  "Accept-Language": "es",
};

export type GeoResult = {
  label: string;
  lat: number;
  lng: number;
  city: string;
  country: string;
  countryCode: string;
  kind: string;
};

type NominatimItem = {
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    country?: string;
    country_code?: string;
  };
};

const toResult = (item: NominatimItem): GeoResult => ({
  label: item.display_name,
  lat: Number(item.lat),
  lng: Number(item.lon),
  city:
    item.address?.city ??
    item.address?.town ??
    item.address?.village ??
    item.address?.municipality ??
    "",
  country: item.address?.country ?? "",
  countryCode: (item.address?.country_code ?? "").toUpperCase(),
  kind: item.type ?? item.class ?? "",
});

export async function GET(request: Request) {
  const hostId = await currentHostId();
  if (!hostId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim();
  const lat = params.get("lat");
  const lng = params.get("lng");
  const near = params.get("near");

  try {
    /* Reverse: the host dragged the pin, we tell them where it landed. */
    if (lat && lng) {
      const url = new URL(`${NOMINATIM}/reverse`);
      url.searchParams.set("lat", lat);
      url.searchParams.set("lon", lng);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("addressdetails", "1");
      const response = await fetch(url, { headers: HEADERS, next: { revalidate: 86400 } });
      if (!response.ok) throw new Error(String(response.status));
      const item = (await response.json()) as NominatimItem;
      return NextResponse.json({ results: item?.lat ? [toResult(item)] : [] });
    }

    if (!query || query.length < 3) {
      return NextResponse.json({ error: "Escribe al menos tres letras" }, { status: 400 });
    }

    const url = new URL(`${NOMINATIM}/search`);
    url.searchParams.set("q", query);
    url.searchParams.set("format", "jsonv2");
    /* Ten candidates, not one: the previous version silently took the first
       result and was wrong often enough to feel broken. Letting the host choose
       is both more honest and less work than guessing better. */
    url.searchParams.set("limit", "10");
    url.searchParams.set("addressdetails", "1");

    /* A viewbox around the property biases results without hiding the rest:
       "Mercado de Antón Martín" should find the one in this city first. */
    if (near) {
      const [nlat, nlng] = near.split(",").map(Number);
      if (Number.isFinite(nlat) && Number.isFinite(nlng)) {
        const d = 0.25; // roughly 25 km
        url.searchParams.set(
          "viewbox",
          `${nlng - d},${nlat + d},${nlng + d},${nlat - d}`,
        );
        url.searchParams.set("bounded", "0");
      }
    }

    const response = await fetch(url, { headers: HEADERS, next: { revalidate: 86400 } });
    if (!response.ok) throw new Error(String(response.status));
    const raw = (await response.json()) as NominatimItem[];
    return NextResponse.json({ results: raw.map(toResult) });
  } catch {
    /* If the external service is down the host can still place the pin by hand:
       the app does not depend on this to work. */
    return NextResponse.json({ error: "No se pudo consultar el mapa" }, { status: 502 });
  }
}
