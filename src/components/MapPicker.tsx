"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { IconPin, IconArrow } from "@/components/icons";
import type { GeoResult } from "@/app/api/geocode/route";

/* ---------------------------------------------------------------------------
   Place a point on a map instead of typing coordinates.

   A host does not know that their flat is at 36.7418, -5.1660, and asking them
   for it was the single worst piece of friction in the editor: a required field
   whose value they had no way of knowing. Worse, the numeric inputs rejected
   negative decimals halfway through typing — "-5." is not a number, so the
   value bounced back before they could finish.

   So: search by name or address, pick from the candidates, then drag the pin to
   the doorway. The coordinates still exist underneath — the map needs them, the
   walking distances need them — but the host never has to see them.
--------------------------------------------------------------------------- */

type Props = {
  lat: number;
  lng: number;
  /* Seeds the first search so the map opens on the right town rather than in
     the middle of the Atlantic. */
  seedQuery?: string;
  /* Biases search results towards the property when picking a restaurant. */
  near?: { lat: number; lng: number };
  label: string;
  onPick: (value: { lat: number; lng: number; label: string; countryCode?: string; city?: string }) => void;
};

export default function MapPicker({ lat, lng, seedQuery, near, label, onPick }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);

  const [query, setQuery] = useState(seedQuery ?? "");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  /* One map instance for the life of the component. Leaflet is imported
     dynamically because it touches `window` on load. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !container.current || mapRef.current) return;

      const map = L.map(container.current).setView([lat, lng], lat === 0 && lng === 0 ? 5 : 17);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({
        className: "",
        html: `<span style="display:block;width:26px;height:26px;border-radius:50% 50% 50% 0;
               transform:rotate(-45deg);background:#ff3a72;border:3px solid #fff;
               box-shadow:0 2px 6px rgba(0,0,0,.35)"></span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 26],
      });

      const marker = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        void commit(p.lat, p.lng);
      });
      /* Tapping the map moves the pin too: dragging a 26 px target on a phone is
         harder than tapping where you mean. */
      map.on("click", (event: import("leaflet").LeafletMouseEvent) => {
        marker.setLatLng(event.latlng);
        void commit(event.latlng.lat, event.latlng.lng);
      });

      mapRef.current = map;
      markerRef.current = marker;
      /* Leaflet measures its container on creation; inside a panel that was
         hidden a moment ago it reads zero and renders grey tiles. */
      setTimeout(() => map.invalidateSize(), 60);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Reverse-geocode so the host sees, in words, where the pin landed. If the
     lookup fails the coordinates are still saved: the address is a courtesy. */
  async function commit(nextLat: number, nextLng: number) {
    onPick({ lat: nextLat, lng: nextLng, label: "" });
    setStatus(null);
    try {
      const response = await fetch(`/api/geocode?lat=${nextLat}&lng=${nextLng}`);
      if (!response.ok) return;
      const { results: found } = (await response.json()) as { results: GeoResult[] };
      const first = found[0];
      if (first) {
        setAddress(first.label);
        onPick({
          lat: nextLat,
          lng: nextLng,
          label: first.label,
          countryCode: first.countryCode,
          city: first.city,
        });
      }
    } catch {
      /* offline: the pin is what matters */
    }
  }

  async function search(event?: React.FormEvent) {
    event?.preventDefault();
    if (query.trim().length < 3) return;
    setStatus("Buscando…");
    setResults([]);
    const url = new URL("/api/geocode", window.location.origin);
    url.searchParams.set("q", query);
    if (near) url.searchParams.set("near", `${near.lat},${near.lng}`);
    const response = await fetch(url);
    if (!response.ok) {
      setStatus("No se pudo buscar. Coloca el punto en el mapa a mano.");
      return;
    }
    const { results: found } = (await response.json()) as { results: GeoResult[] };
    setStatus(found.length === 0 ? "Sin resultados. Prueba con menos detalle." : null);
    setResults(found);
  }

  async function choose(result: GeoResult) {
    setResults([]);
    setAddress(result.label);
    markerRef.current?.setLatLng([result.lat, result.lng]);
    mapRef.current?.setView([result.lat, result.lng], 18);
    onPick({
      lat: result.lat,
      lng: result.lng,
      label: result.label,
      countryCode: result.countryCode,
      city: result.city,
    });
  }

  return (
    <div className="text-sm">
      <p className="font-medium">{label}</p>

      <form onSubmit={search} className="mt-2 flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Calle, número y ciudad"
          className="w-full rounded-xl border border-line px-3 py-2 outline-none focus:border-brand"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-brand px-4 py-2 font-medium text-white"
        >
          Buscar
        </button>
      </form>

      {status ? <p className="mt-2 text-xs text-muted">{status}</p> : null}

      {results.length > 0 ? (
        <ul className="mt-2 max-h-44 overflow-auto rounded-xl border border-line">
          {results.map((result) => (
            <li key={`${result.lat},${result.lng}`}>
              <button
                type="button"
                onClick={() => choose(result)}
                className="flex w-full items-start gap-2 border-b border-line px-3 py-2 text-left last:border-0 hover:bg-brand-soft"
              >
                <IconPin size={14} className="mt-0.5 shrink-0 text-brand" />
                <span className="text-xs">{result.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div
        ref={container}
        className="mt-3 h-64 overflow-hidden rounded-xl border border-line"
        role="application"
        aria-label={label}
      />

      <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
        <IconArrow size={13} className="mt-0.5 shrink-0" />
        Arrastra el punto o toca el mapa para ajustar la posición exacta.
      </p>
      {address ? <p className="mt-1 text-xs text-brand-deep">{address}</p> : null}
    </div>
  );
}
