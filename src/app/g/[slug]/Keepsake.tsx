"use client";

import { useRef, useState } from "react";
import { IconArrow } from "@/components/icons";

/* ---------------------------------------------------------------------------
   Tarjeta de recuerdo.

   La foto que elige el huésped NUNCA sale de su móvil: se dibuja en un canvas
   local y se descarga desde ahí. Sin subida, sin almacenamiento, sin coste y
   sin un solo problema de protección de datos. Es la única forma honesta de
   ofrecer algo "compartible" en una app que presume de no pedirle nada a quien
   la abre.
--------------------------------------------------------------------------- */

export default function Keepsake({
  title,
  city,
  stats,
  label,
  hint,
}: {
  title: string;
  city: string;
  stats: { value: string; label: string }[];
  label: string;
  hint: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  function draw(file: File) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const image = new Image();
    image.onload = () => {
      const W = (canvas.width = 1080);
      const H = (canvas.height = 1350);

      /* La foto se recorta al centro manteniendo proporción: nadie quiere su
         recuerdo deformado. */
      const scale = Math.max(W / image.width, (H - 260) / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      context.drawImage(image, (W - w) / 2, (H - 260 - h) / 2, w, h);

      const fade = context.createLinearGradient(0, H - 620, 0, H - 260);
      fade.addColorStop(0, "rgba(18,81,125,0)");
      fade.addColorStop(1, "rgba(18,81,125,0.92)");
      context.fillStyle = fade;
      context.fillRect(0, H - 620, W, 360);

      context.fillStyle = "#12517d";
      context.fillRect(0, H - 260, W, 260);

      context.fillStyle = "#ffffff";
      context.font = "600 58px Outfit, system-ui, sans-serif";
      context.fillText(title.slice(0, 24), 64, H - 176);
      context.fillStyle = "rgba(255,255,255,.72)";
      context.font = "400 32px Inter, system-ui, sans-serif";
      context.fillText(city, 64, H - 128);

      stats.forEach((stat, index) => {
        const x = 64 + index * 320;
        context.fillStyle = "#ffffff";
        context.font = "600 52px Outfit, system-ui, sans-serif";
        context.fillText(stat.value, x, H - 62);
        context.fillStyle = "rgba(255,255,255,.72)";
        context.font = "400 24px Inter, system-ui, sans-serif";
        context.fillText(stat.label, x, H - 26);
      });

      setReady(true);
      URL.revokeObjectURL(image.src);
    };
    image.src = URL.createObjectURL(file);
  }

  function download() {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "recuerdo.png";
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  return (
    <div className="no-print mt-4">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-white">
        {label}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) draw(file);
          }}
        />
      </label>
      <p className="mt-2 text-xs text-muted">{hint}</p>
      <canvas
        ref={canvasRef}
        className={ready ? "mt-4 w-full max-w-[280px] rounded-xl border border-line" : "hidden"}
      />
      {ready ? (
        <button
          type="button"
          onClick={download}
          className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1 ring-brand-line"
        >
          PNG <IconArrow size={16} />
        </button>
      ) : null}
    </div>
  );
}
