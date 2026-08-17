import { getSql, hasDatabase } from "./db";
import { getRepo } from "./repo";

/* ---------------------------------------------------------------------------
   The business panel: what this product can honestly report about itself.

   The temptation with an admin dashboard is to show every metric a SaaS is
   supposed to have. Half of the usual list — MRR, ARPU, LTV, churn de ingresos,
   CAC, NPS, tickets — cannot be computed here, because there is no billing
   provider, no ad spend and no helpdesk in this system. Printing a number for
   any of them would mean inventing it, and an invented figure in a business
   panel is worse than a missing one: somebody eventually makes a decision on
   it.

   So this file computes what the architecture actually knows, and the panel
   states plainly what it does not and what each missing metric would need. The
   good news is that the honest set is the interesting set — activation, time to
   value, where hosts drop out of the editor, which sections of the product are
   dead weight — because those are the ones that change what gets built next.

   Two constraints inherited from the rest of the app and deliberately kept:
   guests are never identified, and every guest-side figure is a floor rather
   than a total, because the guide works offline.
--------------------------------------------------------------------------- */

export type Funnel = {
  label: string;
  count: number;
  hint: string;
  /* Two denominators, because they answer different questions: how many of the
     previous step made it here (where the leak is) and how many of everyone who
     ever signed up made it here (how far the product carries a cohort). */
  ofPrevious: number | null;
  ofTop: number;
};

export type Series = { month: string; value: number }[];

/* A level with nothing to compare it to is trivia. Every headline figure in
   this panel carries its own denominator or its own previous period, and says
   which. */
export type Trend = {
  current: number;
  previous: number;
  /* Percentage change, or null when the previous period was zero — dividing by
     zero and printing "+∞%" is how dashboards lie. */
  changePct: number | null;
};

export type Verdict = {
  tone: "bien" | "atencion" | "sin-datos";
  headline: string;
  detail: string;
};

export type AdminStats = {
  /* Small samples produce confident nonsense. Every ratio in this panel is
     computed the same way regardless, but the panel is told when the numbers
     are too thin to lean on, and says so instead of pretending. */
  sample: { hosts: number; properties: number; bookings: number; thin: boolean };
  verdict: Verdict;
  hosts: {
    total: number;
    newHosts: Trend;
    sources: { value: string; count: number }[];
    series: { hosts: Series; properties: Series; bookings: Series; opens: Series };
  };
  /* The only funnel that matters for this product: an account is worth nothing
     until a guest has opened a guide. */
  funnel: Funnel[];
  activation: {
    /* Median rather than mean: one host who signs up and finishes six months
       later would drag an average into meaninglessness. */
    medianHoursToFirstGuide: number | null;
    /* The same median for hosts who registered this month against last month:
       the level says how long onboarding takes, the comparison says whether it
       is getting better. */
    medianThisMonth: number | null;
    medianLastMonth: number | null;
    publishedRate: number;
    /* Of every host who ever registered, how many reached a guide a guest
       opened. The single number that says whether the product works. */
    endToEndRate: number;
  };
  /* Where hosts stop inside the editor. This is the metric the visitedSteps
     column was worth adding for, and it points straight at the step to fix. */
  wizard: {
    step: number;
    label: string;
    reached: number;
    /* Share of properties that got this far, and the drop from the step before
       it — the leak, rather than the level. */
    pct: number;
    dropFromPrevious: number;
  }[];
  worstStep: { step: number; label: string; dropFromPrevious: number } | null;
  content: {
    properties: number;
    published: number;
    bookings: number;
    guides: number;
    places: number;
    avgPropertiesPerHost: number;
    sectionsUsed: { label: string; count: number }[];
    themes: { value: string; count: number }[];
  };
  guests: {
    opensPerPublishedGuide: number;
    opens: number;
    unique: number;
    bookingsWithGuide: number;
    bookingsTotal: number;
    helpfulYes: number;
    helpfulNo: number;
    misses: number;
    keepsakes: number;
    languages: { value: string; count: number }[];
  };
  /* Retention by sign-up cohort. Active means the host touched a property that
     month — the cheapest honest definition available without sessions. */
  cohorts: { cohort: string; size: number; active: number; pct: number }[];
  platform: {
    databaseMB: number | null;
    metricRows: number;
  };
};

