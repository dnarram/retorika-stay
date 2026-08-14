"use client";

import { useEffect, useRef, useState } from "react";
import { IconArrow, IconCheck, IconTrash } from "@/components/icons";
import type { Dict } from "@/i18n/dictionaries";
import { paletteOf, fontOf, styleOf, type Theme } from "@/lib/theme";

/* ---------------------------------------------------------------------------
   The keepsake: a guest's stay, laid out as an Instagram carousel.

   Two design commitments hold the whole thing up.

   The first is that no photograph ever leaves the phone. Every slide is drawn
   on a local canvas and downloaded from there — no upload, no storage, no
   moderation queue, no data-protection surface. It is also the only version of
   this feature that could ship in an app that promises to ask the guest for
   nothing, and it happens to be the cheapest to run.

   The second is that the keepsake wears the flat's own clothes. It reads the
   same palette, type pairing and section style the host chose for the guide, so
   what the guest posts is recognisably this house — which is exactly why a host
   would want their guests to make one.

   The photo prompts are not decoration either. A keepsake offered on the last
   morning gets whatever happens to be in the camera roll; a keepsake announced
   on day one gets six photographs somebody meant to take. Six is the number
   that fits a carousel without turning a holiday into homework.
--------------------------------------------------------------------------- */

export const PROMPTS = ["antes", "llegada", "lugares", "gente", "loca", "despedida"] as const;
export type PromptId = (typeof PROMPTS)[number];

type Shot = { id: PromptId; dataUrl: string };

const CAROUSEL = { w: 1080, h: 1350 };
const STORY = { w: 1080, h: 1920 };

