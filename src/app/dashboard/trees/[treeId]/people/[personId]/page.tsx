import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, GitBranch, UsersRound } from "lucide-react";
import { RemoveRelationButton } from "@/components/remove-relation-button";
import { requireSession } from "@/lib/session";
import { getAccessiblePerson, getAccessibleTree, getFamilyRelations } from "@/lib/trees";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const labels = { biological: "Biológico", adoptive: "Adoptivo", other: "No especificado" };

export default async function PersonPage({ params }: { params: Promise<{ treeId: string; personId: string }> }) {
  const { user } = await requireSession();
  const { treeId, personId } = await params;
  if (!uuid.test(treeId) || !uuid.test(personId)) notFound();

  const tree = await getAccessibleTree(user.id, treeId);
  if (!tree) notFound();
  const member = await getAccessiblePerson(user.id, treeId, personId);
  if (!member) notFound();
  const { parents, children } = await getFamilyRelations(treeId, personId);
  const canEdit = tree.ownerId === user.id || tree.collaboratorRole === "editor";

  return (
    <div className="space-y-8 lg:space-y-10">
      <Link href={`/dashboard/trees/${treeId}`} className="text-link inline-flex items-center gap-2 text-sm"><ArrowLeft className="size-4" /> {tree.name}</Link>
      <header className="flex flex-wrap items-center gap-5 border-b border-[#dce7d9] pb-8 sm:gap-7">
        <span aria-hidden="true" className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-[#e5f0e1] font-heading text-4xl text-[#356747] sm:size-24">{member.displayName.charAt(0).toLocaleUpperCase("es")}</span>
        <div><p className="eyebrow mb-2 inline-flex items-center gap-2"><GitBranch className="size-4" /> Perfil familiar</p><h1 className="page-title">{member.displayName}</h1>
        <p className="mt-3 text-sm text-[#667a6a]">
          {member.lifeStatus === "living" ? "Vive" : member.lifeStatus === "deceased" ? "Fallecido/a" : "Estado vital desconocido"}
          {member.whereaboutsStatus === "missing" ? " · Paradero desconocido" : ""}
        </p>
        {member.biography && <p className="mt-3 max-w-2xl whitespace-pre-wrap leading-7 text-[#516655]">{member.biography}</p>}</div>
      </header>
      <section aria-label="Familiares" className="space-y-6">
        <div><p className="eyebrow mb-2">Personas que nos conectan</p><h2 className="section-title">Vínculos familiares</h2></div>
        <div className="grid items-start gap-6 lg:grid-cols-2">
        {([
          { title: "Progenitores", relatives: parents, isParent: true },
          { title: "Hijos e hijas", relatives: children, isParent: false },
        ] as const).map(({ title, relatives, isParent }) => (
          <div key={title} className="soft-panel space-y-5 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3"><h3 className="font-heading text-xl font-semibold text-[#193d2b]">{title}</h3><span className="rounded-full bg-[#edf4e9] px-2.5 py-1 text-xs font-semibold text-[#4d7955]">{relatives.length}</span></div>
            {relatives.length === 0 ? <div className="flex items-center gap-3 rounded-xl border border-dashed border-[#dce8d8] bg-[#fbfcf9] p-5 text-sm text-[#718274]"><UsersRound className="size-5 shrink-0" /> No hay vínculos registrados.</div> : (
              <ul className="space-y-3">
                {relatives.map((relative) => (
                  <li key={relative.id} className="rounded-xl border border-[#e1e9de] bg-[#fcfdfb] p-4">
                    <div className="flex items-center gap-3"><span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#e8f1e4] font-heading text-lg text-[#356747]">{relative.displayName.charAt(0).toLocaleUpperCase("es")}</span><div className="min-w-0 flex-1"><Link href={`/dashboard/trees/${treeId}/people/${relative.id}`} className="text-link inline-flex max-w-full items-center gap-1 text-sm"><span className="truncate">{relative.displayName}</span><ArrowUpRight className="size-3.5 shrink-0" /></Link><p className="mt-1 text-xs text-[#738675]">{labels[relative.relationType]}</p></div></div>
                    {canEdit && <div className="mt-3 border-t border-[#e8eee5] pt-3"><RemoveRelationButton treeId={treeId} parentId={isParent ? relative.id : personId} childId={isParent ? personId : relative.id} /></div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        </div>
      </section>
    </div>
  );
}
