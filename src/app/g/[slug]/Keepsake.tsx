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
  /* Caveat is loaded here and nowhere else: the handwriting is what makes these
     slides look made rather than generated, and a guest who never opens the
     keepsake should not download a font for it. */
  useEffect(() => {
    const id = "keepsake-script-font";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Caveat:wght@400;600&display=swap";
      document.head.appendChild(link);
    }
    void document.fonts?.load("400 40px Caveat");
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

  /* ---------------------------- drawing toolkit ----------------------------
     Everything below exists because the first version of these slides was a
     coloured rectangle with a caption, and nobody posts a coloured rectangle.
     What people post has depth: a photograph that fills the frame, a print with
     a white border sitting at an angle, a line of handwriting over a sky, a
     dashed route with a little aeroplane on it. These are those pieces, drawn
     rather than imported, so the whole thing still weighs nothing and still
     never sends a photograph anywhere.
  ------------------------------------------------------------------------- */

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

  /* object-fit: cover, but on a canvas: fill the box, crop the overflow, never
     squash a face. */
  function cover(
    c: CanvasRenderingContext2D,
    image: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const scale = Math.max(w / image.width, h / image.height);
    const dw = image.width * scale;
    const dh = image.height * scale;
    c.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  /* A photograph is not a background until it has been darkened: text over an
     unmodified holiday snap is unreadable half the time and looks amateur the
     other half. */
  function scrim(c: CanvasRenderingContext2D, W: number, H: number, from = 0.45) {
    const gradient = c.createLinearGradient(0, H * from, 0, H);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,0.72)");
    c.fillStyle = gradient;
    c.fillRect(0, H * from, W, H * (1 - from));
  }

  function paper(c: CanvasRenderingContext2D, W: number, H: number) {
    c.fillStyle = palette.canvas;
    c.fillRect(0, 0, W, H);
    /* Faint ruled lines: enough to read as paper in a feed, not enough to
       compete with the photographs. */
    c.strokeStyle = palette.ink;
    c.globalAlpha = 0.05;
    c.lineWidth = 2;
    for (let y = 120; y < H; y += 64) {
      c.beginPath();
      c.moveTo(60, y);
      c.lineTo(W - 60, y);
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  /* A strip of masking tape. Slightly translucent, slightly askew, because a
     perfectly straight piece of tape has never existed. */
  function tape(c: CanvasRenderingContext2D, x: number, y: number, w: number, angle: number) {
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    c.fillStyle = "rgba(255,255,255,0.55)";
    c.fillRect(-w / 2, -18, w, 36);
    c.strokeStyle = "rgba(0,0,0,0.06)";
    c.lineWidth = 2;
    c.strokeRect(-w / 2, -18, w, 36);
    c.restore();
  }

  /* A print with a white border, dropped at an angle with a real shadow. The
     single most recognisable object in travel scrapbooking, and the reason
     these slides stop looking like a template. */
  function polaroid(
    c: CanvasRenderingContext2D,
    image: HTMLImageElement,
    cx: number,
    cy: number,
    w: number,
    h: number,
    angle: number,
    caption?: string,
  ) {
    const border = 22;
    const foot = caption ? 84 : border;
    c.save();
    c.translate(cx, cy);
    c.rotate(angle);
    c.shadowColor = "rgba(0,0,0,0.28)";
    c.shadowBlur = 34;
    c.shadowOffsetY = 12;
    c.fillStyle = "#ffffff";
    c.fillRect(-w / 2 - border, -h / 2 - border, w + border * 2, h + border + foot);
    c.shadowColor = "transparent";
    c.save();
    c.beginPath();
    c.rect(-w / 2, -h / 2, w, h);
    c.clip();
    cover(c, image, -w / 2, -h / 2, w, h);
    c.restore();
    if (caption) {
      c.fillStyle = palette.body;
      c.textAlign = "center";
      c.font = `400 40px Caveat, ${font.body}, cursive`;
      c.fillText(caption, 0, h / 2 + 58);
    }
    c.restore();
  }

  /* The dashed flight path. Two control points, an aeroplane at the end, and a
     pin where it started — the visual shorthand for "I went somewhere". */
  function route(c: CanvasRenderingContext2D, W: number, H: number, y: number) {
    c.save();
    c.fillStyle = "rgba(255,255,255,0.9)";
    c.strokeStyle = "rgba(255,255,255,0.9)";
    c.lineWidth = 6;
    c.setLineDash([18, 20]);
    c.shadowColor = "rgba(0,0,0,0.35)";
    c.shadowBlur = 12;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(W * 0.1, y + 30);
    c.bezierCurveTo(W * 0.32, y - 150, W * 0.6, y + 150, W * 0.84, y - 70);
    c.stroke();
    c.setLineDash([]);

    /* The pin the route leaves from. */
    c.beginPath();
    c.arc(W * 0.1, y + 30, 11, 0, Math.PI * 2);
    c.fill();

    c.translate(W * 0.84, y - 70);
    c.rotate(-0.65);
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.moveTo(38, 0);
    c.lineTo(-26, 20);
    c.lineTo(-14, 0);
    c.lineTo(-26, -20);
    c.closePath();
    c.fill();
    c.restore();
  }

  /* A circular inset with a white ring: the second photograph, without giving
     it a slide of its own. */
  function circleInset(
    c: CanvasRenderingContext2D,
    image: HTMLImageElement,
    cx: number,
    cy: number,
    r: number,
  ) {
    c.save();
    c.shadowColor = "rgba(0,0,0,0.3)";
    c.shadowBlur = 28;
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.arc(cx, cy, r + 10, 0, Math.PI * 2);
    c.fill();
    c.shadowColor = "transparent";
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.clip();
    cover(c, image, cx - r, cy - r, r * 2, r * 2);
    c.restore();
  }

  /* Handwriting over a photograph, with a shadow so it survives a bright sky. */
  function script(
    c: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    size: number,
    align: CanvasTextAlign = "center",
  ) {
    c.save();
    c.textAlign = align;
    c.font = `400 ${size}px Caveat, ${font.body}, cursive`;
    c.shadowColor = "rgba(0,0,0,0.45)";
    c.shadowBlur = 18;
    c.shadowOffsetY = 4;
    c.fillStyle = "#ffffff";
    c.fillText(text, x, y);
    c.restore();
  }

  function chip(c: CanvasRenderingContext2D, text: string, x: number, y: number) {
    c.font = `600 30px ${font.display}, sans-serif`;
    const w = c.measureText(text).width + 52;
    c.fillStyle = palette.brand;
    roundRect(c, x, y - 44, w, 62, 31);
    c.fill();
    c.fillStyle = "#ffffff";
    c.textAlign = "left";
    c.fillText(text, x + 26, y);
    return w;
  }

  /* -------------------------------- slides -------------------------------- */

  function drawCover(c: CanvasRenderingContext2D, W: number, H: number, hero?: HTMLImageElement) {
    if (hero) {
      cover(c, hero, 0, 0, W, H);
      /* Top scrim as well: the eyebrow lives up there. */
      const top = c.createLinearGradient(0, 0, 0, H * 0.45);
      top.addColorStop(0, "rgba(0,0,0,0.55)");
      top.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = top;
      c.fillRect(0, 0, W, H * 0.45);
      scrim(c, W, H, 0.4);
    } else {
      c.fillStyle = palette.ink;
      c.fillRect(0, 0, W, H);
    }

    c.textAlign = "center";
    c.fillStyle = "#ffffff";
    c.globalAlpha = 0.85;
    c.font = `500 26px ${font.body}, sans-serif`;
    c.letterSpacing = "10px";
    c.fillText(t.memory.coverTitle.toUpperCase(), W / 2, 140);
    c.letterSpacing = "0px";
    c.globalAlpha = 1;

    route(c, W, H, H * 0.36);

    c.font = `600 ${city.length > 12 ? 108 : 140}px ${font.display}, sans-serif`;
    c.shadowColor = "rgba(0,0,0,0.4)";
    c.shadowBlur = 26;
    c.fillText(city, W / 2, H * 0.72);
    c.shadowColor = "transparent";

    script(c, propertyName, W / 2, H * 0.79, 56);

    c.globalAlpha = 0.8;
    c.font = `400 28px ${font.body}, sans-serif`;
    c.fillText(`${nights} ${t.tripNights}`, W / 2, H - 96);
    c.globalAlpha = 1;
  }

  /* Full bleed: the photograph is the slide, the words stay out of its way. */
  function drawBleed(
    c: CanvasRenderingContext2D,
    W: number,
    H: number,
    image: HTMLImageElement,
    caption: string,
  ) {
    cover(c, image, 0, 0, W, H);
    scrim(c, W, H, 0.5);
    script(c, caption, W / 2, H - 190, 92);
    c.textAlign = "center";
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.font = `400 26px ${font.body}, sans-serif`;
    c.letterSpacing = "6px";
    c.fillText(city.toUpperCase(), W / 2, H - 120);
    c.letterSpacing = "0px";
  }

  /* Scrapbook: one or two prints taped to paper, at an angle. */
  function drawScrapbook(
    c: CanvasRenderingContext2D,
    W: number,
    H: number,
    images: HTMLImageElement[],
    caption: string,
  ) {
    paper(c, W, H);

    if (images.length > 1) {
      /* Kept clear of the right edge: a print cropped by the canvas reads as a
         mistake, not as a layout. */
      polaroid(c, images[1], W * 0.58, H * 0.7, W * 0.32, W * 0.32, 0.09);
      tape(c, W * 0.58, H * 0.7 - W * 0.19, 130, 0.09 - 0.35);
    }
    polaroid(c, images[0], W * 0.44, H * 0.38, W * 0.54, W * 0.58, -0.055, caption);
    tape(c, W * 0.44, H * 0.38 - W * 0.32, 190, -0.055 + 0.3);

    c.fillStyle = palette.brand;
    c.textAlign = "left";
    c.font = `600 30px ${font.display}, sans-serif`;
    c.letterSpacing = "6px";
    c.fillText(city.toUpperCase(), 72, H - 92);
    c.letterSpacing = "0px";
  }

  /* Hero plus inset: the composition from a hundred travel posters, and it
     still works because the eye goes big, then small, then reads. */
  function drawInset(
    c: CanvasRenderingContext2D,
    W: number,
    H: number,
    images: HTMLImageElement[],
    caption: string,
  ) {
    cover(c, images[0], 0, 0, W, H);
    scrim(c, W, H, 0.45);
    if (images.length > 1) circleInset(c, images[1], W * 0.26, H * 0.68, W * 0.17);
    script(c, caption, W * 0.52, H * 0.68, 84, "left");
    c.textAlign = "left";
    c.fillStyle = "rgba(255,255,255,0.8)";
    c.font = `400 24px ${font.body}, sans-serif`;
    c.letterSpacing = "6px";
    c.fillText(city.toUpperCase(), W * 0.52, H * 0.68 + 46);
    c.letterSpacing = "0px";
  }

  /* The list slide, as a page torn from a notebook: the host's own
     recommendations, ticked off by somebody else. */
  function drawStats(c: CanvasRenderingContext2D, W: number, H: number, image?: HTMLImageElement) {
    paper(c, W, H);

    c.fillStyle = palette.ink;
    c.textAlign = "left";
    c.font = `600 62px ${font.display}, sans-serif`;
    c.fillText(t.memory.statsTitle, 72, 180);
    c.fillStyle = palette.brand;
    c.fillRect(72, 210, 110, 8);

    const stats: [string, string][] = [
      [String(visitedNames.length), t.tripPlaces],
      [String(nights), t.tripNights],
      [km, t.tripWalk],
    ];
    stats.forEach(([value, label], index) => {
      const x = 72 + index * (W - 190) / 3;
      c.fillStyle = palette.brand;
      c.font = `600 84px ${font.display}, sans-serif`;
      c.fillText(value, x, 340);
      c.fillStyle = palette.body;
      c.globalAlpha = 0.65;
      c.font = `400 24px ${font.body}, sans-serif`;
      c.fillText(label, x, 382);
      c.globalAlpha = 1;
    });

    visitedNames.slice(0, 5).forEach((name, index) => {
      const y = 520 + index * 76;
      c.strokeStyle = palette.brand;
      c.lineWidth = 5;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(76, y - 10);
      c.lineTo(90, y + 4);
      c.lineTo(114, y - 26);
      c.stroke();
      c.fillStyle = palette.body;
      c.font = `400 42px Caveat, ${font.body}, cursive`;
      c.fillText(name.slice(0, 26), 146, y + 4);
    });

    /* The print sits in the space the list leaves, tucked into the corner: a
       scrapbook page is composed, not a list with a photograph after it. */
    if (image) {
      polaroid(c, image, W * 0.64, H * 0.76, W * 0.34, W * 0.34, 0.07);
      tape(c, W * 0.64, H * 0.76 - W * 0.2, 140, 0.07 - 0.3);
    }
  }

  function drawClosing(c: CanvasRenderingContext2D, W: number, H: number, image?: HTMLImageElement) {
    if (image) {
      cover(c, image, 0, 0, W, H);
      c.fillStyle = "rgba(0,0,0,0.5)";
      c.fillRect(0, 0, W, H);
    } else {
      c.fillStyle = palette.ink;
      c.fillRect(0, 0, W, H);
    }
    c.textAlign = "center";
    script(c, t.memory.thanksTitle, W / 2, H / 2 - 10, 120);
    c.fillStyle = "#ffffff";
    c.globalAlpha = 0.85;
    c.font = `600 40px ${font.display}, sans-serif`;
    c.fillText(propertyName, W / 2, H / 2 + 80);
    c.globalAlpha = 0.5;
    c.font = `400 22px ${font.body}, sans-serif`;
    c.letterSpacing = "5px";
    /* The quiet credit line: small enough not to spoil the picture, present
       enough to be read by whoever asks where the guide came from. */
    c.fillText(`${t.memory.madeWith.toUpperCase()} · RETORIKA STAY`, W / 2, H - 88);
    c.letterSpacing = "0px";
    c.globalAlpha = 1;
  }

  /* Layouts rotate so no two consecutive slides look alike — the fastest way a
     generated carousel gives itself away is by repeating one composition six
     times. */
  const LAYOUTS = ["bleed", "scrapbook", "inset"] as const;

  async function renderSlide(index: number, size: { w: number; h: number }): Promise<Blob | null> {
    const canvas = document.createElement("canvas");
    canvas.width = size.w;
    canvas.height = size.h;
    const c = canvas.getContext("2d");
    if (!c) return null;
    c.textBaseline = "alphabetic";

    const images = await Promise.all(ordered.map((shot) => loadImage(shot.dataUrl)));

    if (index === 0) {
      drawCover(c, size.w, size.h, images[0]);
    } else if (index <= ordered.length) {
      const position = index - 1;
      const layout = LAYOUTS[position % LAYOUTS.length];
      const caption = t.memory.prompts[ordered[position].id].label;
      const pair = [images[position], images[(position + 1) % images.length]].filter(Boolean);
      if (layout === "scrapbook") drawScrapbook(c, size.w, size.h, pair, caption);
      else if (layout === "inset") drawInset(c, size.w, size.h, pair, caption);
      else drawBleed(c, size.w, size.h, images[position], caption);
    } else if (index === ordered.length + 1) {
      drawStats(c, size.w, size.h, images[images.length - 1]);
    } else {
      drawClosing(c, size.w, size.h, images[images.length - 1]);
    }

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
    const first = ordered[0];
    if (!first) {
      drawCover(c, CAROUSEL.w, CAROUSEL.h);
      return;
    }
    void loadImage(first.dataUrl).then((image) => {
      void document.fonts?.ready.then(() => drawCover(c, CAROUSEL.w, CAROUSEL.h, image));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, city, propertyName, nights, shots]);

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