export default function Keepsake({
  t,
  theme,
  slug,
  propertyName,
  city,
  nights,
  visitedNames,
  km,
}: {
  t: Dict;
  theme: Theme;
  slug: string;
  propertyName: string;
  city: string;
  nights: number;
  visitedNames: string[];
  km: string;
}) {
  const [shots, setShots] = useState<Shot[]>([]);
  const [busy, setBusy] = useState(false);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const palette = paletteOf(theme);
  const font = fontOf(theme);
  const style = styleOf(theme);

  /* Photos live in the tab, not in storage: a base64 holiday album in
     localStorage would blow past the quota on the third picture. */
  useEffect(() => {
    void document.fonts?.ready;
  }, []);

  function pick(id: PromptId, file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setShots((current) => [...current.filter((s) => s.id !== id), { id, dataUrl }]);
    };
    reader.readAsDataURL(file);
  }

  const ordered = PROMPTS.map((id) => shots.find((s) => s.id === id)).filter(Boolean) as Shot[];
  const slideCount = ordered.length > 0 ? ordered.length + 2 : 0;

  /* ------------------------------- drawing ------------------------------- */

  function roundRect(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawCover(c: CanvasRenderingContext2D, W: number, H: number) {
    c.fillStyle = palette.ink;
    c.fillRect(0, 0, W, H);
    c.fillStyle = "#ffffff";

    const cx = W / 2;
    const eyebrow = t.memory.coverTitle.toUpperCase();

    if (style === "sello") {
      c.textAlign = "center";
      c.font = `500 30px ${font.body}, sans-serif`;
      c.globalAlpha = 0.75;
      c.letterSpacing = "8px";
      c.fillText(eyebrow, cx, H * 0.34);
      c.letterSpacing = "0px";
      c.globalAlpha = 1;
      c.font = `600 108px ${font.display}, sans-serif`;
      c.fillText(city, cx, H * 0.46);
      c.globalAlpha = 0.55;
      c.fillRect(cx - 90, H * 0.5, 180, 2);
      c.globalAlpha = 0.8;
      c.font = `400 34px ${font.body}, sans-serif`;
      c.fillText(propertyName, cx, H * 0.56);
      c.globalAlpha = 1;
    } else if (style === "banda") {
      c.textAlign = "left";
      c.fillStyle = "rgba(255,255,255,.16)";
      c.fillRect(90, H * 0.3, 420, 62);
      c.fillStyle = "#ffffff";
      c.font = `500 28px ${font.body}, sans-serif`;
      c.letterSpacing = "6px";
      c.fillText(eyebrow, 110, H * 0.3 + 40);
      c.letterSpacing = "0px";
      c.font = `600 112px ${font.display}, sans-serif`;
      c.fillText(city, 90, H * 0.45);
      c.globalAlpha = 0.8;
      c.font = `400 34px ${font.body}, sans-serif`;
      c.fillText(propertyName, 90, H * 0.51);
      c.globalAlpha = 1;
      c.fillRect(90, H * 0.56, 140, 12);
    } else {
      c.textAlign = "left";
      c.globalAlpha = 0.75;
      c.font = `500 28px ${font.body}, sans-serif`;
      c.letterSpacing = style === "editorial" ? "10px" : "6px";
      c.fillText(eyebrow, 90, H * 0.34);
      c.letterSpacing = "0px";
      c.globalAlpha = 1;
      if (style === "editorial") {
        c.globalAlpha = 0.3;
        c.fillRect(90, H * 0.36, W - 180, 2);
        c.globalAlpha = 1;
      }
      c.font = `600 116px ${font.display}, sans-serif`;
      c.fillText(city, 90, H * 0.47);
      c.globalAlpha = 0.8;
      c.font = `400 34px ${font.body}, sans-serif`;
      c.fillText(propertyName, 90, H * 0.53);
      c.globalAlpha = 1;
    }

    c.textAlign = "left";
    c.globalAlpha = 0.6;
    c.font = `400 26px ${font.body}, sans-serif`;
    c.fillText(`${nights} ${t.tripNights}`, 90, H - 90);
    c.globalAlpha = 1;
  }

  function drawPhoto(
    c: CanvasRenderingContext2D,
    W: number,
    H: number,
    image: HTMLImageElement,
    caption: string,
  ) {
    c.fillStyle = palette.ink;
    c.fillRect(0, 0, W, H);

    const bandH = 150;
    const areaH = H - bandH;
    /* Centre-crop, never squash: nobody wants a stretched memory. */
    const scale = Math.max(W / image.width, areaH / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    c.drawImage(image, (W - w) / 2, (areaH - h) / 2, w, h);

    c.fillStyle = palette.ink;
    c.fillRect(0, areaH, W, bandH);
    c.fillStyle = "#ffffff";
    c.textAlign = style === "sello" ? "center" : "left";
    const x = style === "sello" ? W / 2 : 80;
    c.font = `600 46px ${font.display}, sans-serif`;
    c.fillText(caption, x, areaH + 78);
    c.globalAlpha = 0.65;
    c.font = `400 26px ${font.body}, sans-serif`;
    c.fillText(city, x, areaH + 118);
    c.globalAlpha = 1;
  }

  function drawStats(c: CanvasRenderingContext2D, W: number, H: number) {
    c.fillStyle = palette.canvas;
    c.fillRect(0, 0, W, H);

    c.fillStyle = palette.ink;
    c.textAlign = "left";
    c.font = `600 64px ${font.display}, sans-serif`;
    c.fillText(t.memory.statsTitle, 90, 200);
    c.fillStyle = palette.brand;
    c.fillRect(90, 232, 120, 8);

    const stats: [string, string][] = [
      [String(visitedNames.length), t.tripPlaces],
      [String(nights), t.tripNights],
      [km, t.tripWalk],
    ];
    stats.forEach(([value, label], index) => {
      const y = 360 + index * 150;
      c.fillStyle = palette.brand;
      c.font = `600 92px ${font.display}, sans-serif`;
      c.fillText(value, 90, y);
      c.fillStyle = palette.body;
      c.globalAlpha = 0.7;
      c.font = `400 30px ${font.body}, sans-serif`;
      c.fillText(label, 90 + c.measureText(value).width + 220, y);
      c.globalAlpha = 1;
    });

    /* The places, in the guest's own order of discovery. This is the slide a
       host would screenshot: their recommendations, in someone else's post. */
    c.fillStyle = palette.body;
    c.font = `400 30px ${font.body}, sans-serif`;
    visitedNames.slice(0, 6).forEach((name, index) => {
      const y = 880 + index * 52;
      c.globalAlpha = 0.35;
      c.fillText("—", 90, y);
      c.globalAlpha = 0.85;
      c.fillText(name.slice(0, 34), 140, y);
    });
    c.globalAlpha = 1;
  }

  function drawClosing(c: CanvasRenderingContext2D, W: number, H: number) {
    c.fillStyle = palette.ink;
    c.fillRect(0, 0, W, H);
    c.fillStyle = "#ffffff";
    c.textAlign = "center";
    c.font = `600 84px ${font.display}, sans-serif`;
    c.fillText(t.memory.thanksTitle, W / 2, H / 2 - 20);
    c.globalAlpha = 0.75;
    c.font = `400 34px ${font.body}, sans-serif`;
    c.fillText(propertyName, W / 2, H / 2 + 40);
    c.globalAlpha = 0.45;
    c.font = `400 24px ${font.body}, sans-serif`;
    c.letterSpacing = "4px";
    /* The quiet credit line. A guest posts this because it looks good; the
       credit rides along because it is small enough not to spoil it. */
    c.fillText(`${t.memory.madeWith.toUpperCase()} · RETORIKA STAY`, W / 2, H - 90);
    c.letterSpacing = "0px";
    c.globalAlpha = 1;
  }

  async function renderSlide(index: number, size: { w: number; h: number }): Promise<Blob | null> {
    const canvas = document.createElement("canvas");
    canvas.width = size.w;
    canvas.height = size.h;
    const c = canvas.getContext("2d");
    if (!c) return null;
    c.textBaseline = "alphabetic";

    if (index === 0) drawCover(c, size.w, size.h);
    else if (index <= ordered.length) {
      const shot = ordered[index - 1];
      const image = await loadImage(shot.dataUrl);
      drawPhoto(c, size.w, size.h, image, t.memory.prompts[shot.id].label);
    } else if (index === ordered.length + 1) drawStats(c, size.w, size.h);
    else drawClosing(c, size.w, size.h);

    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  }

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  async function download(size: { w: number; h: number }, suffix: string) {
    setBusy(true);
    for (let index = 0; index < slideCount; index += 1) {
      const blob = await renderSlide(index, size);
      if (!blob) continue;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slug}-${suffix}-${String(index + 1).padStart(2, "0")}.jpg`;
      link.click();
      URL.revokeObjectURL(url);
      /* Browsers throttle a burst of downloads; a short gap keeps them all. */
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    setBusy(false);
  }

  /* Live preview of the cover, so the guest sees the thing before they commit
     to six file pickers. */
  useEffect(() => {
    const canvas = previewRef.current;
    const c = canvas?.getContext("2d");
    if (!canvas || !c) return;
    canvas.width = CAROUSEL.w;
    canvas.height = CAROUSEL.h;
    c.textBaseline = "alphabetic";
    drawCover(c, CAROUSEL.w, CAROUSEL.h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, city, propertyName, nights]);

  return (
    <div className="no-print mt-4">
      <p className="text-sm text-white/80">{t.memory.readyIntro}</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {PROMPTS.map((id) => {
          const shot = shots.find((s) => s.id === id);
          return (
            <div
              key={id}
              className="flex items-center gap-3 rounded-xl bg-white/10 p-2.5 text-left"
            >
              <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white/15">
                {shot ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shot.dataUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-white">
                  {t.memory.prompts[id].label}
                </span>
                <span className="block truncate text-[11px] text-white/60">
                  {t.memory.prompts[id].hint}
                </span>
              </span>
              <label className="shrink-0 cursor-pointer rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white">
                {shot ? t.memory.change : t.memory.addPhoto}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) pick(id, file);
                  }}
                />
              </label>
              {shot ? (
                <button
                  type="button"
                  onClick={() => setShots((c) => c.filter((s) => s.id !== id))}
                  aria-label={t.memory.remove}
                  className="shrink-0 text-white/50 hover:text-white"
                >
                  <IconTrash size={16} />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <canvas
          ref={previewRef}
          className="w-24 rounded-lg border border-white/20"
          aria-label={t.memory.coverTitle}
        />
        <div className="flex-1">
          {slideCount > 0 ? (
            <p className="text-xs text-white/60">
              {slideCount} {t.memory.slides}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={slideCount === 0 || busy}
              onClick={() => download(CAROUSEL, "carrusel")}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-brand-ink disabled:opacity-40"
            >
              {busy ? t.memory.downloading : t.memory.downloadCarousel} <IconArrow size={15} />
            </button>
            <button
              type="button"
              disabled={slideCount === 0 || busy}
              onClick={() => download(STORY, "historia")}
              className="rounded-full px-4 py-2 text-sm font-medium text-white ring-1 ring-white/30 disabled:opacity-40"
            >
              {t.memory.downloadStory}
            </button>
          </div>
          {slideCount > 0 ? <p className="mt-2 text-[11px] text-white/50">{t.memory.hint}</p> : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------- the announcement, day one ----------------------- */

export function KeepsakeTeaser({ t, slug }: { t: Dict; slug: string }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(`mission_${slug}`);
    if (saved) setDone(JSON.parse(saved) as string[]);
  }, [slug]);

  function toggle(id: PromptId) {
    const next = done.includes(id) ? done.filter((d) => d !== id) : [...done, id];
    setDone(next);
    localStorage.setItem(`mission_${slug}`, JSON.stringify(next));
  }

  return (
    <aside className="no-print mt-6 rounded-card border border-brand-line bg-brand-soft p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-brand-ink">{t.memory.teaser}</p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-brand-deep ring-1 ring-brand-line"
        >
          {t.memory.teaserOpen}
        </button>
      </div>

      {open ? (
        <div className="mt-3">
          <p className="text-sm font-medium text-brand-ink">{t.memory.missionTitle}</p>
          <p className="mt-1 text-xs text-brand-ink/80">{t.memory.missionIntro}</p>
          <ul className="mt-3 space-y-1.5">
            {PROMPTS.map((id) => (
              <li key={id}>
                <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={done.includes(id)}
                    onChange={() => toggle(id)}
                    className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]"
                  />
                  <span className={done.includes(id) ? "text-muted line-through" : ""}>
                    <span className="font-medium">{t.memory.prompts[id].label}</span>
                    <span className="block text-xs text-muted">{t.memory.prompts[id].hint}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {done.length === PROMPTS.length ? (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-ok-ink">
              <IconCheck size={14} /> {t.memory.ready}
            </p>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
