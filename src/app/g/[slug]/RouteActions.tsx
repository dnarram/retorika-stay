import { IconMap } from "@/components/icons";
import type { Dict } from "@/i18n/dictionaries";

/* ---------------------------------------------------------------------------
   One button, one provider, every device.

   The previous version split this in two — navigate now, or read the route —
   and then had to detect the device to decide which of them to show. Both
   decisions were mine to make and neither was mine to make: a Google Maps link
   already does the right thing on each device without being told. On a phone or
   tablet the Maps app takes over and offers navigation; on a laptop the web app
   draws the route and lists the steps in a panel that prints and shares.

   Dropping `dir_action=navigate` is what makes that work. With it, a phone goes
   straight into turn-by-turn, which is presumptuous for a guest who only wanted
   to see how far the restaurant is. Without it, the guest lands on the route and
   decides for themselves — which is the same freedom the desktop always had.

   Because no device detection is left, this is a plain link with no state and no
   client-side JavaScript at all. The simplest version of this feature is also
   the one that behaves best.
--------------------------------------------------------------------------- */

type Mode = "walking" | "driving" | "bicycling" | "transit";

export default function RouteActions({
  to,
  from,
  t,
  defaultMode = "walking",
}: {
  to: { lat: number; lng: number };
  /* The flat, when the journey starts there. Passing it means the route is
     already drawn when the page opens instead of asking the guest where they
     are — and it is what someone planning tomorrow's walk actually wants. It is
     deliberately absent for "how do I reach the flat", where only the guest
     knows where they are coming from. */
  from?: { lat: number; lng: number };
  t: Dict;
  defaultMode?: Mode;
}) {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", `${to.lat},${to.lng}`);
  if (from) url.searchParams.set("origin", `${from.lat},${from.lng}`);
  /* A starting suggestion, not a decision: Maps keeps its own mode selector. */
  url.searchParams.set("travelmode", defaultMode);

  return (
    <a
      href={url.toString()}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-sm font-medium text-white"
    >
      <IconMap size={14} /> {t.actions.directions}
    </a>
  );
}
