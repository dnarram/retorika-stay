"use client";

import { useEffect, useMemo, useState } from "react";
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
  IconWalk,
  IconWifi,
} from "@/components/icons";
import { LOCALE_NAMES, getDictionary } from "@/i18n/dictionaries";
import type { ContactKind, Guide, Locale, Place, PlaceCategory } from "@/lib/schema";
import type { StayPhase } from "@/lib/stay";
import { wifiQrPayload } from "@/lib/wifi";

const PlacesMap = dynamic(() => import("./PlacesMap"), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-xl bg-brand-soft" />,
});

export type GuestPlace = Place & { walkMin: number; distance: string; directions: string };

export type GuestPayload = {
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
    wifiPassword: string;
    wifiSecurity: "WPA" | "WEP" | "nopass";
    checkinFrom: string;
    checkoutUntil: string;
    contacts: { kind: ContactKind; phone: string; detail?: string }[];
    accessCode: string | null;
    directions: string;
  };
  guide: Guide;
  reviewed: boolean;
  locale: Locale;
  phase: StayPhase;
  demoPhase: boolean;
  places: GuestPlace[];
};

type SectionId =
  | "esencial"
  | "casa"
  | "normas"
  | "sitios"
  | "moverse"
  | "emergencias"
  | "salida"
  | "faq";

/* La misma información, distinto orden según el día de la estancia. Ninguna
   sección desaparece nunca: se reordena. Ocultar información a un huésped que
   no encuentra el contenedor de la basura es peor que hacerle bajar dos
   pantallas. */
const ORDER: Record<StayPhase, SectionId[]> = {
  antes: ["esencial", "moverse", "normas", "sitios", "casa", "emergencias", "salida", "faq"],
  llegada: ["esencial", "casa", "normas", "sitios", "moverse", "emergencias", "salida", "faq"],
  estancia: ["sitios", "casa", "esencial", "moverse", "normas", "emergencias", "salida", "faq"],
  salida: ["salida", "esencial", "sitios", "moverse", "emergencias", "casa", "normas", "faq"],
  despues: ["salida", "faq", "sitios", "esencial", "moverse", "casa", "normas", "emergencias"],
};

