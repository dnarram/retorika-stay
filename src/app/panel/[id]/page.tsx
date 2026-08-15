import { notFound, redirect } from "next/navigation";
import { currentHostId } from "@/lib/auth";
import { completeness } from "@/lib/completeness";
import { getRepo } from "@/lib/repo";
import Editor from "./Editor";

export const dynamic = "force-dynamic";

export default async function EditorPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paso?: string }>;
}) {
  const hostId = await currentHostId();
  if (!hostId) redirect("/panel/login");

  const { id } = await props.params;
  const { paso } = await props.searchParams;
  const repo = getRepo();
  const property = await repo.getProperty(id);
  if (!property || property.hostId !== hostId) notFound();

  const [guides, places] = await Promise.all([repo.listGuides(id), repo.listPlaces(id)]);
  const { score, checks } = completeness(property, guides, places);

  return (
    <Editor
      property={property}
      guides={guides}
      places={places}
      initialScore={score}
      checks={checks}
      mode={repo.mode}
      initialStep={Math.min(Math.max(Number(paso) || 1, 1), 7)}
    />
  );
}
