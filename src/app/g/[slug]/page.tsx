import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resolveLocale } from "@/i18n/dictionaries";
import { guidePinCookie, verifyPinToken } from "@/lib/auth";
import { directionsUrl, formatDistance, haversineMeters, walkingMinutes } from "@/lib/geo";
import { getRepo } from "@/lib/repo";
import type { Locale } from "@/lib/schema";
import { canRevealAccessCode, isPhase, stayPhase, type StayPhase } from "@/lib/stay";
import GuideView, { type GuestPayload } from "./GuideView";
import PinGate from "./PinGate";

/* La guía no se indexa nunca: contiene el código de la puerta y la clave del
   WiFi de una casa real. El X-Robots-Tag va además en next.config.ts. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

type Params = { slug: string };
type Search = { lang?: string; fase?: string };

export default async function GuidePage(props: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await props.params;
  const { lang, fase } = await props.searchParams;

  const repo = getRepo();
  const property = await repo.getPropertyBySlug(slug);
  if (!property || !property.published) notFound();

  /* Puerta del PIN antes de leer nada más: si el anfitrión lo ha puesto, el
     contenido no llega al navegador sin él. */
  if (property.pin) {
    const jar = await cookies();
    const token = jar.get(guidePinCookie(slug))?.value;
    if (!(await verifyPinToken(token, slug))) {
      const requested = resolveLocale(lang, (await headers()).get("accept-language"), property.defaultLocale);
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

  /* El parámetro ?fase= es un atajo de demostración para poder ver las cuatro
     versiones de la guía sin esperar a las fechas reales de una reserva. */
  const demoPhase = isPhase(fase) ? (fase as StayPhase) : null;
  const phase: StayPhase = demoPhase ?? stayPhase(property);
  const reveal = demoPhase
    ? demoPhase !== "antes" && demoPhase !== "despues"
    : canRevealAccessCode(property);

  const origin = { lat: property.lat, lng: property.lng };

  const payload: GuestPayload = {
    property: {
      slug: property.slug,
      name: property.name,
      city: property.city,
      address: property.address,
      lat: property.lat,
      lng: property.lng,
      hostName: property.hostName,
      hostPhone: property.hostPhone,
      wifiSsid: property.wifiSsid,
      wifiPassword: property.wifiPassword,
      wifiSecurity: property.wifiSecurity,
      checkinFrom: property.checkinFrom,
      checkoutUntil: property.checkoutUntil,
      contacts: property.contacts,
      /* Dato sensible: fuera de la ventana de estancia no se serializa. */
      accessCode: reveal ? property.accessCode : null,
      directions: directionsUrl({ lat: property.lat, lng: property.lng }),
    },
    guide: guide.content,
    reviewed: guide.reviewed,
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
          directions: directionsUrl(place),
          _meters: meters,
        };
      })
      .sort((a, b) => a._meters - b._meters)
      .map(({ _meters, ...place }) => place),
  };

  return <GuideView data={payload} />;
}
