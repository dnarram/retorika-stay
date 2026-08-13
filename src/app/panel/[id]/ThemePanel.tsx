"use client";

import {
  FONTS,
  ORNAMENTS,
  PALETTES,
  RADII,
  fontOf,
  ornamentStyle,
  paletteOf,
  themeVars,
  type Theme,
} from "@/lib/theme";

/* ---------------------------------------------------------------------------
   Four decisions and a live preview, in the sidebar where the host already is.

   Everything here is a picture, not a word. A host choosing a palette is
   choosing between six swatches, not between six names they would have to
   imagine; the type pairing is shown set in its own faces; the corner radius is
   shown as a corner. Nobody has to know what "ornament" means because they can
   see three of them.

   The preview is a real fragment of the guest guide — the same header, the same
   card, the same button — rendered with the same custom properties the guide
   uses. It is not a mock-up that might drift: change the palette and this is
   literally what the guest will see, at a smaller size.
--------------------------------------------------------------------------- */

export default function ThemePanel({
  theme,
  propertyName,
  city,
  onChange,
}: {
  theme: Theme;
  propertyName: string;
  city: string;
  onChange: (patch: Partial<Theme>) => void;
}) {
  const palette = paletteOf(theme);
  const font = fontOf(theme);

  return (
    <div className="rounded-card border border-line bg-white p-4">
      <p className="text-sm font-medium">Aspecto de la guía</p>
      <p className="mt-1 text-xs text-muted">
        Cuatro decisiones y ya está. Lo de abajo es exactamente lo que verá tu huésped.
      </p>

      {/* Colour ------------------------------------------------------------ */}
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Color</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {PALETTES.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange({ palette: option.id })}
            aria-pressed={theme.palette === option.id}
            title={option.name}
            className={`rounded-xl p-1.5 ring-1 transition ${
              theme.palette === option.id ? "ring-2 ring-brand" : "ring-line hover:ring-brand-line"
            }`}
          >
            <span className="flex overflow-hidden rounded-lg">
              <span className="h-7 flex-1" style={{ background: option.ink }} />
              <span className="h-7 flex-1" style={{ background: option.brand }} />
              <span className="h-7 flex-1" style={{ background: option.soft }} />
            </span>
            <span className="mt-1 block truncate text-[11px] text-muted">{option.name}</span>
          </button>
        ))}
      </div>

      {/* Type -------------------------------------------------------------- */}
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Tipografía</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {FONTS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange({ font: option.id })}
            aria-pressed={theme.font === option.id}
            className={`rounded-xl px-3 py-2 text-left ring-1 transition ${
              theme.font === option.id ? "ring-2 ring-brand" : "ring-line hover:ring-brand-line"
            }`}
          >
            {/* Set in the face it offers: the only honest way to show a font. */}
            <span
              className="block text-base font-semibold leading-tight"
              style={{ fontFamily: `${option.display}, system-ui` }}
            >
              Aa
            </span>
            <span className="mt-0.5 block text-[11px] text-muted">{option.name}</span>
          </button>
        ))}
      </div>

      {/* Corners ----------------------------------------------------------- */}
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Esquinas</p>
      <div className="mt-2 flex gap-2">
        {RADII.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange({ radius: option.id })}
            aria-pressed={theme.radius === option.id}
            className={`flex-1 px-2 py-2 text-[11px] font-medium ring-1 transition ${
              theme.radius === option.id ? "ring-2 ring-brand" : "ring-line hover:ring-brand-line"
            }`}
            style={{ borderRadius: option.value }}
          >
            {option.name}
          </button>
        ))}
      </div>

      {/* Ornament ---------------------------------------------------------- */}
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Textura</p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {ORNAMENTS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange({ ornament: option.id })}
            aria-pressed={theme.ornament === option.id}
            title={option.name}
            className={`h-10 rounded-lg ring-1 transition ${
              theme.ornament === option.id ? "ring-2 ring-brand" : "ring-line hover:ring-brand-line"
            }`}
            style={ornamentStyle({ ...theme, ornament: option.id })}
          />
        ))}
      </div>

      {/* Preview ----------------------------------------------------------- */}
      <div
        className="mt-5 overflow-hidden rounded-xl border"
        style={{ ...themeVars(theme), borderColor: palette.line }}
      >
        <div className="px-3 pb-3 pt-3 text-white" style={ornamentStyle(theme)}>
          <p className="text-[9px] uppercase tracking-[0.2em] text-white/70">Guía de bienvenida</p>
          <p
            className="mt-1 text-sm font-semibold"
            style={{ fontFamily: `${font.display}, system-ui` }}
          >
            {propertyName || "Tu alojamiento"}
          </p>
          <p className="text-[10px] text-white/70">{city || "Ciudad"}</p>
        </div>
        <div className="p-3" style={{ background: palette.canvas }}>
          <div
            className="border p-2.5"
            style={{
              background: "#fff",
              borderColor: palette.line,
              borderRadius: "var(--radius-card)",
              fontFamily: `${font.body}, system-ui`,
            }}
          >
            <p
              className="text-[11px] font-semibold"
              style={{ fontFamily: `${font.display}, system-ui`, color: palette.body }}
            >
              Entrada
            </p>
            <p className="mt-0.5 text-[10px]" style={{ color: palette.body, opacity: 0.7 }}>
              La caja de llaves está a la izquierda del portal.
            </p>
            <span
              className="mt-2 inline-block px-2.5 py-1 text-[10px] font-medium text-white"
              style={{ background: palette.brand, borderRadius: 999 }}
            >
              Mostrar código
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
