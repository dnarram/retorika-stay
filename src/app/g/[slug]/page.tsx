import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resolveLocale } from "@/i18n/dictionaries";
import { currentHostId, guidePinCookie, verifyPinToken } from "@/lib/auth";
import { formatDistance, haversineMeters, walkingMinutes } from "@/lib/geo";
import { getRepo } from "@/lib/repo";
import type { Locale, Property, Stay } from "@/lib/schema";
import { canRevealAccess, isPhase, nightsBetween, stayPhase, type StayPhase } from "@/lib/stay";
import { fontsHref } from "@/lib/theme";
import GuideView, { type GuestPayload } from "./GuideView";
import PinGate from "./PinGate";

/* Guides are never indexed: they hold the door code and Wi-Fi password of a
   real home. The X-Robots-Tag is also set in next.config.ts. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

type Search = { lang?: string; fase?: string; editor?: string; paso?: string };

export default async function GuidePage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await props.params;
  const { lang, fase, editor, paso } = await props.searchParams;
  const repo = getRepo();

  /* One link format, two very different audiences:
       · booking slug  → the fridge QR. Full access, only for the days of the
                         booking.
       · property slug → the link the host pastes into the rental ad. The whole
                         guide MINUS anything that opens the home.
     Resolving the booking first is what lets the listing link stay valid
     forever without ever being dangerous. */
  const stay: Stay | null = await repo.getStayBySlug(slug);
  const property: Property | null = stay
    ? await repo.getProperty(stay.propertyId)
    : await repo.getPropertyBySlug(slug);

  if (!property) notFound();

  /* An unpublished guide is a 404 for the world, but not for the person who
     owns it: the host has to be able to see their draft before deciding to
     publish it. Anything else means the dashboard offers three share buttons
     that lead nowhere. */
  const isOwner = (await currentHostId()) === property.hostId;
  if (!property.published && !isOwner) notFound();
  const draft = !property.published;

  /* The PIN can be set per booking or for the whole property: the booking one
     wins, so it can be changed for one guest without touching anything else. */
  const pin = stay?.pin ?? property.pin;
  if (pin) {
    const jar = await cookies();
    if (!(await verifyPinToken(jar.get(guidePinCookie(slug))?.value, slug))) {
      const requested = resolveLocale(
        lang,
        (await headers()).get("accept-language"),
        property.defaultLocale,
      );
      return <PinGate slug={slug} locale={requested} propertyName={property.name} />;
    }
  }

  const locale: Locale = resolveLocale(
    lang,
    (await headers()).get("accept-language"),
    property.defaultLocale,
  );

  const guide =
    (await repo.getGuide(property.id, locale)) ??
    (await repo.getGuide(property.id, property.defaultLocale));
  if (!guide) notFound();

  const places = await repo.listPlaces(property.id);

  /* The host's name can never be blank. The field is editable and a host can
     empty it, but the guide always has an account behind it, so the account is
     the floor: what the host typed wins, and their registered name catches the
     fall. A "Host:" with nothing after it is worse than no line at all. */
  const account = await repo.getHostById(property.hostId);
  /* People register as "belen montes" at two in the morning and their name then
     appears that way to every guest. Capitalising on display fixes it for the
     guides already out there without touching what they typed. */
  const hostName = titleCase(property.hostName.trim() || account?.name?.trim() || "");

  /* ?fase= is a demo shortcut: it shows all five versions of the guide without
     waiting for a booking's real dates. */
  const demoPhase = isPhase(fase) ? (fase as StayPhase) : null;

  const phase: StayPhase = demoPhase ?? (stay ? stayPhase(stay) : "staying");

  /* SECURITY: ?fase= may narrow what is shown and must never widen it.

     The first version let the parameter decide on its own, which meant anybody
     holding the link to a finished booking could append ?fase=staying and get
     the door code back — defeating the single feature this product is built
     around. The rule now is monotonic: the real dates decide whether the code
     may be served at all, and the demo parameter can only take that away.

     Which keeps the review script working (an active booking with
     ?fase=memories still hides the code) and closes the hole (a finished
     booking with ?fase=staying stays closed). */
  const withinWindow = stay ? canRevealAccess(stay) : false;
  const demoAllows = demoPhase ? demoPhase !== "before" && demoPhase !== "memories" : true;

  /* The owner sees everything, always.

     Hiding the door code from the person who typed it made no sense: they are
     checking that their own guide reads correctly, and half of what they came
     to check was blanked out. The rule protects guests from each other, not a
     host from themselves — and `isOwner` comes from the session, so it cannot
     be claimed by anybody else. */
  const reveal = isOwner || (withinWindow && demoAllows);

  const origin = { lat: property.lat, lng: property.lng };

  const payload: GuestPayload = {
    audience: stay ? "booking" : "listing",
    draft,
    /* Drives the "back to my properties" link. Only the owner ever sees it: a
       guest must never learn there is a dashboard behind this page. */
    isOwner,
    hiddenSections: property.hiddenSections,
    /* Set only when the host arrived from their own editor: previewing is a
       look, and the way out should be the way back. */
    backToEditor:
      isOwner && editor === property.id
        ? `/panel/${property.id}?paso=${Math.min(Math.max(Number(paso) || 1, 1), 7)}`
        : null,
    theme: property.theme,
    stay: stay
      ? {
          guestName: stay.guestName,
          arrival: stay.arrival,
          departure: stay.departure,
          nights: nightsBetween(stay.arrival, stay.departure),
        }
      : null,
    property: {
      slug,
      name: property.name,
      city: property.city,
      address: property.address,
      lat: property.lat,
      lng: property.lng,
      hostName,
      hostPhone: property.hostPhone,
      wifiSsid: property.wifiSsid,
      wifiSecurity: property.wifiSecurity,
      checkinFrom: property.checkinFrom,
      checkoutUntil: property.checkoutUntil,
      contacts: property.contacts,
      /* The two values that open the home. Outside the booking window they are
         not serialised: not hidden, simply absent from the HTML. */
      accessCode: reveal ? (stay?.accessCodeOverride ?? property.accessCode) : null,
      hasAccessCode: Boolean((stay?.accessCodeOverride ?? property.accessCode).trim()),
      defaultLocale: property.defaultLocale,
      wifiPassword: reveal ? property.wifiPassword : null,
    },
    guide: guide.content,
    /* If the language served is not the host's own, it is a machine
       translation and we say so. Neither host nor guest has any reason to be
       multilingual: demanding a human review would be demanding the impossible. */
    autoTranslated: guide.locale !== property.defaultLocale,
    locale,
    phase,
    demoPhase: Boolean(demoPhase),
    places: places
      .map((place) => {
        const meters = haversineMeters(origin, place);
        return {
          ...place,
          walkMin: walkingMinutes(origin, place),
          distance: formatDistance(meters),
          meters: Math.round(meters),
        };
      })
      .sort((a, b) => a.meters - b.meters),
  };

  return (
    <>
      {/* React hoists this into <head>. Loading only the pairing this guide
          actually uses keeps three unused families off a guest's phone. */}
      <link rel="stylesheet" href={fontsHref(property.theme)} />
      <GuideView data={payload} />
    </>
  );
}

/* Handles the particles Spanish names carry ("de", "del", "la") by leaving them
   lower case, which is how the names are actually written. */
const PARTICLES = new Set(["de", "del", "la", "las", "los", "y", "da", "do", "van", "von"]);

function titleCase(value: string): string {
  return value
    .toLocaleLowerCase("es")
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) =>
      index > 0 && PARTICLES.has(word)
        ? word
        : word.charAt(0).toLocaleUpperCase("es") + word.slice(1),
    )
    .join(" ");
}
