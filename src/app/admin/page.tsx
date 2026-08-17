import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { IconAlert, IconCheck, IconInfo } from "@/components/icons";
import { adminStats } from "@/lib/admin";
import { currentHostId } from "@/lib/auth";
import { getRepo } from "@/lib/repo";

export const dynamic = "force-dynamic";

/* ---------------------------------------------------------------------------
   The business panel.

   Its most important section is the last one: what this panel does not measure
   and why. Every SaaS dashboard template ships with MRR, LTV, CAC and NPS, and
   a product with no billing provider, no ad spend and no helpdesk can only fill
   those in by inventing them. An invented number in a business panel is worse
   than a blank: sooner or later somebody plans against it.

   What is here is what the system genuinely knows, and it happens to be the set
   that changes decisions: whether accounts turn into opened guides, how long
   that takes, where hosts stop inside the editor, and which parts of the
   product nobody uses.
--------------------------------------------------------------------------- */

export default async function AdminPage() {
  const hostId = await currentHostId();
  if (!hostId) redirect("/");
  const account = await getRepo().getHostById(hostId);
  if (account?.role !== "admin") notFound();

  const stats = await adminStats();
  const { sample, verdict, hosts, funnel, activation, wizard, worstStep, content, guests, cohorts, platform } =
    stats;

  /* The biggest leak in the funnel, named rather than left for the reader to
     find by comparing six bars. */
  const leak = funnel
    .slice(1)
    .map((stage, index) => ({ stage, lost: funnel[index].count - stage.count, from: funnel[index] }))
    .sort((a, b) => b.lost - a.lost)[0];

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Retorika Stay</p>
          <h1 className="font-display text-2xl font-semibold">Panel de negocio</h1>
        </div>
        <Link href="/panel" className="text-sm text-muted hover:text-brand-deep">
          Ir a Mis alojamientos →
        </Link>
      </header>

      {/* Verdict ------------------------------------------------------ */}
      <section
        className={`mt-6 rounded-card p-5 ${
          verdict.tone === "bien"
            ? "bg-ok-soft"
            : verdict.tone === "atencion"
              ? "bg-alert-soft"
              : "bg-brand-soft"
        }`}
      >
        <p className="font-display text-lg font-semibold">{verdict.headline}</p>
        <p className="mt-1 text-sm">{verdict.detail}</p>
        {sample.thin ? (
          <p className="mt-2 text-xs">
            Muestra actual: {sample.hosts} anfitriones · {sample.properties} alojamientos ·{" "}
            {sample.bookings} reservas.
          </p>
        ) : null}
      </section>

      {/* Headline ---------------------------------------------------- */}
      <section className="mt-4 grid gap-3 sm:grid-cols-4">
        <Figure
          value={String(hosts.total)}
          label="anfitriones registrados"
          note="total histórico"
        />
        <Figure
          value={String(hosts.newHosts.current)}
          label="altas este mes"
          note={changeNote(hosts.newHosts)}
        />
        <Figure
          value={`${activation.endToEndRate}%`}
          label="del registro a la guía abierta"
          note={`${funnel[funnel.length - 1]?.count ?? 0} de ${hosts.total}`}
        />
        <Figure
          value={
            activation.medianHoursToFirstGuide === null
              ? "—"
              : formatHours(activation.medianHoursToFirstGuide)
          }
          label="mediana hasta la primera guía"
          note={medianNote(activation.medianThisMonth, activation.medianLastMonth)}
        />
      </section>

      {/* Growth ------------------------------------------------------- */}
      <Panel
        title="¿Crece?"
        lead="Seis meses de altas, alojamientos, reservas y aperturas. Lo que importa no es la altura de la última barra sino la forma de la fila."
        source="Fechas de creación de cuentas, alojamientos y reservas, y el contador de aperturas agrupado por mes."
      >
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Spark title="Altas de anfitriones" data={hosts.series.hosts} />
          <Spark title="Alojamientos creados" data={hosts.series.properties} />
          <Spark title="Reservas creadas" data={hosts.series.bookings} />
          <Spark title="Aperturas de huéspedes" data={hosts.series.opens} />
        </div>
      </Panel>

      {/* Funnel ------------------------------------------------------ */}
      <Panel
        title="¿Convierte?"
        lead={
          leak
            ? `Una cuenta no vale nada hasta que un huésped abre una guía. La mayor pérdida está entre «${leak.from.label}» y «${leak.stage.label}»: se quedan ${leak.lost} por el camino.`
            : "Una cuenta no vale nada hasta que un huésped abre una guía."
        }
        source="Cada escalón cuenta filas reales: cuentas en la tabla de anfitriones, alojamientos creados, pasos del editor que el anfitrión ha abierto de verdad, guías marcadas como publicadas, reservas con fechas y reservas con sello de primera apertura."
      >
        <ul className="mt-4 space-y-2">
          {funnel.map((stage, index) => (
            <li key={stage.label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium">{stage.label}</span>
                <span className="text-muted">
                  {/* Three readings of the same bar: how many, how many of the
                      step before, and how many of everyone who signed up. */}
                  <strong className="text-ink">{stage.count}</strong>
                  {stage.ofPrevious !== null ? (
                    <span className={stage.ofPrevious < 60 ? "ml-2 text-alert-ink" : "ml-2"}>
                      {stage.ofPrevious}% del paso anterior
                    </span>
                  ) : null}
                  {index > 0 ? <span className="ml-2 text-muted">· {stage.ofTop}% del total</span> : null}
                </span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-brand-soft">
                <div className="h-full bg-brand" style={{ width: `${stage.ofTop}%` }} />
              </div>
              <p className="mt-0.5 text-xs text-muted">{stage.hint}</p>
            </li>
          ))}
        </ul>
      </Panel>

      {/* Wizard ------------------------------------------------------ */}
      <Panel
        title="Dónde se quedan dentro del editor"
        lead={
          worstStep && worstStep.dropFromPrevious > 0
            ? `La caída más fuerte está al entrar en el paso ${worstStep.step}, «${worstStep.label}»: se pierde el ${worstStep.dropFromPrevious}% de quienes venían del anterior.`
            : "Sin caídas apreciables entre pasos."
        }
        source="El editor apunta cada paso que el anfitrión abre. Se compara con el paso inmediatamente anterior, no con el total, para que la caída señale el escalón concreto que se atraganta."
      >
        <ul className="mt-4 space-y-1.5">
          {wizard.map((step) => (
            <li key={step.step} className="flex items-center gap-3 text-sm">
              <span className="w-6 shrink-0 text-xs text-muted">{step.step}</span>
              <span className="w-52 shrink-0 truncate">{step.label}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-brand-soft">
                <span
                  className="block h-full bg-brand"
                  style={{ width: `${step.pct}%` }}
                />
              </span>
              <span className="w-24 shrink-0 text-right text-xs text-muted">
                {step.reached} · {step.pct}%
                {step.dropFromPrevious > 0 ? (
                  <span className={step.dropFromPrevious >= 30 ? "text-alert-ink" : ""}>
                    {" "}
                    −{step.dropFromPrevious}%
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>

      </Panel>

      {/* Product ----------------------------------------------------- */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel
          title="Qué se usa del producto"
          lead={`${content.published} de ${content.properties} alojamientos están publicados (${activation.publishedRate}%), a ${content.avgPropertiesPerHost} por anfitrión.`}
          source="Cuenta de alojamientos y, para cada sección, cuántos anfitriones NO la han apagado en «Qué se muestra en la guía»."
        >
          <Bars
            items={content.sectionsUsed.map((section) => ({
              label: section.label,
              count: section.count,
              total: content.properties,
            }))}
          />
          <p className="mt-3 text-xs text-muted">
            Secciones que los anfitriones dejan encendidas. Una que casi nadie mantiene es una
            sección que replantear, no que promocionar.
          </p>
          {content.themes.length > 0 ? (
            <p className="mt-3 text-xs text-muted">
              Estilos elegidos: {content.themes.map((theme) => `${theme.value} (${theme.count})`).join(" · ")}
            </p>
          ) : null}
        </Panel>

        <Panel
          title="Qué hacen los huéspedes"
          lead={`${guests.bookingsWithGuide} de ${guests.bookingsTotal} reservas abrieron su guía · ${guests.opensPerPublishedGuide} aperturas por guía publicada.`}
          source="Eventos que envía la guía del huésped. Las visitas del propio anfitrión se descartan en el servidor, así que aquí no hay pruebas ni previsualizaciones."
        >
          <dl className="mt-3 grid grid-cols-2 gap-3">
            <MiniFigure value={String(guests.opens)} label="aperturas" />
            <MiniFigure
              value={
                guests.opens > 0
                  ? `${Math.round((guests.unique / guests.opens) * 100)}%`
                  : "—"
              }
              label="son dispositivos nuevos"
            />
            <MiniFigure value={String(guests.helpfulYes)} label="«sí me sirvió»" />
            <MiniFigure value={String(guests.misses)} label="búsquedas sin resultado" />
            <MiniFigure value={String(guests.helpfulNo)} label="«no me sirvió»" />
            <MiniFigure value={String(guests.keepsakes)} label="recuerdos creados" />
          </dl>
          {guests.languages.length > 0 ? (
            <p className="mt-3 text-xs text-muted">
              Idiomas: {guests.languages.map((l) => `${l.value.toUpperCase()} ${l.count}`).join(" · ")}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted">
            Toda cifra de huésped es un suelo: la guía funciona sin conexión y quien la lee en el
            avión no cuenta.
          </p>
        </Panel>
      </div>

      {/* Retention + acquisition ------------------------------------- */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel
          title="¿Retiene?"
          lead="De cada grupo que se registró en un mes, cuántos siguen tocando su guía ahora."
          source="Cohorte = mes de alta de la cuenta. Activo = tiene algún alojamiento modificado durante el mes en curso."
        >
          {cohorts.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Sin cohortes todavía.</p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm">
              {cohorts.map((cohort) => (
                <li key={cohort.cohort} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-muted">{cohort.cohort}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-brand-soft">
                    <span
                      className="block h-full bg-brand"
                      style={{ width: `${cohort.size ? (cohort.active / cohort.size) * 100 : 0}%` }}
                    />
                  </span>
                  <span className="w-24 shrink-0 text-right text-xs text-muted">
                    {cohort.active}/{cohort.size} · {cohort.pct}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="¿De dónde vienen?"
          lead={`${hosts.total} anfitriones, repartidos por el sitio desde el que llegaron al formulario.`}
          source="La cabecera «referer» del navegador en el momento exacto del registro, reducida a una palabra. No se guarda ningún historial de navegación."
        >
          <Bars
            items={hosts.sources.map((source) => ({
              label: source.value,
              count: source.count,
              total: hosts.total,
            }))}
          />
          <p className="mt-3 text-xs text-muted">
            La categoría <strong>guía</strong> es la interesante: alguien que leyó un manual de
            bienvenida y volvió para hacer el suyo. Es el bucle de crecimiento propio del producto y
            lo único que podemos medir de él sin inventarnos un coeficiente viral.
          </p>
        </Panel>
      </div>

      {/* Platform ---------------------------------------------------- */}
      <Panel
        title="Plataforma"
        lead="Lo que ocupa y lo que mueve."
        source="Tamaño real de la base de datos y recuento de filas. Latencia y disponibilidad se miden en la plataforma de despliegue."
      >
        <dl className="mt-3 grid gap-3 sm:grid-cols-4">
          <MiniFigure
            value={platform.databaseMB === null ? "—" : `${platform.databaseMB} MB`}
            label="base de datos"
          />
          <MiniFigure value={String(content.guides)} label="guías (idiomas incl.)" />
          <MiniFigure value={String(content.places)} label="sitios" />
          <MiniFigure value={String(platform.metricRows)} label="series de métricas" />
        </dl>
        <p className="mt-3 flex items-start gap-2 text-xs text-muted">
          <IconInfo size={14} />
          Latencia, disponibilidad y tasa de error se miden donde ocurren —en la plataforma de
          despliegue—, no reimplementados aquí a medias.
        </p>
      </Panel>

      {/* What we deliberately do not measure ------------------------- */}
      <section className="mt-6 rounded-card border border-alert-soft bg-alert-soft/40 p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <IconAlert size={18} /> Lo que este panel no mide, y por qué
        </h2>
        <p className="mt-1 text-sm">
          Un número inventado en un panel de negocio es peor que un hueco: alguien acaba planificando
          con él. Esto es lo que falta, qué haría falta para tenerlo y qué cuesta.
        </p>
        <dl className="mt-4 space-y-3 text-sm">
          <Missing
            title="MRR, ARR, ARPU, LTV, churn de ingresos, impago"
            need="Una pasarela de pago (Stripe) y un modelo de planes."
            note="Hoy no hay cobro en el producto. Con Stripe, estas seis salen de sus webhooks en un par de días y no hay que instrumentar nada más."
          />
          <Missing
            title="CAC, canales de pago, tasa de rebote de la landing"
            need="Inversión publicitaria y una herramienta de analítica web."
            note="Lo que sí tenemos es el referente en el registro, arriba. Un CAC sin gasto declarado sería una división por cero disfrazada."
          />
          <Missing
            title="NPS, CSAT, tickets, tiempo de primera respuesta"
            need="Una encuesta a anfitriones y un sistema de soporte."
            note="El NPS es la más barata de todas: una pregunta de 0 a 10 en el panel del anfitrión. Es el siguiente paso que recomiendo."
          />
          <Missing
            title="Coeficiente viral K, referidos"
            need="Un programa de invitación con código propio."
            note="El recuerdo que el huésped publica es una imagen, no un enlace: no hay nada que atribuir. La aproximación honesta es el origen «guía»."
          />
          <Missing
            title="Tiempo medio de lectura, tasa de finalización de la guía"
            need="Nada: son medibles y he decidido no mostrarlas."
            note="Una guía no es un curso. Quien encuentra el WiFi en ocho segundos es el mejor caso posible y saldría como el peor dato del mes."
          />
        </dl>
        <p className="mt-4 flex items-start gap-2 text-xs">
          <IconCheck size={14} />
          Cada una de estas está a una integración de distancia, y ninguna necesita rehacer lo
          construido: el modelo de datos ya tiene dónde colgarlas.
        </p>
      </section>
    </main>
  );
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} días`;
}

function Panel({
  title,
  lead,
  source,
  children,
}: {
  title: string;
  lead: string;
  /* Where the number comes from, in words somebody who has never seen the
     database can check. A dashboard whose provenance is a mystery gets
     believed when it is wrong and ignored when it is right. */
  source?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-card border border-line bg-white p-6">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{lead}</p>
      {children}
      {source ? (
        <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
          <span className="font-medium text-ink">De dónde sale: </span>
          {source}
        </p>
      ) : null}
    </section>
  );
}

/* "+3 frente a 1 el mes pasado" beats "+200%", and when the previous month was
   zero there is no percentage to give — saying so is more useful than printing
   an infinity. */
function changeNote(trend: { current: number; previous: number; changePct: number | null }): string {
  if (trend.previous === 0 && trend.current === 0) return "sin altas en dos meses";
  if (trend.previous === 0) return `las primeras: 0 el mes pasado`;
  const sign = trend.changePct !== null && trend.changePct >= 0 ? "+" : "";
  return `${sign}${trend.changePct}% · ${trend.previous} el mes pasado`;
}

function medianNote(current: number | null, previous: number | null): string {
  if (current === null && previous === null) return "sin altas recientes";
  if (current === null) return `${formatHours(previous ?? 0)} el mes pasado`;
  if (previous === null) return `${formatHours(current)} en las altas de este mes`;
  const faster = current < previous;
  return `${formatHours(current)} este mes · ${faster ? "más rápido" : "más lento"} que ${formatHours(previous)}`;
}

/* Six bars, the last one highlighted. Not a chart library for four series of
   six points: the dependency would weigh more than the data. */
function Spark({ title, data }: { title: string; data: { month: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((point) => point.value));
  const total = data.reduce((sum, point) => sum + point.value, 0);
  return (
    <div className="rounded-xl bg-canvas p-3">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
        <p className="text-xs text-muted">{total} en 6 meses</p>
      </div>
      <div className="mt-3 flex h-16 items-end gap-1.5">
        {data.map((point, index) => (
          <span key={point.month} className="flex flex-1 flex-col items-center gap-1">
            <span
              className={`w-full rounded-t ${index === data.length - 1 ? "bg-brand" : "bg-brand-line"}`}
              style={{ height: `${Math.max(3, (point.value / max) * 56)}px` }}
              title={`${point.month}: ${point.value}`}
            />
            <span className="text-[9px] text-muted">{point.month.slice(5)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Figure({ value, label, note }: { value: string; label: string; note?: string }) {
  return (
    <div className="rounded-card border border-line bg-white px-4 py-3">
      <p className="font-display text-2xl font-semibold text-brand-deep">{value}</p>
      <p className="text-xs text-muted">{label}</p>
      {note ? <p className="text-[11px] text-muted">{note}</p> : null}
    </div>
  );
}

function MiniFigure({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-canvas px-3 py-2">
      <dt className="font-display text-xl font-semibold text-brand-deep">{value}</dt>
      <dd className="text-[11px] text-muted">{label}</dd>
    </div>
  );
}

function Bars({ items }: { items: { label: string; count: number; total: number }[] }) {
  return (
    <ul className="mt-3 space-y-1.5 text-sm">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate">{item.label}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-brand-soft">
            <span
              className="block h-full bg-brand"
              style={{ width: `${item.total ? (item.count / item.total) * 100 : 0}%` }}
            />
          </span>
          <span className="w-8 shrink-0 text-right text-xs text-muted">{item.count}</span>
        </li>
      ))}
    </ul>
  );
}

function Missing({ title, need, note }: { title: string; need: string; note: string }) {
  return (
    <div className="rounded-xl bg-white p-3">
      <dt className="font-medium">{title}</dt>
      <dd className="mt-0.5 text-xs text-muted">
        <span className="font-medium text-ink">Necesita:</span> {need}
      </dd>
      <dd className="mt-0.5 text-xs text-muted">{note}</dd>
    </div>
  );
}
