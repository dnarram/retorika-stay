import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import AuthPanel from "@/components/AuthPanel";
import { IconArrow, IconGlobe, IconKey, IconQr, IconWalk, IconWifi } from "@/components/icons";
import { currentHostId } from "@/lib/auth";
import { googleConfigured } from "@/lib/google";
import { getRepo } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function Home() {
  /* With a session already open the landing page adds nothing: go to the dashboard. */
  if (await currentHostId()) redirect("/panel");

  const repo = getRepo();
  const demo = await repo.listProperties("host_belen");

  return (
    <main className="min-h-screen">
      <section className="bg-brand-ink px-5 pb-16 pt-10 text-white">
        <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[1fr_380px] lg:items-start">
          <div>
            <Image
              src="/logo-retorika-blanco.png"
              alt="Retorika"
              width={175}
              height={89}
              priority
              className="h-12 w-auto"
            />
            <h1 className="mt-8 font-display text-4xl font-semibold leading-tight sm:text-5xl">
              Todo lo que tu huésped necesita saber, en un enlace.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/75">
              Rellenas la guía de tu casa una vez. Tu huésped escanea un QR y encuentra la entrada,
              el WiFi, las normas, tus recomendaciones y a quién llamar si algo va mal. En su idioma,
              sin instalar nada y sin registrarse.
            </p>

            <ul className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {[
                {
                  icon: <IconWalk size={20} />,
                  title: "Se reordena según el día",
                  body: "Antes de llegar manda la dirección; el último día, la hora de salida.",
                },
                {
                  icon: <IconKey size={20} />,
                  title: "El acceso caduca solo",
                  body: "Cuando termina la reserva, el código de la puerta deja de mostrarse.",
                },
                {
                  icon: <IconWifi size={20} />,
                  title: "QR de WiFi",
                  body: "Tu huésped escanea y el móvil se conecta. Sin teclear la clave.",
                },
                {
                  icon: <IconGlobe size={20} />,
                  title: "Cuatro idiomas",
                  body: "Se traduce sola y detecta el idioma del navegador del huésped.",
                },
                {
                  icon: <IconQr size={20} />,
                  title: "Un QR para la nevera",
                  body: "Lo imprimes y se acaban los mensajes a medianoche.",
                },
                {
                  icon: <IconArrow size={20} />,
                  title: "Funciona sin conexión",
                  body: "Quien aterriza sin datos abre la guía igual.",
                },
              ].map((feature) => (
                <li key={feature.title} className="flex gap-3">
                  <span className="mt-0.5 text-white/60">{feature.icon}</span>
                  <div>
                    <p className="font-display font-semibold">{feature.title}</p>
                    <p className="text-sm text-white/65">{feature.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <AuthPanel googleEnabled={googleConfigured()} />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="font-display text-xl font-semibold">Míralo por dentro</h2>
        <p className="mt-2 text-muted">
          Dos guías reales de ejemplo, tal y como las ve un huésped. No hace falta cuenta.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {demo.map((property) => (
            <Link
              key={property.id}
              href={`/g/${property.slug}`}
              className="group rounded-card border border-line bg-white p-6 transition hover:border-brand"
            >
              <p className="text-sm text-muted">{property.city}</p>
              <p className="mt-1 font-display text-xl font-semibold">{property.name}</p>
              <p className="mt-4 flex items-center gap-2 text-sm font-medium text-brand-deep">
                Ver la guía
                <IconArrow size={16} className="transition group-hover:translate-x-1" />
              </p>
              <p className="mt-2 text-xs text-muted">
                Enlace de muestra: enseña la guía entera menos lo que abre la casa.
              </p>
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-line px-5 py-8 text-sm text-muted">
        <div className="mx-auto max-w-5xl">
          Prueba técnica para el proceso de selección de Retorika Academy · David Naranjo Ramírez ·
          agosto de 2026
        </div>
      </footer>
    </main>
  );
}
