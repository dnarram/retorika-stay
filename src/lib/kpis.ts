import type { MetricKind, Stay } from "./schema";

/* ---------------------------------------------------------------------------
   From counters to answers.

   The database stores rows of (property, day, kind, value, count). That is the
   right shape to write and the wrong shape to read: no host wants a table of
   event names. This module turns those rows into the four questions a host
   actually asks about their guide, in the order they matter:

     1. ¿Llega?        Is anyone opening it at all
     2. ¿Sirve?        Does it answer what they came for
     3. ¿Ahorra?       Is it saving me messages
     4. ¿Se comparte?  Is it doing anything for me beyond the stay

   Two honesty rules run through all of it. Every figure is a FLOOR, never a
   total: the guide works offline, so a guest who reads it on a plane sends
   nothing. And nothing here is per person — the one exception, whether a
   booking was ever opened, stops at a date because the host already knows who
   was staying and does not need a diary of their evening.
--------------------------------------------------------------------------- */

export type MetricRow = { kind: MetricKind; value: string; count: number; day?: string };

export type Kpis = {
  reach: {
    opens: number;
    unique: number;
    bookingsWithGuide: number;
    bookingsTotal: number;
    languages: { value: string; count: number }[];
    devices: { value: string; count: number }[];
    /* Bookings whose guest never opened the guide and whose stay has not ended:
       the only list here that is a to-do rather than a statistic. */
    silentBookings: { id: string; guestName: string | null; arrival: string; slug: string }[];
  };
  usefulness: {
    sections: { value: string; count: number }[];
    /* Section ratings and the rating of the guide as a whole were being added
       together, which made both meaningless: "12 sí" could be twelve people
       liking the wifi section or twelve people liking the guide, and the
       whole-guide "no" — the most serious signal in the product — was buried
       among section noise. They are two different questions and are now two
       different numbers. */
    sectionYes: number;
    sectionNo: { section: string; count: number }[];
    /* The total was missing, and without it the panel could only print the
       breakdown — which read as a continuation of the "sí" figure. */
    sectionNoTotal: number;
    guideYes: number;
    guideNo: number;
    misses: { value: string; count: number }[];
  };
  workSaved: {
    calls: number;
    reveals: number;
    directions: { value: string; count: number }[];
    /* Friction is not "questions avoided" — we cannot see WhatsApp — but it is
       the closest honest proxy: every call, dead-end search and "this did not
       help" is a moment the guide failed to answer something. Shown as a trend
       because the absolute number means nothing on its own. */
    friction: { thisMonth: number; lastMonth: number };
  };
  sharing: {
    keepsakes: number;
    prints: number;
    shares: number;
  };
};

/* The panel was printing our internal ids at the host: "rules (2)", "wifi (5)".
   A host has never seen those words and should not have to learn them. */
export const SECTION_LABEL: Record<string, string> = {
  arrival: "Cómo llegar",
  entry: "Entrada",
  wifi: "WiFi",
  house: "La casa",
  rules: "Normas",
  places: "Recomendaciones",
  transport: "Moverte",
  emergency: "Emergencias",
  checkout: "Salida",
  faq: "Preguntas",
  guide: "La guía entera",
};

export const sectionName = (id: string): string => SECTION_LABEL[id] ?? id;

const sum = (rows: MetricRow[]) => rows.reduce((total, row) => total + row.count, 0);
const byKind = (rows: MetricRow[], kind: MetricKind) => rows.filter((row) => row.kind === kind);

const ranked = (rows: MetricRow[], kind: MetricKind, limit = 6) =>
  byKind(rows, kind)
    /* Rows arrive split by day; a host wants the total per thing. */
    .reduce<{ value: string; count: number }[]>((list, row) => {
      const found = list.find((item) => item.value === row.value);
      if (found) found.count += row.count;
      else list.push({ value: row.value, count: row.count });
      return list;
    }, [])
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

function monthKey(offset = 0, now = new Date()): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
  return date.toISOString().slice(0, 7);
}

export function computeKpis(rows: MetricRow[], stays: Stay[], now = new Date()): Kpis {
  const today = now.toISOString().slice(0, 10);
  const relevant = stays.filter((stay) => !stay.revoked);

  const frictionKinds: MetricKind[] = ["call", "search_miss"];
  const frictionIn = (month: string) =>
    rows
      .filter((row) => (row.day ?? "").startsWith(month))
      .filter(
        (row) =>
          frictionKinds.includes(row.kind) ||
          (row.kind === "helpful" && row.value.endsWith(":no")),
      )
      .reduce((total, row) => total + row.count, 0);

  return {
    reach: {
      opens: sum(byKind(rows, "open")),
      unique: sum(byKind(rows, "unique")),
      bookingsWithGuide: relevant.filter((stay) => stay.openedAt).length,
      bookingsTotal: relevant.length,
      languages: ranked(rows, "language", 4),
      devices: ranked(rows, "device", 3),
      silentBookings: relevant
        .filter((stay) => !stay.openedAt && stay.departure >= today)
        .map((stay) => ({
          id: stay.id,
          guestName: stay.guestName,
          arrival: stay.arrival,
          slug: stay.slug,
        })),
    },
    usefulness: {
      sections: ranked(rows, "section", 6),
      sectionYes: byKind(rows, "helpful")
        .filter((row) => row.value.endsWith(":si") && !row.value.startsWith("guide:"))
        .reduce((total, row) => total + row.count, 0),
      sectionNo: ranked(
        byKind(rows, "helpful").filter(
          (row) => row.value.endsWith(":no") && !row.value.startsWith("guide:"),
        ),
        "helpful",
        5,
      ).map((row) => ({ section: row.value.split(":")[0], count: row.count })),
      sectionNoTotal: byKind(rows, "helpful")
        .filter((row) => row.value.endsWith(":no") && !row.value.startsWith("guide:"))
        .reduce((total, row) => total + row.count, 0),
      guideYes: byKind(rows, "helpful")
        .filter((row) => row.value === "guide:si")
        .reduce((total, row) => total + row.count, 0),
      guideNo: byKind(rows, "helpful")
        .filter((row) => row.value === "guide:no")
        .reduce((total, row) => total + row.count, 0),
      misses: ranked(rows, "search_miss", 6),
    },
    workSaved: {
      calls: sum(byKind(rows, "call")),
      reveals: sum(byKind(rows, "reveal")),
      directions: ranked(rows, "directions", 6),
      friction: { thisMonth: frictionIn(monthKey(0, now)), lastMonth: frictionIn(monthKey(1, now)) },
    },
    sharing: {
      keepsakes: sum(byKind(rows, "keepsake")),
      prints: sum(byKind(rows, "print")),
      shares: sum(byKind(rows, "share")),
    },
  };
}

/* The one-line summary for the property card. Deliberately not a score out of
   a hundred: a made-up index invites a host to optimise a number instead of
   fixing a guide, and the three figures below are each directly actionable. */
export function headline(kpis: Kpis): {
  openRate: number | null;
  opens: number;
  attention: number;
} {
  const { bookingsWithGuide, bookingsTotal } = kpis.reach;
  return {
    openRate: bookingsTotal > 0 ? Math.round((bookingsWithGuide / bookingsTotal) * 100) : null,
    opens: kpis.reach.opens,
    /* Everything worth a host's attention this week, counted once. */
    attention:
      kpis.usefulness.misses.length +
      kpis.usefulness.sectionNo.length +
      (kpis.usefulness.guideNo > 0 ? 1 : 0) +
      kpis.reach.silentBookings.length,
  };
}
