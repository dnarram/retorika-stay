"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  IconAlert,
  IconArrow,
  IconCheck,
  IconClock,
  IconCopy,
  IconCross,
  IconGlobe,
  IconInfo,
  IconKey,
  IconMap,
  IconPhone,
  IconPin,
  IconPrint,
  IconQr,
  IconGrid,
  IconHelp,
  IconHome,
  IconLuggage,
  IconRules,
  IconWalk,
  IconWifi,
} from "@/components/icons";
import { LOCALE_NAMES, getDictionary } from "@/i18n/dictionaries";
import type { ContactKind, Guide, Locale, Place, PlaceCategory } from "@/lib/schema";
import type { StayPhase } from "@/lib/stay";
import { directionsUrl } from "@/lib/geo";
import { wifiQrPayload } from "@/lib/wifi";
import Keepsake from "./Keepsake";

const PlacesMap = dynamic(() => import("./PlacesMap"), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-xl bg-brand-soft" />,
});

export type GuestPlace = Place & {
  walkMin: number;
  distance: string;
  meters: number;
  directions: string;
};

export type GuestPayload = {
  audience: "booking" | "listing";
  /* Only ever true for the host looking at their own unpublished guide. */
  draft: boolean;
  isOwner: boolean;
  stay: { guestName: string | null; arrival: string; departure: string; nights: number } | null;
  autoTranslated: boolean;
  property: {
    slug: string;
    name: string;
    city: string;
    address: string;
    lat: number;
    lng: number;
    hostName: string;
    hostPhone: string;
    wifiSsid: string;
    wifiPassword: string | null;
    wifiSecurity: "WPA" | "WEP" | "nopass";
    checkinFrom: string;
    checkoutUntil: string;
    contacts: { kind: ContactKind; phone: string; detail?: string }[];
    accessCode: string | null;
    directions: string;
  };
  guide: Guide;
  locale: Locale;
  phase: StayPhase;
  demoPhase: boolean;
  places: GuestPlace[];
};

/* One id per icon, and one icon per question the guest actually has.
   "Lo esencial" used to hold the address, the entry steps and the Wi-Fi: three
   different needs at three different moments, behind one tile. A guest standing
   at the door at midnight should not have to open a section that also contains
   the parking. */
type SectionId =
  | "arrival"
  | "entry"
  | "wifi"
  | "house"
  | "rules"
  | "places"
  | "transport"
  | "emergency"
  | "checkout"
  | "faq";

/* Same information, different order depending on the day of the booking. No
   section ever disappears — it moves. Hiding information from a guest who
   cannot find the recycling bin is worse than making them scroll. */
/* One icon per section. The guest recognises a shape faster than they read a
   word, and on a 360 px screen the shape is most of what fits. */
const SECTION_ICON: Record<SectionId, (props: { size?: number }) => React.ReactNode> = {
  arrival: IconMap,
  entry: IconKey,
  wifi: IconWifi,
  house: IconHome,
  rules: IconRules,
  places: IconPin,
  transport: IconWalk,
  emergency: IconAlert,
  checkout: IconLuggage,
  faq: IconHelp,
};

/* The order is a story, not a menu.

   NARRATIVE follows the guest's own journey: you travel, you get in, you
   connect, you learn how the flat works, you learn what is expected of you, you
   go out, you move around, something goes wrong, you leave, you still have a
   doubt. Read top to bottom it makes sense on its own.

   The phase of the booking does not shuffle that story: it only PROMOTES the
   one or two sections that matter today to the front, and everything else keeps
   its narrative position. Reordering the whole list per phase — which is what
   this did before — meant the guide read differently every day and the guest
   lost the map they had built in their head. */
const NARRATIVE: SectionId[] = [
  "arrival",
  "entry",
  "wifi",
  "house",
  "rules",
  "places",
  "transport",
  "emergency",
  "checkout",
  "faq",
];

const PINNED: Record<StayPhase, SectionId[]> = {
  before: ["arrival", "entry"],
  arrival: ["entry", "wifi"],
  staying: ["places"],
  departure: ["checkout"],
  memories: ["places"],
};

function sectionOrder(phase: StayPhase): SectionId[] {
  const pinned = PINNED[phase];
  return [...pinned, ...NARRATIVE.filter((id) => !pinned.includes(id))];
}



