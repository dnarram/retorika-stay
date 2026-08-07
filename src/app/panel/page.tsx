import { redirect } from "next/navigation";
import { currentHostId } from "@/lib/auth";
import { completeness } from "@/lib/completeness";
import { getRepo } from "@/lib/repo";
import { needsCodeRotation, stayPhase } from "@/lib/stay";
import PanelClient, { type PropertyRow } from "@/components/PanelClient";

export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const hostId = await currentHostId();
  if (!hostId) redirect("/");

  const repo = getRepo();
  const properties = await repo.listProperties(hostId);

  const rows: PropertyRow[] = await Promise.all(
    properties.map(async (property) => {
      const [guides, places, stays, metrics] = await Promise.all([
        repo.listGuides(property.id),
        repo.listPlaces(property.id),
        repo.listStays(property.id),
        repo.metrics(property.id),
      ]);
      const { score, pending } = completeness(property, guides, places);
      const opens = metrics.filter((m) => m.kind === "apertura").reduce((n, m) => n + m.count, 0);

      return {
        id: property.id,
        slug: property.slug,
        name: property.name,
        city: property.city,
        published: property.published,
        score,
        nextStep: pending[0] ? { label: pending[0].label, hint: pending[0].hint } : null,
        /* El aviso que ningún competidor va a tener: una estancia ha terminado y
           el código de la puerta sigue siendo el mismo que tenía ese huésped. */
        rotateCode: needsCodeRotation(property, stays),
        stays: stays.map((stay) => ({
          id: stay.id,
          slug: stay.slug,
          guestName: stay.guestName,
          arrival: stay.arrival,
          departure: stay.departure,
          revoked: stay.revoked,
          phase: stayPhase(stay),
        })),
        metrics: {
          opens,
          languages: metrics
            .filter((m) => m.kind === "idioma")
            .map((m) => ({ value: m.value, count: m.count })),
          misses: metrics
            .filter((m) => m.kind === "busqueda_sin_resultado")
            .slice(0, 5)
            .map((m) => ({ value: m.value, count: m.count })),
        },
      };
    }),
  );

  return <PanelClient rows={rows} mode={repo.mode} />;
}
