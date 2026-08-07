"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { GuestPlace } from "./GuideView";

/* Plain Leaflet, no react-leaflet: it is fifty lines and avoids a compatibility
   layer that breaks on every major React release. Markers are divIcons (HTML),
   so there is no need to serve Leaflet's PNGs or patch its default image path —
   the classic first bug of any Leaflet integration. */
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

      const pin = (label: string, home = false) =>
        L.divIcon({
          className: "",
          html: `<span style="display:flex;align-items:center;justify-content:center;
                 width:${home ? 30 : 24}px;height:${home ? 30 : 24}px;border-radius:50%;
                 background:${home ? "#12517d" : "#156fe7"};color:#fff;font:600 11px Inter,sans-serif;
                 border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3)">${label}</span>`,
          iconSize: [home ? 30 : 24, home ? 30 : 24],
          iconAnchor: [home ? 15 : 12, home ? 15 : 12],
        });

      L.marker([center.lat, center.lng], { icon: pin("★", true), title: propertyName })
        .addTo(map)
        .bindPopup(propertyName);

      layerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      draw(L);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Only the markers are redrawn when the category filter changes: the map and
     its tiles are never recreated. */
  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then(({ default: L }) => draw(L));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places]);

  function draw(L: typeof import("leaflet")) {
    const layer = layerRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();

    places.forEach((place, index) => {
      const icon = L.divIcon({
        className: "",
        html: `<span style="display:flex;align-items:center;justify-content:center;width:24px;
               height:24px;border-radius:50%;background:#156fe7;color:#fff;
               font:600 11px Inter,sans-serif;border:2px solid #fff">${index + 1}</span>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      L.marker([place.lat, place.lng], { icon, title: place.name })
        .bindPopup(`<strong>${place.name}</strong><br>${place.walkMin} min`)
        .addTo(layer);
    });

    const points: [number, number][] = [
      [center.lat, center.lng],
      ...places.map((p) => [p.lat, p.lng] as [number, number]),
    ];
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points).pad(0.15));
    }
  }

  return <div ref={container} role="application" aria-label="Mapa de recomendaciones" />;
}
