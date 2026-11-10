import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { StoryForm } from "@/components/story-form";
import { getAccessibleStories } from "@/lib/family-stories";
import { requireSession } from "@/lib/session";
import { getAccessiblePeople, getAccessibleTree } from "@/lib/trees";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StoriesPage({ params }: { params: Promise<{ treeId: string }> }) {
  const { user } = await requireSession();
  const { treeId } = await params;
  if (!uuid.test(treeId)) notFound();
  const tree = await getAccessibleTree(user.id, treeId);
  if (!tree) notFound();
  const [stories, people] = await Promise.all([getAccessibleStories(user.id, treeId), getAccessiblePeople(user.id, treeId)]);
  if (!stories) notFound();
  const canEdit = tree.ownerId === user.id || tree.collaboratorRole === "editor";
  return <div className="space-y-8">
    <Link href={`/dashboard/trees/${treeId}`} className="text-link inline-flex items-center gap-2 text-sm"><ArrowLeft className="size-4" /> {tree.name}</Link>
    <header className="border-b border-[#dce7d9] pb-7"><p className="eyebrow mb-2 inline-flex items-center gap-2"><BookOpen className="size-4" /> Memoria compartida</p><h1 className="page-title">Historias familiares</h1><p className="mt-3 text-sm text-[#617366]">Relatos del árbol, con o sin familiares asociados.</p></header>
    <section aria-label="Relatos registrados" className="space-y-4">
      <h2 className="section-title">Relatos registrados</h2>
      {stories.length === 0 ? <p className="soft-panel border-dashed p-6 text-sm text-[#718274]">Todavía no hay historias familiares. {canEdit ? "Registra el primer relato para comenzar." : "Vuelve más tarde para descubrirlas."}</p> :
        <ul className="grid gap-4 sm:grid-cols-2">{stories.map((story) => <li key={story.id} className="soft-panel space-y-3 p-5">
          <p className="text-xs text-[#718274]">{story.createdAt.toLocaleDateString("es-ES", { dateStyle: "long" })}</p>
          <h3 className="font-heading text-xl font-semibold text-[#193d2b]"><Link className="text-link" href={`/dashboard/trees/${treeId}/stories/${story.id}`}>{story.title}</Link></h3>
          <p className="line-clamp-3 whitespace-pre-wrap text-sm text-[#516655]">{story.body}</p>
          <p className="text-xs text-[#718274]">{story.participants.length ? story.participants.map((person) => person.displayName).join(", ") : "Relato general"}</p>
        </li>)}</ul>}
    </section>
    {canEdit && <section aria-label="Registrar relato" className="soft-panel max-w-3xl space-y-5 p-5 sm:p-6"><h2 className="section-title">Nuevo relato</h2><StoryForm treeId={treeId} people={people} /></section>}
  </div>;
}
