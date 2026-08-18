"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconArrow, IconCheck, IconTrash } from "@/components/icons";
import type { Dict } from "@/i18n/dictionaries";
import { paletteOf, fontOf, type Theme } from "@/lib/theme";
import { zipStore } from "@/lib/zip";

/* ---------------------------------------------------------------------------
   The keepsake: a guest's stay, laid out as an Instagram carousel.

   Three commitments hold this up.

   No photograph ever leaves the phone. Every slide is drawn on a local canvas
   and downloaded from there — no upload, no storage, no moderation queue, no
   data-protection surface. It is the only version of this that could ship in an
   app which promises to ask the guest for nothing, and it is also the cheapest
   to run.

   The keepsake wears the flat's own clothes: the same palette and type pairing
   the host chose for the guide, so what the guest posts is recognisably this
   house. That is precisely why a host would want their guests to make one.

   And a section is composed from its own photographs, never from somebody
   else's afternoon. An earlier version padded thin slides by reusing pictures
   across sections, and it read exactly like what it was — a generator running
   out of material. Now the number of photographs in a section chooses the
   composition: one gets a frame, a mark and a line of handwriting; several get
   a real collage. Only the cover may appear twice, because the cover is chosen
   to be the photograph that earns the swipe.
--------------------------------------------------------------------------- */

export const PROMPTS = ["antes", "llegada", "lugares", "gente", "loca", "despedida"] as const;
export type PromptId = (typeof PROMPTS)[number];

/* Three of the six are naturally plural — the ticket AND the suitcase, the door
   AND the view, one photo per place visited — and three are singular by nature:
   there is one silly photo, one group, one goodbye. */
export const MULTI: PromptId[] = ["antes", "llegada", "lugares"];

