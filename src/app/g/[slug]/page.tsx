import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resolveLocale } from "@/i18n/dictionaries";
import { currentHostId, guidePinCookie, verifyPinToken } from "@/lib/auth";
import { directionsUrl, formatDistance, haversineMeters, walkingMinutes } from "@/lib/geo";
import { getRepo } from "@/lib/repo";
import type { Locale, Property, Stay } from "@/lib/schema";
import { canRevealAccess, isPhase, nightsBetween, stayPhase, type StayPhase } from "@/lib/stay";
import GuideView, { type GuestPayload } from "./GuideView";
import PinGate from "./PinGate";

/* Guides are never indexed: they hold the door code and Wi-Fi password of a
   real home. The X-Robots-Tag is also set in next.config.ts. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

type Search = { lang?: string; fase?: string };

export default async function GuidePage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await props.params;
  const { lang, fase } = await props.searchParams;
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

  /* ?fase= is a demo shortcut: it shows all five versions of the guide without
     waiting for a booking's real dates. */
  const demoPhase = isPhase(fase) ? (fase as StayPhase) : null;

  const phase: StayPhase = demoPhase ?? (stay ? stayPhase(stay) : "staying");
  const reveal = stay
    ? demoPhase
      ? demoPhase !== "before" && demoPhase !== "memories"
      : canRevealAccess(stay)
    : false;

  const origin = { lat: property.lat, lng: property.lng };

  const payload: GuestPayload = {
    audience: stay ? "booking" : "listing",
    draft,
    /* Drives the "back to my properties" link. Only the owner ever sees it: a
       guest must never learn there is a dashboard behind this page. */
    isOwner,
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
      hostName: property.hostName,
      hostPhone: property.hostPhone,
      wifiSsid: property.wifiSsid,
      wifiSecurity: property.wifiSecurity,
      checkinFrom: property.checkinFrom,
      checkoutUntil: property.checkoutUntil,
      contacts: property.contacts,
      /* The two values that open the home. Outside the booking window they are
         not serialised: not hidden, simply absent from the HTML. */
      accessCode: reveal ? (stay?.accessCodeOverride ?? property.accessCode) : null,
      wifiPassword: reveal ? property.wifiPassword : null,
      directions: directionsUrl({ lat: property.lat, lng: property.lng, mode: "driving" }),
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
          directions: directionsUrl({ lat: place.lat, lng: place.lng, mode: "walking" }),
        };
      })
      .sort((a, b) => a.meters - b.meters),
  };

  return <GuideView data={payload} />;
}
