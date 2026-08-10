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
  metrics: {
    opens: number;
    languages: { value: string; count: number }[];
    devices: { value: string; count: number }[];
    misses: { value: string; count: number }[];
  };
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
}: {
  rows: PropertyRow[];
  mode: "postgres" | "demo";
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

  /* The phone's own share sheet: WhatsApp, SMS, mail, whatever the host uses.
     No backend, no email provider. Desktop browsers without the API fall back
     to copying the link, which is what the user wanted anyway. */
  async function shareLink(row: PropertyRow) {
    const url = `${window.location.origin}/g/${row.slug}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: row.name, text: `Guía de ${row.name}`, url });
        return;
      } catch {
        /* the user cancelled: not an error */
      }
    }
    await copyLink(row.slug);
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
          <button
            type="submit"
            disabled={busy || !form.name || !form.city || !form.address}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "Buscando la dirección…" : "Crear y empezar la guía"} <IconArrow size={16} />
          </button>
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

            {!row.published ? (
              <div className="mt-4 rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand-ink">
                <p className="flex items-start gap-2">
                  <IconInfo size={16} />
                  Sin publicar: solo tú puedes verla, con «Previsualizar borrador». Publícala
                  cuando esté lista y aparecerán el enlace y el QR para compartirla.
                </p>
                <button
                  type="button"
                  onClick={() => togglePublished(row)}
                  disabled={busy}
                  className="mt-2 rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                >
                  Publicar guía
                </button>
              </div>
            ) : null}

            {!row.published ? (
              <div className="mt-4 rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand-ink">
                <p className="flex items-start gap-2">
                  <IconInfo size={16} />
                  Sin publicar: solo tú puedes verla, con «Previsualizar borrador». Publícala
                  cuando esté lista y aparecerán las opciones para compartirla.
                </p>
                <button
                  type="button"
                  onClick={() => publish(row)}
                  disabled={busy}
                  className="mt-2 rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
                >
                  Publicar guía
                </button>
              </div>
            ) : null}

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
              ) : (
                <p className="mt-2 text-sm text-ok-ink">La guía está completa.</p>
              )}
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Reservas</p>
              {row.stays.length === 0 ? (
                <p className="mt-2 text-sm text-muted">
                  Sin reservas. Crea una desde el editor para generar el enlace del huésped.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {row.stays.slice(0, 3).map((stay) => (
                    <li
                      key={stay.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm"
                    >
                      <span>
                        <span className="font-medium">{stay.guestName ?? "Huésped"}</span>
                        <span className="text-muted">
                          {" "}
                          · {stay.arrival} → {stay.departure}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
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
                        {row.published ? (
                          <Link
                            href={`/g/${stay.slug}`}
                            className="text-xs font-medium text-brand-deep underline"
                          >
                            abrir
                          </Link>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {row.metrics.opens > 0 ? (
              <div className="mt-5 rounded-xl bg-canvas p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Cómo la usan tus huéspedes
                </p>
                <p className="mt-2">
                  {row.metrics.opens} {row.metrics.opens === 1 ? "apertura" : "aperturas"}
                  {row.metrics.languages.length > 0
                    ? ` · ${row.metrics.languages
                        .map((lang) => `${lang.value.toUpperCase()} ${lang.count}`)
                        .join(" · ")}`
                    : null}
                </p>
                {row.metrics.devices.length > 0 ? (
                  <p className="mt-1 text-muted">
                    Dispositivo aproximado:{" "}
                    {row.metrics.devices.map((d) => `${d.value} ${d.count}`).join(" · ")}
                  </p>
                ) : null}
                {row.metrics.misses.length > 0 ? (
                  <p className="mt-2 text-muted">
                    Buscaron y no encontraron:{" "}
                    <span className="text-ink">
                      {row.metrics.misses.map((miss) => `"${miss.value}"`).join(", ")}
                    </span>
                    . Puede que falte en tu guía.
                  </p>
                ) : null}
              </div>
            ) : null}

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
                    onClick={() => shareLink(row)}
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
        <p className="mt-10 rounded-card border border-dashed border-line p-10 text-center text-muted">
          Todavía no tienes alojamientos. Crea el primero y tendrás la guía lista en unos minutos.
        </p>
      ) : null}
    </main>
  );
}
