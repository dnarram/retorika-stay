"use client";

import { useState } from "react";
import { getDictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/lib/schema";

export default function PinGate({
  slug,
  locale,
  propertyName,
}: {
  slug: string;
  locale: Locale;
  propertyName: string;
}) {
  const t = getDictionary(locale);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const response = await fetch(`/api/guide/${slug}/unlock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    setBusy(false);
    if (response.ok) window.location.reload();
    else setError(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-brand-ink px-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-card bg-white p-7">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">{propertyName}</p>
        <h1 className="mt-2 font-display text-xl font-semibold">{t.pin.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.pin.body}</p>
        <label className="sr-only" htmlFor="pin">
          PIN
        </label>
        <input
          id="pin"
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9]{4}"
          maxLength={4}
          value={pin}
          onChange={(event) => {
            setPin(event.target.value.replace(/\D/g, ""));
            setError(false);
          }}
          className="mt-5 w-full rounded-xl border border-line px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] outline-none focus:border-brand"
        />
        {error ? <p className="mt-2 text-sm text-alert-ink">{t.pin.error}</p> : null}
        <button
          type="submit"
          disabled={pin.length !== 4 || busy}
          className="mt-4 w-full rounded-full bg-brand px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
        >
          {t.pin.submit}
        </button>
      </form>
    </main>
  );
}