const STEP_LABELS = [
  "Datos del alojamiento",
  "Entrada y WiFi",
  "Cómo funciona la casa",
  "Normas",
  "Recomendaciones",
  "Moverse y emergencias",
  "Salida, preguntas y publicación",
];

/* Six months of buckets, always present even when empty: a series with holes
   in it invites the reader to join the dots wrongly. */
function monthsBack(count: number, now: Date): string[] {
  return Array.from({ length: count }, (_, index) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - index), 1))
      .toISOString()
      .slice(0, 7),
  );
}

function trend(current: number, previous: number): Trend {
  return {
    current,
    previous,
    /* Null rather than infinity: going from zero to one is not "+100%", it is
       the first one, and the panel says so in words. */
    changePct: previous === 0 ? null : Math.round(((current - previous) / previous) * 100),
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export async function adminStats(): Promise<AdminStats> {
  if (!hasDatabase) return demoStats();

  const sql = getSql();

  const [hostRows, propertyRows, stayRows, metricRows, guideRows, placeRows] = await Promise.all([
    sql<{ id: string; source: string; created_at: Date }[]>`
      select id, source, created_at from hosts`,
    sql<{
      id: string;
      host_id: string;
      published: boolean;
      visited_steps: number[];
      hidden_sections: string[];
      theme: { style?: string; palette?: string };
      created_at: Date;
      updated_at: Date;
    }[]>`select id, host_id, published, visited_steps, hidden_sections, theme,
             created_at, updated_at from properties`,
    sql<{ id: string; opened_at: Date | null; revoked: boolean; created_at: Date }[]>`
      select id, opened_at, revoked, created_at from stays`,
    sql<{ kind: string; value: string; count: number; month: string }[]>`
      select kind, value, sum(count)::int as count, to_char(day, 'YYYY-MM') as month
      from metrics group by kind, value, to_char(day, 'YYYY-MM')`,
    sql<{ n: number }[]>`select count(*)::int as n from guides`,
    sql<{ n: number }[]>`select count(*)::int as n from places`,
  ]);

  let databaseMB: number | null = null;
  try {
    const [row] = await sql<{ mb: number }[]>`
      select round(pg_database_size(current_database()) / 1048576.0, 1)::float8 as mb`;
    databaseMB = row?.mb ?? null;
  } catch {
    /* the panel is still useful without it */
  }

  return build({
    hosts: hostRows.map((row) => ({
      id: row.id,
      source: row.source ?? "directo",
      createdAt: row.created_at ? new Date(row.created_at) : null,
    })),
    properties: propertyRows.map((row) => ({
      id: row.id,
      hostId: row.host_id,
      published: row.published,
      visitedSteps: row.visited_steps ?? [],
      hiddenSections: row.hidden_sections ?? [],
      theme: row.theme ?? {},
      createdAt: row.created_at ? new Date(row.created_at) : null,
      updatedAt: row.updated_at ? new Date(row.updated_at) : null,
    })),
    stays: stayRows.map((row) => ({
      openedAt: row.opened_at ? new Date(row.opened_at) : null,
      revoked: row.revoked,
      createdAt: row.created_at ? new Date(row.created_at) : null,
    })),
    metrics: metricRows.map((row) => ({
      kind: row.kind,
      value: row.value,
      count: row.count,
      month: row.month,
    })),
    guides: guideRows[0]?.n ?? 0,
    places: placeRows[0]?.n ?? 0,
    databaseMB,
  });
}

/* Demo mode reads the same shapes out of the in-memory repository, so the panel
   is explorable without a database — the same promise the rest of the app
   makes. */
async function demoStats(): Promise<AdminStats> {
  const repo = getRepo();
  const properties = await repo.listProperties("host_belen");
  const stays = (await Promise.all(properties.map((p) => repo.listStays(p.id)))).flat();
  const metrics = (await Promise.all(properties.map((p) => repo.metrics(p.id)))).flat();
  const guides = (await Promise.all(properties.map((p) => repo.listGuides(p.id)))).flat();
  const places = (await Promise.all(properties.map((p) => repo.listPlaces(p.id)))).flat();

  return build({
    hosts: [{ id: "host_belen", source: "directo", createdAt: new Date() }],
    properties: properties.map((p) => ({
      id: p.id,
      hostId: p.hostId,
      published: p.published,
      visitedSteps: p.visitedSteps,
      hiddenSections: p.hiddenSections,
      theme: p.theme,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    stays: stays.map((s) => ({
      openedAt: s.openedAt ? new Date(s.openedAt) : null,
      revoked: s.revoked,
      createdAt: new Date(),
    })),
    metrics: metrics.map((m) => ({
      kind: m.kind,
      value: m.value,
      count: m.count,
      month: (m.day ?? new Date().toISOString()).slice(0, 7),
    })),
    guides: guides.length,
    places: places.length,
    databaseMB: null,
  });
}

type Input = {
  hosts: { id: string; source: string; createdAt: Date | null }[];
  properties: {
    id: string;
    hostId: string;
    published: boolean;
    visitedSteps: number[];
    hiddenSections: string[];
    theme: { style?: string; palette?: string };
    createdAt: Date | null;
    updatedAt: Date | null;
  }[];
  stays: { openedAt: Date | null; revoked: boolean; createdAt: Date | null }[];
  metrics: { kind: string; value: string; count: number; month: string }[];
  guides: number;
  places: number;
  databaseMB: number | null;
};

function build(input: Input): AdminStats {
  const { hosts, properties, stays, metrics } = input;
  const now = new Date();
  const monthOf = (date: Date) => date.toISOString().slice(0, 7);
  const thisMonth = monthOf(now);
  const lastMonth = monthOf(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));

  const sum = (kind: string) =>
    metrics.filter((m) => m.kind === kind).reduce((total, m) => total + m.count, 0);
  const top = (kind: string, limit = 5) =>
    metrics
      .filter((m) => m.kind === kind)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map((m) => ({ value: m.value, count: m.count }));

  const hostsWithProperty = new Set(properties.map((p) => p.hostId));
  const withContent = properties.filter((p) => p.visitedSteps.length >= 3);
  const published = properties.filter((p) => p.published);
  const liveStays = stays.filter((s) => !s.revoked);
  const opened = liveStays.filter((s) => s.openedAt);

  /* Hours from sign-up to the host's first property. The single best proxy for
     "how quickly does this product pay off", and the number to attack if it
     grows. */
  const firstProperty = new Map<string, Date>();
  properties.forEach((property) => {
    if (!property.createdAt) return;
    const current = firstProperty.get(property.hostId);
    if (!current || property.createdAt < current) firstProperty.set(property.hostId, property.createdAt);
  });
  const hoursToFirst = hosts
    .map((host) => {
      const first = firstProperty.get(host.id);
      if (!host.createdAt || !first) return null;
      return (first.getTime() - host.createdAt.getTime()) / 3600000;
    })
    .filter((value): value is number => value !== null && value >= 0);

  const sources = Object.entries(
    hosts.reduce<Record<string, number>>((acc, host) => {
      acc[host.source] = (acc[host.source] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);

  const cohorts = Object.entries(
    hosts.reduce<Record<string, { size: number; active: number }>>((acc, host) => {
      if (!host.createdAt) return acc;
      const key = monthOf(host.createdAt);
      acc[key] = acc[key] ?? { size: 0, active: 0 };
      acc[key].size += 1;
      const touched = properties.some(
        (p) => p.hostId === host.id && p.updatedAt && monthOf(p.updatedAt) === thisMonth,
      );
      if (touched) acc[key].active += 1;
      return acc;
    }, {}),
  )
    .map(([cohort, value]) => ({
      cohort,
      ...value,
      pct: value.size ? Math.round((value.active / value.size) * 100) : 0,
    }))
    .sort((a, b) => b.cohort.localeCompare(a.cohort))
    .slice(0, 6);

  /* Which optional sections hosts actually keep. A section switched off by most
     of them is a section to rethink, not a section to promote. */
  const SECTIONS = [
    ["entry", "Entrada"],
    ["wifi", "WiFi"],
    ["house", "La casa"],
    ["rules", "Normas"],
    ["places", "Recomendaciones"],
    ["transport", "Moverte"],
    ["emergency", "Emergencias"],
    ["checkout", "Salida"],
    ["faq", "Preguntas"],
  ] as const;

  const months = monthsBack(6, now);
  const countIn = (dates: (Date | null)[], month: string) =>
    dates.filter((date) => date && monthOf(date) === month).length;

  const series = {
    hosts: months.map((month) => ({
      month,
      value: countIn(hosts.map((h) => h.createdAt), month),
    })),
    properties: months.map((month) => ({
      month,
      value: countIn(properties.map((p) => p.createdAt), month),
    })),
    bookings: months.map((month) => ({
      month,
      value: countIn(stays.map((s) => s.createdAt), month),
    })),
    opens: months.map((month) => ({
      month,
      value: metrics
        .filter((m) => m.kind === "open" && m.month === month)
        .reduce((total, m) => total + m.count, 0),
    })),
  };

  const newHosts = trend(
    hosts.filter((h) => h.createdAt && monthOf(h.createdAt) === thisMonth).length,
    hosts.filter((h) => h.createdAt && monthOf(h.createdAt) === lastMonth).length,
  );

  const medianFor = (month: string) =>
    median(
      hosts
        .filter((host) => host.createdAt && monthOf(host.createdAt) === month)
        .map((host) => {
          const first = firstProperty.get(host.id);
          if (!host.createdAt || !first) return null;
          return (first.getTime() - host.createdAt.getTime()) / 3600000;
        })
        .filter((value): value is number => value !== null && value >= 0),
    );

  const funnelRaw: { label: string; count: number; hint: string }[] = [
    { label: "Se registran", count: hosts.length, hint: "cuentas creadas" },
    { label: "Crean un alojamiento", count: hostsWithProperty.size, hint: "el primer paso real" },
    { label: "Rellenan la guía", count: withContent.length, hint: "al menos tres secciones abiertas" },
    { label: "La publican", count: published.length, hint: "visible para un huésped" },
    { label: "Crean una reserva", count: liveStays.length, hint: "enlace con fechas" },
    { label: "Un huésped la abre", count: opened.length, hint: "el producto ha servido" },
  ];
  const funnelTop = funnelRaw[0].count || 1;
  const funnel: Funnel[] = funnelRaw.map((stage, index) => ({
    ...stage,
    ofTop: Math.round((stage.count / funnelTop) * 100),
    ofPrevious:
      index === 0
        ? null
        : funnelRaw[index - 1].count === 0
          ? null
          : Math.round((stage.count / funnelRaw[index - 1].count) * 100),
  }));

  const wizard = STEP_LABELS.map((label, index) => {
    const reached = properties.filter((p) => p.visitedSteps.includes(index + 1)).length;
    const before =
      index === 0
        ? properties.length
        : properties.filter((p) => p.visitedSteps.includes(index)).length;
    return {
      step: index + 1,
      label,
      reached,
      pct: properties.length ? Math.round((reached / properties.length) * 100) : 0,
      dropFromPrevious: before === 0 ? 0 : Math.round(((before - reached) / before) * 100),
    };
  });
  const worstStep =
    [...wizard].sort((a, b) => b.dropFromPrevious - a.dropFromPrevious)[0] ?? null;

  const endToEndRate = hosts.length ? Math.round((opened.length / hosts.length) * 100) : 0;
  const thin = hosts.length < 10 || properties.length < 10;

  /* One sentence at the top, derived rather than decorative. Growth alone is
     not health: an account that never reaches an opened guide is a number, not
     a customer, so the verdict weighs activation before volume — and refuses to
     pronounce at all on a sample this small. */
  const verdict: Verdict = thin
    ? {
        tone: "sin-datos",
        headline: "Muestra demasiado pequeña para concluir nada",
        detail: `Con ${hosts.length} anfitriones y ${properties.length} alojamientos, cualquier porcentaje se mueve entero al añadir un caso. Los números están abajo; las conclusiones, cuando haya volumen.`,
      }
    : endToEndRate >= 40 && (newHosts.changePct ?? 0) >= 0
      ? {
          tone: "bien",
          headline: "El producto convierte y no pierde ritmo",
          detail: `${endToEndRate} de cada 100 registros terminan con un huésped abriendo una guía, y las altas de este mes no caen frente al anterior.`,
        }
      : {
          tone: "atencion",
          headline:
            endToEndRate < 40
              ? "Entran cuentas, pero pocas llegan al huésped"
              : "Convierte bien, pero entran menos cuentas",
          detail:
            endToEndRate < 40
              ? `Solo ${endToEndRate} de cada 100 registros terminan con una guía abierta por un huésped. El escalón que más pierde está en el embudo de abajo.`
              : `La conversión aguanta (${endToEndRate}%), pero las altas bajan un ${Math.abs(newHosts.changePct ?? 0)}% frente al mes pasado.`,
        };

  return {
    sample: {
      hosts: hosts.length,
      properties: properties.length,
      bookings: stays.length,
      thin,
    },
    verdict,
    hosts: {
      total: hosts.length,
      newHosts,
      sources,
      series,
    },
    funnel,
    activation: {
      medianHoursToFirstGuide: median(hoursToFirst),
      medianThisMonth: medianFor(thisMonth),
      medianLastMonth: medianFor(lastMonth),
      publishedRate: properties.length
        ? Math.round((published.length / properties.length) * 100)
        : 0,
      endToEndRate,
    },
    wizard,
    worstStep,
    content: {
      properties: properties.length,
      published: published.length,
      bookings: stays.length,
      guides: input.guides,
      places: input.places,
      avgPropertiesPerHost: hosts.length
        ? Math.round((properties.length / hosts.length) * 10) / 10
        : 0,
      sectionsUsed: SECTIONS.map(([id, label]) => ({
        label,
        count: properties.filter((p) => !p.hiddenSections.includes(id)).length,
      })),
      themes: Object.entries(
        properties.reduce<Record<string, number>>((acc, property) => {
          const key = `${property.theme?.palette ?? "retorika"} · ${property.theme?.style ?? "sereno"}`;
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {}),
      )
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    },
    guests: {
      opensPerPublishedGuide: published.length
        ? Math.round((sum("open") / published.length) * 10) / 10
        : 0,
      opens: sum("open"),
      unique: sum("unique"),
      bookingsWithGuide: opened.length,
      bookingsTotal: liveStays.length,
      helpfulYes: metrics
        .filter((m) => m.kind === "helpful" && m.value.endsWith(":si"))
        .reduce((total, m) => total + m.count, 0),
      helpfulNo: metrics
        .filter((m) => m.kind === "helpful" && m.value.endsWith(":no"))
        .reduce((total, m) => total + m.count, 0),
      misses: sum("search_miss"),
      keepsakes: sum("keepsake"),
      languages: top("language", 4),
    },
    cohorts,
    platform: {
      databaseMB: input.databaseMB,
      metricRows: metrics.length,
    },
  };
}
