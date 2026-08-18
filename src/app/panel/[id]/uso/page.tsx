import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { IconAlert, IconArrow, IconCheck, IconInfo } from "@/components/icons";
import { currentHostId } from "@/lib/auth";
import { computeKpis, sectionName } from "@/lib/kpis";
import { getRepo } from "@/lib/repo";

export const dynamic = "force-dynamic";

/* ---------------------------------------------------------------------------
   Four questions, in the order a host asks them, and nothing else on the page.

   The temptation with analytics is to show everything that was measured. That
   produces a wall a host reads once and never again. So each block answers one
   question in a sentence, and the numbers are there to support the sentence
   rather than the other way round — and where a figure implies an action, the
   action is on the page next to it.
--------------------------------------------------------------------------- */

export default async function UsagePage(props: { params: Promise<{ id: string }> }) {
  const hostId = await currentHostId();
  if (!hostId) redirect("/");

  const { id } = await props.params;
  const repo = getRepo();
  const property = await repo.getProperty(id);
  if (!property || property.hostId !== hostId) notFound();

  const [rows, stays] = await Promise.all([repo.metrics(id), repo.listStays(id)]);
  const kpis = computeKpis(rows, stays);
  const { reach, usefulness, workSaved, sharing } = kpis;

  const openRate =
    reach.bookingsTotal > 0
      ? Math.round((reach.bookingsWithGuide / reach.bookingsTotal) * 100)
      : null;
  const frictionDelta = workSaved.friction.lastMonth - workSaved.friction.thisMonth;

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <header>
        <Link href="/panel" className="text-sm text-muted hover:text-brand-deep">
          ← Mis alojamientos
        </Link>
        <h1 className="mt-1 font-display text-2xl font-semibold">Cómo usan la guía tus huéspedes</h1>
        <p className="text-sm text-muted">
          {property.name} · {property.city}
        </p>
      </header>

      {reach.opens === 0 ? (
        <p className="mt-6 flex items-start gap-2 rounded-card bg-brand-soft px-4 py-3 text-sm text-brand-ink">
          <IconInfo size={18} />
          Todavía no hay datos. Aparecerán en cuanto tu primer huésped abra la guía.
        </p>
      ) : null}

      {/* 1 ------------------------------------------------------------ */}
      <Block
        number="1"
        title="¿Llega?"
        lead={
          openRate === null
            ? "Sin reservas todavía."
            : `${reach.bookingsWithGuide} de ${reach.bookingsTotal} reservas han abierto su guía.`
        }
      >
        <Figures
          items={[
            { value: openRate === null ? "—" : `${openRate}%`, label: "reservas que la abren" },
            { value: String(reach.unique || reach.opens), label: "dispositivos distintos" },
            { value: String(reach.opens), label: "aperturas" },
          ]}
        />

        {reach.languages.length > 0 ? (
          <Row
            label="Idiomas"
            text={reach.languages.map((l) => `${l.value.toUpperCase()} ${l.count}`).join(" · ")}
            hint="Si la mayoría llega en un idioma que no es el tuyo, escribe pensando en él."
          />
        ) : null}
        {reach.devices.length > 0 ? (
          <Row
            label="Dispositivo"
            text={reach.devices.map((d) => `${d.value} ${d.count}`).join(" · ")}
            hint="Aproximado. Si casi todo es móvil, revisa la guía en un móvil."
          />
        ) : null}

        {reach.silentBookings.length > 0 ? (
          <div className="mt-4 rounded-xl bg-alert-soft p-3">
            <p className="flex items-start gap-2 text-sm text-alert-ink">
              <IconAlert size={16} />
              {reach.silentBookings.length === 1
                ? "Una reserva en curso todavía no ha abierto su guía."
                : `${reach.silentBookings.length} reservas en curso todavía no han abierto su guía.`}
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {reach.silentBookings.map((stay) => (
                <li key={stay.id} className="flex items-center justify-between gap-2">
                  <span>
                    {stay.guestName || "Huésped"} · llega el {stay.arrival}
                  </span>
                  <Link href="/panel" className="text-xs font-medium text-brand-deep underline">
                    enviarle el enlace
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Block>

      {/* 2 ------------------------------------------------------------ */}
      <Block
        number="2"
        title="¿Sirve?"
        lead={
          usefulness.misses.length > 0
            ? "Hay cosas que tus huéspedes buscaron y no encontraron."
            : "Nadie se ha quedado sin encontrar lo que buscaba."
        }
      >
        {usefulness.sections.length > 0 ? (
          <Row
            label="Secciones más abiertas"
            text={usefulness.sections.map((s) => `${sectionName(s.value)} (${s.count})`).join(" · ")}
            hint="Nadie lee una guía entera. Esto es lo que de verdad necesitan."
          />
        ) : null}

        {usefulness.misses.length > 0 ? (
          <div className="mt-4 rounded-xl bg-alert-soft p-3 text-sm text-alert-ink">
            <p className="font-medium">Buscaron y no encontraron</p>
            <p className="mt-1">
              {usefulness.misses.map((m) => `"${m.value}" (${m.count})`).join(", ")}
            </p>
            <p className="mt-2 text-alert-ink/80">
              Es lo que falta en tu guía, dicho con sus palabras. El dato más útil de esta página.
            </p>
            <Link
              href={`/panel/${property.id}`}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-brand-deep"
            >
              Añadirlo a la guía <IconArrow size={13} />
            </Link>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              La guía entera
            </p>
            <p className="mt-1 text-sm">
              {usefulness.guideYes === 0 && usefulness.guideNo === 0 ? (
                "Sin respuestas todavía"
              ) : (
                <>
                  <span className="font-medium text-ok-ink">{usefulness.guideYes} sí</span>
                  <span className="text-muted"> · </span>
                  <span className="font-medium text-alert-ink">{usefulness.guideNo} no</span>
                </>
              )}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Se pregunta una sola vez, al final, y solo a quien lee en modo continuo.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Sección por sección
            </p>
            {/* Two numbers first, the breakdown underneath and labelled.

                The previous version printed "4 sí · Normas (2), Entrada (1)",
                where the list was the noes and nothing said so — so it read as
                four positives followed by more positives. The count was always
                right; the sentence was the bug, which is the worst kind in a
                dashboard because it looks like data. */}
            <p className="mt-1 text-sm">
              {usefulness.sectionYes === 0 && usefulness.sectionNoTotal === 0 ? (
                "Sin respuestas todavía"
              ) : (
                <>
                  <span className="font-medium text-ok-ink">{usefulness.sectionYes} sí</span>
                  <span className="text-muted"> · </span>
                  <span className="font-medium text-alert-ink">
                    {usefulness.sectionNoTotal} no
                  </span>
                </>
              )}
            </p>
            {usefulness.sectionNo.length > 0 ? (
              <p className="mt-1 text-sm text-alert-ink">
                Dicen que no:{" "}
                {usefulness.sectionNo
                  .map((h) => `${sectionName(h.section)} (${h.count})`)
                  .join(" · ")}
              </p>
            ) : null}
            <p className="mt-0.5 text-xs text-muted">
              Un «no» señala la sección exacta que hay que reescribir.
            </p>
          </div>
        </div>
      </Block>

      {/* 3 ------------------------------------------------------------ */}
      <Block
        number="3"
        title="¿Te ahorra trabajo?"
        lead={
          workSaved.friction.lastMonth === 0 && workSaved.friction.thisMonth === 0
            ? "Sin fricciones registradas."
            : frictionDelta > 0
              ? `Este mes tus huéspedes tuvieron ${workSaved.friction.thisMonth} fricciones; el mes pasado, ${workSaved.friction.lastMonth}.`
              : `Este mes tus huéspedes tuvieron ${workSaved.friction.thisMonth} fricciones; el mes pasado, ${workSaved.friction.lastMonth}.`
        }
      >
        <Figures
          items={[
            { value: String(workSaved.calls), label: "llamadas desde la guía" },
            { value: String(workSaved.reveals), label: "veces que consultaron el código de entrada" },
            {
              value: frictionDelta > 0 ? `−${frictionDelta}` : frictionDelta < 0 ? `+${-frictionDelta}` : "=",
              label: "fricciones frente al mes pasado",
            },
          ]}
        />
        <p className="mt-3 text-xs text-muted">
          Una fricción es una llamada, una búsqueda sin resultado o un «no me sirvió». No podemos
          contar los mensajes que te ahorras —no vemos tu WhatsApp—, pero esto se mueve en la misma
          dirección.
        </p>

        {workSaved.directions.length > 0 ? (
          <Row
            label="Recomendaciones que usan"
            text={workSaved.directions.map((d) => `${d.value} (${d.count})`).join(" · ")}
            hint="Veces que pulsaron «Cómo llegar» en cada sitio. Las que nadie pulsa sobran: una lista corta y buena vale más que una larga."
          />
        ) : null}
      </Block>

      {/* 4 ------------------------------------------------------------ */}
      <Block
        number="4"
        title="¿Se comparte?"
        lead={
          sharing.keepsakes > 0
            ? `${sharing.keepsakes} huéspedes se llevaron su recuerdo.`
            : "Todavía nadie ha creado su recuerdo."
        }
      >
        <Figures
          items={[
            { value: String(sharing.keepsakes), label: "recuerdos descargados" },
            { value: String(sharing.prints), label: "veces que pulsaron imprimir" },
          ]}
        />
        <p className="mt-3 text-xs text-muted">
          «Pulsaron imprimir» es literalmente eso: cuántas veces alguien abrió el diálogo de
          impresión de su navegador desde la guía. No sabemos si llegó a salir en papel, ni si
          acaban publicando el recuerdo: la guía no mira nada fuera de sí misma.
        </p>
      </Block>

      <footer className="mt-10 rounded-card border border-line bg-white p-4 text-xs text-muted">
        <p className="flex items-start gap-2">
          <IconCheck size={15} />
          <span className="block">
            <strong>Tus propias visitas no cuentan.</strong> Cuando abres tu guía desde «Vista de
            muestra», «Ver la guía como huésped» o el editor, nada de eso llega a estos números.
            Aquí solo hay huéspedes.
          </span>
          <span className="mt-2 block">
            Todos estos números son un suelo, no un total: la guía funciona sin conexión y quien la
            lee en el avión no cuenta. Los datos abarcan los últimos seis meses. Nada se guarda por
            persona salvo si una reserva abrió su guía, y de eso solo la fecha.
          </span>
        </p>
      </footer>
    </main>
  );
}

function Block({
  number,
  title,
  lead,
  children,
}: {
  number: string;
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-card border border-line bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{number}</p>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm">{lead}</p>
      {children}
    </section>
  );
}

function Figures({ items }: { items: { value: string; label: string }[] }) {
  return (
    <dl className="mt-4 grid gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-canvas px-3 py-2.5">
          <dt className="font-display text-2xl font-semibold text-brand-deep">{item.value}</dt>
          <dd className="text-xs text-muted">{item.label}</dd>
        </div>
      ))}
    </dl>
  );
}

function Row({ label, text, hint }: { label: string; text: string; hint: string }) {
  return (
    <div className="mt-4 border-t border-line pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm">{text}</p>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </div>
  );
}
