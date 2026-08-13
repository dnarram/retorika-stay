"use client";

import { useEffect, useState } from "react";
import { IconMap, IconWalk } from "@/components/icons";
import type { Dict } from "@/i18n/dictionaries";

/* ---------------------------------------------------------------------------
   Two intentions, two destinations. They are not the same button with different
   settings, and that is the whole point.

   · "Ir ahora"  → someone standing up, about to leave. Google Maps, which is
                   where navigation actually lives, with its own mode selector
                   and its own start button. We do not put a screen of our own
                   in front of it: Maps already asks the question, and asking it
                   twice is friction we invented.

   · "Ver ruta"  → someone who wants the route written down. Printable,
                   shareable, and useful hours before setting off.

   The second one is why this component links to OpenStreetMap rather than to
   Google. On a laptop, a Google Maps link opens the web app with its
   step-by-step panel; on a phone the identical link is intercepted by the Maps
   app, which has no such panel. There is no parameter that prevents that — the
   app claims those URLs at the operating system level. So the two buttons would
   have collapsed into the same thing on exactly the devices where the
   difference matters.

   OpenStreetMap's directions page is a web page on every device: same route,
   same numbered steps, same panel, and it prints. It also lets the route start
   at the flat rather than at wherever the guest happens to be standing, which
   is what someone planning tomorrow's walk actually wants.
--------------------------------------------------------------------------- */

type Mode = "walking" | "driving" | "bicycling";

const OSRM_ENGINE: Record<Mode, string> = {
  walking: "fossgis_osrm_foot",
  driving: "fossgis_osrm_car",
  bicycling: "fossgis_osrm_bike",
};

/* Navigation: hand straight over to Maps, with no mode preselected so its own
   selector opens where the guest expects it. */
function navigateUrl(to: { lat: number; lng: number }): string {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", `${to.lat},${to.lng}`);
  return url.toString();
}

/* Written directions: a web page, identical on every device. */
function routeUrl(
  to: { lat: number; lng: number },
  from: { lat: number; lng: number } | undefined,
  mode: Mode,
): string {
  const url = new URL("https://www.openstreetmap.org/directions");
  url.searchParams.set("engine", OSRM_ENGINE[mode]);
  /* An empty origin is valid: OpenStreetMap asks for it, and the guest can use
     their location. That is the right default for "how do I reach the flat",
     where we have no idea where they are coming from. */
  url.searchParams.set("route", `${from ? `${from.lat},${from.lng}` : ""};${to.lat},${to.lng}`);
  return url.toString();
}

export default function RouteActions({
  to,
  from,
  t,
  defaultMode = "walking",
}: {
  to: { lat: number; lng: number };
  from?: { lat: number; lng: number };
  t: Dict;
  defaultMode?: Mode;
}) {
  const [touch, setTouch] = useState(false);

  /* `(pointer: coarse)` asks whether the primary input is a finger, which is
     the actual question. Sniffing the user agent guesses at the same thing with
     worse data. */
  useEffect(() => {
    setTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  return (
    <>
      {/* Navigation only where there is something to navigate: on a machine
          that does not move it is theatre. */}
      {touch ? (
        <a
          href={navigateUrl(to)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-sm font-medium text-white"
        >
          <IconWalk size={14} /> {t.actions.navigate}
        </a>
      ) : null}

      <a
        href={routeUrl(to, from, defaultMode)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-brand-line"
      >
        <IconMap size={14} /> {t.actions.route}
      </a>
    </>
  );
}
