"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { IconArrow, IconCheck, IconCross, IconInfo, IconQr, IconTrash } from "./editor-icons";
import StepsEditor from "./StepsEditor";
import type { GuideRecord } from "@/data/seed";
import { LOCALE_NAMES, getDictionary } from "@/i18n/dictionaries";
import type { Check } from "@/lib/completeness";
import { suggestedContacts } from "@/lib/emergency";
import type { NearbyPlace } from "@/app/api/nearby/route";
import { completeness } from "@/lib/completeness";
import {
  CONTACT_KINDS,
  LOCALES,
  type Stay,
  PLACE_CATEGORIES,
  type Guide,
  type Locale,
  type Place,
  type PlaceCategory,
  type Property,
} from "@/lib/schema";

/* Leaflet touches `window`, so the picker only exists in the browser. */
const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-xl bg-brand-soft" />,
});

/* The five transport entries almost every guide needs. Offered as one-tap
   titles rather than pre-created rows: a guide that ships with five empty
   sections the host has to delete is worse than one they fill themselves. */
/* Turns the assistant's answer back into a list, tolerating the numbering it
   sometimes adds despite being asked not to. */
const linesFrom = (text: string | null): string[] =>
  (text ?? "")
    .split("\n")
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);

/* The questions hosts answer over and over on WhatsApp. Offered as one-tap
   starters: the host taps, the question is written, and they only supply the
   answer — which is the part only they know. */
const FAQ_TEMPLATES: { q: string }[] = [
  { q: "¿Se puede beber el agua del grifo?" },
  { q: "¿Hay ascensor?" },
  { q: "¿Puedo dejar las maletas antes de entrar o después de salir?" },
  { q: "¿Dónde compro a última hora?" },
  { q: "¿Hay wifi suficiente para teletrabajar?" },
  { q: "¿Se admiten mascotas?" },
  { q: "¿Puedo fumar?" },
  { q: "¿Dónde aparco?" },
  { q: "¿Qué hago si se va la luz?" },
  { q: "¿A qué hora recogen la basura?" },
  { q: "¿Hay toallas y sábanas?" },
  { q: "¿Se puede hacer check-in tarde?" },
];

const CHECKOUT_TEMPLATES = [
  "Deja las llaves donde acordamos",
  "Saca la basura",
  "Cierra ventanas y apaga el aire",
  "Los platos, en el lavavajillas",
] as const;

const HOUSE_TEMPLATES = [
  "Agua caliente",
  "Climatización",
  "Lavadora",
  "Basura y reciclaje",
  "Cocina",
  "Televisión",
] as const;

const TRANSPORT_TEMPLATES = [
  "Desde el aeropuerto",
  "Desde la estación de tren",
  "Estación de autobuses",
  "Parada de taxis",
  "Alquiler de coche",
] as const;

const STEPS = [
  "Datos del alojamiento",
  "Entrada y WiFi",
  "Cómo funciona la casa",
  "Normas",
  "Recomendaciones",
  "Moverse y emergencias",
  "Salida, preguntas y publicación",
] as const;

type SaveState = "idle" | "saving" | "saved" | "error";

