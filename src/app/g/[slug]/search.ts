import type { Dict } from "@/i18n/dictionaries";
import type { Guide, Locale, Place } from "@/lib/schema";

/* ---------------------------------------------------------------------------
   Searching the whole guide, which is what the box always claimed to do.

   The first version looked only at the name and the personal note of each
   recommendation, so "restaurantes" found nothing even with four restaurants
   on the page — the category label was never in the haystack — and neither did
   anything written about the washing machine, the rules or the bins. A search
   box that promises the guide and delivers one section is worse than no search
   box: the guest concludes the answer is not there and stops looking.

   Two details that decide whether this feels intelligent or broken:

     · Accents and case are stripped before comparing. A guest typing "tapas"
       on an English keyboard should find "Tapás", and someone typing in a
       hurry should not be punished for it.
     · Results carry the section they came from, so a hit is a place to go
       rather than a highlighted word floating on its own.
--------------------------------------------------------------------------- */

export type SectionId =
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

export type Hit = { section: SectionId; title: string; text: string };

/* Lower case with the diacritics removed: "Baños árabes" and "banos arabes"
   have to be the same string by the time they are compared. */
export const normalise = (value: string): string =>
  value
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export function buildIndex(
  guide: Guide,
  places: Place[],
  locale: Locale,
  fallback: Locale,
  t: Dict,
): Hit[] {
  const hits: Hit[] = [];
  const push = (section: SectionId, title: string, text: string) => {
    if (text.trim()) hits.push({ section, title, text });
  };

  push("arrival", t.sections.arrival, guide.parking);
  guide.arrivalSteps.forEach((step) => push("entry", t.sections.entry, step));
  push("wifi", t.sections.wifi, guide.wifiNote);
  guide.house.forEach((item) => push("house", item.title, item.body));
  guide.rules.forEach((rule) => push("rules", t.sections.rules, rule.text));
  guide.transport.forEach((item) => push("transport", item.title, item.body));
  push("emergency", t.sections.emergency, guide.emergencyNote);
  guide.checkoutSteps.forEach((step) => push("checkout", t.sections.checkout, step));
  guide.faqs.forEach((faq) => push("faq", faq.q, faq.a));

  places.forEach((place) => {
    const note = place.notes[locale] ?? place.notes[fallback];
    /* The category label goes into the text on purpose: "restaurantes" is what
       a guest types, and it is the word the guide shows them. */
    push(
      "places",
      place.name,
      `${t.categories[place.category]} ${note?.tagline ?? ""} ${note?.note ?? ""}`,
    );
  });

  return hits;
}

export function search(index: Hit[], query: string, limit = 12): Hit[] {
  const needle = normalise(query.trim());
  if (needle.length < 2) return [];
  return index
    .filter((hit) => normalise(`${hit.title} ${hit.text}`).includes(needle))
    .slice(0, limit);
}

/* A window of text around the match, so the result reads as an answer rather
   than as a title the guest has to open to evaluate. */
export function snippet(hit: Hit, query: string, width = 90): string {
  const text = `${hit.text}`.trim();
  const at = normalise(text).indexOf(normalise(query.trim()));
  if (at < 0) return text.slice(0, width) + (text.length > width ? "…" : "");
  const start = Math.max(0, at - Math.floor(width / 3));
  const end = Math.min(text.length, start + width);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

/* Splits a string around every occurrence of the query so the caller can wrap
   the matches without dangerous HTML injection. */
export function parts(text: string, query: string): { text: string; match: boolean }[] {
  const needle = normalise(query.trim());
  if (!needle) return [{ text, match: false }];
  const haystack = normalise(text);
  const out: { text: string; match: boolean }[] = [];
  let cursor = 0;
  let found = haystack.indexOf(needle, cursor);
  while (found >= 0) {
    if (found > cursor) out.push({ text: text.slice(cursor, found), match: false });
    out.push({ text: text.slice(found, found + needle.length), match: true });
    cursor = found + needle.length;
    found = haystack.indexOf(needle, cursor);
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), match: false });
  return out;
}
