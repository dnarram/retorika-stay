"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* Sign in and sign up in the same card, behind two tabs: the host arriving from
   an ad and the one who already has an account land in the same place, and
   nobody has to hunt for a small "create account" link. */
export default function AuthPanel({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"entrar" | "crear">("entrar");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const endpoint = mode === "entrar" ? "/api/auth/login" : "/api/auth/register";
    const body = mode === "entrar" ? { email, password } : { name, email, password };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (response.ok) {
      router.push("/panel");
      router.refresh();
      return;
    }
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setError(payload?.error ?? "No se pudo completar la operación.");
  }

  function demo() {
    setMode("entrar");
    setEmail("belen@retorika.es");
    setPassword("retorika2026");
  }

  return (
    <div className="rounded-card bg-white p-6 text-ink shadow-sm">
      {googleEnabled ? (
        <>
          <a
            href="/api/auth/google"
            className="flex w-full items-center justify-center gap-3 rounded-full border border-line px-4 py-3 text-sm font-medium hover:border-brand"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
              <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.3-.2-1.9H9v3.5h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5Z" />
              <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.3c-.8.6-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18Z" />
              <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3Z" />
              <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6Z" />
            </svg>
            Continuar con Google
          </a>
          <div className="my-5 flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" /> o con tu correo <span className="h-px flex-1 bg-line" />
          </div>
        </>
      ) : null}

      <div className="flex gap-1 rounded-full bg-canvas p-1 text-sm font-medium">
        {(["entrar", "crear"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setMode(option);
              setError(null);
            }}
            aria-pressed={mode === option}
            className={`flex-1 rounded-full px-4 py-2 ${
              mode === option ? "bg-brand text-white" : "text-muted"
            }`}
          >
            {option === "entrar" ? "Entrar" : "Crear cuenta"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-5 space-y-3 text-sm">
        {mode === "crear" ? (
          <label className="block">
            <span className="font-medium">Nombre</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 outline-none focus:border-brand"
            />
          </label>
        ) : null}

        <label className="block">
          <span className="font-medium">Correo</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 outline-none focus:border-brand"
          />
        </label>

        <label className="block">
          <span className="font-medium">Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "entrar" ? "current-password" : "new-password"}
            className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 outline-none focus:border-brand"
          />
          {mode === "crear" ? (
            <span className="mt-1 block text-xs text-muted">Mínimo 8 caracteres.</span>
          ) : null}
        </label>

        {error ? <p className="text-sm text-alert-ink">{error}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-brand px-4 py-3 font-medium text-white disabled:opacity-40"
        >
          {mode === "entrar" ? "Entrar" : "Crear cuenta"}
        </button>
      </form>

      <button
        type="button"
        onClick={demo}
        className="mt-4 w-full rounded-xl bg-brand-soft px-3 py-2 text-xs text-brand-ink"
      >
        Rellenar con la cuenta de demostración
      </button>
    </div>
  );
}
