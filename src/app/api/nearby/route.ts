import { NextResponse } from "next/server";
import { currentHostId } from "@/lib/auth";
import { walkingMinutes } from "@/lib/geo";
import type { PlaceCategory } from "@/lib/schema";

/* ---------------------------------------------------------------------------
   Popular places near the property, from OpenStreetMap via Overpass.

   The point is not to write the guide for the host — a list of every bar within
   500 m is noise, and a recommendation without a personal note is just a map.
   The point is to remove the typing: the host recognises the places they
   already recommend by word of mouth, taps them, and writes only the sentence
   that matters ("ask for the oxtail").

   Ordered by walking distance, capped at 30. Free, no key, no quota beyond
   politeness. If Overpass is unavailable the host adds places by hand, exactly
   as before: this endpoint is a shortcut, never a dependency.
--------------------------------------------------------------------------- */

const ENDPOINT = "https://overpass-api.de/api/interpreter";

/* OSM tags → our categories. Anything not listed is ignored rather than guessed
   into the wrong bucket. */
const MAPPING: { filter: string; category: PlaceCategory }[] = [
  { filter: 'node["amenity"="restaurant"]', category: "restaurant" },
  { filter: 'node["amenity"="cafe"]', category: "cafe" },
  { filter: 'node["amenity"="bar"]', category: "nightlife" },
  { filter: 'node["amenity"="pharmacy"]', category: "services" },
  { filter: 'node["shop"="supermarket"]', category: "shopping" },
  { filter: 'node["shop"="bakery"]', category: "shopping" },
  { filter: 'node["tourism"="attraction"]', category: "sights" },
  { filter: 'node["tourism"="museum"]', category: "sights" },
  { filter: 'node["historic"="monument"]', category: "sights" },
  { filter: 'node["leisure"="park"]', category: "outdoors" },
];

export type NearbyPlace = {
  name: string;
  lat: number;
  lng: number;
  category: PlaceCategory;
  walkMin: number;
  cuisine?: string;
};

export async function GET(request: Request) {
  const hostId = await currentHostId();
  if (!hostId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const radius = Math.min(Number(params.get("radius") ?? 800), 2000);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Coordenadas no válidas" }, { status: 400 });
  }

  /* Only named places: an unnamed node is useless as a recommendation. */
  const query = `[out:json][timeout:20];(${MAPPING.map(
    (m) => `${m.filter}["name"](around:${radius},${lat},${lng});`,
  ).join("")});out body 120;`;

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      next: { revalidate: 86400 },
    });
    if (!response.ok) throw new Error(String(response.status));

    const payload = (await response.json()) as {
      elements: { lat: number; lon: number; tags?: Record<string, string> }[];
    };

    const origin = { lat, lng };
    const seen = new Set<string>();
    const places: NearbyPlace[] = [];

    for (const element of payload.elements ?? []) {
      const tags = element.tags ?? {};
      const name = tags.name;
      if (!name || seen.has(name)) continue;

      const match = MAPPING.find((m) => {
        const [key, value] = m.filter.match(/\["([^"]+)"="([^"]+)"\]/)?.slice(1) ?? [];
        return key && tags[key] === value;
      });
      if (!match) continue;

      seen.add(name);
      places.push({
        name,
        lat: element.lat,
        lng: element.lon,
        category: match.category,
        walkMin: walkingMinutes(origin, { lat: element.lat, lng: element.lon }),
        cuisine: tags.cuisine?.split(";")[0],
      });
    }

    places.sort((a, b) => a.walkMin - b.walkMin);
    return NextResponse.json({ places: places.slice(0, 30) });
  } catch {
    return NextResponse.json(
      { error: "No se pudieron buscar sitios cercanos. Puedes añadirlos a mano." },
      { status: 502 },
    );
  }
}