export default function GuideView({ data }: { data: GuestPayload }) {
  const t = getDictionary(data.locale);
  const { property, guide, places } = data;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PlaceCategory | "todas">("todas");
  const [showCode, setShowCode] = useState(false);
  const [showWifiQr, setShowWifiQr] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [done, setDone] = useState<number[]>([]);

  /* Registro del service worker: la guía se guarda en el móvil al primer
     acceso, que es justo cuando el huésped todavía tiene wifi del aeropuerto. */
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(`checkout_${property.slug}`);
    if (saved) setDone(JSON.parse(saved) as number[]);
  }, [property.slug]);

  const toggleStep = (index: number) => {
    const next = done.includes(index) ? done.filter((i) => i !== index) : [...done, index];
    setDone(next);
    localStorage.setItem(`checkout_${property.slug}`, JSON.stringify(next));
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

  const categories = useMemo(
    () => Array.from(new Set(places.map((p) => p.category))),
    [places],
  );

  const wifiQr = `/api/qr?size=320&data=${encodeURIComponent(
    wifiQrPayload({
      ssid: property.wifiSsid,
      password: property.wifiPassword,
      security: property.wifiSecurity,
    }),
  )}`;

  const sections: Record<SectionId, React.ReactNode> = {
    esencial: (
      <Section id="esencial" title={t.sections.essentials} key="esencial">
        <Card>
          <Row icon={<IconPin size={18} />} label={t.labels.address} value={property.address} />
          <a
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white no-print"
            href={property.directions}
            target="_blank"
            rel="noreferrer"
          >
            {t.actions.directions} <IconArrow size={16} />
          </a>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Row icon={<IconClock size={18} />} label={t.labels.checkin} value={property.checkinFrom} compact />
            <Row icon={<IconClock size={18} />} label={t.labels.checkout} value={property.checkoutUntil} compact />
          </div>
        </Card>

        <Card id="entrada">
          <h3 className="font-display text-base font-semibold">{t.quick.access}</h3>
          <ol className="mt-3 space-y-2 text-sm">
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

          {guide.parking ? (
            <p className="mt-4 text-sm text-muted">
              <span className="font-medium text-ink">{t.labels.parking}: </span>
              {guide.parking}
            </p>
          ) : null}
        </Card>

        <Card id="wifi">
          <h3 className="font-display text-base font-semibold">{t.quick.wifi}</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">{t.labels.network}</dt>
              <dd className="font-mono">{property.wifiSsid}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">{t.labels.password}</dt>
              <dd className="font-mono">{property.wifiPassword}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2 no-print">
            <button
              type="button"
              onClick={() => copy(property.wifiPassword, "wifi")}
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

    casa: (
      <Section id="casa" title={t.sections.house} key="casa">
        <Card>
          {guide.house.map((item) => (
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

    normas: (
      <Section id="normas" title={t.sections.rules} key="normas">
        <Card>
          <ul className="space-y-3">
            {guide.rules.map((rule) => {
              const style =
                rule.allowed === true
                  ? { chip: "bg-ok-soft text-ok-ink", label: t.rules.allowed, icon: <IconCheck size={14} /> }
                  : rule.allowed === false
                    ? { chip: "bg-alert-soft text-alert-ink", label: t.rules.forbidden, icon: <IconCross size={14} /> }
                    : { chip: "bg-brand-soft text-brand-ink", label: t.rules.note, icon: <IconInfo size={14} /> };
              return (
                <li key={rule.text} className="flex flex-wrap items-start gap-3 text-sm">
                  {/* El estado se dice con texto e icono, no solo con color:
                      un daltónico tiene que poder leer la norma igual. */}
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

    sitios: (
      <Section id="sitios" title={t.sections.places} key="sitios">
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

        <div id="mapa" className="no-print mt-3 h-72 overflow-hidden rounded-xl border border-line">
          <PlacesMap
            center={{ lat: property.lat, lng: property.lng }}
            propertyName={property.name}
            places={visiblePlaces}
          />
        </div>

        <ul className="mt-4 space-y-3">
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
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium ring-1 ring-brand-line"
                  >
                    <IconMap size={14} /> {place.distance}
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

    moverse: (
      <Section id="moverse" title={t.sections.transport} key="moverse">
        <Card>
          {guide.transport.map((item) => (
            <div key={item.title} className="border-b border-line py-3 last:border-0">
              <p className="font-medium">{item.title}</p>
              <p className="mt-1 text-sm text-muted">{item.body}</p>
            </div>
          ))}
        </Card>
      </Section>
    ),

    emergencias: (
      <Section id="emergencias" title={t.sections.emergency} key="emergencias">
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
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
                    contact.kind === "emergencias"
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

    salida: (
      <Section id="salida" title={t.sections.checkout} key="salida">
        <Card>
          <p className="text-sm text-muted">
            {t.labels.checkout} <span className="font-medium text-ink">{property.checkoutUntil}</span>
          </p>
          <ul className="mt-3 space-y-2">
            {guide.checkoutSteps.map((step, index) => (
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
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs uppercase tracking-[0.2em] text-white/70">{t.brand}</span>
            <LanguageSwitcher current={data.locale} />
          </div>
          <h1 className="mt-3 font-display text-2xl font-semibold">{guide.welcomeTitle}</h1>
          <p className="text-sm text-white/70">
            {property.city} · {t.labels.host}: {property.hostName}
          </p>

          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs">
            <IconClock size={14} /> {t.phase[data.phase]} — {t.phaseHint[data.phase]}
          </p>

          <nav aria-label={t.brand} className="mt-4 grid grid-cols-4 gap-2 no-print">
            <QuickLink href="#wifi" icon={<IconWifi size={18} />} label={t.quick.wifi} />
            <QuickLink href="#entrada" icon={<IconKey size={18} />} label={t.quick.access} />
            <QuickLink href="#emergencias" icon={<IconAlert size={18} />} label={t.quick.help} accent />
            <QuickLink href="#mapa" icon={<IconMap size={18} />} label={t.quick.map} />
          </nav>
        </div>
      </header>

      <main id="contenido" className="mx-auto max-w-2xl px-5">
        {!data.reviewed ? (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-alert-soft px-4 py-3 text-sm text-alert-ink">
            <IconInfo size={16} /> {t.draftNotice}
          </p>
        ) : null}

        <p className="mt-5 text-[15px] leading-relaxed text-ink">{guide.welcomeIntro}</p>

        <div className="no-print sticky top-0 z-10 -mx-5 mt-5 bg-canvas/95 px-5 py-3 backdrop-blur">
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

        {ORDER[data.phase].map((id) => sections[id])}

        {data.demoPhase ? <PhasePreview locale={data.locale} phase={data.phase} /> : null}

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 text-xs text-muted">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-medium ring-1 ring-brand-line no-print"
          >
            <IconPrint size={14} /> {t.actions.print}
          </button>
          <span className="inline-flex items-center gap-1.5">
            <IconCheck size={14} /> {t.actions.offlineReady}
          </span>
        </footer>
      </main>
    </div>
  );
}

/* -------------------------------- piezas ---------------------------------- */

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

function QuickLink({
  href,
  icon,
  label,
  accent,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  accent?: boolean;
}) {
  return (
    <a
      href={href}
      className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[11px] font-medium ${
        accent ? "bg-alert text-white" : "bg-brand text-white"
      }`}
    >
      {icon}
      {label}
    </a>
  );
}

function LanguageSwitcher({ current }: { current: Locale }) {
  return (
    <div className="flex items-center gap-1 text-xs no-print">
      {(Object.keys(LOCALE_NAMES) as Locale[]).map((code) => (
        <a
          key={code}
          href={`?lang=${code}`}
          hrefLang={code}
          aria-current={code === current ? "true" : undefined}
          title={LOCALE_NAMES[code]}
          className={`rounded-full px-2 py-1 uppercase ${
            code === current ? "bg-white text-brand-ink" : "text-white/70 hover:text-white"
          }`}
        >
          {code}
        </a>
      ))}
    </div>
  );
}

/* Selector visible solo cuando se entra con ?fase=: permite ver en treinta
   segundos las cuatro versiones de la guía sin manipular fechas. */
function PhasePreview({ phase, locale }: { phase: StayPhase; locale: Locale }) {
  const t = getDictionary(locale);
  const phases: StayPhase[] = ["antes", "llegada", "estancia", "salida"];
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
