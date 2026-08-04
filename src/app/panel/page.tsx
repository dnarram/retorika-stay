import Link from "next/link";
import { redirect } from "next/navigation";
import { IconArrow, IconInfo } from "@/components/icons";
import { currentHostId } from "@/lib/auth";
import { completeness } from "@/lib/completeness";
import { getRepo } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const hostId = await currentHostId();
  if (!hostId) redirect("/panel/login");

  const repo = getRepo();
  const properties = await repo.listProperties(hostId);

  const rows = await Promise.all(
    properties.map(async (property) => {
      const [guides, places] = await Promise.all([
        repo.listGuides(property.id),
        repo.listPlaces(property.id),
      ]);
      return { property, ...completeness(property, guides, places) };
    }),
  );

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Retorika Stay</p>
          <h1 className="font-display text-2xl font-semibold">Tus alojamientos</h1>
        </div>
        <form action="/api/auth/logout" method="post">
          <button className="rounded-full px-4 py-2 text-sm font-medium ring-1 ring-line">Salir</button>
        </form>
      </header>

      {repo.mode === "demo" ? (
        <p className="mt-6 flex items-start gap-2 rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand-ink">
          <IconInfo size={18} />
          Modo demostración: no hay base de datos conectada, así que los cambios se guardan en
          memoria y se pierden al reiniciar el servidor. Define DATABASE_URL para usar PostgreSQL.
        </p>
      ) : null}

      <ul className="mt-6 space-y-4">
        {rows.map(({ property, score, pending }) => (
          <li key={property.id} className="rounded-card border border-line bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted">{property.city}</p>
                <p className="font-display text-lg font-semibold">{property.name}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  property.published ? "bg-ok-soft text-ok-ink" : "bg-alert-soft text-alert-ink"
                }`}
              >
                {property.published ? "Publicada" : "Sin publicar"}
              </span>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">Guía completada</span>
                <span className="font-medium">{score}%</span>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-soft"
                role="progressbar"
                aria-valuenow={score}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="h-full bg-brand" style={{ width: `${score}%` }} />
              </div>
            </div>

            {pending.length > 0 ? (
              <p className="mt-3 text-sm text-muted">
                Lo siguiente: <span className="text-ink">{pending[0].label}.</span> {pending[0].hint}
              </p>
            ) : (
              <p className="mt-3 text-sm text-ok-ink">La guía está completa.</p>
            )}

            <div className="mt-5 flex flex-wrap gap-2 text-sm">
              <Link
                href={`/panel/${property.id}`}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 font-medium text-white"
              >
                Editar guía <IconArrow size={16} />
              </Link>
              <Link
                href={`/g/${property.slug}`}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 font-medium ring-1 ring-line"
              >
                Vista del huésped
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
