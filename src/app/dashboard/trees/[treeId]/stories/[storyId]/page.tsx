import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { StoryForm } from "@/components/story-form";
import { getAccessibleStories } from "@/lib/family-stories";
import { requireSession } from "@/lib/session";
import { getAccessiblePeople, getAccessibleTree } from "@/lib/trees";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function StoryPage({ params }: { params: Promise<{ treeId: string; storyId: string }> }) {
  const { user } = await requireSession();
  const { treeId, storyId } = await params;
  if (!uuid.test(treeId) || !uuid.test(storyId)) notFound();
  const tree = await getAccessibleTree(user.id, treeId);
  if (!tree) notFound();
  const [stories, people] = await Promise.all([getAccessibleStories(user.id, treeId, { storyId }), getAccessiblePeople(user.id, treeId)]);
  const story = stories?.[0];
  if (!story) notFound();
  const canEdit = tree.ownerId === user.id || tree.collaboratorRole === "editor";
  return <article className="max-w-4xl space-y-8">
    <Link href={`/dashboard/trees/${treeId}/stories`} className="text-link inline-flex items-center gap-2 text-sm"><ArrowLeft className="size-4" /> Historias familiares</Link>
    <header className="border-b border-[#dce7d9] pb-7"><p className="eyebrow mb-2">Historia familiar</p><h1 className="page-title">{story.title}</h1><p className="mt-3 text-sm text-[#718274]">Creado el {story.createdAt.toLocaleDateString("es-ES", { dateStyle: "long" })}</p></header>
    <div className="soft-panel whitespace-pre-wrap p-6 leading-8 text-[#284c34]">{story.body}</div>
    <section aria-label="Participantes" className="space-y-4"><h2 className="section-title">Familiares asociados</h2>
      {story.participants.length === 0 ? <p className="soft-panel border-dashed p-5 text-sm text-[#718274]">Este relato es general y no está asociado a ninguna persona.</p> :
        <ul className="flex flex-wrap gap-3">{story.participants.map((person) => <li key={person.id}><Link className="text-link soft-panel inline-flex items-center gap-2 px-4 py-3 text-sm" href={`/dashboard/trees/${treeId}/people/${person.id}`}>{person.displayName}<ArrowUpRight className="size-4" /></Link></li>)}</ul>}
    </section>
    {canEdit && <section aria-label="Editar relato" className="soft-panel space-y-5 p-5 sm:p-6"><h2 className="section-title">Editar relato y participantes</h2><StoryForm treeId={treeId} people={people} story={story} /></section>}
  </article>;
}
