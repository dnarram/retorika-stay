"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconAlert, IconArrow, IconCheck, IconCopy, IconInfo, IconQr, IconShare } from "@/components/icons";
import type { StayPhase } from "@/lib/stay";

export type PropertyRow = {
  id: string;
  slug: string;
  name: string;
  city: string;
  published: boolean;
  score: number;
  nextStep: { label: string; hint: string } | null;
  rotateCode: boolean;
  stays: {
    id: string;
    slug: string;
    guestName: string | null;
    arrival: string;
    departure: string;
    revoked: boolean;
    phase: StayPhase;
  }[];
  metrics: { openRate: number | null; opens: number; attention: number };
};

const PHASE_LABEL: Record<StayPhase, string> = {
  before: "Próxima",
  arrival: "Llega hoy",
  staying: "En curso",
  departure: "Se va hoy",
  memories: "Terminada",
};

export default function PanelClient({
  rows,
  mode,
  isAdmin,
}: {
  rows: PropertyRow[];
  mode: "postgres" | "demo";
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", address: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function createProperty(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    /* The address is turned into coordinates before anything is created: the
       host never faces a latitude field, one of the classic reasons people
       abandon a form halfway. */
    const geo = await fetch(`/api/geocode?q=${encodeURIComponent(`${form.address}, ${form.city}`)}`);
    const found = geo.ok ? ((await geo.json()) as { results: { lat: number; lng: number }[] }) : null;
    const first = found?.results?.[0];
    if (!first) {
      setBusy(false);
      setError("No encontramos esa dirección. Revisa la calle y la ciudad.");
      return;
    }

    const response = await fetch("/api/properties", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, lat: first.lat, lng: first.lng }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("No se pudo crear el alojamiento.");
      return;
    }
    const { property } = (await response.json()) as { property: { id: string } };
    router.push(`/panel/${property.id}`);
  }

  async function removeProperty(row: PropertyRow) {
    if (!confirm(`¿Borrar "${row.name}" y todas sus guías y estancias? No se puede deshacer.`)) return;
    await fetch(`/api/properties/${row.id}`, { method: "DELETE" });
    router.refresh();
  }

  /* Publishing from the card itself: making the host walk to step 7 of the
     editor to flip one switch is friction with nothing on the other side. */
  async function togglePublished(row: PropertyRow) {
    setBusy(true);
    await fetch(`/api/properties/${row.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ published: !row.published }),
    });
    setBusy(false);
    router.refresh();
  }

  /* Publishing from the card itself: sending the host into step 7 of the editor
     to flip one switch is friction with nothing on the other side. */
  async function publish(row: PropertyRow) {
    setBusy(true);
    await fetch(`/api/properties/${row.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ published: true }),
    });
    setBusy(false);
    router.refresh();
  }

  /* Bookings are managed where the property lives, not inside the guide editor:
     the editor is about what the guide says, this page is about who is staying.
     Every action a booking needs is here — create, edit dates, share, revoke,
     delete — so there is one place to look and nothing to learn. */
  async function addStay(row: PropertyRow) {
    const iso = (days: number) => {
      const date = new Date();
      date.setDate(date.getDate() + days);
      return date.toISOString().slice(0, 10);
    };
    setBusy(true);
    await fetch("/api/stays", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        propertyId: row.id,
        stay: {
          guestName: "",
          arrival: iso(0),
          departure: iso(3),
          accessCodeOverride: null,
          pin: null,
        },
      }),
    });
    setBusy(false);
    router.refresh();
  }

  async function saveStay(
    row: PropertyRow,
    stay: PropertyRow["stays"][number],
    patch: Partial<{ guestName: string; arrival: string; departure: string; revoked: boolean }>,
  ) {
    const next = { ...stay, ...patch };
    const response = await fetch("/api/stays", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        propertyId: row.id,
        id: stay.id,
        revoked: next.revoked,
        stay: {
          guestName: next.guestName,
          arrival: next.arrival,
          departure: next.departure,
          accessCodeOverride: null,
          pin: null,
        },
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "No se pudo guardar la reserva.");
      return;
    }
    router.refresh();
  }

  async function removeStay(id: string, guestName: string | null) {
    if (!confirm(`¿Borrar la reserva${guestName ? ` de ${guestName}` : ""}? No se puede deshacer.`))
      return;
    await fetch(`/api/stays/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function shareSlug(slug: string, title: string) {
    const url = `${window.location.origin}/g/${slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* the user cancelled: not an error */
      }
    }
    await copyLink(slug);
  }

  async function copyLink(slug: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/g/${slug}`).catch(() => {});
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Image src="/logo-retorika.png" alt="Retorika" width={120} height={61} className="h-8 w-auto" />
          <div>
            <h1 className="font-display text-2xl font-semibold">Mis alojamientos</h1>
            <p className="text-sm text-muted">
              {rows.length} {rows.length === 1 ? "alojamiento" : "alojamientos"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white"
          >
            Nuevo alojamiento
          </button>
          {isAdmin ? (
            <Link
              href="/admin"
              className="rounded-full px-4 py-2 text-sm font-medium ring-1 ring-line"
            >
              Panel de negocio
            </Link>
          ) : null}
          <form action="/api/auth/logout" method="post">
            <button className="rounded-full px-4 py-2 text-sm font-medium ring-1 ring-line">Salir</button>
          </form>
        </div>
      </header>

      {mode === "demo" ? (
        <p className="mt-6 flex items-start gap-2 rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand-ink">
          <IconInfo size={18} />
          Modo demostración: sin base de datos conectada, los cambios se guardan en memoria y se
          pierden al reiniciar el servidor.
        </p>
      ) : null}

      {creating ? (
        <form onSubmit={createProperty} className="mt-6 rounded-card border border-line bg-white p-6">
          <h2 className="font-display text-lg font-semibold">Nuevo alojamiento</h2>
          <p className="mt-1 text-sm text-muted">
            Tres datos y ya tienes la guía en borrador. Las coordenadas las buscamos nosotros.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(
              [
                ["name", "Nombre", "Casa Puente Nuevo"],
                ["city", "Ciudad", "Ronda"],
                ["address", "Dirección", "Calle Tenorio 12"],
              ] as const
            ).map(([key, label, placeholder]) => (
              <label key={key} className="block text-sm">
                <span className="font-medium">{label}</span>
                <input
                  value={form[key]}
                  placeholder={placeholder}
                  onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                  className="mt-1 w-full rounded-xl border border-line px-3 py-2 outline-none focus:border-brand"
                />
              </label>
            ))}
          </div>
          {error ? <p className="mt-3 text-sm text-alert-ink">{error}</p> : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={busy || !form.name || !form.city || !form.address}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy ? "Buscando la dirección…" : "Crear y empezar la guía"} <IconArrow size={16} />
            </button>
            {/* A form you can open by accident and cannot close is a trap. */}
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setError(null);
                setForm({ name: "", city: "", address: "" });
              }}
              className="rounded-full px-4 py-2 text-sm font-medium text-muted ring-1 ring-line"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      <ul className="mt-6 grid gap-5 lg:grid-cols-2">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-col rounded-card border border-line bg-white p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted">{row.city}</p>
                <p className="font-display text-lg font-semibold">{row.name}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  row.published ? "bg-ok-soft text-ok-ink" : "bg-brand-soft text-brand-ink"
                }`}
              >
                {row.published ? "Publicada" : "Sin publicar"}
              </span>
            </div>

            {row.rotateCode ? (
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-alert-soft px-3 py-2 text-sm text-alert-ink">
                <IconAlert size={16} />
                Ha terminado una estancia y el código de entrada sigue siendo el mismo. Cámbialo en
                la casa y actualízalo en la guía.
              </p>
            ) : null}

            <div className="mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Guía completada</span>
                <span className="font-medium">{row.score}%</span>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-soft"
                role="progressbar"
                aria-valuenow={row.score}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="h-full bg-brand" style={{ width: `${row.score}%` }} />
              </div>
              {row.nextStep ? (
                <p className="mt-2 text-sm text-muted">
                  Lo siguiente: <span className="text-ink">{row.nextStep.label}.</span>{" "}
                  {row.nextStep.hint}
                </p>
              ) : null}
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Reservas</p>
                <button
                  type="button"
                  onClick={() => addStay(row)}
                  className="rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-white"
                >
                  Nueva reserva
                </button>
              </div>
              {row.stays.length === 0 ? (
                <p className="mt-2 text-sm text-muted">
                  Sin reservas. Crea una y tendrás el enlace y el QR de ese huésped, con acceso solo
                  durante sus fechas.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {row.stays.map((stay) => (
                    <li key={stay.id} className="rounded-xl border border-line p-3 text-sm">
                      <div className="grid gap-2 sm:grid-cols-[1fr_130px_130px]">
                        <label className="block">
                          <span className="text-xs text-muted">Huésped</span>
                          <input
                            defaultValue={stay.guestName ?? ""}
                            placeholder="Nombre"
                            onBlur={(event) => saveStay(row, stay, { guestName: event.target.value })}
                            className="mt-0.5 w-full rounded-lg border border-line px-2.5 py-1.5 outline-none focus:border-brand"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs text-muted">Llegada</span>
                          <input
                            type="date"
                            defaultValue={stay.arrival}
                            onChange={(event) => saveStay(row, stay, { arrival: event.target.value })}
                            className="mt-0.5 w-full rounded-lg border border-line px-2.5 py-1.5 outline-none focus:border-brand"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs text-muted">Salida</span>
                          <input
                            type="date"
                            defaultValue={stay.departure}
                            onChange={(event) => saveStay(row, stay, { departure: event.target.value })}
                            className="mt-0.5 w-full rounded-lg border border-line px-2.5 py-1.5 outline-none focus:border-brand"
                          />
                        </label>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            stay.revoked
                              ? "bg-alert-soft text-alert-ink"
                              : stay.phase === "memories"
                                ? "bg-canvas text-muted"
                                : "bg-ok-soft text-ok-ink"
                          }`}
                        >
                          {stay.revoked ? "Revocada" : PHASE_LABEL[stay.phase]}
                        </span>

                        {/* Every action a booking needs, on the booking itself.
                            They used to live inside the guide editor, which is
                            about what the guide says — not about who is staying
                            this weekend. */}
                        <Link
                          href={`/g/${stay.slug}`}
                          className="rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-line"
                        >
                          Abrir
                        </Link>
                        <button
                          type="button"
                          onClick={() => copyLink(stay.slug)}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-line"
                        >
                          {copied === stay.slug ? <IconCheck size={13} /> : <IconCopy size={13} />}
                          {copied === stay.slug ? "Copiado" : "Copiar enlace"}
                        </button>
                        <button
                          type="button"
                          onClick={() => shareSlug(stay.slug, `${row.name} · ${stay.guestName ?? "Tu estancia"}`)}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-line"
                        >
                          <IconShare size={13} /> Compartir
                        </button>
                        <a
                          href={`/api/qr?size=600&data=${encodeURIComponent(`/g/${stay.slug}`)}`}
                          download={`qr-${stay.slug}.svg`}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-line"
                        >
                          <IconQr size={13} /> QR
                        </a>
                        <button
                          type="button"
                          onClick={() => saveStay(row, stay, { revoked: !stay.revoked })}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                            stay.revoked ? "bg-alert-soft text-alert-ink" : "ring-1 ring-line"
                          }`}
                        >
                          {stay.revoked ? "Restablecer acceso" : "Revocar acceso"}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStay(stay.id, stay.guestName)}
                          className="ml-auto text-xs text-muted hover:text-alert-ink"
                        >
                          Borrar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Three figures and a door. The detail lives on its own page: a
                property card that tries to be a dashboard stops being a card. */}
            <div className="mt-5 rounded-xl bg-canvas p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Cómo usan la guía tus huéspedes
                </p>
                <Link
                  href={`/panel/${row.id}/uso`}
                  className="text-xs font-medium text-brand-deep underline"
                >
                  ver detalle
                </Link>
              </div>
              <p className="mt-1 text-[11px] text-muted">
                Solo huéspedes: tus propias visitas no cuentan.
              </p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                <div>
                  <dt className="font-display text-xl font-semibold text-brand-deep">
                    {row.metrics.openRate === null ? "—" : `${row.metrics.openRate}%`}
                  </dt>
                  <dd className="text-[11px] text-muted">reservas que la abren</dd>
                </div>
                <div>
                  <dt className="font-display text-xl font-semibold text-brand-deep">
                    {row.metrics.opens}
                  </dt>
                  <dd className="text-[11px] text-muted">aperturas</dd>
                </div>
                <div>
                  <dt
                    className={`font-display text-xl font-semibold ${
                      row.metrics.attention > 0 ? "text-alert-ink" : "text-ok-ink"
                    }`}
                  >
                    {row.metrics.attention}
                  </dt>
                  <dd className="text-[11px] text-muted">requieren atención</dd>
                </div>
              </dl>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 text-sm">
              <Link
                href={`/panel/${row.id}`}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 font-medium text-white"
              >
                Editar guía <IconArrow size={16} />
              </Link>
              <Link
                href={`/g/${row.slug}`}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-medium ring-1 ring-line"
              >
                {row.published ? "Vista de muestra" : "Previsualizar borrador"}
              </Link>

              {/* Sharing actions only exist once the guide is published. An
                  unpublished guide is a 404 for everyone but its owner, so a
                  copy-link button would hand the host a broken link and a QR
                  would print one onto paper. */}
              {row.published ? (
                <>
                  <button
                    type="button"
                    onClick={() => copyLink(row.slug)}
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-medium ring-1 ring-line"
                  >
                    {copied === row.slug ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    {copied === row.slug ? "Copiado" : "Copiar enlace"}
                  </button>
                  <button
                    type="button"
                    onClick={() => shareSlug(row.slug, row.name)}
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-medium ring-1 ring-line"
                  >
                    <IconShare size={16} /> Compartir
                  </button>
                  <a
                    href={`/api/qr?size=600&data=${encodeURIComponent(`/g/${row.slug}`)}`}
                    download={`qr-${row.slug}.svg`}
                    className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-medium ring-1 ring-line"
                  >
                    <IconQr size={16} /> QR
                  </a>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => removeProperty(row)}
                className="ml-auto rounded-full px-4 py-2 font-medium text-muted hover:text-alert-ink"
              >
                Borrar
              </button>
            </div>
          </li>
        ))}
      </ul>

      {rows.length === 0 && !creating ? (
        /* The empty state is the only screen where a host has nothing to look
           at, which makes it the only place a short walkthrough is welcome
           rather than in the way. Five steps, one line each, and it disappears
           for good the moment the first property exists — a tutorial that
           follows you around after you have done the thing is clutter. */
        <section className="mt-10 rounded-card border border-dashed border-line p-8">
          <h2 className="font-display text-xl font-semibold">Tu primera guía, en cinco pasos</h2>
          <p className="mt-1 text-sm text-muted">
            Unos minutos en total. Puedes parar donde quieras: se guarda solo.
          </p>

          <ol className="mt-6 space-y-4">
            {[
              {
                title: "Crea el alojamiento",
                text: "Nombre, ciudad y dirección. El mapa encuentra el sitio y tú ajustas el punto exacto arrastrándolo.",
              },
              {
                title: "Rellena la guía",
                text: "Siete pasos con sugerencias de un toque: entrada, WiFi, normas, tus sitios favoritos y a quién llamar.",
              },
              {
                title: "Publícala",
                text: "Solo hacen falta el nombre y la dirección. Al publicar se traduce sola a inglés, francés y portugués.",
              },
              {
                title: "Crea una reserva",
                text: "Nombre del huésped y fechas. Genera un enlace propio en el que el código de entrada solo aparece durante su estancia.",
              },
              {
                title: "Compártela",
                text: "Copia el enlace, mándalo por donde quieras o imprime el QR para dejarlo en la puerta.",
              },
            ].map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft font-display text-sm font-semibold text-brand-deep">
                  {index + 1}
                </span>
                <span>
                  <span className="block font-medium">{step.title}</span>
                  <span className="block text-sm text-muted">{step.text}</span>
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-white"
            >
              Empezar por el paso 1 <IconArrow size={16} />
            </button>
            {/* Seeing a finished guide before writing one is worth more than any
                amount of instructions: it shows the host what they are aiming at. */}
            <Link
              href="/g/k3f9apx2"
              className="text-sm font-medium text-brand-deep underline underline-offset-4"
            >
              Ver antes una guía terminada
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}
