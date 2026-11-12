import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BookOpen, ChevronDown, GitBranch, UsersRound } from "lucide-react";
import { notFound } from "next/navigation";
import { FamilyTreeCanvas } from "@/components/family-tree-canvas";
import { TreeEditPanel } from "@/components/tree-edit-panel";
import { requireSession } from "@/lib/session";
import { getAccessibleTreeGraph } from "@/lib/tree-graph-data";
import { getAccessibleStories } from "@/lib/family-stories";
import { getAccessibleTree } from "@/lib/trees";
import { MAX_GENERATIONS, type BranchMode } from "@/lib/tree-exploration-options";

export default async function TreePage({ params, searchParams }: { params: Promise<{ treeId: string }>; searchParams: Promise<{ person?: string; mode?: string; generations?: string }> }) {
  const { user } = await requireSession();
  const { treeId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(treeId)) notFound();

  const tree = await getAccessibleTree(user.id, treeId);
  if (!tree) notFound();

  const graph = await getAccessibleTreeGraph(user.id, tree.id);
  if (!graph) notFound();
  const { people } = graph;
  const selection = await searchParams;
  const initialPersonId = people.some((person) => person.id === selection.person) ? selection.person : undefined;
  const initialMode: BranchMode | undefined = initialPersonId && (selection.mode === "ancestors" || selection.mode === "descendants") ? selection.mode : undefined;
  const count = Number(selection.generations);
  const initialGenerations = Number.isInteger(count) && count >= 1 && count <= MAX_GENERATIONS ? count : 4;
  const stories = await getAccessibleStories(user.id, tree.id);
  if (!stories) notFound();

  return (
    <div className="space-y-8 lg:space-y-10">
      <Link href="/dashboard" className="text-link inline-flex items-center gap-2 text-sm"><ArrowLeft className="size-4" /> Mis árboles</Link>
      <header className="flex flex-wrap items-end justify-between gap-5 border-b border-[#dce7d9] pb-7">
        <div className="space-y-3">
          <p className="eyebrow inline-flex items-center gap-2"><GitBranch className="size-4" /> Árbol familiar</p>
          <h1 className="page-title">{tree.name}</h1>
          {tree.description && <p className="max-w-2xl leading-7 text-[#617366]">{tree.description}</p>}
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#d4e4d0] bg-[#ebf3e8] px-4 py-2 text-sm font-medium text-[#356747]"><UsersRound className="size-4" /> {people.length} {people.length === 1 ? "persona" : "personas"}</span>
      </header>
      {people.length > 0 && <FamilyTreeCanvas treeId={tree.id} data={graph} initialPersonId={initialPersonId} initialMode={initialMode} initialGenerations={initialGenerations} />}
      <section aria-label="Familiares" className="space-y-5">
        <div><p className="eyebrow mb-2">Explora conexiones</p><h2 className="section-title">Familiares</h2></div>
        {people.length === 0 ? (
          <div className="soft-panel flex flex-col items-center gap-3 border-dashed px-6 py-12 text-center"><span className="flex size-14 items-center justify-center rounded-2xl bg-[#edf4e9] text-[#4c8158]"><UsersRound className="size-7" /></span><p className="font-heading text-xl text-[#193d2b]">Un árbol por comenzar</p><p className="max-w-sm text-sm leading-6 text-[#687a6b]">Añade a la primera persona y empieza a reconstruir tu historia familiar.</p></div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {people.map((member) => (
              <li key={member.id} className="soft-panel group flex items-center gap-3 p-4 transition-all hover:border-[#bad1ba] hover:shadow-md">
                <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#e9f2e7] font-heading text-lg text-[#356747]">{member.displayName.charAt(0).toLocaleUpperCase("es")}</span>
                <div className="min-w-0 flex-1"><Link href={`/dashboard/trees/${tree.id}/people/${member.id}`} className="text-link block truncate text-sm font-semibold">{member.displayName}</Link>
                <p className="mt-1 text-xs text-[#718274]">
                  {member.whereaboutsStatus === "missing" ? "Paradero desconocido · " : ""}
                  {member.lifeStatus === "living" ? "Vive" : member.lifeStatus === "deceased" ? "Fallecido/a" : "Estado vital desconocido"}
                </p></div><ArrowUpRight className="size-4 shrink-0 text-[#8ba68d] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
              </li>
            ))}
          </ul>
        )}
      </section>
      {(tree.ownerId === user.id || tree.collaboratorRole === "editor") ? (
        <details className="soft-panel group" aria-label="Editar árbol">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden sm:px-6">
            <span><span className="block font-heading text-xl font-semibold text-[#193d2b]">Editar árbol</span><span className="mt-1 block text-sm text-[#607266]">Agregar familiares, parentescos y parejas</span></span>
            <ChevronDown className="size-5 shrink-0 text-[#4f835c] transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <TreeEditPanel treeId={tree.id} people={people} />
        </details>
      ) : <p className="soft-panel p-5 text-sm leading-6 text-[#607266]">Tienes acceso de lectura a este árbol. Puedes explorar las personas y sus vínculos familiares.</p>}
      <section aria-label="Historias familiares" className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow mb-2 inline-flex items-center gap-2"><BookOpen className="size-4" /> Memoria compartida</p><h2 className="section-title">Historias familiares</h2></div><Link className="text-link text-sm" href={`/dashboard/trees/${tree.id}/stories`}>Ver todas las historias →</Link></div>
        {stories.length === 0 ? <p className="soft-panel border-dashed p-6 text-sm text-[#718274]">Aún no hay relatos en este árbol. <Link className="text-link" href={`/dashboard/trees/${tree.id}/stories`}>Explorar historias familiares</Link></p> :
          <ul className="grid gap-4 sm:grid-cols-2">{stories.slice(0, 4).map((story) => <li key={story.id} className="soft-panel p-5"><Link className="text-link font-heading text-xl" href={`/dashboard/trees/${tree.id}/stories/${story.id}`}>{story.title}</Link><p className="mt-2 text-xs text-[#718274]">{story.participants.length ? story.participants.map((person) => person.displayName).join(", ") : "Relato general"}</p></li>)}</ul>}
      </section>
    </div>
  );
}