type Album = Record<PromptId, string[]>;
const EMPTY_ALBUM: Album = {
  antes: [],
  llegada: [],
  lugares: [],
  gente: [],
  loca: [],
  despedida: [],
};

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
  const [album, setAlbum] = useState<Album>(EMPTY_ALBUM);
  /* The cover is picked on purpose rather than borrowed from the first slot: it
     is the photograph that has to earn the swipe, and the only one allowed to
     appear twice. */
  const [cover, setCover] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const palette = paletteOf(theme);
  const font = fontOf(theme);

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

  function addPhotos(id: PromptId, files: FileList) {
    const limit = MULTI.includes(id) ? 4 : 1;
    Array.from(files)
      .slice(0, limit)
      .forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result);
          setAlbum((current) => ({ ...current, [id]: [...current[id], dataUrl].slice(-limit) }));
        };
        reader.readAsDataURL(file);
      });
  }

  function removePhoto(id: PromptId, index: number) {
    setAlbum((current) => ({ ...current, [id]: current[id].filter((_, i) => i !== index) }));
  }

  /* Only sections the guest actually filled get a slide. An empty section is
     not a gap to paper over. */
  const filled = useMemo(() => PROMPTS.filter((id) => album[id].length > 0), [album]);
  const heroSrc = cover ?? (filled[0] ? album[filled[0]][0] : null);
  const slideCount = filled.length > 0 ? filled.length + 3 : 0;

  /* ---------------------------- drawing toolkit ----------------------------
     Everything below exists because the first version of these slides was a
     coloured rectangle with a caption, and nobody posts a coloured rectangle.
     What people post has depth: a photograph that fills the frame, a print with
     a white border sitting at an angle, a line of handwriting over a sky, a
     dashed route with a little aeroplane on it, a ticket stub, a strip of film.
     These are those pieces, drawn rather than imported, so the whole thing
     still weighs nothing and still never sends a photograph anywhere.
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

  /* object-fit: cover, on a canvas: fill the box, crop the overflow, never
     squash a face. */
  function cover2(
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
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    c.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    c.restore();
  }

  /* A photograph is not a background until it has been darkened: text over an
     unmodified holiday snap is unreadable half the time and amateur the other
     half. */
  function scrim(c: CanvasRenderingContext2D, W: number, H: number, from = 0.45) {
    const gradient = c.createLinearGradient(0, H * from, 0, H);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,0.74)");
    c.fillStyle = gradient;
    c.fillRect(0, H * from, W, H * (1 - from));
  }

  /* A wash of the property's own colour. It is what ties six snaps taken on
     three different phones into one series. */
  function wash(c: CanvasRenderingContext2D, W: number, H: number, alpha = 0.14) {
    c.save();
    c.globalCompositeOperation = "multiply";
    c.globalAlpha = alpha;
    c.fillStyle = palette.brand;
    c.fillRect(0, 0, W, H);
    c.restore();
  }

  /* Grain. A perfectly clean gradient looks like a template; a little noise
     looks like print. */
  function grain(c: CanvasRenderingContext2D, W: number, H: number, amount = 700) {
    c.save();
    c.globalAlpha = 0.045;
    for (let i = 0; i < amount; i += 1) {
      c.fillStyle = i % 2 ? "#ffffff" : "#000000";
      c.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    c.restore();
  }

  function paper(c: CanvasRenderingContext2D, W: number, H: number) {
    c.fillStyle = palette.canvas;
    c.fillRect(0, 0, W, H);
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
    grain(c, W, H, 400);
  }

  /* Crop marks: the mark of something meant for print, and the cheapest way to
     say "this was designed". */
  function cornerMarks(c: CanvasRenderingContext2D, W: number, H: number, alpha = 0.6) {
    c.save();
    c.strokeStyle = `rgba(255,255,255,${alpha})`;
    c.lineWidth = 3;
    const inset = 46;
    const L = 40;
    ([
      [inset, inset, 1, 1],
      [W - inset, inset, -1, 1],
      [inset, H - inset, 1, -1],
      [W - inset, H - inset, -1, -1],
    ] as [number, number, number, number][]).forEach(([x, y, dx, dy]) => {
      c.beginPath();
      c.moveTo(x, y + dy * L);
      c.lineTo(x, y);
      c.lineTo(x + dx * L, y);
      c.stroke();
    });
    c.restore();
  }

  function wrap(c: CanvasRenderingContext2D, text: string, max: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";
    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (c.measureText(test).width > max && line) {
        lines.push(line);
        line = word;
      } else line = test;
    });
    if (line) lines.push(line);
    return lines;
  }

  /* The line of writing that turns a photograph into a postcard. */
  function quote(
    c: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    max: number,
    size: number,
    color: string,
    align: CanvasTextAlign = "center",
    shadow = false,
  ) {
    c.save();
    c.textAlign = align;
    c.fillStyle = color;
    if (shadow) {
      c.shadowColor = "rgba(0,0,0,0.5)";
      c.shadowBlur = 18;
      c.shadowOffsetY = 4;
    }
    c.font = `400 ${size}px Caveat, ${font.body}, cursive`;
    const lines = wrap(c, text, max).slice(0, 3);
    lines.forEach((line, index) => c.fillText(line, x, y + index * size * 0.9));
    c.restore();
    return lines.length * size * 0.9;
  }

  function label(
    c: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    color: string,
    align: CanvasTextAlign = "left",
    size = 24,
  ) {
    c.save();
    c.textAlign = align;
    c.fillStyle = color;
    c.font = `600 ${size}px ${font.display}, sans-serif`;
    c.letterSpacing = "7px";
    c.fillText(text.toUpperCase(), x, y);
    c.letterSpacing = "0px";
    c.restore();
  }

  /* Hand-drawn furniture: an arrow that bends, a burst, a ring of dashes, a
     spark. Four marks, reused everywhere, and the reason these slides read as
     made by a person rather than assembled by a script. */
  function doodleArrow(
    c: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    lift = 90,
  ) {
    c.save();
    c.strokeStyle = color;
    c.fillStyle = color;
    c.lineWidth = 5;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(x1, y1);
    c.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 - lift, x2, y2);
    c.stroke();
    const angle = Math.atan2(y2 - ((y1 + y2) / 2 - lift), x2 - (x1 + x2) / 2);
    c.translate(x2, y2);
    c.rotate(angle);
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(-26, -12);
    c.lineTo(-26, 12);
    c.closePath();
    c.fill();
    c.restore();
  }

  function starburst(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, text: string) {
    c.save();
    c.translate(cx, cy);
    c.rotate(-0.16);
    c.fillStyle = palette.brand;
    c.beginPath();
    for (let i = 0; i < 24; i += 1) {
      const angle = (i / 24) * Math.PI * 2;
      const radius = i % 2 ? r * 0.8 : r;
      c.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    c.closePath();
    c.fill();
    c.fillStyle = "#ffffff";
    c.textAlign = "center";
    c.font = `600 ${Math.round(r * 0.3)}px ${font.display}, sans-serif`;
    c.fillText(text, 0, r * 0.1);
    c.restore();
  }

  function dashedRing(
    c: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    color: string,
  ) {
    c.save();
    c.strokeStyle = color;
    c.lineWidth = 4;
    c.setLineDash([12, 14]);
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }

  function sparkle(c: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
    c.save();
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x, y - r);
    c.quadraticCurveTo(x + r * 0.2, y - r * 0.2, x + r, y);
    c.quadraticCurveTo(x + r * 0.2, y + r * 0.2, x, y + r);
    c.quadraticCurveTo(x - r * 0.2, y + r * 0.2, x - r, y);
    c.quadraticCurveTo(x - r * 0.2, y - r * 0.2, x, y - r);
    c.fill();
    c.restore();
  }

  /* A torn paper edge, drawn rather than imaged so it never repeats the same
     way twice. */
  function tornEdge(c: CanvasRenderingContext2D, W: number, y: number, color: string, down = true) {
    c.save();
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(0, y);
    let x = 0;
    let seed = 1;
    while (x < W) {
      const step = 34 + ((seed * 37) % 26);
      const lift = ((seed * 53) % 22) - 11;
      c.lineTo(x + step, y + lift);
      x += step;
      seed += 1;
    }
    c.lineTo(W, down ? y + 4000 : y - 4000);
    c.lineTo(0, down ? y + 4000 : y - 4000);
    c.closePath();
    c.fill();
    c.restore();
  }

  /* A torn band with a height, as opposed to two half-plane fills that painted
     over both photographs — which is exactly what the first before-and-after
     slide did, and why it came out blank. */
  function tornBand(
    c: CanvasRenderingContext2D,
    W: number,
    y: number,
    h: number,
    color: string,
  ) {
    c.save();
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(0, y);
    let x = 0;
    let seed = 1;
    while (x < W) {
      const step = 34 + ((seed * 37) % 26);
      c.lineTo(x + step, y + (((seed * 53) % 20) - 10));
      x += step;
      seed += 1;
    }
    c.lineTo(W, y + h);
    x = W;
    seed = 7;
    while (x > 0) {
      const step = 34 + ((seed * 41) % 26);
      c.lineTo(x - step, y + h + (((seed * 59) % 20) - 10));
      x -= step;
      seed += 1;
    }
    c.closePath();
    c.fill();
    c.restore();
  }

  function tape(c: CanvasRenderingContext2D, x: number, y: number, w: number, angle: number) {
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    c.fillStyle = "rgba(255,255,255,0.6)";
    c.fillRect(-w / 2, -18, w, 36);
    c.strokeStyle = "rgba(0,0,0,0.06)";
    c.lineWidth = 2;
    c.strokeRect(-w / 2, -18, w, 36);
    c.restore();
  }

  /* A print with a white border, dropped at an angle with a real shadow: the
     single most recognisable object in travel scrapbooking. */
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
    const border = 20;
    const foot = caption ? 78 : border;
    c.save();
    c.translate(cx, cy);
    c.rotate(angle);
    c.shadowColor = "rgba(0,0,0,0.28)";
    c.shadowBlur = 34;
    c.shadowOffsetY = 12;
    c.fillStyle = "#ffffff";
    c.fillRect(-w / 2 - border, -h / 2 - border, w + border * 2, h + border + foot);
    c.shadowColor = "transparent";
    cover2(c, image, -w / 2, -h / 2, w, h);
    if (caption) {
      c.fillStyle = palette.body;
      c.textAlign = "center";
      c.font = `400 38px Caveat, ${font.body}, cursive`;
      c.fillText(caption, 0, h / 2 + 52);
    }
    c.restore();
  }

  /* The arch: a nod to the doorways these flats actually have, and a frame that
     flatters almost any photograph of a building. */
  function archPhoto(
    c: CanvasRenderingContext2D,
    image: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    c.save();
    c.shadowColor = "rgba(0,0,0,0.3)";
    c.shadowBlur = 36;
    c.shadowOffsetY = 14;
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.moveTo(x - 18, y + h + 18);
    c.lineTo(x - 18, y + w / 2);
    c.arc(x + w / 2, y + w / 2, w / 2 + 18, Math.PI, 0);
    c.lineTo(x + w + 18, y + h + 18);
    c.closePath();
    c.fill();
    c.shadowColor = "transparent";
    c.save();
    c.beginPath();
    c.moveTo(x, y + h);
    c.lineTo(x, y + w / 2);
    c.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
    c.lineTo(x + w, y + h);
    c.closePath();
    c.clip();
    const scale = Math.max(w / image.width, h / image.height);
    c.drawImage(
      image,
      x + (w - image.width * scale) / 2,
      y + (h - image.height * scale) / 2,
      image.width * scale,
      image.height * scale,
    );
    c.restore();
    c.restore();
  }

  /* A boarding pass: the photograph as the ticket body, the stub torn off down
     the perforation. Made for "before you leave". */
  function ticket(
    c: CanvasRenderingContext2D,
    image: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number,
    stubText: string,
  ) {
    const stub = w * 0.24;
    c.save();
    c.shadowColor = "rgba(0,0,0,0.3)";
    c.shadowBlur = 36;
    c.shadowOffsetY = 14;
    c.fillStyle = "#ffffff";
    roundRect(c, x, y, w, h, 18);
    c.fill();
    c.shadowColor = "transparent";
    cover2(c, image, x + 14, y + 14, w - stub - 22, h - 28);

    c.strokeStyle = palette.line;
    c.lineWidth = 3;
    c.setLineDash([10, 12]);
    c.beginPath();
    c.moveTo(x + w - stub, y + 18);
    c.lineTo(x + w - stub, y + h - 18);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = palette.canvas;
    [y, y + h].forEach((ny) => {
      c.beginPath();
      c.arc(x + w - stub, ny, 16, 0, Math.PI * 2);
      c.fill();
    });

    c.save();
    c.translate(x + w - stub / 2, y + h / 2);
    c.rotate(Math.PI / 2);
    c.fillStyle = palette.ink;
    c.textAlign = "center";
    c.font = `600 28px ${font.display}, sans-serif`;
    c.letterSpacing = "7px";
    c.fillText(stubText.toUpperCase().slice(0, 14), 0, 8);
    c.letterSpacing = "0px";
    c.restore();
    c.restore();
  }

  /* A strip of film: frames and sprocket holes. The right container for a
     sequence of moments from one afternoon. */
  function filmStrip(
    c: CanvasRenderingContext2D,
    images: HTMLImageElement[],
    cx: number,
    cy: number,
    w: number,
    h: number,
    angle: number,
  ) {
    c.save();
    c.translate(cx, cy);
    c.rotate(angle);
    c.shadowColor = "rgba(0,0,0,0.32)";
    c.shadowBlur = 30;
    c.shadowOffsetY = 12;
    c.fillStyle = "#141414";
    c.fillRect(-w / 2, -h / 2, w, h);
    c.shadowColor = "transparent";

    const pad = h * 0.16;
    const frameH = h - pad * 2;
    const frameW = (w - 24) / images.length;
    images.forEach((image, index) => {
      cover2(c, image, -w / 2 + 12 + index * frameW + 5, -h / 2 + pad, frameW - 10, frameH);
    });

    c.fillStyle = "rgba(255,255,255,0.85)";
    for (let sx = -w / 2 + 16; sx < w / 2 - 10; sx += 34) {
      c.fillRect(sx, -h / 2 + pad * 0.3, 16, 12);
      c.fillRect(sx, h / 2 - pad * 0.3 - 12, 16, 12);
    }
    c.restore();
  }

  /* The mark, drawn rather than loaded.

     A blue PNG would sit badly on a photograph and worse on the olive palette,
     and an image request would be the only network call this feature makes.
     Traced in whatever colour the slide needs, at the weight of a signature on
     the back of a print — visible to whoever looks for it, invisible to
     everyone scrolling past. */
  function mark(c: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
    c.save();
    c.translate(x, y);
    c.scale(size / 24, size / 24);
    c.strokeStyle = color;
    c.lineWidth = 2.4;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    c.moveTo(5, 4);
    c.lineTo(5, 17);
    c.stroke();
    c.beginPath();
    c.moveTo(12, 4);
    c.lineTo(14.5, 4);
    c.arc(14.5, 8, 4, -Math.PI / 2, Math.PI / 2);
    c.lineTo(12, 12);
    c.stroke();
    c.beginPath();
    c.moveTo(12.5, 12);
    c.lineTo(19, 18.5);
    c.stroke();
    c.restore();
  }

  function numberPin(c: CanvasRenderingContext2D, x: number, y: number, n: number) {
    c.save();
    c.fillStyle = palette.brand;
    c.beginPath();
    c.arc(x, y, 26, Math.PI, 0);
    c.lineTo(x, y + 42);
    c.closePath();
    c.fill();
    c.fillStyle = "#ffffff";
    c.textAlign = "center";
    c.font = `600 26px ${font.display}, sans-serif`;
    c.fillText(String(n), x, y + 9);
    c.restore();
  }

  function route(c: CanvasRenderingContext2D, W: number, y: number) {
    c.save();
    c.fillStyle = "rgba(255,255,255,0.9)";
    c.strokeStyle = "rgba(255,255,255,0.9)";
    c.lineWidth = 6;
    c.setLineDash([18, 20]);
    c.lineCap = "round";
    c.shadowColor = "rgba(0,0,0,0.35)";
    c.shadowBlur = 12;
    c.beginPath();
    c.moveTo(W * 0.1, y + 30);
    c.bezierCurveTo(W * 0.32, y - 150, W * 0.6, y + 150, W * 0.84, y - 70);
    c.stroke();
    c.setLineDash([]);
    c.beginPath();
    c.arc(W * 0.1, y + 30, 11, 0, Math.PI * 2);
    c.fill();
    c.translate(W * 0.84, y - 70);
    c.rotate(-0.65);
    c.beginPath();
    c.moveTo(38, 0);
    c.lineTo(-26, 20);
    c.lineTo(-14, 0);
    c.lineTo(-26, -20);
    c.closePath();
    c.fill();
    c.restore();
  }

  /* -------------------------------- slides --------------------------------
     One composition per section, chosen by how many photographs it holds. A
     section with one picture gets a frame, a mark and a line of handwriting; a
     section with several gets a collage built only from its own.
  ------------------------------------------------------------------------- */

  function drawCover(c: CanvasRenderingContext2D, W: number, H: number, hero?: HTMLImageElement) {
    if (hero) {
      cover2(c, hero, 0, 0, W, H);
      const top = c.createLinearGradient(0, 0, 0, H * 0.45);
      top.addColorStop(0, "rgba(0,0,0,0.6)");
      top.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = top;
      c.fillRect(0, 0, W, H * 0.45);
      scrim(c, W, H, 0.38);
      wash(c, W, H, 0.1);
    } else {
      c.fillStyle = palette.ink;
      c.fillRect(0, 0, W, H);
    }
    grain(c, W, H);
    cornerMarks(c, W, H);

    label(c, t.memory.coverTitle, W / 2, 150, "rgba(255,255,255,0.85)", "center", 26);
    route(c, W, H * 0.34);

    c.save();
    c.textAlign = "center";
    c.fillStyle = "#ffffff";
    c.shadowColor = "rgba(0,0,0,0.45)";
    c.shadowBlur = 30;
    c.font = `600 ${city.length > 12 ? 104 : 138}px ${font.display}, sans-serif`;
    c.fillText(city, W / 2, H * 0.7);
    c.restore();

    /* A rule split by the property name: the title reads as a masthead rather
       than a caption. */
    c.save();
    c.strokeStyle = "rgba(255,255,255,0.5)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(W * 0.12, H * 0.755);
    c.lineTo(W * 0.88, H * 0.755);
    c.stroke();
    c.restore();
    quote(c, propertyName, W / 2, H * 0.8, W * 0.8, 54, "#ffffff", "center", true);

    label(c, `${nights} ${t.tripNights}`, W / 2, H - 92, "rgba(255,255,255,0.75)", "center", 22);
    sparkle(c, W * 0.16, H * 0.62, 22, "rgba(255,255,255,0.9)");
    sparkle(c, W * 0.86, H * 0.55, 15, "rgba(255,255,255,0.75)");
    /* Bottom right, the size of a signature: the one slide everybody sees,
       credited without taking a millimetre from the photograph. */
    mark(c, W - 92, H - 118, 22, "rgba(255,255,255,0.45)");
  }

  /* ------------------------------ antes ---------------------------------- */

  function drawAntes(c: CanvasRenderingContext2D, W: number, H: number, images: HTMLImageElement[]) {
    paper(c, W, H);
    label(c, t.memory.prompts.antes.label, 72, 130, palette.brand, "left", 26);

    if (images.length === 1) {
      /* One photograph: the boarding pass, which turns a suitcase snap into an
         object rather than a picture with a title on it. */
      ticket(c, images[0], 84, 240, W - 168, 620, city);
      starburst(c, W * 0.86, 236, 84, `${nights}`);
      doodleArrow(c, W * 0.26, 930, W * 0.46, 1000, palette.brand, 60);
      quote(c, t.memory.quotes.antes, W / 2, 1120, W * 0.76, 60, palette.ink);
    } else if (images.length === 2) {
      polaroid(c, images[1], W * 0.66, H * 0.56, W * 0.4, W * 0.4, 0.1);
      tape(c, W * 0.66, H * 0.56 - W * 0.23, 140, 0.1 - 0.35);
      polaroid(c, images[0], W * 0.38, H * 0.38, W * 0.48, W * 0.5, -0.06);
      tape(c, W * 0.38, H * 0.38 - W * 0.28, 170, -0.06 + 0.3);
      quote(c, t.memory.quotes.antes, W / 2, H * 0.83, W * 0.78, 60, palette.ink);
    } else {
      filmStrip(c, images.slice(0, 3), W / 2, H * 0.44, W * 0.86, 380, -0.035);
      doodleArrow(c, W * 0.2, H * 0.63, W * 0.36, H * 0.68, palette.brand, 50);
      quote(c, t.memory.quotes.antes, W / 2, H * 0.79, W * 0.78, 62, palette.ink);
      if (images[3]) {
        polaroid(c, images[3], W * 0.78, H * 0.86, W * 0.3, W * 0.3, 0.09);
      }
    }
    label(c, city, 72, H - 84, palette.brand, "left", 26);
  }

  /* ----------------------------- llegada --------------------------------- */

  function drawLlegada(
    c: CanvasRenderingContext2D,
    W: number,
    H: number,
    images: HTMLImageElement[],
  ) {
    if (images.length === 1) {
      /* The arch frames a doorway better than a rectangle does, and this slide
         is always a doorway. */
      c.fillStyle = palette.ink;
      c.fillRect(0, 0, W, H);
      cover2(c, images[0], 0, 0, W, H);
      c.fillStyle = "rgba(0,0,0,0.45)";
      c.fillRect(0, 0, W, H);
      archPhoto(c, images[0], W * 0.16, H * 0.16, W * 0.68, H * 0.56);
      grain(c, W, H);
      label(c, t.memory.prompts.llegada.label, W / 2, H * 0.79, "rgba(255,255,255,0.85)", "center", 26);
      quote(c, t.memory.quotes.llegada, W / 2, H * 0.86, W * 0.78, 60, "#ffffff", "center", true);
      dashedRing(c, W * 0.16, H * 0.24, 54, "rgba(255,255,255,0.55)");
    } else if (images.length === 2) {
      /* A diagonal split: two moments of the same arrival, one cut. */
      cover2(c, images[0], 0, 0, W, H);
      c.save();
      c.beginPath();
      c.moveTo(W, 0);
      c.lineTo(W, H);
      c.lineTo(0, H);
      c.closePath();
      c.clip();
      cover2(c, images[1], 0, 0, W, H);
      c.restore();
      c.save();
      c.strokeStyle = "#ffffff";
      c.lineWidth = 14;
      c.beginPath();
      c.moveTo(W, 0);
      c.lineTo(0, H);
      c.stroke();
      c.restore();
      scrim(c, W, H, 0.62);
      grain(c, W, H);
      /* Label above the line, not below it: a quote that runs to two lines used
         to land on top of its own caption. */
      label(c, t.memory.prompts.llegada.label, W / 2, H - 250, "rgba(255,255,255,0.8)", "center", 24);
      quote(c, t.memory.quotes.llegada, W / 2, H - 170, W * 0.8, 64, "#ffffff", "center", true);
    } else {
      /* Mosaic: one big, two stacked. A room, a view, a detail. */
      paper(c, W, H);
      label(c, t.memory.prompts.llegada.label, 72, 130, palette.brand, "left", 26);
      const top = 200;
      const bigW = W * 0.56;
      const bigH = H * 0.44;
      cover2(c, images[0], 72, top, bigW, bigH);
      c.strokeStyle = "#ffffff";
      c.lineWidth = 14;
      c.strokeRect(72, top, bigW, bigH);
      const sideX = 72 + bigW + 26;
      const sideW = W - sideX - 72;
      cover2(c, images[1], sideX, top, sideW, bigH / 2 - 13);
      cover2(c, images[2], sideX, top + bigH / 2 + 13, sideW, bigH / 2 - 13);
      quote(c, t.memory.quotes.llegada, W / 2, top + bigH + 150, W * 0.8, 64, palette.ink);
      if (images[3]) polaroid(c, images[3], W * 0.74, H * 0.84, W * 0.32, W * 0.32, 0.08);
      label(c, city, 72, H - 84, palette.brand, "left", 26);
    }
  }

  /* ----------------------------- lugares --------------------------------- */

  function drawLugares(
    c: CanvasRenderingContext2D,
    W: number,
    H: number,
    images: HTMLImageElement[],
  ) {
    paper(c, W, H);
    label(c, t.memory.prompts.lugares.label, 72, 130, palette.brand, "left", 26);

    if (images.length === 1) {
      /* One place, so the slide becomes about the place: the photograph, the
         host's own list beside it, and the pin that ties them together. */
      polaroid(c, images[0], W * 0.44, H * 0.34, W * 0.56, W * 0.58, -0.04);
      numberPin(c, W * 0.72, H * 0.16, 1);
      const names = visitedNames.slice(0, 4);
      c.save();
      c.textAlign = "left";
      names.forEach((name, index) => {
        const y = H * 0.66 + index * 58;
        c.fillStyle = palette.brand;
        c.beginPath();
        c.arc(96, y - 10, 7, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = palette.body;
        c.font = `400 42px Caveat, ${font.body}, cursive`;
        c.fillText(name.slice(0, 26), 124, y);
      });
      c.restore();
      quote(c, t.memory.quotes.lugares, W / 2, H - 186, W * 0.78, 52, palette.ink);
    } else {
      /* Several places: prints scattered and numbered, joined by a dashed path
         — the map of an afternoon, without a map. */
      /* Pulled up and in: the last print used to sit on top of the closing
         line, which is the sort of collision nobody forgives in a post. */
      const spots: [number, number, number][] = [
        [0.33, 0.29, -0.07],
        [0.68, 0.4, 0.09],
        [0.34, 0.57, 0.05],
        [0.68, 0.68, -0.06],
      ];
      c.save();
      c.strokeStyle = palette.brand;
      c.globalAlpha = 0.5;
      c.lineWidth = 4;
      c.setLineDash([12, 14]);
      c.beginPath();
      spots.slice(0, images.length).forEach(([sx, sy], index) => {
        const x = W * sx;
        const y = H * sy;
        if (index === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      });
      c.stroke();
      c.restore();

      images.slice(0, 4).forEach((image, index) => {
        const [sx, sy, angle] = spots[index];
        const size = index === 0 ? W * 0.38 : W * 0.31;
        polaroid(c, image, W * sx, H * sy, size, size, angle);
        numberPin(c, W * sx - size / 2 - 6, H * sy - size / 2 - 6, index + 1);
      });
      quote(c, t.memory.quotes.lugares, W / 2, H - 190, W * 0.8, 54, palette.ink);
    }
    /* Low enough to clear a quote that runs to two lines: the collision only
       appears with certain phrasings, which is exactly the kind of bug that
       ships. */
    label(c, city, 72, H - 48, palette.brand, "left", 26);
  }

  /* ------------------------------ gente ---------------------------------- */

  function drawGente(c: CanvasRenderingContext2D, W: number, H: number, image: HTMLImageElement) {
    cover2(c, image, 0, 0, W, H);
    c.fillStyle = "rgba(0,0,0,0.55)";
    c.fillRect(0, 0, W, H);

    /* A vignette portrait: the crowd around it goes quiet and the faces do the
       work. */
    const r = W * 0.34;
    c.save();
    c.beginPath();
    c.arc(W / 2, H * 0.42, r + 14, 0, Math.PI * 2);
    c.fillStyle = "#ffffff";
    c.shadowColor = "rgba(0,0,0,0.4)";
    c.shadowBlur = 40;
    c.fill();
    c.shadowColor = "transparent";
    c.beginPath();
    c.arc(W / 2, H * 0.42, r, 0, Math.PI * 2);
    c.clip();
    cover2(c, image, W / 2 - r, H * 0.42 - r, r * 2, r * 2);
    c.restore();

    dashedRing(c, W / 2, H * 0.42, r + 44, "rgba(255,255,255,0.6)");
    sparkle(c, W / 2 - r - 40, H * 0.3, 20, "rgba(255,255,255,0.9)");
    sparkle(c, W / 2 + r + 34, H * 0.52, 16, "rgba(255,255,255,0.75)");
    grain(c, W, H);

    label(c, t.memory.prompts.gente.label, W / 2, H * 0.76, "rgba(255,255,255,0.85)", "center", 26);
    quote(c, t.memory.quotes.gente, W / 2, H * 0.84, W * 0.78, 70, "#ffffff", "center", true);
    label(c, city, W / 2, H - 84, "rgba(255,255,255,0.6)", "center", 22);
  }

  /* ------------------------------- loca ---------------------------------- */

  function drawLoca(c: CanvasRenderingContext2D, W: number, H: number, image: HTMLImageElement) {
    /* The loud one, on purpose. Every other slide is restrained, so this one
       gets the thick border, the tilt and the sticker — a carousel needs one
       slide that breaks its own rules or it reads as a brochure. */
    c.fillStyle = palette.brand;
    c.fillRect(0, 0, W, H);
    c.save();
    c.globalAlpha = 0.18;
    for (let y = 40; y < H; y += 46) {
      for (let x = 40; x < W; x += 46) {
        c.fillStyle = "#ffffff";
        c.beginPath();
        c.arc(x, y, 7, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.restore();

    c.save();
    c.translate(W / 2, H * 0.45);
    c.rotate(-0.05);
    c.shadowColor = "rgba(0,0,0,0.35)";
    c.shadowBlur = 40;
    c.shadowOffsetY = 16;
    c.fillStyle = "#ffffff";
    const w = W * 0.78;
    const h = W * 0.86;
    c.fillRect(-w / 2 - 22, -h / 2 - 22, w + 44, h + 44);
    c.shadowColor = "transparent";
    cover2(c, image, -w / 2, -h / 2, w, h);
    c.restore();

    tape(c, W * 0.24, H * 0.45 - W * 0.44, 180, -0.4);
    tape(c, W * 0.76, H * 0.45 + W * 0.44, 180, -0.4);
    starburst(c, W * 0.8, H * 0.22, 96, "!");
    quote(c, t.memory.quotes.loca, W / 2, H * 0.87, W * 0.82, 68, "#ffffff", "center", true);
    grain(c, W, H);
  }

  /* ---------------------------- despedida -------------------------------- */

  function drawDespedida(
    c: CanvasRenderingContext2D,
    W: number,
    H: number,
    image: HTMLImageElement,
    first?: HTMLImageElement,
  ) {
    if (first) {
      /* The one crossover the brief allows, and the only one that earns itself:
         the first day above the last, which is a before-and-after rather than a
         collage of unrelated afternoons. */
      cover2(c, first, 0, 0, W, H / 2);
      cover2(c, image, 0, H / 2, W, H / 2);
      c.save();
      c.fillStyle = "rgba(0,0,0,0.35)";
      c.fillRect(0, 0, W, H);
      c.restore();
      grain(c, W, H);
      /* The seam: a strip of paper torn along both edges, with the writing on
         it. Wide enough to carry the line, narrow enough that both days keep
         most of the frame. */
      tornBand(c, W, H / 2 - 88, 176, palette.canvas);
      label(c, t.memory.firstDay, 72, 120, "rgba(255,255,255,0.9)", "left", 26);
      label(c, t.memory.lastDay, W - 72, H - 92, "rgba(255,255,255,0.9)", "right", 26);
      quote(c, t.memory.quotes.despedida, W / 2, H / 2 + 4, W * 0.74, 54, palette.ink);
    } else {
      cover2(c, image, 0, 0, W, H);
      scrim(c, W, H, 0.4);
      wash(c, W, H, 0.12);
      grain(c, W, H);
      tornEdge(c, W, H * 0.72, palette.canvas, true);
      label(c, t.memory.prompts.despedida.label, 72, H * 0.79, palette.brand, "left", 26);
      quote(c, t.memory.quotes.despedida, 72, H * 0.86, W * 0.8, 66, palette.ink, "left");
    }
  }

  /* ------------------------------- closing -------------------------------- */

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
    stats.forEach(([value, text], index) => {
      const x = 72 + (index * (W - 190)) / 3;
      c.fillStyle = palette.brand;
      c.font = `600 84px ${font.display}, sans-serif`;
      c.fillText(value, x, 340);
      c.fillStyle = palette.body;
      c.globalAlpha = 0.65;
      c.font = `400 24px ${font.body}, sans-serif`;
      c.fillText(text, x, 382);
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

    if (image) {
      polaroid(c, image, W * 0.64, H * 0.76, W * 0.34, W * 0.34, 0.07);
      tape(c, W * 0.64, H * 0.76 - W * 0.2, 140, 0.07 - 0.3);
    }
  }

  function drawClosing(c: CanvasRenderingContext2D, W: number, H: number, image?: HTMLImageElement) {
    if (image) {
      cover2(c, image, 0, 0, W, H);
      c.fillStyle = "rgba(0,0,0,0.55)";
      c.fillRect(0, 0, W, H);
    } else {
      c.fillStyle = palette.ink;
      c.fillRect(0, 0, W, H);
    }
    grain(c, W, H);
    cornerMarks(c, W, H, 0.4);
    c.textAlign = "center";
    quote(c, t.memory.thanksTitle, W / 2, H / 2 - 10, W * 0.8, 118, "#ffffff", "center", true);
    c.fillStyle = "#ffffff";
    c.globalAlpha = 0.85;
    c.font = `600 40px ${font.display}, sans-serif`;
    c.fillText(propertyName, W / 2, H / 2 + 90);
    c.globalAlpha = 1;
    /* The quiet credit line: small enough not to spoil the picture, present
       enough to answer "where did that come from". */
    mark(c, W / 2 - 13, H - 158, 26, "rgba(255,255,255,0.55)");
    label(c, `${t.memory.madeWith} · Retorika Stay`, W / 2, H - 88, "rgba(255,255,255,0.5)", "center", 22);
  }

  /* ------------------------------- assembly -------------------------------- */

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  async function renderSlide(index: number, size: { w: number; h: number }): Promise<Blob> {
    const canvas = document.createElement("canvas");
    canvas.width = size.w;
    canvas.height = size.h;
    const c = canvas.getContext("2d");
    if (!c) throw new Error("2d context unavailable");
    c.textBaseline = "alphabetic";
    const { w: W, h: H } = size;

    if (index === 0) {
      drawCover(c, W, H, heroSrc ? await loadImage(heroSrc) : undefined);
      return toBlob(canvas);
    }

    if (index <= filled.length) {
      const id = filled[index - 1];
      const images = await Promise.all(album[id].map(loadImage));
      if (id === "antes") drawAntes(c, W, H, images);
      else if (id === "llegada") drawLlegada(c, W, H, images);
      else if (id === "lugares") drawLugares(c, W, H, images);
      else if (id === "gente") drawGente(c, W, H, images[0]);
      else if (id === "loca") drawLoca(c, W, H, images[0]);
      else {
        const arrival = album.llegada[0] ? await loadImage(album.llegada[0]) : undefined;
        drawDespedida(c, W, H, images[0], arrival);
      }
      return toBlob(canvas);
    }

    if (index === filled.length + 1) {
      const last = filled[filled.length - 1];
      drawStats(c, W, H, await loadImage(album[last][album[last].length - 1]));
      return toBlob(canvas);
    }

    drawClosing(c, W, H, heroSrc ? await loadImage(heroSrc) : undefined);
    return toBlob(canvas);
  }

  /* toBlob can return null, and the first version treated that as "skip this
     slide" — which is how a carousel quietly came out with eight images instead
     of nine. Now a failure is a failure: it retries once at a lower quality and
     then gives up loudly. */
  async function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    const attempt = (quality: number) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    const blob = (await attempt(0.92)) ?? (await attempt(0.8));
    if (!blob) throw new Error("canvas.toBlob returned null");
    return blob;
  }

  /* One archive, one download, one permission prompt.

     Nine separate downloads is what produced both of the problems the guest
     saw: browsers throttle bursts and ask to approve "multiple files", and a
     burst broken up by pauses reads as more than one burst, so the prompt
     appears twice. Worse, the old loop revoked each object URL immediately
     after clicking it — while the browser might not have finished reading the
     blob — which is why the missing slide was never the same one twice. */
  async function download(size: { w: number; h: number }, suffix: string) {
    setBusy(true);
    setError(null);
    try {
      const entries: { name: string; blob: Blob }[] = [];
      for (let index = 0; index < slideCount; index += 1) {
        setProgress({ done: index, total: slideCount });
        const blob = await renderSlide(index, size);
        entries.push({
          name: `${String(index + 1).padStart(2, "0")}-${suffix}.jpg`,
          blob,
        });
      }
      setProgress({ done: slideCount, total: slideCount });

      const archive = await zipStore(entries);
      try {
        navigator.sendBeacon?.(
          "/api/track",
          new Blob([JSON.stringify({ slug, kind: "keepsake", value: suffix })], {
            type: "application/json",
          }),
        );
      } catch {
        /* the keepsake matters, the counter does not */
      }
      const filename = `${slug}-${suffix}.zip`;

      /* Download, always. An earlier version handed the archive straight to the
         share sheet on phones, which sounds helpful and is not: the guest is
         asked to publish something they have not seen yet. Download first, look
         at it in their own gallery, share it if they like it — and that
         sequence is the same on a phone, a tablet and a laptop, which matters
         because we cannot reliably tell which one they are holding. */
      const url = URL.createObjectURL(archive);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      /* Attached to the document before clicking: a detached anchor is ignored
         by some browsers, which is its own silent failure. */
      document.body.appendChild(link);
      link.click();
      link.remove();
      /* Revoked late, and only after the browser has had time to read it. */
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setError(t.memory.failed);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  /* Live preview of the cover, so the guest sees the thing before committing to
     six file pickers. */
  useEffect(() => {
    const canvas = previewRef.current;
    const c = canvas?.getContext("2d");
    if (!canvas || !c) return;
    canvas.width = CAROUSEL.w;
    canvas.height = CAROUSEL.h;
    c.textBaseline = "alphabetic";
    void document.fonts?.ready.then(async () => {
      drawCover(c, CAROUSEL.w, CAROUSEL.h, heroSrc ? await loadImage(heroSrc) : undefined);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroSrc, theme, city, propertyName, nights]);

  return (
    <div className="no-print mt-4">
      <p className="text-sm text-white/80">{t.memory.readyIntro}</p>

      {/* Cover first: it is the one decision that changes the whole carousel. */}
      <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/15 p-3">
        <span className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-white/15">
          {heroSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroSrc} alt="" className="h-full w-full object-cover" />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-white">{t.memory.cover}</span>
          <span className="block text-[11px] text-white/60">{t.memory.coverHint}</span>
        </span>
        <label className="shrink-0 cursor-pointer rounded-full bg-white px-3 py-1.5 text-xs font-medium text-brand-ink">
          {cover ? t.memory.change : t.memory.addPhoto}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = () => setCover(String(reader.result));
                reader.readAsDataURL(file);
              }
            }}
          />
        </label>
      </div>

      <div className="mt-3 grid gap-2">
        {PROMPTS.map((id) => {
          const photos = album[id];
          const multi = MULTI.includes(id);
          return (
            <div key={id} className="rounded-xl bg-white/10 p-2.5">
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white">
                    {t.memory.prompts[id].label}
                    {multi ? (
                      <span className="ml-2 text-[11px] font-normal text-white/50">
                        {t.memory.multi}
                      </span>
                    ) : null}
                  </span>
                  <span className="block truncate text-[11px] text-white/60">
                    {t.memory.prompts[id].hint}
                  </span>
                </span>
                <label className="shrink-0 cursor-pointer rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white">
                  {photos.length > 0 && !multi ? t.memory.change : t.memory.addPhoto}
                  <input
                    type="file"
                    accept="image/*"
                    multiple={multi}
                    className="sr-only"
                    onChange={(event) => {
                      if (event.target.files?.length) addPhotos(id, event.target.files);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>

              {photos.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {photos.map((src, index) => (
                    <span key={index} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt=""
                        className="h-14 w-14 rounded-lg object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(id, index)}
                        aria-label={t.memory.remove}
                        className="absolute -right-1.5 -top-1.5 rounded-full bg-black/70 p-1 text-white"
                      >
                        <IconTrash size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <canvas
          ref={previewRef}
          className="w-24 rounded-lg border border-white/20"
          aria-label={t.memory.cover}
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
              {busy
                ? progress
                  ? `${progress.done} / ${progress.total}`
                  : t.memory.downloading
                : t.memory.downloadCarousel}{" "}
              <IconArrow size={15} />
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
          {error ? <p className="mt-2 text-[11px] text-white">{error}</p> : null}
          {slideCount > 0 && !error ? (
            <p className="mt-2 text-[11px] text-white/50">{t.memory.hint}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

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
