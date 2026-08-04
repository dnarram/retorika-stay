"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("belen@retorika.es");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setBusy(false);
    if (response.ok) router.push("/panel");
    else setError("Correo o contraseña incorrectos.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-card border border-line bg-white p-7">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Retorika Stay</p>
        <h1 className="mt-2 font-display text-xl font-semibold">Panel del anfitrión</h1>

        <label className="mt-6 block text-sm font-medium" htmlFor="email">
          Correo
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 outline-none focus:border-brand"
        />

        <label className="mt-4 block text-sm font-medium" htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 outline-none focus:border-brand"
        />

        {error ? <p className="mt-3 text-sm text-alert-ink">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-full bg-brand px-4 py-3 text-sm font-medium text-white disabled:opacity-40"
        >
          Entrar
        </button>

        <p className="mt-4 rounded-xl bg-brand-soft px-3 py-2 text-xs text-brand-ink">
          Acceso de demostración: <strong>belen@retorika.es</strong> / <strong>retorika2026</strong>
        </p>
      </form>
    </main>
  );
}
