"use client";

import { useState } from "react";
import { IconArrow, IconTrash } from "./editor-icons";

/* ---------------------------------------------------------------------------
   A list of steps the host can reorder by hand, plus the assistant.

   Both sequences in the guide — how to get in, how to leave — are the same kind
   of thing, so they get the same tools. Offering the assistant on one and not
   the other was an accident of the order in which they were built.

   Reordering is native HTML5 drag and drop for the mouse, with up/down buttons
   beside every row for touch and for keyboards. Drag and drop alone would have
   locked out exactly the host working from a phone, and this is the editor they
   are most likely to open on the sofa.
--------------------------------------------------------------------------- */

export default function StepsEditor({
  label,
  items,
  onChange,
  placeholder,
  suggestions = [],
  onAssist,
  assistLabel,
  assistHint,
  assistResult,
  onAcceptAssist,
  onDismissAssist,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  suggestions?: readonly string[];
  onAssist?: () => void;
  assistLabel?: string;
  assistHint?: string;
  assistResult?: string | null;
  onAcceptAssist?: () => void;
  onDismissAssist?: () => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="text-sm">
      <p className="font-medium">{label}</p>

      <ul className="mt-2 space-y-2">
        {items.map((item, index) => (
          <li
            key={index}
            draggable
            onDragStart={() => setDragging(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragging !== null) move(dragging, index);
              setDragging(null);
            }}
            onDragEnd={() => setDragging(null)}
            className={`flex gap-2 rounded-xl border border-line p-2 ${
              dragging === index ? "opacity-50" : ""
            }`}
          >
            <div className="flex flex-col items-center gap-1 pt-1">
              <span className="text-xs font-semibold text-muted">{index + 1}</span>
              {/* Buttons as well as dragging: a host on a phone cannot drag, and
                  neither can a keyboard. */}
              <button
                type="button"
                onClick={() => move(index, index - 1)}
                disabled={index === 0}
                aria-label="Subir"
                className="text-muted disabled:opacity-25"
              >
                <IconArrow size={14} className="-rotate-90" />
              </button>
              <button
                type="button"
                onClick={() => move(index, index + 1)}
                disabled={index === items.length - 1}
                aria-label="Bajar"
                className="text-muted disabled:opacity-25"
              >
                <IconArrow size={14} className="rotate-90" />
              </button>
            </div>

            <textarea
              value={item}
              rows={2}
              placeholder={placeholder}
              onChange={(event) => {
                const next = [...items];
                next[index] = event.target.value;
                onChange(next);
              }}
              className="w-full rounded-lg border border-line px-3 py-2 outline-none focus:border-brand"
            />

            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              aria-label="Eliminar"
              className="self-start pt-1 text-muted hover:text-alert-ink"
            >
              <IconTrash size={16} />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange([...items, ""])}
          className="rounded-full px-4 py-2 text-sm font-medium ring-1 ring-line"
        >
          Añadir paso
        </button>
        {suggestions
          .filter((suggestion) => !items.includes(suggestion))
          .map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onChange([...items, suggestion])}
              className="rounded-full px-3 py-2 text-xs font-medium text-brand-deep ring-1 ring-brand-line"
            >
              + {suggestion}
            </button>
          ))}
      </div>

      {onAssist ? (
        <div className="mt-3 rounded-xl bg-brand-soft p-3">
          <button
            type="button"
            onClick={onAssist}
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-brand-deep ring-1 ring-brand-line"
          >
            {assistLabel}
          </button>
          {assistHint ? <p className="mt-2 text-xs text-brand-ink">{assistHint}</p> : null}
          {assistResult ? (
            <div className="mt-3 rounded-lg bg-white p-3 text-sm">
              <pre className="whitespace-pre-wrap font-sans">{assistResult}</pre>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={onAcceptAssist}
                  className="rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-white"
                >
                  Usar
                </button>
                <button
                  type="button"
                  onClick={onDismissAssist}
                  className="rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-line"
                >
                  Descartar
                </button>
              </div>
              <p className="mt-2 text-xs text-muted">
                Si el orden no te convence, arrastra los pasos o usa las flechas.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
