"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { GuestPlace } from "./GuideView";

/* Plain Leaflet, no react-leaflet: it is fifty lines and avoids a compatibility
   layer that breaks on every major React release. Markers are divIcons (HTML),
   so there is no need to serve Leaflet's PNGs or patch its default image path —
   the classic first bug of any Leaflet integration.

   The second classic bug is the one that made this map render as a single dot
   on a world view: Leaflet measures its container once, when the map is
   created. Every section of this guide except the open one is hidden with CSS,
   so a map built inside a closed section measures zero by zero, and the
   `fitBounds` that follows computes its zoom against nothing. The guest opened
   "Recomendaciones" and found the whole of Europe.

   A ResizeObserver fixes it properly: whenever the box gets a real size — the
   section opens, the phone rotates, the window is resized — the map remeasures
   and refits to the same set of points. */
export default function PlacesMap({
  center,
  places,
  propertyName,
}: {
  center: { lat: number; lng: number };
  places: GuestPlace[];
  propertyName: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const placesRef = useRef(places);
  placesRef.current = places;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !container.current || mapRef.current) return;

      const map = L.map(container.current, { scrollWheelZoom: false }).setView(
        [center.lat, center.lng],
        15,
      );
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      /* The flat is always on the map and always the reference point: every
         distance in this guide is measured from here. */
      L.marker([center.lat, center.lng], {
        icon: L.divIcon({
          className: "",
          html: `<span style="display:flex;align-items:center;justify-content:center;
                 width:30px;height:30px;border-radius:50%;background:#12517d;color:#fff;
                 font:600 13px Inter,sans-serif;border:3px solid #fff;
                 box-shadow:0 1px 5px rgba(0,0,0,.35)">★</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
        title: propertyName,
        zIndexOffset: 1000,
      })
        .addTo(map)
        .bindPopup(propertyName);

      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;

      const observer = new ResizeObserver((entries) => {
        const box = entries[0]?.contentRect;
        if (!box || box.width === 0 || box.height === 0) return;
        map.invalidateSize();
        /* Refit after the resize: the zoom computed against a zero-sized box
           was meaningless, and this is the moment it can be computed properly. */
        fit(L, map);
      });
      observer.observe(container.current);
      observerRef.current = observer;

      draw(L);
    })();

    return () => {
      cancelled = true;
      observerRef.current?.disconnect();
      observerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Redraw markers when the category filter changes; the map and its tiles are
     never recreated. */
  useEffect(() => {
    if (!mapRef.current) return;
    void import("leaflet").then(({ default: L }) => draw(L));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places]);

  function fit(L: typeof import("leaflet"), map: import("leaflet").Map) {
    const current = placesRef.current;
    const points: [number, number][] = [
      [center.lat, center.lng],
      ...current.map((p) => [p.lat, p.lng] as [number, number]),
    ];

    if (points.length === 1) {
      /* Nothing but the flat: a street-level view, not a country. */
      map.setView([center.lat, center.lng], 16);
      return;
    }

    map.fitBounds(L.latLngBounds(points), {
      /* Room for the pins themselves, which hang above their coordinate. */
      padding: [36, 36],
      /* Two places on the same corner must not zoom to the pavement. */
      maxZoom: 17,
    });
  }

  function draw(L: typeof import("leaflet")) {
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();

    places.forEach((place, index) => {
      const icon = L.divIcon({
        className: "",
        html: `<span style="display:flex;align-items:center;justify-content:center;width:26px;
               height:26px;border-radius:50%;background:#156fe7;color:#fff;
               font:600 12px Inter,sans-serif;border:2px solid #fff;
               box-shadow:0 1px 4px rgba(0,0,0,.3)">${index + 1}</span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      L.marker([place.lat, place.lng], { icon, title: place.name })
        .bindPopup(`<strong>${index + 1}. ${place.name}</strong><br>${place.walkMin} min`)
        .addTo(layer);
    });

    fit(L, map);
  }

  /* The sized box is the parent; Leaflet takes the child. globals.css sets
     .leaflet-container { height: 100% }, which would otherwise collapse a map
     that carries its own height class. */
  return (
    <div className="h-full w-full">
      <div ref={container} className="h-full w-full" role="application" aria-label="Mapa" />
    </div>
  );
}
