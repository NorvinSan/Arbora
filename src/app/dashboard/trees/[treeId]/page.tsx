import Link from "next/link";
import { ArrowLeft, ArrowUpRight, GitBranch, UsersRound } from "lucide-react";
import { notFound } from "next/navigation";
import { AddPersonForm } from "@/components/add-person-form";
import { ParentChildForm } from "@/components/parent-child-form";
import { requireSession } from "@/lib/session";
import { getAccessiblePeople, getAccessibleTree } from "@/lib/trees";

export default async function TreePage({ params }: { params: Promise<{ treeId: string }> }) {
  const { user } = await requireSession();
  const { treeId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(treeId)) notFound();

  const tree = await getAccessibleTree(user.id, treeId);
  if (!tree) notFound();

  const people = await getAccessiblePeople(user.id, tree.id);

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
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,390px)] lg:gap-10">
      <section aria-label="Familiares" className="space-y-5">
        <div><p className="eyebrow mb-2">Explora conexiones</p><h2 className="section-title">Familiares</h2></div>
        {people.length === 0 ? (
          <div className="soft-panel flex flex-col items-center gap-3 border-dashed px-6 py-12 text-center"><span className="flex size-14 items-center justify-center rounded-2xl bg-[#edf4e9] text-[#4c8158]"><UsersRound className="size-7" /></span><p className="font-heading text-xl text-[#193d2b]">Un árbol por comenzar</p><p className="max-w-sm text-sm leading-6 text-[#687a6b]">Añade a la primera persona y empieza a reconstruir tu historia familiar.</p></div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
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
        <aside className="space-y-5" aria-label="Editar árbol">
          <AddPersonForm treeId={tree.id} />
          <ParentChildForm treeId={tree.id} people={people} />
        </aside>
      ) : <aside className="soft-panel p-6 text-sm leading-6 text-[#607266]">Tienes acceso de lectura a este árbol. Puedes explorar las personas y sus vínculos familiares.</aside>}
      </div>
    </div>
  );
}
