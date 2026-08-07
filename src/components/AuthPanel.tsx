"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/* Entrar y registrarse en la misma tarjeta, alternando con dos pestañas: el
   anfitrión que llega desde un anuncio y el que ya es cliente aterrizan en el
   mismo sitio y no tienen que buscar el enlace pequeño de "crear cuenta". */
export default function AuthPanel() {
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
