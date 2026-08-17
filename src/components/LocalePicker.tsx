"use client";

import { useEffect, useState } from "react";
import { IconGlobe } from "@/components/icons";
import { LOCALE_NAMES } from "@/i18n/dictionaries";
import type { Locale } from "@/lib/schema";

/* ---------------------------------------------------------------------------
   Language, chosen once on the way in.

   Asking a host mid-edit which language their guide is in was the wrong moment
   and the wrong question: by then they have written half of it, and the control
   read as an offer to translate what they had already typed. The choice belongs
   before they start, so it is here on the landing page, defaulted from their
   browser and remembered in a cookie.

   From then on it is the language every guide they create is written in. It is
   deliberately NOT shown again inside the dashboard: a setting that follows you
   around invites you to change it, and changing the original language of a
   guide halfway through is not a preference, it is a rewrite.
--------------------------------------------------------------------------- */

export const LOCALE_COOKIE = "retorika_locale";

export default function LocalePicker({ current }: { current: Locale }) {
  const [value, setValue] = useState<Locale>(current);

  /* If the visitor has never chosen, follow the browser — and fall back to
     English rather than to Spanish, because a browser we do not recognise is
     more likely to belong to someone who reads English than to someone who
     reads Spanish. */
  useEffect(() => {
    if (document.cookie.includes(`${LOCALE_COOKIE}=`)) return;
    const supported = Object.keys(LOCALE_NAMES) as Locale[];
    const preferred = navigator.languages
      .map((tag) => tag.slice(0, 2).toLowerCase())
      .find((tag) => supported.includes(tag as Locale)) as Locale | undefined;
    const next = preferred ?? "en";
    if (next !== value) {
      setValue(next);
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function choose(next: Locale) {
    setValue(next);
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    /* A reload rather than client-side state: the choice has to reach the
       server, which is what decides the language of every guide created from
       here on. */
    window.location.reload();
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
      <IconGlobe size={14} />
      <label className="sr-only" htmlFor="app-locale">
        {LOCALE_NAMES[value]}
      </label>
      <select
        id="app-locale"
        value={value}
        onChange={(event) => choose(event.target.value as Locale)}
        className="bg-transparent text-xs text-white outline-none [&>option]:text-ink"
      >
        {(Object.keys(LOCALE_NAMES) as Locale[]).map((code) => (
          <option key={code} value={code}>
            {LOCALE_NAMES[code]}
          </option>
        ))}
      </select>
    </div>
  );
}
