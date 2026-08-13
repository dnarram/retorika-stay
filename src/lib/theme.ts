import { z } from "zod";

/* ---------------------------------------------------------------------------
   Look and feel for the guest guide.

   The host is not a designer and does not want to become one this afternoon.
   Free colour pickers and font menus would let them build something ugly and
   unreadable in about ninety seconds — dark grey on mid grey, a display face at
   body size — and then blame the app for it. So this is a set of finished
   directions rather than a box of parts: four decisions, each between a handful
   of options that were composed to work together, and every combination of them
   is a guide you would be happy to hand a guest.

   Two rules the host cannot break, on purpose:

     · The semantic colours do not change. Fuchsia means urgency and green means
       confirmation in every palette, because a guest reading the emergency
       section at 2am should not have to relearn what red means because the
       host liked the olive theme.
     · Contrast is fixed at composition time. Every ink here carries white text
       at AA or better, and every canvas carries its own body colour. There is
       no combination that produces unreadable text.

   The palettes are named after the materials of the places these flats are in —
   whitewash, Seville's albero sand, olive groves — because that is the world
   the product lives in, and a host recognises their own house in a word faster
   than in a hex code.
--------------------------------------------------------------------------- */

export type Palette = {
  id: string;
  name: string;
  /* Header and headings: always dark enough for white text. */
  ink: string;
  /* Actions: buttons, active states, links. */
  brand: string;
  brandDeep: string;
  /* Tinted background for callouts, and the hairline for card borders. */
  soft: string;
  line: string;
  /* Page background and body text. */
  canvas: string;
  body: string;
};

export const PALETTES: Palette[] = [
  {
    id: "retorika",
    name: "Retorika",
    ink: "#12517d",
    brand: "#156fe7",
    brandDeep: "#105cb1",
    soft: "#eaf1fb",
    line: "#dbe6f2",
    canvas: "#f4f7fb",
    body: "#0b1b2b",
  },
  {
    id: "cal",
    name: "Cal y añil",
    ink: "#2f4650",
    brand: "#0e7c7b",
    brandDeep: "#0a615f",
    soft: "#e6f1f0",
    line: "#dde5e5",
    canvas: "#f8f7f4",
    body: "#1d2b31",
  },
  {
    id: "albero",
    name: "Albero",
    ink: "#4a3b22",
    brand: "#a56a12",
    brandDeep: "#84550e",
    soft: "#f5ecdb",
    line: "#e7ddc9",
    canvas: "#fbf7ef",
    body: "#332a1b",
  },
  {
    id: "marino",
    name: "Marino",
    ink: "#0b3a53",
    brand: "#0f7fa6",
    brandDeep: "#0b6483",
    soft: "#e4f1f6",
    line: "#d7e4ea",
    canvas: "#f2f7fa",
    body: "#0d2733",
  },
  {
    id: "olivar",
    name: "Olivar",
    ink: "#33402a",
    brand: "#5b7a2e",
    brandDeep: "#476124",
    soft: "#edf1e5",
    line: "#dfe5d4",
    canvas: "#f6f7f1",
    body: "#26301f",
  },
  {
    id: "carbon",
    name: "Carbón",
    ink: "#1b1e23",
    brand: "#c1483b",
    brandDeep: "#9d382d",
    soft: "#f0eeec",
    line: "#e0dcd8",
    canvas: "#f6f5f3",
    body: "#20242a",
  },
];

/* Pairings, not a font list. The display face carries the personality and is
   used only for headings; the body face is chosen for being invisible at 15px
   on a phone, which is where this is actually read. */
export type FontPair = {
  id: string;
  name: string;
  display: string;
  body: string;
  /* What Google Fonts needs to serve them. */
  families: string[];
};