export default function Editor({
  property: initialProperty,
  guides: initialGuides,
  places: initialPlaces,
  stays: initialStays,
  checks,
  mode,
}: {
  property: Property;
  guides: GuideRecord[];
  places: Place[];
  stays: Stay[];
  initialScore: number;
  checks: Check[];
  mode: "postgres" | "demo";
}) {
  const [property, setProperty] = useState(initialProperty);
  const [guides, setGuides] = useState(initialGuides);
  const [places, setPlaces] = useState(initialPlaces);
  const [stays, setStays] = useState(initialStays);
  const [assist, setAssist] = useState<string | null>(null);
  const [assistTarget, setAssistTarget] = useState<"arrival" | "checkout" | null>(null);
  const [country, setCountry] = useState<string | undefined>(undefined);
  const [nearby, setNearby] = useState<NearbyPlace[] | null>(null);
  const [nearbyStatus, setNearbyStatus] = useState<string | null>(null);
  const [nearbyFailed, setNearbyFailed] = useState(false);
  const [erNearby, setErNearby] = useState<NearbyPlace[] | null>(null);
  const [erStatus, setErStatus] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>(initialProperty.defaultLocale);
  const [step, setStep] = useState(1);
  const [saveState, setSave] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* The editor speaks the language of the guide being written: showing
     "restaurant" and "sights" to a host writing in Spanish was a leak of our
     internal enum into their screen. */
  const t = getDictionary(locale);

  const guide = useMemo(
    () => guides.find((g) => g.locale === locale) ?? guides[0],
    [guides, locale],
  );

  /* The country comes from the pin the host already placed: no extra question,
     and the numbers are right for the address rather than for our assumptions. */
  const suggestions = useMemo(() => {
    const already = new Set(property.contacts.map((c) => c.phone.replace(/\s/g, "")));
    return suggestedContacts(country).filter((s) => !already.has(s.phone.replace(/\s/g, "")));
  }, [country, property.contacts]);

  const countryName = useMemo(
    () =>
      country
        ? new Intl.DisplayNames([locale], { type: "region" }).of(country) ?? country
        : "",
    [country, locale],
  );

  const progress = useMemo(
    () => completeness(property, guides, places),
    [property, guides, places],
  );

  /* Debounced autosave: typing must not fire one request per keystroke, but a
     save button the host forgets to press is worse. */
  /* One save routine, two triggers: a debounced one while typing and an
     immediate one at every moment the host could reasonably expect their work
     to be safe — changing step, publishing, leaving the page. Anything less and
     a closed tab loses the last sentence. */
  const save = useCallback(
    async (nextProperty: Property, nextGuide: GuideRecord | undefined) => {
      {
        setSave("saving");
        try {
          const calls: Promise<Response>[] = [
            fetch(`/api/properties/${nextProperty.id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                name: nextProperty.name,
                city: nextProperty.city,
                address: nextProperty.address,
                lat: nextProperty.lat,
                lng: nextProperty.lng,
                hostName: nextProperty.hostName,
                hostPhone: nextProperty.hostPhone,
                wifiSsid: nextProperty.wifiSsid,
                wifiPassword: nextProperty.wifiPassword,
                wifiSecurity: nextProperty.wifiSecurity,
                accessCode: nextProperty.accessCode,
                checkinFrom: nextProperty.checkinFrom,
                checkoutUntil: nextProperty.checkoutUntil,
                contacts: nextProperty.contacts,
                published: nextProperty.published,
                pin: nextProperty.pin,
              }),
            }),
          ];
          if (nextGuide) {
            calls.push(
              fetch(`/api/guides/${nextProperty.id}/${nextGuide.locale}`, {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ content: nextGuide.content, reviewed: true }),
              }),
            );
          }
          const results = await Promise.all(calls);
          const failed = results.find((r) => !r.ok);
          if (!failed) {
            setSave("saved");
            return true;
          }
          /* The API explains what is wrong; showing "could not save" and
             swallowing that explanation is how a bug hides for days. */
          const payload = (await failed.json().catch(() => null)) as { error?: string } | null;
          setSave("error");
          setSaveError(payload?.error ?? "No se pudo guardar. Revisa los datos de este paso.");
          return false;
        } catch {
          setSave("error");
          setSaveError("Sin conexión con el servidor.");
          return false;
        }
      }
    },
    [],
  );

  const persist = useCallback(
    (nextProperty: Property, nextGuide: GuideRecord | undefined) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(nextProperty, nextGuide), 900);
    },
    [save],
  );

  /* Cancels the pending debounce and writes now. Returns whether it worked, so
     the publish switch can refuse to flip when the API says no. */
  const saveNow = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    return save(property, guide);
  }, [save, property, guide]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  /* Resolve the country once on load, so the emergency suggestions are there
     before the host reaches step 6 without them having to touch the map. */
  useEffect(() => {
    if (country || !property.lat) return;
    fetch(`/api/geocode?lat=${property.lat}&lng=${property.lng}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { results?: { countryCode: string }[] } | null) => {
        const code = payload?.results?.[0]?.countryCode;
        if (code) setCountry(code);
      })
      .catch(() => {
        /* offline or rate limited: the host can still type numbers by hand */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Every route into another step goes through here, so there is exactly one
     place where "moving on saves your work" is true. */
  const goToStep = async (next: number) => {
    await saveNow();
    setStep(next);
  };

  const patchProperty = (patch: Partial<Property>) => {
    const next = { ...property, ...patch };
    setProperty(next);
    setSaveError(null);
    persist(next, guide);
  };

  /* Publishing writes immediately and rolls the switch back if the API refuses,
     so the checkbox can never show a state the server does not have. */
  const setPublished = async (value: boolean) => {
    const next = { ...property, published: value };
    setProperty(next);
    setSaveError(null);
    if (timer.current) clearTimeout(timer.current);
    const ok = await save(next, guide);
    if (!ok) setProperty({ ...property, published: !value });
  };

  const patchGuide = (patch: Partial<Guide>) => {
    if (!guide) return;
    const nextGuide: GuideRecord = { ...guide, reviewed: true, content: { ...guide.content, ...patch } };
    const nextGuides = guides.map((g) => (g.locale === nextGuide.locale ? nextGuide : g));
    setGuides(nextGuides);
    persist(property, nextGuide);
  };

  async function savePlace(place: Place) {
    setPlaces((current) => current.map((p) => (p.id === place.id ? place : p)));
    await fetch("/api/places", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        propertyId: property.id,
        id: place.id,
        place: { ...place, id: undefined, propertyId: undefined },
      }),
    });
  }

  /* One tap turns a nearby result into a recommendation with its coordinates
     already right. The host only writes the sentence that makes it a
     recommendation rather than a map pin. */
  async function loadNearby(radius = 700) {
    setNearbyStatus("Buscando sitios cerca…");
    setNearbyFailed(false);
    const response = await fetch(
      `/api/nearby?lat=${property.lat}&lng=${property.lng}&radius=${radius}`,
    );
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; detail?: string }
        | null;
      setNearbyStatus(
        [payload?.error ?? "No se pudieron buscar sitios cercanos.", payload?.detail]
          .filter(Boolean)
          .join(" — "),
      );
      setNearbyFailed(true);
      return;
    }
    const { places: found } = (await response.json()) as { places: NearbyPlace[] };
    const already = new Set(places.map((p) => p.name.toLowerCase()));
    const fresh = found.filter((p) => !already.has(p.name.toLowerCase()));
    setNearby(fresh);
    setNearbyStatus(fresh.length === 0 ? "No encontramos sitios nuevos cerca." : null);
  }

  async function loadEmergencyNearby() {
    setErStatus("Buscando servicios cerca…");
    const response = await fetch(
      `/api/nearby?scope=emergency&lat=${property.lat}&lng=${property.lng}`,
    );
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; detail?: string }
        | null;
      setErStatus([payload?.error, payload?.detail].filter(Boolean).join(" — "));
      return;
    }
    const { places: found } = (await response.json()) as { places: NearbyPlace[] };
    const already = new Set(places.map((p) => p.name.toLowerCase()));
    const fresh = found.filter((p) => !already.has(p.name.toLowerCase()));
    setErNearby(fresh);
    setErStatus(fresh.length === 0 ? "No encontramos servicios nuevos cerca." : null);
  }

  async function addNearby(candidate: NearbyPlace, scope: "recommendation" | "emergency" = "recommendation") {
    setNearby((current) => current?.filter((p) => p.name !== candidate.name) ?? null);
    const response = await fetch("/api/places", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        propertyId: property.id,
        place: {
          category: candidate.category,
          name: candidate.name,
          lat: candidate.lat,
          lng: candidate.lng,
          scope,
          price: null,
          /* Whatever OpenStreetMap already knows travels with the place: one
             less field for the host to fill, and they can still correct it. */
          url: candidate.website ?? null,
          phone: candidate.phone ?? null,
          hours: candidate.hours ?? null,
          notes: { [locale]: { tagline: "", note: "" } },
        },
      }),
    });
    if (response.ok) {
      const { place } = (await response.json()) as { place: Place };
      setPlaces((current) => [...current, place]);
    }
  }

  async function addPlace() {
    const response = await fetch("/api/places", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        propertyId: property.id,
        place: {
          category: "restaurant" as PlaceCategory,
          name: "Sitio nuevo",
          lat: property.lat,
          lng: property.lng,
          scope: "recommendation",
          price: null,
          url: null,
          phone: null,
          hours: null,
          notes: { [locale]: { tagline: "", note: "" } },
        },
      }),
    });
    if (response.ok) {
      const { place } = (await response.json()) as { place: Place };
      setPlaces((current) => [...current, place]);
    }
  }

  async function removePlace(id: string) {
    setPlaces((current) => current.filter((p) => p.id !== id));
    await fetch(`/api/places/${id}`, { method: "DELETE" });
  }


  /* The assistant REORGANISES what the host wrote; it never adds facts. The
     suggestion is shown for them to accept or discard, and is never saved on
     its own. */
  async function suggest(
    task: "pasos" | "normas" | "nota" | "pulir",
    input: string,
    target: "arrival" | "checkout" | null = null,
  ) {
    setAssistTarget(target);
    setAssist("Pensando…");
    const response = await fetch("/api/assist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ task, input }),
    });
    const payload = (await response.json()) as { suggestion?: string; error?: string };
    setAssist(payload.suggestion ?? payload.error ?? "No se pudo generar la sugerencia.");
  }

  async function saveStay(stay: Stay) {
    setStays((current) => current.map((s) => (s.id === stay.id ? stay : s)));
    await fetch("/api/stays", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        propertyId: property.id,
        id: stay.id,
        revoked: stay.revoked,
        stay: {
          guestName: stay.guestName,
          arrival: stay.arrival,
          departure: stay.departure,
          accessCodeOverride: stay.accessCodeOverride,
          pin: stay.pin,
        },
      }),
    });
  }

  async function addStay() {
    const today = new Date();
    const iso = (days: number) => {
      const date = new Date(today);
      date.setDate(date.getDate() + days);
      return date.toISOString().slice(0, 10);
    };
    const response = await fetch("/api/stays", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        propertyId: property.id,
        stay: {
          guestName: "",
          arrival: iso(0),
          departure: iso(3),
          accessCodeOverride: null,
          pin: null,
        },
      }),
    });
    if (response.ok) {
      const { stay } = (await response.json()) as { stay: Stay };
      setStays((current) => [stay, ...current]);
    }
  }

  async function removeStay(id: string) {
    setStays((current) => current.filter((s) => s.id !== id));
    await fetch(`/api/stays/${id}`, { method: "DELETE" });
  }


  const guideUrl =
    typeof window === "undefined" ? "" : `${window.location.origin}/g/${property.slug}`;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/panel" className="text-sm text-muted hover:text-brand-deep">
            ← Tus alojamientos
          </Link>
          <h1 className="mt-1 font-display text-2xl font-semibold">{property.name}</h1>
          <p className="text-sm text-muted">
            {property.city} · paso {step} de {STEPS.length}
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* The publish button lives in the header, visible from every step:
              it is the one action the host is working towards, and burying it
              in step 7 made it invisible. It disappears once published. */}
          {/* The host writes in one language and the rest are generated on
              publish. Asking them to "review" a language they may not speak was
              a permanent, impossible chore in their dashboard. */}
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">Idioma de la guía</span>
            <select
              value={property.defaultLocale}
              onChange={(event) => patchProperty({ defaultLocale: event.target.value as Locale })}
              className="rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-brand"
            >
              {LOCALES.map((code) => (
                <option key={code} value={code}>
                  {LOCALE_NAMES[code]}
                </option>
              ))}
            </select>
          </label>

          {!property.published ? (
            <button
              type="button"
              onClick={() => void setPublished(true)}
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white"
            >
              Publicar guía
            </button>
          ) : (
            <span className="rounded-full bg-ok-soft px-4 py-2 text-sm font-medium text-ok-ink">
              Publicada
            </span>
          )}
        <div className="text-right text-sm">
          <p className="font-medium">{progress.score}% completada</p>
          <p className="text-muted">
            {saveState === "saving" ? "Guardando…" : null}
            {saveState === "saved" ? "Cambios guardados" : null}
            {saveState === "error" ? "No se pudo guardar" : null}
            {saveState === "idle" ? "Autoguardado activo" : null}
          </p>
          {saveError ? (
            <p className="mt-1 max-w-[260px] text-xs text-alert-ink">{saveError}</p>
          ) : null}
        </div>
        </div>
      </header>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-brand-soft">
        <div className="h-full bg-brand transition-all" style={{ width: `${progress.score}%` }} />
      </div>

      {mode === "demo" ? (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand-ink">
          <IconInfo size={18} /> Modo demostración: los cambios viven en memoria hasta que reinicies
          el servidor.
        </p>
      ) : null}

      <nav className="mt-6 flex gap-2 overflow-x-auto pb-2" aria-label="Pasos">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => void goToStep(index + 1)}
            aria-current={step === index + 1 ? "step" : undefined}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium ${
              step === index + 1 ? "bg-brand text-white" : "bg-white text-muted ring-1 ring-line"
            }`}
          >
            {index + 1}. {label}
          </button>
        ))}
      </nav>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_260px]">
        <section className="space-y-5">
          {step === 1 ? (
            <Panel title="Datos del alojamiento">
              <Field label="Nombre" value={property.name} onChange={(v) => patchProperty({ name: v })} />
              <Field label="Ciudad" value={property.city} onChange={(v) => patchProperty({ city: v })} />
              <Field label="Dirección" value={property.address} onChange={(v) => patchProperty({ address: v })} />
              <MapPicker
                lat={property.lat}
                lng={property.lng}
                seedQuery={`${property.address}, ${property.city}`}
                label="Sitúa tu alojamiento en el mapa"
                onPick={(pick) => {
                  const patch: Partial<Property> = { lat: pick.lat, lng: pick.lng };
                  /* The address field follows the pin only while it is empty:
                     overwriting what the host wrote would be rude, and their
                     wording ("portal azul, 4.º izquierda") is often better than
                     the map's. */
                  if (pick.label && !property.address.trim()) patch.address = pick.label;
                  if (pick.city && !property.city.trim()) patch.city = pick.city;
                  if (pick.countryCode) setCountry(pick.countryCode);
                  patchProperty(patch);
                }}
              />

              <div className="grid grid-cols-2 gap-3">
                <Field label="Entrada desde" value={property.checkinFrom} onChange={(v) => patchProperty({ checkinFrom: v })} />
                <Field label="Salida antes de" value={property.checkoutUntil} onChange={(v) => patchProperty({ checkoutUntil: v })} />
              </div>
              <Area
                label="Bienvenida"
                value={guide?.content.welcomeIntro ?? ""}
                onChange={(v) => patchGuide({ welcomeIntro: v })}
                hint="Dos o tres frases honestas: lo bueno y lo que conviene saber antes de llegar."
              />
            </Panel>
          ) : null}

          {step === 2 ? (
            <>
              <Panel title="Entrada">
                <Field
                  label="Código de acceso"
                  value={property.accessCode}
                  onChange={(v) => patchProperty({ accessCode: v })}
                  hint="Solo se envía al navegador del huésped durante su estancia."
                />
                <StepsEditor
                  label="Pasos para entrar"
                  items={guide?.content.arrivalSteps ?? []}
                  onChange={(arrivalSteps) => patchGuide({ arrivalSteps })}
                  placeholder="Ej.: la caja de llaves es la gris, a la izquierda del portal."
                  onAssist={() =>
                    suggest("pasos", (guide?.content.arrivalSteps ?? []).join("\n"), "arrival")
                  }
                  assistLabel="Ordenar mis notas con el asistente"
                  assistHint="Reescribe lo que ya has puesto. No inventa datos: si falta algo, lo deja entre corchetes para que lo completes tú."
                  assistResult={assistTarget === "arrival" ? assist : null}
                  onAcceptAssist={() => {
                    patchGuide({ arrivalSteps: linesFrom(assist) });
                    setAssist(null);
                  }}
                  onDismissAssist={() => setAssist(null)}
                />

                <Area label="Aparcamiento" value={guide?.content.parking ?? ""} onChange={(v) => patchGuide({ parking: v })} />
              </Panel>
              <Panel title="WiFi">
                <Field label="Red" value={property.wifiSsid} onChange={(v) => patchProperty({ wifiSsid: v })} />
                <Field label="Contraseña" value={property.wifiPassword} onChange={(v) => patchProperty({ wifiPassword: v })} />
                <Area label="Nota sobre la cobertura" value={guide?.content.wifiNote ?? ""} onChange={(v) => patchGuide({ wifiNote: v })} />
              </Panel>
            </>
          ) : null}

          {step === 3 ? (
            <Panel title="Cómo funciona la casa">
              <PairEditor
                items={guide?.content.house ?? []}
                onChange={(house) => patchGuide({ house })}
                titleLabel="Elemento"
                bodyLabel="Instrucciones"
                hint="Agua caliente, climatización, lavadora y basuras evitan la mayoría de los mensajes."
              />
            </Panel>
          ) : null}

          {step === 4 ? (
            <Panel title="Normas">
              <ul className="space-y-3">
                {(guide?.content.rules ?? []).map((rule, index) => (
                  <li key={index} className="rounded-xl border border-line p-3">
                    <textarea
                      value={rule.text}
                      rows={2}
                      onChange={(event) => {
                        const rules = [...(guide?.content.rules ?? [])];
                        rules[index] = { ...rule, text: event.target.value };
                        patchGuide({ rules });
                      }}
                      className="w-full resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {[
                        { value: true, label: "Permitido" },
                        { value: false, label: "Prohibido" },
                        { value: null, label: "Matiz" },
                      ].map((option) => (
                        <button
                          key={String(option.value)}
                          type="button"
                          onClick={() => {
                            const rules = [...(guide?.content.rules ?? [])];
                            rules[index] = { ...rule, allowed: option.value };
                            patchGuide({ rules });
                          }}
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            rule.allowed === option.value
                              ? "bg-brand text-white"
                              : "ring-1 ring-line text-muted"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          patchGuide({ rules: (guide?.content.rules ?? []).filter((_, i) => i !== index) })
                        }
                        className="ml-auto text-muted hover:text-alert-ink"
                        aria-label="Eliminar norma"
                      >
                        <IconTrash size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() =>
                  patchGuide({ rules: [...(guide?.content.rules ?? []), { text: "", allowed: null }] })
                }
                className="mt-3 rounded-full px-4 py-2 text-sm font-medium ring-1 ring-line"
              >
                Añadir norma
              </button>
            </Panel>
          ) : null}

          {step === 5 ? (
            <Panel title="Recomendaciones">
              <p className="text-sm text-muted">
                Las distancias y los minutos a pie se calculan solos. Lo que no se puede calcular es
                tu nota personal: eso es lo que hace útil la lista.
              </p>

              <div className="mt-4 rounded-xl bg-brand-soft p-3">
                <button
                  type="button"
                  onClick={() => loadNearby()}
                  className="rounded-full bg-white px-4 py-2 text-sm font-medium text-brand-deep ring-1 ring-brand-line"
                >
                  Ver sitios populares cerca del alojamiento
                </button>
                <p className="mt-2 text-xs text-brand-ink">
                  Salen de OpenStreetMap, ordenados por lo cerca que están. Añade los que ya
                  recomiendas y escribe solo tu nota.
                </p>
                {nearbyStatus ? <p className="mt-2 text-xs text-muted">{nearbyStatus}</p> : null}
                {nearbyFailed ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {/* OpenStreetMap's public servers are free and occasionally
                        busy. A retry costs the host one tap, and "Añadir sitio"
                        below already searches any place by name — this shortcut
                        going down never blocks the work. */}
                    <button
                      type="button"
                      onClick={() => loadNearby(1200)}
                      className="rounded-full bg-white px-3 py-1.5 font-medium text-brand-deep ring-1 ring-brand-line"
                    >
                      Reintentar buscando más lejos
                    </button>
                    <span className="text-muted">
                      o usa «Añadir sitio» y búscalo por su nombre en el mapa.
                    </span>
                  </div>
                ) : null}
                {nearby && nearby.length > 0 ? (
                  <ul className="mt-3 max-h-60 space-y-1 overflow-auto">
                    {nearby.map((candidate) => (
                      <li
                        key={`${candidate.name}-${candidate.lat}`}
                        className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="font-medium">{candidate.name}</span>
                          <span className="block text-xs text-muted">
                            {t.categories[candidate.category]} · {candidate.walkMin} min a pie
                            {candidate.cuisine ? ` · ${candidate.cuisine}` : ""}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => addNearby(candidate)}
                          className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Añadir
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <ul className="mt-4 space-y-4">
                {places.filter((place) => place.scope !== "emergency").map((place) => (
                  <li key={place.id} className="rounded-xl border border-line p-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Nombre" value={place.name} onChange={(v) => savePlace({ ...place, name: v })} />
                      <label className="block text-sm">
                        <span className="font-medium">Categoría</span>
                        <select
                          value={place.category}
                          onChange={(event) =>
                            savePlace({ ...place, category: event.target.value as PlaceCategory })
                          }
                          className="mt-1 w-full rounded-xl border border-line px-3 py-2 outline-none focus:border-brand"
                        >
                          {PLACE_CATEGORIES.map((category) => (
                            <option key={category} value={category}>
                              {t.categories[category]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium text-brand-deep">
                        Ajustar la ubicación en el mapa
                      </summary>
                      <div className="mt-2">
                        <MapPicker
                          lat={place.lat}
                          lng={place.lng}
                          seedQuery={place.name}
                          near={{ lat: property.lat, lng: property.lng }}
                          label={`Dónde está ${place.name}`}
                          onPick={(pick) => savePlace({ ...place, lat: pick.lat, lng: pick.lng })}
                        />
                      </div>
                    </details>
                    <Field
                      label={`Titular (${locale})`}
                      value={place.notes[locale]?.tagline ?? ""}
                      onChange={(v) =>
                        savePlace({
                          ...place,
                          notes: {
                            ...place.notes,
                            [locale]: { tagline: v, note: place.notes[locale]?.note ?? "" },
                          },
                        })
                      }
                    />
                    <Area
                      label={`Tu nota (${locale})`}
                      value={place.notes[locale]?.note ?? ""}
                      onChange={(v) =>
                        savePlace({
                          ...place,
                          notes: {
                            ...place.notes,
                            [locale]: { tagline: place.notes[locale]?.tagline ?? "", note: v },
                          },
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={() => removePlace(place.id)}
                      className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted hover:text-alert-ink"
                    >
                      <IconTrash size={16} /> Eliminar
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={addPlace}
                className="mt-4 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white"
              >
                Añadir sitio
              </button>
            </Panel>
          ) : null}

          {step === 6 ? (
            <>
              <Panel title="Cómo moverse">
                <p className="text-sm text-muted">
                  Incluye siempre la llegada desde el aeropuerto o la estación. Si el apartado es un
                  sitio —el aeropuerto, la estación, la parada de taxis— sitúalo en el mapa y tu
                  huésped podrá navegar hasta allí de un toque.
                </p>
                <ul className="mt-3 space-y-3">
                  {(guide?.content.transport ?? []).map((item, index) => {
                    const update = (patch: Partial<typeof item>) => {
                      const transport = [...(guide?.content.transport ?? [])];
                      transport[index] = { ...item, ...patch };
                      patchGuide({ transport });
                    };
                    return (
                      <li key={index} className="rounded-xl border border-line p-3">
                        <input
                          value={item.title}
                          placeholder="Desde el aeropuerto"
                          onChange={(event) => update({ title: event.target.value })}
                          className="w-full rounded-lg border border-line px-3 py-2 font-medium outline-none focus:border-brand"
                        />
                        <textarea
                          value={item.body}
                          rows={2}
                          placeholder="Autobús directo, 50 minutos, 5 €."
                          onChange={(event) => update({ body: event.target.value })}
                          className="mt-2 w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand"
                        />

                        {TRANSPORT_TEMPLATES.length > 0 && !item.title ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {TRANSPORT_TEMPLATES.map((template) => (
                              <button
                                key={template}
                                type="button"
                                onClick={() => update({ title: template })}
                                className="rounded-full px-2.5 py-1 text-xs font-medium text-brand-deep ring-1 ring-brand-line"
                              >
                                {template}
                              </button>
                            ))}
                          </div>
                        ) : null}

                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm font-medium text-brand-deep">
                            {item.lat !== undefined
                              ? "Ubicación marcada · ajustar"
                              : "Marcar la ubicación en el mapa (opcional)"}
                          </summary>
                          <div className="mt-2">
                            <MapPicker
                              lat={item.lat ?? property.lat}
                              lng={item.lng ?? property.lng}
                              seedQuery={item.title}
                              near={{ lat: property.lat, lng: property.lng }}
                              label={item.title || "Ubicación"}
                              onPick={(pick) => update({ lat: pick.lat, lng: pick.lng })}
                            />
                            {item.lat !== undefined ? (
                              <button
                                type="button"
                                onClick={() => update({ lat: undefined, lng: undefined })}
                                className="mt-2 text-xs text-muted hover:text-alert-ink"
                              >
                                Quitar la ubicación
                              </button>
                            ) : null}
                          </div>
                        </details>

                        <button
                          type="button"
                          onClick={() =>
                            patchGuide({
                              transport: (guide?.content.transport ?? []).filter((_, i) => i !== index),
                            })
                          }
                          className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted hover:text-alert-ink"
                        >
                          <IconTrash size={16} /> Eliminar
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  onClick={() =>
                    patchGuide({ transport: [...(guide?.content.transport ?? []), { title: "", body: "" }] })
                  }
                  className="mt-3 rounded-full px-4 py-2 text-sm font-medium ring-1 ring-line"
                >
                  Añadir apartado
                </button>
              </Panel>
              <Panel title="Emergencias">
                <p className="text-sm text-muted">
                  Añade tu teléfono y los servicios que quieras que tu huésped tenga a mano.
                </p>

                {suggestions.length > 0 ? (
                  <div className="mt-3 rounded-xl bg-brand-soft p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-brand-ink">
                      Números oficiales de {countryName}
                    </p>
                    <p className="mt-1 text-xs text-brand-ink">
                      Salen de dónde has situado el alojamiento. Añade los que quieras mostrar: un
                      número de emergencia en una guía es una promesa, y la decides tú.
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {suggestions.map((suggestion) => (
                        <li key={`${suggestion.kind}-${suggestion.phone}`}>
                          <button
                            type="button"
                            onClick={() =>
                              patchProperty({
                                contacts: [
                                  ...property.contacts,
                                  {
                                    kind: suggestion.kind,
                                    phone: suggestion.phone,
                                    detail: suggestion.detail,
                                  },
                                ],
                              })
                            }
                            className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-brand-deep ring-1 ring-brand-line"
                          >
                            + {suggestion.phone} · {suggestion.detail}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <ul className="mt-3 space-y-2">
                  {property.contacts.map((contact, index) => (
                    <li key={index} className="grid gap-2 sm:grid-cols-[130px_1fr_1fr_auto]">
                      <select
                        value={contact.kind}
                        onChange={(event) => {
                          const contacts = [...property.contacts];
                          contacts[index] = { ...contact, kind: event.target.value as typeof contact.kind };
                          patchProperty({ contacts });
                        }}
                        className="rounded-xl border border-line px-3 py-2 text-sm"
                      >
                        {CONTACT_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {t.contacts[kind]}
                          </option>
                        ))}
                      </select>
                      <input
                        value={contact.phone}
                        onChange={(event) => {
                          const contacts = [...property.contacts];
                          contacts[index] = { ...contact, phone: event.target.value };
                          patchProperty({ contacts });
                        }}
                        className="rounded-xl border border-line px-3 py-2 text-sm"
                      />
                      <input
                        value={contact.detail ?? ""}
                        placeholder="Detalle"
                        onChange={(event) => {
                          const contacts = [...property.contacts];
                          contacts[index] = { ...contact, detail: event.target.value };
                          patchProperty({ contacts });
                        }}
                        className="rounded-xl border border-line px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          patchProperty({ contacts: property.contacts.filter((_, i) => i !== index) })
                        }
                        aria-label="Eliminar contacto"
                        className="text-muted hover:text-alert-ink"
                      >
                        <IconTrash size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() =>
                    patchProperty({ contacts: [...property.contacts, { kind: "host", phone: "" }] })
                  }
                  className="mt-3 rounded-full px-4 py-2 text-sm font-medium ring-1 ring-line"
                >
                  Añadir contacto
                </button>
              </Panel>

              <Panel title="Dónde acudir">
                <p className="text-sm text-muted">
                  Un teléfono resuelve una urgencia; una dirección resuelve la otra mitad. Los
                  lugares que añadas aquí salen en su propio mapa dentro de «Emergencias», separado
                  del de recomendaciones.
                </p>
                <button
                  type="button"
                  onClick={loadEmergencyNearby}
                  className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-medium text-brand-deep ring-1 ring-brand-line"
                >
                  Buscar hospitales, farmacias y policía cerca
                </button>
                {erStatus ? <p className="mt-2 text-xs text-muted">{erStatus}</p> : null}
                {erNearby && erNearby.length > 0 ? (
                  <ul className="mt-3 max-h-60 space-y-1 overflow-auto">
                    {erNearby.map((candidate) => (
                      <li
                        key={`${candidate.name}-${candidate.lat}`}
                        className="flex items-center justify-between gap-2 rounded-lg bg-canvas px-3 py-2 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="font-medium">{candidate.name}</span>
                          <span className="block text-xs text-muted">
                            {candidate.walkMin} min a pie
                            {candidate.hours ? ` · ${candidate.hours}` : ""}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setErNearby((c) => c?.filter((p) => p.name !== candidate.name) ?? null);
                            void addNearby(candidate, "emergency");
                          }}
                          className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Añadir
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <ul className="mt-3 space-y-2">
                  {places
                    .filter((place) => place.scope === "emergency")
                    .map((place) => (
                      <li
                        key={place.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm"
                      >
                        <span className="font-medium">{place.name}</span>
                        <button
                          type="button"
                          onClick={() => removePlace(place.id)}
                          aria-label="Quitar"
                          className="text-muted hover:text-alert-ink"
                        >
                          <IconTrash size={16} />
                        </button>
                      </li>
                    ))}
                </ul>
              </Panel>
            </>
          ) : null}

          {step === 7 ? (
            <>
              <Panel title="Salida">
                <StepsEditor
                  label="Pasos de salida"
                  items={guide?.content.checkoutSteps ?? []}
                  onChange={(checkoutSteps) => patchGuide({ checkoutSteps })}
                  placeholder="Ej.: deja las llaves dentro de la caja y gira la rueda."
                  suggestions={CHECKOUT_TEMPLATES}
                  onAssist={() =>
                    suggest("pasos", (guide?.content.checkoutSteps ?? []).join("\n"), "checkout")
                  }
                  assistLabel="Ordenar mis notas con el asistente"
                  assistHint="Los mismos pasos, en el orden en que ocurren y con frases más cortas."
                  assistResult={assistTarget === "checkout" ? assist : null}
                  onAcceptAssist={() => {
                    patchGuide({ checkoutSteps: linesFrom(assist) });
                    setAssist(null);
                  }}
                  onDismissAssist={() => setAssist(null)}
                />
              </Panel>

              <Panel title="Preguntas frecuentes">
                <p className="text-sm text-muted">
                  Escribe la pregunta que ya te han hecho tres veces por WhatsApp. Cada una que
                  respondas aquí es un mensaje menos a medianoche.
                </p>
                <ul className="mt-3 space-y-3">
                  {(guide?.content.faqs ?? []).map((faq, index) => (
                    <li key={index} className="rounded-xl border border-line p-3">
                      <input
                        value={faq.q}
                        placeholder="Escribe la pregunta"
                        onChange={(event) => {
                          const faqs = [...(guide?.content.faqs ?? [])];
                          faqs[index] = { ...faq, q: event.target.value };
                          patchGuide({ faqs });
                        }}
                        className="w-full rounded-lg border border-line px-3 py-2 font-medium outline-none focus:border-brand"
                      />
                      <textarea
                        value={faq.a}
                        rows={2}
                        placeholder="Respuesta"
                        onChange={(event) => {
                          const faqs = [...(guide?.content.faqs ?? [])];
                          faqs[index] = { ...faq, a: event.target.value };
                          patchGuide({ faqs });
                        }}
                        className="mt-2 w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          patchGuide({ faqs: (guide?.content.faqs ?? []).filter((_, i) => i !== index) })
                        }
                        className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted hover:text-alert-ink"
                      >
                        <IconTrash size={16} /> Eliminar
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => patchGuide({ faqs: [...(guide?.content.faqs ?? []), { q: "", a: "" }] })}
                    className="rounded-full px-4 py-2 text-sm font-medium ring-1 ring-line"
                  >
                    Añadir pregunta
                  </button>
                  {FAQ_TEMPLATES.filter(
                    (template) => !(guide?.content.faqs ?? []).some((faq) => faq.q === template.q),
                  )
                    .slice(0, 8)
                    .map((template) => (
                      <button
                        key={template.q}
                        type="button"
                        onClick={() =>
                          patchGuide({
                            faqs: [...(guide?.content.faqs ?? []), { q: template.q, a: "" }],
                          })
                        }
                        className="rounded-full px-3 py-2 text-xs font-medium text-brand-deep ring-1 ring-brand-line"
                      >
                        + {template.q}
                      </button>
                    ))}
                </div>
              </Panel>

              <Panel title="Reservas">
                <p className="text-sm text-muted">
                  Cada reserva genera su propio enlace. Cuando termina, el código de entrada y la
                  clave del WiFi dejan de mostrarse en esa guía sin que tengas que hacer nada. El
                  enlace de muestra del alojamiento nunca los enseña.
                </p>
                <ul className="mt-3 space-y-3">
                  {stays.map((stay) => (
                    <li key={stay.id} className="rounded-xl border border-line p-3">
                      <div className="grid gap-2 sm:grid-cols-[1fr_140px_140px]">
                        <Field
                          label="Huésped"
                          value={stay.guestName ?? ""}
                          onChange={(v) => saveStay({ ...stay, guestName: v })}
                        />
                        <label className="block text-sm">
                          <span className="font-medium">Llegada</span>
                          <input
                            type="date"
                            value={stay.arrival}
                            onChange={(event) => saveStay({ ...stay, arrival: event.target.value })}
                            className="mt-1 w-full rounded-xl border border-line px-3 py-2 outline-none focus:border-brand"
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="font-medium">Salida</span>
                          <input
                            type="date"
                            value={stay.departure}
                            onChange={(event) => saveStay({ ...stay, departure: event.target.value })}
                            className="mt-1 w-full rounded-xl border border-line px-3 py-2 outline-none focus:border-brand"
                          />
                        </label>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                        <a
                          href={`/g/${stay.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs text-brand-deep underline"
                        >
                          /g/{stay.slug}
                        </a>
                        <a
                          href={`/api/qr?size=600&data=${encodeURIComponent(`/g/${stay.slug}`)}`}
                          download={`qr-${stay.slug}.svg`}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-line"
                        >
                          <IconQr size={14} /> QR de esta reserva
                        </a>
                        <button
                          type="button"
                          onClick={() => saveStay({ ...stay, revoked: !stay.revoked })}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                            stay.revoked ? "bg-alert-soft text-alert-ink" : "ring-1 ring-line"
                          }`}
                        >
                          {stay.revoked ? "Revocada" : "Revocar acceso"}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStay(stay.id)}
                          aria-label="Eliminar reserva"
                          className="ml-auto text-muted hover:text-alert-ink"
                        >
                          <IconTrash size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={addStay}
                  className="mt-3 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white"
                >
                  Añadir reserva
                </button>
              </Panel>

              <Panel title="Publicación">
                <p className="text-sm text-muted">
                  Al publicar se generan automáticamente las versiones en{" "}
                  {LOCALES.filter((c) => c !== property.defaultLocale)
                    .map((c) => LOCALE_NAMES[c])
                    .join(", ")}
                  . No tienes que revisarlas: la guía avisa al huésped de que la traducción es
                  automática.
                </p>
                <label className="mt-3 flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={property.published}
                    onChange={(event) => void setPublished(event.target.checked)}
                    className="h-5 w-5 accent-[var(--color-brand)]"
                  />
                  Guía publicada y accesible por enlace (desmarca para retirarla)
                </label>
                <Field
                  label="PIN de acceso (opcional)"
                  value={property.pin ?? ""}
                  onChange={(v) => patchProperty({ pin: /^\d{4}$/.test(v) ? v : v === "" ? null : property.pin })}
                  hint="Cuatro cifras. Con PIN, ni siquiera quien tenga el enlace ve el contenido."
                />
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  {guideUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/qr?size=200&data=${encodeURIComponent(guideUrl)}`}
                      alt="Código QR de la guía"
                      width={140}
                      height={140}
                      className="rounded-xl border border-line bg-white p-2"
                    />
                  ) : null}
                  <div className="text-sm">
                    <p className="font-mono text-xs text-brand-deep">{guideUrl}</p>
                    <p className="mt-2 text-muted">
                      Imprime el QR y déjalo en la nevera. El enlace no está indexado en buscadores.
                    </p>
                    <a
                      href={`/api/qr?size=600&data=${encodeURIComponent(guideUrl)}`}
                      download={`qr-${property.slug}.svg`}
                      className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 font-medium text-white"
                    >
                      <IconQr size={16} /> Descargar QR
                    </a>
                  </div>
                </div>
              </Panel>
            </>
          ) : null}

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => void goToStep(Math.max(1, step - 1))}
              disabled={step === 1}
              className="rounded-full px-4 py-2 text-sm font-medium ring-1 ring-line disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => void goToStep(Math.min(STEPS.length, step + 1))}
              disabled={step === STEPS.length}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Siguiente <IconArrow size={16} />
            </button>
          </div>
        </section>

        <aside className="space-y-3 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-card border border-line bg-white p-4">
            <p className="text-sm font-medium">Qué falta</p>
            <ul className="mt-3 space-y-2 text-sm">
              {progress.checks.map((check) => (
                <li key={check.key}>
                  <button
                    type="button"
                    onClick={() => void goToStep(check.step)}
                    className="flex w-full items-start gap-2 text-left"
                  >
                    <span className={check.done ? "text-ok-ink" : "text-muted"}>
                      {check.done ? <IconCheck size={16} /> : <IconCross size={16} />}
                    </span>
                    <span className={check.done ? "text-muted line-through" : ""}>
                      {check.label}
                      {!check.done && check.progress ? (
                        <span className="text-muted">
                          {" "}
                          · {check.progress.current} de {check.progress.target}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <Link
            href={`/g/${property.slug}`}
            className="block rounded-card border border-line bg-white p-4 text-sm font-medium text-brand-deep hover:border-brand"
          >
            Ver la guía como huésped →
          </Link>
        </aside>
      </div>
    </div>
  );
}

/* ----------------------------- form primitives ---------------------------- */

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-white p-5">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-line px-3 py-2 outline-none focus:border-brand"
      />
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <textarea
        value={value}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-line px-3 py-2 outline-none focus:border-brand"
      />
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

function ListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="text-sm">
      <p className="font-medium">{label}</p>
      <ul className="mt-2 space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex gap-2">
            <span className="mt-2 text-xs text-muted">{index + 1}</span>
            <textarea
              value={item}
              rows={2}
              placeholder={placeholder}
              onChange={(event) => {
                const next = [...items];
                next[index] = event.target.value;
                onChange(next);
              }}
              className="w-full rounded-xl border border-line px-3 py-2 outline-none focus:border-brand"
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              aria-label="Eliminar"
              className="text-muted hover:text-alert-ink"
            >
              <IconTrash size={16} />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onChange([...items, ""])}
        className="mt-2 rounded-full px-4 py-2 text-sm font-medium ring-1 ring-line"
      >
        Añadir
      </button>
    </div>
  );
}

