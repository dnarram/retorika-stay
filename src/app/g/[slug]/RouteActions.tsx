"use client";

import { useEffect, useState } from "react";
import { IconArrow, IconMap, IconWalk } from "@/components/icons";
import type { Dict } from "@/i18n/dictionaries";

/* ---------------------------------------------------------------------------
   Two ways to reach a place, and the guest picks both the way and the mode.

   Starting turn-by-turn navigation the instant someone taps a restaurant is
   presumptuous: we have no idea whether they are walking there tonight or
   driving there tomorrow, and a phone that suddenly starts talking is a phone
   the guest closes. So the flow is: tap "Ir ahora" → choose how you are getting
   there → start. Walking is preselected because these places are minutes away,
   but the choice is visible and one tap wide.

   The buttons only appear on touch devices. `(pointer: coarse)` is the honest
   test: it asks whether the primary input is a finger, which is the actual
   question — a phone, a tablet, a touchscreen laptop. Sniffing the user agent
   would be guessing at the same thing with worse data. On a desktop the guest
   gets a single link to the route view, because navigation on a machine that
   does not move is theatre.
--------------------------------------------------------------------------- */

type Mode = "walking" | "driving" | "bicycling" | "transit";

function mapsUrl(to: { lat: number; lng: number }, mode: Mode, navigate: boolean): string {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", `${to.lat},${to.lng}`);
  url.searchParams.set("travelmode", mode);
  /* Without dir_action the maps app opens the route with its written steps —
     which is exactly the second option the guest asked for. */
  if (navigate) url.searchParams.set("dir_action", "navigate");
  return url.toString();
}

export default function RouteActions({
  to,
  t,
  defaultMode = "walking",
  compact,
}: {
  to: { lat: number; lng: number };
  t: Dict;
  defaultMode?: Mode;
  compact?: boolean;
}) {
  const [touch, setTouch] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(defaultMode);

  useEffect(() => {
    setTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const MODES: { value: Mode; label: string }[] = [
    { value: "walking", label: t.travel.walking },
    { value: "driving", label: t.travel.driving },
    { value: "bicycling", label: t.travel.bicycling },
    { value: "transit", label: t.travel.transit },
  ];

  /* Desktop: one link, the route view. */
  if (!touch) {
    return (
      <a
        href={mapsUrl(to, mode, false)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-brand-line"
      >
        <IconMap size={14} /> {t.actions.route}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white ${
          compact ? "" : ""
        }`}
      >
        <IconWalk size={14} /> {t.actions.navigate}
      </button>

      <a
        href={mapsUrl(to, mode, false)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-brand-line"
      >
        <IconMap size={14} /> {t.actions.route}
      </a>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label={t.actions.navigate}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-t-card bg-white p-5 sm:rounded-card"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="font-display text-lg font-semibold">{t.travel.title}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {MODES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMode(option.value)}
                  aria-pressed={mode === option.value}
                  className={`rounded-xl px-4 py-3 text-sm font-medium ${
                    mode === option.value
                      ? "bg-brand text-white"
                      : "text-muted ring-1 ring-line"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <a
              href={mapsUrl(to, mode, true)}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-medium text-white"
            >
              {t.travel.start} <IconArrow size={16} />
            </a>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-2 w-full rounded-full px-4 py-2.5 text-sm font-medium text-muted"
            >
              {t.actions.close}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
