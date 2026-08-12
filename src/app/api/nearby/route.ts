import { NextResponse } from "next/server";
import { currentHostId } from "@/lib/auth";
import { walkingMinutes } from "@/lib/geo";
import type { PlaceCategory } from "@/lib/schema";

/* ---------------------------------------------------------------------------
   Popular places near the property, from OpenStreetMap via Overpass.

   The point is not to write the guide for the host — a list of every bar within
   500 m is noise, and a recommendation without a personal note is just a map.
   The point is to remove the typing: the host recognises places they already
   recommend by word of mouth, taps them, and writes only the sentence that
   matters ("ask for the oxtail").

   Four things the first version got wrong, all of them the reason it never
   returned anything from production:

     1. No User-Agent. Overpass throttles anonymous clients hard, and from the
        shared IPs of a serverless platform that means an immediate 429.
     2. One mirror. When overpass-api.de is busy — which is often — there was no
        second chance. Now three are tried in turn.
     3. Only `node`. A great many restaurants and museums are mapped as ways or
        relations (the building, not a point), so they were invisible. `nwr`
        plus `out center` covers all three.
     4. The real error was swallowed and replaced with a generic sentence, which
        is why this took a deployment to diagnose instead of a glance.

   If every mirror fails the host adds places by hand, exactly as before: this
   endpoint is a shortcut, never a dependency.
--------------------------------------------------------------------------- */

/* Kumi first: the main instance is the busiest and was the one returning 504.
   Nine seconds each, so all three still fit inside the function's budget —
   the previous 25 s meant the first mirror ate the whole allowance and the
   other two never really got their turn. */
const MIRRORS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const PER_MIRROR_MS = 9000;

/* Vercel kills a serverless function at its own limit regardless of what fetch
   is waiting for, and the default is shorter than three attempts need. */
export const maxDuration = 30;

/* OSM tag → our category. Anything not listed is ignored rather than guessed
   into the wrong bucket. */
const TAGS: { key: string; value: string; category: PlaceCategory }[] = [
  { key: "amenity", value: "restaurant", category: "restaurant" },
  { key: "amenity", value: "fast_food", category: "restaurant" },
  { key: "amenity", value: "cafe", category: "cafe" },
  { key: "amenity", value: "bar", category: "nightlife" },
  { key: "amenity", value: "pub", category: "nightlife" },
  { key: "amenity", value: "nightclub", category: "nightlife" },
  { key: "amenity", value: "pharmacy", category: "services" },
  { key: "amenity", value: "marketplace", category: "shopping" },
  { key: "shop", value: "supermarket", category: "shopping" },
  { key: "shop", value: "bakery", category: "shopping" },
  { key: "tourism", value: "attraction", category: "sights" },
  { key: "tourism", value: "museum", category: "sights" },
  { key: "tourism", value: "viewpoint", category: "sights" },
  { key: "historic", value: "monument", category: "sights" },
  { key: "historic", value: "castle", category: "sights" },
  { key: "leisure", value: "park", category: "outdoors" },
  { key: "leisure", value: "garden", category: "outdoors" },
];

export type NearbyPlace = {
  name: string;
  lat: number;
  lng: number;
  category: PlaceCategory;
  walkMin: number;
  cuisine?: string;
};

type Element = {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export async function GET(request: Request) {
  const hostId = await currentHostId();
  if (!hostId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const radius = Math.min(Math.max(Number(params.get("radius") ?? 700), 200), 2000);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
    return NextResponse.json(
      { error: "Sitúa primero el alojamiento en el mapa, en el paso 1." },
      { status: 400 },
    );
  }

  /* One clause per tag KEY, not per value.

     The first version emitted seventeen separate `nwr` statements, so Overpass
     walked its spatial index seventeen times for one answer — which is exactly
     what produced the 504s and timeouts in production. Grouping the values into
     a regex per key brings it down to five passes over the same area, for
     identical results.

     nwr = node, way and relation: plenty of restaurants and museums are mapped
     as buildings rather than points. `out center` gives each one a coordinate. */
  const byKey = new Map<string, string[]>();
  for (const tag of TAGS) {
    byKey.set(tag.key, [...(byKey.get(tag.key) ?? []), tag.value]);
  }
  const clauses = [...byKey.entries()]
    .map(([key, values]) =>
      `nwr["${key}"~"^(${values.join("|")})$"]["name"](around:${radius},${lat},${lng});`,
    )
    .join("");
  /* timeout:15 is what we ask Overpass to spend; PER_MIRROR_MS is what we are
     willing to wait. The first has to be the smaller of the two or the server
     keeps working on a query nobody is listening to any more. */
  const query = `[out:json][timeout:15];(${clauses});out center 80;`;

  const failures: string[] = [];

  for (const mirror of MIRRORS) {
    try {
      const response = await fetch(mirror, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          /* Overpass asks callers to identify themselves, and throttles those
             who do not. This one line is the difference between results and a
             permanent 429. */
          "User-Agent": "RetorikaStay/1.0 (technical test; naranjoramirez.d@gmail.com)",
        },
        body: `data=${encodeURIComponent(query)}`,
        cache: "no-store",
        signal: AbortSignal.timeout(PER_MIRROR_MS),
      });

      if (!response.ok) {
        failures.push(`${new URL(mirror).hostname}: ${response.status}`);
        continue;
      }

      const payload = (await response.json()) as { elements?: Element[] };
      const origin = { lat, lng };
      const seen = new Set<string>();
      const places: NearbyPlace[] = [];

      for (const element of payload.elements ?? []) {
        const tags = element.tags ?? {};
        const name = tags.name;
        const plat = element.lat ?? element.center?.lat;
        const plng = element.lon ?? element.center?.lon;
        if (!name || plat === undefined || plng === undefined) continue;

        const key = name.toLowerCase();
        if (seen.has(key)) continue;

        const match = TAGS.find((t) => tags[t.key] === t.value);
        if (!match) continue;

        seen.add(key);
        places.push({
          name,
          lat: plat,
          lng: plng,
          category: match.category,
          walkMin: walkingMinutes(origin, { lat: plat, lng: plng }),
          cuisine: tags.cuisine?.split(";")[0]?.replace(/_/g, " "),
        });
      }

      places.sort((a, b) => a.walkMin - b.walkMin);
      return NextResponse.json({ places: places.slice(0, 40), source: new URL(mirror).hostname });
    } catch (error) {
      failures.push(`${new URL(mirror).hostname}: ${(error as Error).name}`);
    }
  }

  /* Say what actually happened. A generic "could not search" is what made the
     first version take a deployment to diagnose. */
  return NextResponse.json(
    {
      error: "OpenStreetMap no responde ahora mismo. Puedes añadir los sitios a mano.",
      detail: failures.join(" · "),
    },
    { status: 502 },
  );
}
