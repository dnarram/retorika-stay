"use client";

import {
  FONTS,
  PALETTES,
  RADII,
  STYLES,
  fontOf,
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

      {/* Style ------------------------------------------------------------- */}
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
        Estilo de las secciones
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {STYLES.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange({ style: option.id })}
            aria-pressed={theme.style === option.id}
            className={`rounded-xl p-2 ring-1 transition ${
              theme.style === option.id ? "ring-2 ring-brand" : "ring-line hover:ring-brand-line"
            }`}
          >
            {/* Each thumbnail is the treatment itself, drawn small: a host
                should recognise what they are choosing without reading a word
                of explanation. */}
            <span className="block" style={{ color: palette.body }}>
              {option.id === "sereno" ? (
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-4 w-4 rounded-full"
                    style={{ background: palette.soft }}
                  />
                  <span className="flex-1">
                    <span className="block h-1.5 w-10 rounded" style={{ background: palette.body }} />
                    <span
                      className="mt-1 block h-0.5 w-4 rounded"
                      style={{ background: palette.brand }}
                    />
                  </span>
                </span>
              ) : option.id === "editorial" ? (
                <span className="block">
                  <span className="block h-px w-full" style={{ background: palette.line }} />
                  <span
                    className="mt-1.5 block h-1.5 w-12 rounded"
                    style={{ background: palette.body }}
                  />
                </span>
              ) : option.id === "banda" ? (
                <span
                  className="flex h-6 items-center gap-1.5 px-1.5"
                  style={{ background: palette.ink, borderRadius: 6 }}
                >
                  <span className="h-2 w-2 rounded-full bg-white/70" />
                  <span className="h-1.5 w-9 rounded bg-white/80" />
                </span>
              ) : (
                <span className="flex flex-col items-center">
                  <span
                    className="h-4 w-4 rounded-full border"
                    style={{ borderColor: palette.line }}
                  />
                  <span className="mt-1 flex items-center gap-1">
                    <span className="h-px w-2.5" style={{ background: palette.line }} />
                    <span className="h-1.5 w-7 rounded" style={{ background: palette.body }} />
                    <span className="h-px w-2.5" style={{ background: palette.line }} />
                  </span>
                </span>
              )}
            </span>
            <span className="mt-1.5 block text-[11px] text-muted">{option.name}</span>
          </button>
        ))}
      </div>

      {/* Preview ----------------------------------------------------------- */}
      <div
        className="mt-5 overflow-hidden rounded-xl border"
        style={{ ...themeVars(theme), borderColor: palette.line }}
      >
        <div
          className={`px-3 pb-3 pt-3 text-white ${theme.style === "sello" ? "text-center" : ""}`}
          style={{ background: palette.ink }}
        >
          <p className="text-[9px] uppercase tracking-[0.22em] text-white/70">Guía de bienvenida</p>
          <p
            className="mt-1 text-sm font-semibold"
            style={{ fontFamily: `${font.display}, system-ui` }}
          >
            {propertyName || "Tu alojamiento"}
          </p>
          <p className="text-[10px] text-white/70">{city || "Ciudad"}</p>
          {theme.style === "banda" ? (
            <span className="mt-2 block h-1 w-8 rounded-full bg-white/70" />
          ) : null}
          {theme.style === "sello" ? (
            <span className="mx-auto mt-2 block h-px w-12 bg-white/40" />
          ) : null}
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
            {theme.style === "banda" ? (
              <p
                className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white"
                style={{
                  fontFamily: `${font.display}, system-ui`,
                  background: palette.ink,
                  borderRadius: "var(--radius-card)",
                }}
              >
                Entrada
              </p>
            ) : (
              <p
                className={`text-[11px] font-semibold ${theme.style === "sello" ? "text-center" : ""}`}
                style={{ fontFamily: `${font.display}, system-ui`, color: palette.body }}
              >
                Entrada
              </p>
            )}
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
