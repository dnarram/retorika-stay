"use client";

import { useEffect, useState } from "react";
import { IconCheck } from "@/components/icons";

/* ---------------------------------------------------------------------------
   "Did this help?" — two words, two taps, and then it stops asking.

   Thumbs were the obvious idea and I think they are slightly the wrong one
   here: a thumb down invites a guest to rate the host's writing, which is not
   the question. The useful question is narrower — did this section answer what
   you came for — because an answer of "no" tells the host exactly which section
   to rewrite, which is actionable in a way that a rating is not.

   Everything about this is built to be ignorable. It sits at the foot of a
   section, in muted type, at the size of a caption. It never blocks anything,
   it never asks twice on the same device, and answering it takes one tap with
   no dialog, no comment box and no thank-you screen — the control simply
   becomes a quiet acknowledgement.

   What travels is a counter: the section id and a yes or no, aggregated per
   property. No identifier of any kind, exactly like every other metric here.
--------------------------------------------------------------------------- */

export default function Helpful({
  slug,
  section,
  question,
  yes,
  no,
  thanks,
}: {
  slug: string;
  /* "guide" for the one at the end of everything. */
  section: string;
  question: string;
  yes: string;
  no: string;
  thanks: string;
}) {
  const [answered, setAnswered] = useState(false);
  const storageKey = `helpful_${slug}_${section}`;

  useEffect(() => {
    setAnswered(Boolean(localStorage.getItem(storageKey)));
  }, [storageKey]);

  function answer(value: "si" | "no") {
    setAnswered(true);
    localStorage.setItem(storageKey, value);
    const body = JSON.stringify({ slug, kind: "helpful", value: `${section}:${value}` });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
        return;
      }
      void fetch("/api/track", { method: "POST", body, keepalive: true });
    } catch {
      /* offline: the guide matters, the counter does not */
    }
  }

  if (answered) {
    return (
      <p className="no-print mt-3 flex items-center gap-1.5 text-xs text-muted">
        <IconCheck size={13} /> {thanks}
      </p>
    );
  }

  return (
    <div className="no-print mt-3 flex items-center gap-2 text-xs text-muted">
      <span>{question}</span>
      <button
        type="button"
        onClick={() => answer("si")}
        className="rounded-full px-2.5 py-1 font-medium ring-1 ring-line hover:ring-brand"
      >
        {yes}
      </button>
      <button
        type="button"
        onClick={() => answer("no")}
        className="rounded-full px-2.5 py-1 font-medium ring-1 ring-line hover:ring-brand"
      >
        {no}
      </button>
    </div>
  );
}