/* A beacon that never blocks navigation and is silently lost when the guest is
   offline: metrics must never get in the way of the guide. */
function track(slug: string, kind: string, value = "") {
  const body = JSON.stringify({ slug, kind, value });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/track", { method: "POST", body, keepalive: true });
  } catch {
    /* offline: nothing to do */
  }
}

export default function GuideView({ data }: { data: GuestPayload }) {
  const t = getDictionary(data.locale);
  const { property, guide, places } = data;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PlaceCategory | "todas">("todas");
  const [showCode, setShowCode] = useState(false);
  const [showWifiQr, setShowWifiQr] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [done, setDone] = useState<number[]>([]);
  const [visited, setVisited] = useState<string[]>([]);
  const [noPrint, setNoPrint] = useState<SectionId[]>([]);
  /* null = the guest is on the hub. On large screens there is no hub: the
     sidebar is always visible and a section is always open. */
  const [active, setActive] = useState<SectionId | null>(null);
  /* Two guests, two behaviours, one guide.

     Before the trip somebody reads the whole thing on the sofa; on the third
     night somebody needs the bin day in four seconds. Neither layout serves
     both, and asking the guest to "configure" anything is a lost guest. So:
     two chips, no explanation needed, the choice remembered on the device. */
  const [reading, setReading] = useState(false);
  /* A section with nothing in it is not an empty section: it is a section that
     should not exist yet. Showing "Normas" with no rules under it makes the
     guide look unfinished and makes the guest doubt the rest of it.

     "Cómo llegar" is the one exception — the address is always there, and it is
     the single thing a guest needs before anything else. */
  const filled = useMemo<Record<SectionId, boolean>>(
    () => ({
      arrival: true,
      entry: Boolean(property.accessCode) || guide.arrivalSteps.some((step) => step.trim()),
      wifi: Boolean(property.wifiSsid || property.wifiPassword || guide.wifiNote.trim()),
      /* The body is what the guest reads: a heading on its own is a promise the
         section does not keep. */
      house: guide.house.some((item) => item.body.trim()),
      rules: guide.rules.some((rule) => rule.text.trim()),
      places: places.length > 0,
      transport: guide.transport.some(
        (item) => item.body.trim() || item.lat !== undefined,
      ),
      emergency: property.contacts.length > 0 || Boolean(guide.emergencyNote.trim()),
      checkout: guide.checkoutSteps.some((step) => step.trim()),
      faq: guide.faqs.some((faq) => faq.q.trim()),
    }),
    [property, guide, places],
  );

  const order = useMemo(
    () => sectionOrder(data.phase).filter((id) => filled[id]),
    [data.phase, filled],
  );

  /* Service worker registration: the guide is cached on the phone on first
     visit, which is exactly when the guest still has airport Wi-Fi. */
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(`checkout_${property.slug}`);
    if (saved) setDone(JSON.parse(saved) as number[]);
    const seen = localStorage.getItem(`visited_${property.slug}`);
    if (seen) setVisited(JSON.parse(seen) as string[]);
    setReading(localStorage.getItem("guide_reading") === "1");
  }, [property.slug]);

  /* Analytics without analytics: two aggregated counters per property, no
     cookies, no device identifier and nothing asked of the guest. They tell the
     host which languages their guests arrive in, and tell us nothing about any
     individual person. */
  useEffect(() => {
    track(property.slug, "open");
    track(property.slug, "language", data.locale);
  }, [property.slug, data.locale]);

  /* Searches that return nothing are the single most useful metric: they tell
     the host what is missing from the guide, in the guest's own words. */
  useEffect(() => {
    if (!needleRef.current) return;
    const timer = setTimeout(() => {
      if (visiblePlaces.length === 0 && visibleFaqs.length === 0) {
        track(property.slug, "search_miss", needleRef.current);
      }
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const toggleStep = (index: number) => {
    const next = done.includes(index) ? done.filter((i) => i !== index) : [...done, index];
    setDone(next);
    localStorage.setItem(`checkout_${property.slug}`, JSON.stringify(next));
  };

  /* The four critical actions live in a section that may be closed. Open it
     first, then scroll: the anchor does not exist in the layout until React has
     painted the section. */
  const jumpTo = (section: SectionId, anchor?: string) => {
    setActive(section);
    setQuery("");
    requestAnimationFrame(() => {
      const target = anchor ? document.getElementById(anchor) : null;
      (target ?? document.getElementById("contenido"))?.scrollIntoView({ block: "start" });
    });
  };

  const toggleVisited = (id: string) => {
    const next = visited.includes(id) ? visited.filter((v) => v !== id) : [...visited, id];
    setVisited(next);
    localStorage.setItem(`visited_${property.slug}`, JSON.stringify(next));
  };

  const share = async () => {
    const url = window.location.href;
    const text = `${guide.welcomeTitle} — ${property.city}`;
    /* navigator.share opens the phone's own sheet: WhatsApp, SMS, mail or
       whatever the guest uses. No backend, no email provider, no cost. */
    if (navigator.share) {
      try {
        await navigator.share({ title: text, url });
        return;
      } catch {
        /* the user cancelled: not an error */
      }
    }
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied("share");
    setTimeout(() => setCopied(null), 2000);
  };

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };

  const needle = query.trim().toLowerCase();
  const searching = needle.length > 0;
  const needleRef = useRef(needle);
  needleRef.current = needle;
  const visiblePlaces = useMemo(
    () =>
      places.filter((place) => {
        const inCategory = category === "todas" || place.category === category;
        if (!needle) return inCategory;
        const note = place.notes[data.locale];
        const haystack = `${place.name} ${note?.tagline ?? ""} ${note?.note ?? ""}`.toLowerCase();
        return inCategory && haystack.includes(needle);
      }),
    [places, category, needle, data.locale],
  );

  const visibleFaqs = useMemo(
    () =>
      needle
        ? guide.faqs.filter((f) => `${f.q} ${f.a}`.toLowerCase().includes(needle))
        : guide.faqs,
    [guide.faqs, needle],
  );

  const visitedPlaces = useMemo(
    () => places.filter((place) => visited.includes(place.id)),
    [places, visited],
  );

  /* Rough kilometres: there and back for each place marked as visited. It is
     an estimate and does not pretend to be anything else. */
  const kmWalked = useMemo(
    () => (visitedPlaces.reduce((sum, place) => sum + place.meters * 2, 0) / 1000).toFixed(1),
    [visitedPlaces],
  );

  const categories = useMemo(
    () => Array.from(new Set(places.map((p) => p.category))),
    [places],
  );

  const wifiQr = `/api/qr?size=320&data=${encodeURIComponent(
    wifiQrPayload({
      ssid: property.wifiSsid,
      password: property.wifiPassword ?? "",
      security: property.wifiSecurity,
    }),
  )}`;

  const sections: Record<SectionId, React.ReactNode> = {
    arrival: (
      <Section id="arrival" title={t.sections.arrival} key="arrival">
        <Card>
          <Row icon={<IconPin size={18} />} label={t.labels.address} value={property.address} />
          <a
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white no-print"
            href={property.directions}
            target="_blank"
            rel="noreferrer"
          >
            {t.actions.navigate} <IconArrow size={16} />
          </a>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Row icon={<IconClock size={18} />} label={t.labels.checkin} value={property.checkinFrom} compact />
            <Row icon={<IconClock size={18} />} label={t.labels.checkout} value={property.checkoutUntil} compact />
          </div>
          {guide.parking ? (
            <p className="mt-4 text-sm text-muted">
              <span className="font-medium text-ink">{t.labels.parking}: </span>
              {guide.parking}
            </p>
          ) : null}
        </Card>
      </Section>
    ),

    entry: (
      <Section id="entry" title={t.sections.entry} key="entry">
        <Card>
          <ol className="space-y-2 text-sm">
            {guide.arrivalSteps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-ink">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <div className="mt-4 rounded-xl border border-brand-line bg-brand-soft p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-ink">
              {t.labels.accessCode}
            </p>
            {property.accessCode ? (
              showCode ? (
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="font-mono text-3xl font-semibold tracking-[0.3em] text-brand-ink">
                    {property.accessCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCode(false)}
                    className="text-sm font-medium text-brand-deep no-print"
                  >
                    {t.actions.hide}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCode(true)}
                  className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-brand-deep ring-1 ring-brand-line no-print"
                >
                  <IconKey size={16} /> {t.actions.reveal}
                </button>
              )
            ) : (
              <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                <IconInfo size={16} /> {t.accessLocked}
              </p>
            )}
          </div>
        </Card>
      </Section>
    ),

    wifi: (
      <Section id="wifi" title={t.sections.wifi} key="wifi">
        <Card>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">{t.labels.network}</dt>
              <dd className="font-mono">{property.wifiSsid}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">{t.labels.password}</dt>
              <dd className="font-mono">
                {property.wifiPassword ?? <span className="text-muted">••••••••</span>}
              </dd>
            </div>
          </dl>
          {!property.wifiPassword ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted">
              <IconInfo size={16} />
              {data.audience === "listing" ? t.showcase : t.expired}
            </p>
          ) : null}
          <div className={property.wifiPassword ? "mt-4 flex flex-wrap gap-2 no-print" : "hidden"}>
            <button
              type="button"
              onClick={() => copy(property.wifiPassword ?? "", "wifi")}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1 ring-brand-line"
            >
              {copied === "wifi" ? <IconCheck size={16} /> : <IconCopy size={16} />}
              {copied === "wifi" ? t.actions.copied : t.actions.copy}
            </button>
            <button
              type="button"
              onClick={() => setShowWifiQr((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full bg-ok px-4 py-2 text-sm font-medium text-ok-ink"
            >
              <IconQr size={16} /> {t.actions.wifiQr}
            </button>
          </div>
          {showWifiQr ? (
            <figure className="mt-4 flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={wifiQr} alt={t.actions.scanToConnect} width={200} height={200} />
              <figcaption className="text-xs text-muted">{t.actions.scanToConnect}</figcaption>
            </figure>
          ) : null}
          {guide.wifiNote ? <p className="mt-3 text-sm text-muted">{guide.wifiNote}</p> : null}
        </Card>
      </Section>
    ),

    house: (
      <Section id="house" title={t.sections.house} key="house">
        <Card>
          {guide.house
            .filter((item) => item.body.trim())
            .map((item) => (
            <details key={item.title} className="border-b border-line py-3 last:border-0 print-block">
              <summary className="cursor-pointer list-none font-medium">
                <span className="flex items-center justify-between gap-3">
                  {item.title}
                  <IconArrow size={16} className="rotate-90 text-muted" />
                </span>
              </summary>
              <p className="mt-2 text-sm text-muted">{item.body}</p>
            </details>
            ))}
        </Card>
      </Section>
    ),

    rules: (
      <Section id="rules" title={t.sections.rules} key="rules">
        <Card>
          <ul className="space-y-3">
            {guide.rules
              .filter((rule) => rule.text.trim())
              .map((rule) => {
              const style =
                rule.allowed === true
                  ? { chip: "bg-ok-soft text-ok-ink", label: t.rules.allowed, icon: <IconCheck size={14} /> }
                  : rule.allowed === false
                    ? { chip: "bg-alert-soft text-alert-ink", label: t.rules.forbidden, icon: <IconCross size={14} /> }
                    : { chip: "bg-brand-soft text-brand-ink", label: t.rules.note, icon: <IconInfo size={14} /> };
              return (
                <li key={rule.text} className="flex flex-wrap items-start gap-3 text-sm">
                  {/* State is carried by text and icon, not colour alone: a
                      colour-blind guest must read the rule just as easily. */}
                  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${style.chip}`}>
                    {style.icon}
                    {style.label}
                  </span>
                  <span className="flex-1">{rule.text}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </Section>
    ),

    places: (
      <Section id="places" title={t.sections.places} key="places">
        <div className="no-print -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
          <Chip active={category === "todas"} onClick={() => setCategory("todas")}>
            {t.actions.seeAll}
          </Chip>
          {categories.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
              {t.categories[c]}
            </Chip>
          ))}
        </div>

        <div id="map" className="no-print mt-3 h-72 overflow-hidden rounded-xl border border-line">
          <PlacesMap
            center={{ lat: property.lat, lng: property.lng }}
            propertyName={property.name}
            places={visiblePlaces}
          />
        </div>

        <ul className="mt-4 space-y-3 wide-two-col">
          {visiblePlaces.map((place) => {
            const note = place.notes[data.locale] ?? place.notes.es;
            return (
              <li key={place.id} className="rounded-card border border-line bg-white p-4 print-block">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display font-semibold">{place.name}</p>
                    <p className="text-xs text-muted">
                      {t.categories[place.category]}
                      {place.price ? ` · ${"€".repeat(place.price)}` : ""}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-ink">
                    <IconWalk size={14} />
                    {place.walkMin} {t.labels.walk}
                  </span>
                </div>
                {note?.tagline ? (
                  <p className="mt-2 text-sm font-medium text-brand-deep">{note.tagline}</p>
                ) : null}
                {note?.note ? <p className="mt-1 text-sm text-muted">{note.note}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2 text-sm no-print">
                  <a
                    href={place.directions}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 font-medium text-white"
                  >
                    <IconWalk size={14} /> {t.actions.navigate} · {place.distance}
                  </a>
                  {place.phone ? (
                    <a
                      href={`tel:${place.phone}`}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium ring-1 ring-brand-line"
                    >
                      <IconPhone size={14} /> {t.actions.call}
                    </a>
                  ) : null}
                  {place.url ? (
                    <a
                      href={place.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium ring-1 ring-brand-line"
                    >
                      <IconGlobe size={14} /> {t.actions.website}
                    </a>
                  ) : null}
                  {/* "Visited" lives only on the guest's phone. Nobody else
                      sees it, and it is what feeds the trip summary. */}
                  <button
                    type="button"
                    onClick={() => toggleVisited(place.id)}
                    aria-pressed={visited.includes(place.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium ${
                      visited.includes(place.id)
                        ? "bg-ok-soft text-ok-ink"
                        : "ring-1 ring-brand-line text-muted"
                    }`}
                  >
                    <IconCheck size={14} />
                    {visited.includes(place.id) ? t.visited : t.markVisited}
                  </button>
                </div>
              </li>
            );
          })}
          {visiblePlaces.length === 0 ? (
            <li className="rounded-card border border-dashed border-line p-6 text-center text-sm text-muted">
              {places.length === 0 ? t.emptyPlaces : t.noResults}
            </li>
          ) : null}
        </ul>
      </Section>
    ),

    transport: (
      <Section id="transport" title={t.sections.transport} key="transport">
        <Card>
          {guide.transport
            .filter((item) => item.body.trim() || item.lat !== undefined)
            .map((item) => (
            <div key={item.title} className="border-b border-line py-3 last:border-0">
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-muted">{item.body}</p>
              {item.lat !== undefined && item.lng !== undefined ? (
                <a
                  href={directionsUrl({ lat: item.lat, lng: item.lng, mode: "driving" })}
                  target="_blank"
                  rel="noreferrer"
                  className="no-print mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-brand-line"
                >
                  <IconMap size={14} /> {t.actions.navigate}
                </a>
              ) : null}
            </div>
          ))}
        </Card>
      </Section>
    ),

    emergency: (
      <Section id="emergency" title={t.sections.emergency} key="emergency">
        <Card>
          <p className="flex gap-2 rounded-xl bg-alert-soft p-3 text-sm text-alert-ink">
            <IconAlert size={18} />
            {t.emergencyIntro}
          </p>
          <ul className="mt-3 divide-y divide-line">
            {property.contacts.map((contact) => (
              <li key={`${contact.kind}-${contact.phone}`} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{t.contacts[contact.kind]}</p>
                  {contact.detail ? <p className="text-xs text-muted">{contact.detail}</p> : null}
                </div>
                <a
                  href={`tel:${contact.phone}`}
                  onClick={() => track(property.slug, "call", contact.kind)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
                    contact.kind === "emergency"
                      ? "bg-alert text-white"
                      : "ring-1 ring-brand-line text-brand-deep"
                  }`}
                >
                  <IconPhone size={14} /> {contact.phone}
                </a>
              </li>
            ))}
          </ul>
          {guide.emergencyNote ? <p className="mt-3 text-sm text-muted">{guide.emergencyNote}</p> : null}
        </Card>
      </Section>
    ),

    checkout: (
      <Section id="checkout" title={t.sections.checkout} key="checkout">
        <Card>
          <p className="text-sm text-muted">
            {t.labels.checkout} <span className="font-medium text-ink">{property.checkoutUntil}</span>
          </p>
          <ul className="mt-3 space-y-2">
            {guide.checkoutSteps
              .filter((step) => step.trim())
              .map((step, index) => (
              <li key={step}>
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={done.includes(index)}
                    onChange={() => toggleStep(index)}
                    className="mt-0.5 h-5 w-5 accent-[var(--color-brand)]"
                  />
                  <span className={done.includes(index) ? "text-muted line-through" : ""}>{step}</span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      </Section>
    ),

    faq: (
      <Section id="faq" title={t.sections.faq} key="faq">
        <Card>
          {visibleFaqs.map((faq) => (
            <details key={faq.q} className="border-b border-line py-3 last:border-0 print-block">
              <summary className="cursor-pointer list-none font-medium">{faq.q}</summary>
              <p className="mt-2 text-sm text-muted">{faq.a}</p>
            </details>
          ))}
          {visibleFaqs.length === 0 ? <p className="text-sm text-muted">{t.noResults}</p> : null}
        </Card>
      </Section>
    ),
  };

  return (
    <div className="min-h-screen pb-16">
      <a className="skip-link" href="#contenido">
        Ir al contenido
      </a>

      <header className="bg-brand-ink px-5 pb-5 pt-6 text-white">
        <div className="mx-auto max-w-2xl lg:max-w-6xl">
          {data.isOwner ? (
            <a
              href="/panel"
              className="no-print mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-white/70 hover:text-white"
            >
              ← Mis alojamientos
            </a>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs uppercase tracking-[0.2em] text-white/70">{t.guideTitle}</span>
            <LanguageSwitcher
              current={data.locale}
              autoTranslated={data.autoTranslated}
              note={t.autoTranslated}
            />
          </div>
          <h1 className="mt-3 font-display text-2xl font-semibold">{guide.welcomeTitle}</h1>
          <p className="text-sm text-white/70">
            {property.city} · {t.labels.host}: {property.hostName}
          </p>

        </div>
      </header>

      <main id="contenido" className="mx-auto max-w-2xl px-5 lg:max-w-6xl">
        {data.draft ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-alert-soft px-4 py-3 text-sm text-alert-ink">
            <IconInfo size={16} />
            {t.draftOnlyYou}
          </p>
        ) : null}

        {data.audience === "listing" ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand-ink">
            <IconInfo size={16} /> {t.showcase}
          </p>
        ) : null}

        {data.audience === "booking" && data.phase === "memories" ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand-ink">
            <IconInfo size={16} /> {t.expired}
          </p>
        ) : null}

        <p className="mt-5 text-[15px] leading-relaxed text-ink">{guide.welcomeIntro}</p>

        <div className="no-print mt-5 flex gap-1 rounded-full bg-white p-1 text-sm font-medium ring-1 ring-line">
          {[
            { value: false, label: t.modeSections, icon: <IconGrid size={16} /> },
            { value: true, label: t.modeRead, icon: <IconRules size={16} /> },
          ].map((option) => (
            <button
              key={String(option.value)}
              type="button"
              aria-pressed={reading === option.value}
              onClick={() => {
                setReading(option.value);
                setActive(null);
                localStorage.setItem("guide_reading", option.value ? "1" : "0");
              }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 transition ${
                reading === option.value ? "bg-brand text-white" : "text-muted"
              }`}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>

        <div className="no-print sticky top-0 z-10 -mx-5 mt-3 bg-canvas/95 px-5 py-3 backdrop-blur">
          <label className="sr-only" htmlFor="buscar">
            {t.actions.search}
          </label>
          <input
            id="buscar"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.actions.search}
            className="w-full rounded-full border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-brand"
          />
        </div>

        {data.phase === "memories" && data.stay ? (
          <section className="mt-8 rounded-card bg-brand-ink p-6 text-white">
            <h2 className="font-display text-lg font-semibold">{t.phase.memories}</h2>
            <p className="mt-1 text-sm text-white/70">{t.phaseHint.memories}</p>
            <dl className="mt-5 grid grid-cols-3 gap-3 text-center">
              {[
                { value: String(visitedPlaces.length), label: t.tripPlaces },
                { value: String(data.stay.nights), label: t.tripNights },
                { value: kmWalked, label: t.tripWalk },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl bg-white/10 py-3">
                  <dt className="font-display text-2xl font-semibold">{stat.value}</dt>
                  <dd className="text-[11px] text-white/70">{stat.label}</dd>
                </div>
              ))}
            </dl>
            <Keepsake
              title={guide.welcomeTitle}
              city={property.city}
              label={t.tripCard}
              hint={t.tripCardHint}
              stats={[
                { value: String(visitedPlaces.length), label: t.tripPlaces },
                { value: String(data.stay.nights), label: t.tripNights },
                { value: kmWalked, label: t.tripWalk },
              ]}
            />
          </section>
        ) : null}

        {/* ------------------------------------------------------------------
            Navigation instead of one long page.

            A guest opens this standing at a door, or in a supermarket aisle, or
            at 2am wondering where the fuse box is. They are not reading: they
            are looking for one specific thing. Eight tiles on one screen beat
            two minutes of scrolling.

            Every section stays in the DOM at all times and is hidden with CSS,
            never unmounted. That is what keeps the printed version complete,
            keeps the browser's own find-in-page useful, and means the whole
            guide is already in the phone when the connection drops.
        ------------------------------------------------------------------- */}
        <div className={reading ? "mt-6" : "mt-6 lg:grid lg:grid-cols-[260px_1fr] lg:gap-10"}>
          {/* Large screens: a permanent sidebar. No hub, no back button, the
              guest sees where they are and what else exists at all times. */}
          <nav aria-label={t.brand} className={`no-print hidden ${reading ? "" : "lg:block"}`}>
            <ul className="sticky top-4 space-y-1">
              {/* On a wide screen the guide stops being a narrow ribbon with two
                empty margins. Two columns halve the scrolling and, just as
                important, keep the line length readable: text stretched across
                1400 px is worse than text in a column, not better. */}
            {order.map((id) => {
                const Icon = SECTION_ICON[id];
                const current = (active ?? order[0]) === id;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setActive(id)}
                      aria-current={current ? "true" : undefined}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                        current ? "bg-brand text-white" : "text-muted hover:bg-brand-soft"
                      }`}
                    >
                      <Icon size={18} />
                      {t.sections[id]}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className={reading ? "guide-flow guide-flow--screen" : "guide-flow"}>
            {/* Small and medium screens: the hub. Two columns on a phone, four
                on a tablet, where there is room to show them all at once. */}
            <div className={`no-print lg:hidden ${active || searching || reading ? "hidden" : ""}`}>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {/* On a wide screen the guide stops being a narrow ribbon with two
                empty margins. Two columns halve the scrolling and, just as
                important, keep the line length readable: text stretched across
                1400 px is worse than text in a column, not better. */}
            {order.map((id) => {
                  const Icon = SECTION_ICON[id];
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => setActive(id)}
                        className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-card border border-line bg-white p-3 text-center transition active:scale-95"
                      >
                        <span className="text-brand">
                          <Icon size={30} />
                        </span>
                        <span className="text-xs font-medium leading-tight">{t.sections[id]}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Back to the hub. Only on small screens, where a hub exists. */}
            {active && !reading ? (
              <button
                type="button"
                onClick={() => setActive(null)}
                className="no-print mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-deep lg:hidden"
              >
                <IconArrow size={16} className="rotate-180" /> {t.actions.seeAll}
              </button>
            ) : null}

            {/* On a wide screen the guide stops being a narrow ribbon with two
                empty margins. Two columns halve the scrolling and, just as
                important, keep the line length readable: text stretched across
                1400 px is worse than text in a column, not better. */}
            {order.map((id) => {
              /* Hidden, never unmounted: `print:block` puts every section back
                 on paper regardless of what is on screen. */
              /* While the guest is typing, the sections that can actually
                 answer a search take over on every screen size. Filtering
                 inside a closed section would look like "no results". */
              const searchable = id === "places" || id === "faq";
              /* Reading mode is the old continuous page: everything stacked, in
                 the order the phase dictates. */
              const openOnLarge = reading ? true : searching ? searchable : (active ?? order[0]) === id;
              const openOnSmall = reading ? true : searching ? searchable : active === id;
              const classes = [
                openOnSmall ? "" : "hidden",
                openOnLarge ? "lg:block" : "lg:hidden",
                noPrint.includes(id) ? "print-hidden" : "print:block",
              ].join(" ");
              return (
                <div key={id} className={classes}>
                  {sections[id]}
                </div>
              );
            })}
          </div>
        </div>

        {data.demoPhase ? <PhasePreview locale={data.locale} phase={data.phase} /> : null}

        <footer className="mt-10 border-t border-line pt-5 text-xs text-muted">
          <details className="no-print rounded-card border border-line bg-white p-4 text-sm text-ink">
            <summary className="cursor-pointer list-none font-medium">
              <span className="flex items-center gap-2">
                <IconPrint size={16} /> {t.printPick}
              </span>
            </summary>
            {/* Printing the whole guide suits the folder left in the flat;
                printing three sections is what a guest who puts a sheet of
                paper in their pocket actually does. */}
            <div className="mt-3 flex flex-wrap gap-2">
              {order.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={!noPrint.includes(id)}
                  onClick={() =>
                    setNoPrint((current) =>
                      current.includes(id) ? current.filter((s) => s !== id) : [...current, id],
                    )
                  }
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                    noPrint.includes(id) ? "text-muted ring-1 ring-line" : "bg-brand text-white"
                  }`}
                >
                  {t.sections[id]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white"
            >
              <IconPrint size={16} /> {t.actions.print}
            </button>
          </details>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={share}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-medium ring-1 ring-brand-line no-print"
            >
              <IconArrow size={14} /> {copied === "share" ? t.actions.copied : t.share}
            </button>
            <span className="inline-flex items-center gap-1.5">
              <IconCheck size={14} /> {t.actions.offlineReady}
            </span>
          </div>
          {data.autoTranslated ? <p className="mt-3">{t.autoTranslated}</p> : null}
        </footer>
      </main>
    </div>
  );
}

/* --------------------------------- pieces --------------------------------- */

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-8 scroll-mt-20">
      <h2 className="mb-3 font-display text-lg font-semibold">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Card({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="scroll-mt-20 rounded-card border border-line bg-white p-5 print-block">
      {children}
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  compact,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "" : "flex items-start gap-3"}>
      <span className="mt-0.5 text-brand">{icon}</span>
      <div>
        <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
        active ? "bg-brand text-white" : "bg-white text-muted ring-1 ring-line"
      }`}
    >
      {children}
    </button>
  );
}

function LanguageSwitcher({
  current,
  autoTranslated,
  note,
}: {
  current: Locale;
  autoTranslated: boolean;
  note: string;
}) {
  /* A <select> rather than a row of chips: chips do not scale past four
     languages and give no clue which one is active on a narrow screen. The
     browser language is already selected server-side, so this control is there
     for the guest who wants something else, not for the one who does not care.
     Navigating on change keeps it working with JavaScript disabled too. */
  return (
    <div className="no-print flex flex-col items-end gap-1">
      <label className="sr-only" htmlFor="locale">
        {note}
      </label>
      <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
        <IconGlobe size={14} />
        <select
          id="locale"
          value={current}
          onChange={(event) => {
            const url = new URL(window.location.href);
            url.searchParams.set("lang", event.target.value);
            window.location.href = url.toString();
          }}
          className="bg-transparent text-xs text-white outline-none [&>option]:text-ink"
        >
          {(Object.keys(LOCALE_NAMES) as Locale[]).map((code) => (
            <option key={code} value={code}>
              {LOCALE_NAMES[code]}
            </option>
          ))}
        </select>
      </div>
      {autoTranslated ? <span className="text-[11px] text-white/60">{note}</span> : null}
    </div>
  );
}

/* Only rendered when the URL carries ?fase=: it lets a reviewer see all four
   versions of the guide in thirty seconds without editing any dates. */
function PhasePreview({ phase, locale }: { phase: StayPhase; locale: Locale }) {
  const t = getDictionary(locale);
  const phases: StayPhase[] = ["before", "arrival", "staying", "departure"];
  return (
    <aside className="no-print mt-10 rounded-card border border-dashed border-brand-line bg-brand-soft p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-ink">
        {t.labels.demo}
      </p>
      <p className="mt-1 text-sm text-muted">
        La guía se reordena según el momento de la estancia. Cambia la fase para verlo:
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {phases.map((p) => (
          <a
            key={p}
            href={`?lang=${locale}&fase=${p}`}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              p === phase ? "bg-brand text-white" : "bg-white text-brand-deep ring-1 ring-brand-line"
            }`}
          >
            {t.phase[p]}
          </a>
        ))}
      </div>
    </aside>
  );
}