export const FONTS: FontPair[] = [
  {
    id: "moderna",
    name: "Moderna",
    display: "Outfit",
    body: "Inter",
    families: ["Outfit:wght@500;600;700", "Inter:wght@400;500;600"],
  },
  {
    id: "editorial",
    name: "Editorial",
    display: "Fraunces",
    body: "Inter",
    families: ["Fraunces:opsz,wght@9..144,500;9..144,600", "Inter:wght@400;500;600"],
  },
  {
    id: "tecnica",
    name: "Técnica",
    display: "Space Grotesk",
    body: "Inter",
    families: ["Space+Grotesk:wght@500;600;700", "Inter:wght@400;500;600"],
  },
  {
    id: "calida",
    name: "Cálida",
    display: "Lora",
    body: "Work Sans",
    families: ["Lora:wght@500;600", "Work+Sans:wght@400;500;600"],
  },
];

export const RADII = [
  { id: "suave", name: "Suave", value: "16px" },
  { id: "redondo", name: "Redondo", value: "26px" },
  { id: "recto", name: "Recto", value: "4px" },
] as const;

/* ---------------------------------------------------------------------------
   Section and header treatment.

   The texture strip this replaces was decoration with nothing to say, and it
   showed. What actually gives a printed welcome book its character is not a
   pattern behind the title — it is how the title is set, how each section is
   announced, and what separates one from the next. Change those three and the
   same words read as a different document.

   Four directions, each a coherent set rather than a slider:

     · Sereno    — a hairline under each heading, the section icon in a soft
                   disc. Quiet, contemporary, gets out of the way.
     · Editorial — a letterspaced eyebrow above a large title, rules above and
                   below. The voice of a printed magazine.
     · Banda     — the section name inside a filled band, the way a designed
                   welcome book blocks its headings. The most graphic of the
                   four.
     · Sello     — centred headings with the icon in an outlined circle and a
                   rule to either side. The framed poster hanging in the hall.

   None of them changes a single word of the guide, and none of them touches the
   semantic colours or the reading order.
--------------------------------------------------------------------------- */
export const STYLES = [
  { id: "sereno", name: "Sereno" },
  { id: "editorial", name: "Editorial" },
  { id: "banda", name: "Banda" },
  { id: "sello", name: "Sello" },
] as const;

export type StyleId = (typeof STYLES)[number]["id"];

export function styleOf(theme: Theme): StyleId {
  return (STYLES.find((s) => s.id === theme.style)?.id ?? "sereno") as StyleId;
}

export const themeSchema = z.object({
  palette: z.string().max(24).default("retorika"),
  font: z.string().max(24).default("moderna"),
  radius: z.string().max(24).default("suave"),
  style: z.string().max(24).default("sereno"),
});
export type Theme = z.infer<typeof themeSchema>;

export const DEFAULT_THEME: Theme = {
  palette: "retorika",
  font: "moderna",
  radius: "suave",
  style: "sereno",
};

export function paletteOf(theme: Theme): Palette {
  return PALETTES.find((p) => p.id === theme.palette) ?? PALETTES[0];
}

export function fontOf(theme: Theme): FontPair {
  return FONTS.find((f) => f.id === theme.font) ?? FONTS[0];
}

/* The custom properties Tailwind's utilities already read. Overriding them on a
   wrapper element re-themes everything inside it without a single conditional
   class name — `bg-brand` resolves to whichever brand colour is in scope. */
export function themeVars(theme: Theme): React.CSSProperties {
  const palette = paletteOf(theme);
  const font = fontOf(theme);
  const radius = RADII.find((r) => r.id === theme.radius) ?? RADII[0];

  return {
    "--color-brand": palette.brand,
    "--color-brand-deep": palette.brandDeep,
    "--color-brand-ink": palette.ink,
    "--color-brand-soft": palette.soft,
    "--color-brand-line": palette.line,
    "--color-line": palette.line,
    "--color-canvas": palette.canvas,
    "--color-ink": palette.body,
    "--radius-card": radius.value,
    "--font-display": `${font.display}, ${font.body}, system-ui, sans-serif`,
    "--font-sans": `${font.body}, system-ui, -apple-system, sans-serif`,
    backgroundColor: palette.canvas,
    color: palette.body,
  } as React.CSSProperties;
}

export function fontsHref(theme: Theme): string {
  const font = fontOf(theme);
  const families = font.families.map((family) => `family=${family}`).join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
