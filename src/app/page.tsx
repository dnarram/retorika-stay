import Link from "next/link";
import { IconArrow, IconGlobe, IconKey, IconQr, IconWalk, IconWifi } from "@/components/icons";
import { getRepo } from "@/lib/repo";

export default async function Home() {
  const repo = getRepo();
  const properties = await repo.listProperties("host_belen");

  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:py-16">
      <header className="flex items-center justify-between">
        <span className="font-display text-lg font-semibold text-[var(--color-brand-ink)]">
          Retorika Stay
        </span>
        <Link
          href="/panel"
          className="rounded-full border border-[var(--color-brand-line)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-brand-deep)] hover:border-[var(--color-brand)]"
        >
          Entrar como anfitrión
        </Link>
      </header>

      <section className="mt-12 max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-wide text-[var(--color-brand)]">
          Prueba técnica · Retorika Academy
        </p>
        <h1 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
          Un enlace con todo lo que tu huésped necesita saber.
        </h1>
        <p className="mt-5 text-lg text-[var(--color-muted)]">
          El anfitrión rellena una plantilla una vez. El huésped escanea un QR y encuentra la
          entrada, el WiFi, las normas, tus recomendaciones y a quién llamar si algo va mal, en su
          idioma y sin instalar nada.
        </p>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        {properties.map((property) => (
          <Link
            key={property.id}
            href={`/g/${property.slug}`}
            className="group rounded-[var(--radius-card)] border border-[var(--color-line)] bg-white p-6 transition hover:border-[var(--color-brand)]"
          >
            <p className="text-sm text-[var(--color-muted)]">{property.city}</p>
            <p className="mt-1 font-display text-xl font-semibold">{property.name}</p>
            <p className="mt-4 flex items-center gap-2 text-sm font-medium text-[var(--color-brand-deep)]">
              Ver la guía del huésped
              <IconArrow size={16} className="transition group-hover:translate-x-1" />
            </p>
            {property.pin ? (
              <p className="mt-2 text-xs text-[var(--color-muted)]">
                Protegida con PIN · usa 2610 para entrar
              </p>
            ) : null}
          </Link>
        ))}
      </section>

      <section className="mt-14">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Qué resuelve
        </h2>
        <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: <IconWalk size={22} />,
              title: "Se reordena según el día",
              body: "Antes de llegar manda la dirección; el último día, la hora de salida. La guía se recoloca sola.",
            },
            {
              icon: <IconKey size={22} />,
              title: "El código, solo cuando toca",
              body: "El código de la puerta no viaja al navegador fuera de la ventana de la reserva.",
            },
            {
              icon: <IconWifi size={22} />,
              title: "QR de WiFi",
              body: "El huésped escanea y el móvil se conecta. Sin teclear una clave de veinte caracteres.",
            },
            {
              icon: <IconGlobe size={22} />,
              title: "Cuatro idiomas",
              body: "Español, inglés, francés y portugués, detectados desde el navegador del huésped.",
            },
            {
              icon: <IconQr size={22} />,
              title: "Un QR para la nevera",
              body: "El anfitrión descarga el código, lo imprime y se acabaron los mensajes a medianoche.",
            },
            {
              icon: <IconArrow size={22} />,
              title: "Funciona sin conexión",
              body: "Quien aterriza sin datos abre la guía igual: se guarda en el móvil al primer acceso.",
            },
          ].map((feature) => (
            <li key={feature.title} className="rounded-[var(--radius-card)] bg-white p-5 border border-[var(--color-line)]">
              <span className="text-[var(--color-brand)]">{feature.icon}</span>
              <p className="mt-3 font-display font-semibold">{feature.title}</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{feature.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-16 border-t border-[var(--color-line)] pt-6 text-sm text-[var(--color-muted)]">
        <p>
          Prueba técnica para el proceso de selección de Retorika Academy · David Naranjo Ramírez ·
          agosto de 2026
        </p>
      </footer>
    </main>
  );
}