function PairEditor({
  items,
  onChange,
  titleLabel,
  bodyLabel,
  hint,
}: {
  items: { title: string; body: string }[];
  onChange: (items: { title: string; body: string }[]) => void;
  titleLabel: string;
  bodyLabel: string;
  hint?: string;
}) {
  return (
    <div className="text-sm">
      {hint ? <p className="text-muted">{hint}</p> : null}
      <ul className="mt-3 space-y-3">
        {items.map((item, index) => (
          <li key={index} className="rounded-xl border border-line p-3">
            <input
              value={item.title}
              placeholder={titleLabel}
              onChange={(event) => {
                const next = [...items];
                next[index] = { ...item, title: event.target.value };
                onChange(next);
              }}
              className="w-full rounded-lg border border-line px-3 py-2 font-medium outline-none focus:border-brand"
            />
            <textarea
              value={item.body}
              rows={2}
              placeholder={bodyLabel}
              onChange={(event) => {
                const next = [...items];
                next[index] = { ...item, body: event.target.value };
                onChange(next);
              }}
              className="mt-2 w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand"
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              className="mt-2 inline-flex items-center gap-1.5 text-muted hover:text-alert-ink"
            >
              <IconTrash size={16} /> Eliminar
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onChange([...items, { title: "", body: "" }])}
        className="mt-3 rounded-full px-4 py-2 text-sm font-medium ring-1 ring-line"
      >
        Añadir
      </button>
    </div>
  );
}
