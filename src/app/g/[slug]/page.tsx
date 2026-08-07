import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { resolveLocale } from "@/i18n/dictionaries";
import { guidePinCookie, verifyPinToken } from "@/lib/auth";
import { directionsUrl, formatDistance, haversineMeters, walkingMinutes } from "@/lib/geo";
import { getRepo } from "@/lib/repo";
import type { Locale, Property, Stay } from "@/lib/schema";
import { canRevealAccess, isPhase, nightsBetween, stayPhase, type StayPhase } from "@/lib/stay";
import GuideView, { type GuestPayload } from "./GuideView";
import PinGate from "./PinGate";

/* La guía no se indexa nunca: contiene el código de la puerta y la clave del
   WiFi de una casa real. El X-Robots-Tag va además en next.config.ts. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

type Search = { lang?: string; fase?: string };

export default async function GuidePage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Search>;
}) {
  const { slug } = await props.params;
  const { lang, fase } = await props.searchParams;
  const repo = getRepo();

  /* Un mismo formato de enlace, dos audiencias muy distintas:
       · slug de estancia  → el QR de la nevera. Acceso completo, y solo durante
                             los días de la reserva.
       · slug de alojamiento → el enlace que el anfitrión pega en el anuncio.
                             La guía entera MENOS lo que abre la casa.
     Resolver primero la estancia hace que el enlace de muestra siga siendo
     válido para siempre sin ser nunca peligroso. */
  const stay: Stay | null = await repo.getStayBySlug(slug);
  const property: Property | null = stay
    ? await repo.getProperty(stay.propertyId)
    : await repo.getPropertyBySlug(slug);

  if (!property || !property.published) notFound();

  /* El PIN puede fijarse por reserva o para todo el alojamiento: el de la
     reserva manda, y así se cambia para un huésped concreto sin tocar nada más. */
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

  /* ?fase= es un atajo de demostración: permite ver las cinco versiones de la
     guía sin esperar a las fechas reales de una reserva. */
  const demoPhase = isPhase(fase) ? (fase as StayPhase) : null;

  const phase: StayPhase = demoPhase ?? (stay ? stayPhase(stay) : "estancia");
  const reveal = stay
    ? demoPhase
      ? demoPhase !== "antes" && demoPhase !== "recuerdo"
      : canRevealAccess(stay)
    : false;

  const origin = { lat: property.lat, lng: property.lng };

  const payload: GuestPayload = {
    audience: stay ? "estancia" : "muestra",
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
      /* Los dos datos que abren la casa. Fuera de la ventana de la reserva no
         se serializan: no están ocultos, no existen en el HTML. */
      accessCode: reveal ? (stay?.accessCodeOverride ?? property.accessCode) : null,
      wifiPassword: reveal ? property.wifiPassword : null,
      directions: directionsUrl({ lat: property.lat, lng: property.lng }),
    },
    guide: guide.content,
    /* Si el idioma servido no es el original del anfitrión, es traducción
       automática y se dice. Ni el anfitrión ni el huésped tienen por qué ser
       multilingües: pedir una revisión humana sería pedir un imposible. */
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
          directions: directionsUrl(place),
        };
      })
      .sort((a, b) => a.meters - b.meters),
  };

  return <GuideView data={payload} />;
}
