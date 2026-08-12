import { NextResponse } from "next/server";
import { currentHostId } from "@/lib/auth";

/* ---------------------------------------------------------------------------
   Geocoding through Nominatim (OpenStreetMap).

   Why this and not Google Places: no key, no credit card, no quota and no
   lock-in to a paid provider for something the open map solves well enough for
   a Spanish postal address.

   The hard part is not the lookup, it is failing usefully. "Calle Arriate 7,
   Ronda 29400" returns nothing, because OpenStreetMap has the street but not
   that particular house number — most Spanish streets have no per-number data
   at all. The first version reported "address not found" and left the host
   staring at a map of the Atlantic, which is a terrible answer to a perfectly
   correct address.

   So the search degrades in steps and says which one it landed on:

     1. exactly what the host typed
     2. structured search: street + city + postcode + country
     3. same, without the house number
     4. the town alone

   Step 4 is not a failure. The pin is the source of truth in this app; the
   search only has to get the map close enough for the host to drag it to the
   doorway, and a map centred on Ronda does that job.
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

async function ask(params: Record<string, string>): Promise<GeoResult[]> {
  const url = new URL(`${NOMINATIM}/search`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "10");
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url, { headers: HEADERS, next: { revalidate: 86400 } });
  if (!response.ok) throw new Error(String(response.status));
  const raw = (await response.json()) as NominatimItem[];
  return raw.map(toResult);
}

/* Pulls the postcode, the house number and the town out of what the host typed,
   so the structured fallbacks have something to work with. Deliberately
   forgiving: a wrong guess only costs one extra query. */
function parseAddress(input: string) {
  const parts = input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  let postalcode = "";
  const rest: string[] = [];
  for (const part of parts) {
    const code = part.match(/\b\d{4,5}\b/);
    /* A 4-5 digit group on its own, or trailing a town name, is a postcode; the
       same digits glued to a street name are a house number. */
    if (code && !/^\d{1,4}$/.test(part.trim())) {
      postalcode = code[0];
      const without = part.replace(code[0], "").trim();
      if (without) rest.push(without);
    } else {
      rest.push(part);
    }
  }

  const street = rest[0] ?? "";
  const city = rest.length > 1 ? rest[rest.length - 1] : "";
  const streetNoNumber = street.replace(/[,\s]*\b\d+\w?\b\s*$/, "").trim();
  /* "Calle Arriate, 7, Ronda" puts the number in its own comma group. */
  const numberOnly = rest.find((part) => /^\d+\w?$/.test(part));

  return {
    street,
    streetNoNumber: streetNoNumber || street,
    number: numberOnly ?? "",
    city,
    postalcode,
  };
}

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

    /* A viewbox around the property biases results without hiding the rest:
       "Mercado de Antón Martín" should find the one in this city first. */
    const bias: Record<string, string> = {};
    if (near) {
      const [nlat, nlng] = near.split(",").map(Number);
      if (Number.isFinite(nlat) && Number.isFinite(nlng)) {
        const d = 0.25; // roughly 25 km
        bias.viewbox = `${nlng - d},${nlat + d},${nlng + d},${nlat - d}`;
        bias.bounded = "0";
      }
    }

    let results = await ask({ q: query, ...bias });
    let precision: "exact" | "street" | "town" = "exact";

    if (results.length === 0) {
      const parsed = parseAddress(query);

      /* Structured beats free text when free text has already failed: it tells
         Nominatim which token is the street and which is the town instead of
         letting it guess. */
      if (parsed.street && (parsed.city || parsed.postalcode)) {
        results = await ask({
          street: parsed.number ? `${parsed.number} ${parsed.streetNoNumber}` : parsed.street,
          city: parsed.city,
          postalcode: parsed.postalcode,
        });
      }

      /* Drop the house number: most Spanish streets are mapped as a line with
         no individual addresses on it. */
      if (results.length === 0 && parsed.streetNoNumber) {
        results = await ask({
          street: parsed.streetNoNumber,
          city: parsed.city,
          postalcode: parsed.postalcode,
        });
        if (results.length > 0) precision = "street";
      }

      /* Last resort: the town. Close enough to drag the pin from. */
      if (results.length === 0 && (parsed.city || parsed.postalcode)) {
        results = await ask({ city: parsed.city, postalcode: parsed.postalcode });
        if (results.length > 0) precision = "town";
      }
    }

    return NextResponse.json({ results, precision });
  } catch {
    /* If the external service is down the host can still place the pin by hand:
       the app does not depend on this to work. */
    return NextResponse.json({ error: "No se pudo consultar el mapa" }, { status: 502 });
  }
}
