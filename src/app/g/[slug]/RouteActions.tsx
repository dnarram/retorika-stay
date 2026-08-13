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
  t,
  defaultMode = "walking",
}: {
  to: { lat: number; lng: number };
  t: Dict;
  defaultMode?: Mode;
}) {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", `${to.lat},${to.lng}`);
  /* No origin on purpose. Leaving it out is what makes Maps start from where
     the guest actually is, which is right almost every time someone taps this.
     The flat as a starting point was my idea, not theirs, and it cost a second
     button to undo — a guest planning from the sofa can type the address into
     the field Maps already shows them. */
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
