import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, GitBranch, UsersRound } from "lucide-react";
import { RemoveRelationButton } from "@/components/remove-relation-button";
import { RemovePartnershipButton } from "@/components/remove-partnership-button";
import { EventForm } from "@/components/event-form";
import { eventLabels, formatEventDate } from "@/lib/event-form-schemas";
import { getPersonEvents } from "@/lib/person-events";
import { requireSession } from "@/lib/session";
import { getAccessiblePerson, getAccessibleTree, getFamilyRelations } from "@/lib/trees";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const labels = { biological: "Biológico", adoptive: "Adoptivo", other: "No especificado" };
const partnershipLabels = { marriage: "Matrimonio", union: "Unión", partnership: "Pareja" };

function formatPartialDate(year: number | null, month: number | null, day: number | null, qualifier: string | null) {
  if (year === null) return null;
  const date = [day, month].filter((part) => part !== null).map((part) => String(part).padStart(2, "0")).concat(String(year).padStart(4, "0")).join("/");
  const prefix = { approximate: "Aprox. ", before: "Antes de ", after: "Después de ", exact: "" }[qualifier ?? "exact"] ?? "";
  return `${prefix}${date}`;
}

export default async function PersonPage({ params }: { params: Promise<{ treeId: string; personId: string }> }) {
  const { user } = await requireSession();
  const { treeId, personId } = await params;
  if (!uuid.test(treeId) || !uuid.test(personId)) notFound();

  const tree = await getAccessibleTree(user.id, treeId);
  if (!tree) notFound();
  const member = await getAccessiblePerson(user.id, treeId, personId);
  if (!member) notFound();
  const [{ parents, children, partners }, events] = await Promise.all([getFamilyRelations(treeId, personId), getPersonEvents(treeId, personId)]);
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
      <section aria-label="Historia de vida" className="space-y-6">
        <div><p className="eyebrow mb-2">Recuerdos y momentos</p><h2 className="section-title">Historia de vida</h2></div>
        {events.length === 0 ? <p className="soft-panel border-dashed p-6 text-sm text-[#718274]">Todavía no hay acontecimientos registrados para esta persona.</p> : (
          <ol className="space-y-4 border-l-2 border-[#dce8d8] pl-5">
            {events.map((event) => <li key={event.id} className="soft-panel relative p-5 before:absolute before:-left-[29px] before:top-6 before:size-3 before:rounded-full before:bg-[#719977]">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#587b60]">{formatEventDate(event.year, event.month, event.day, event.qualifier)} · {eventLabels[event.type]}</p>
              <h3 className="mt-2 font-heading text-xl font-semibold text-[#193d2b]">{event.title}</h3>
              {event.place && <p className="mt-2 text-sm text-[#667a6a]">Lugar: {event.place}</p>}
              {event.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#516655]">{event.description}</p>}
              {canEdit && <details className="mt-4 border-t border-[#e8eee5] pt-3"><summary className="text-link cursor-pointer text-sm">Editar acontecimiento</summary><div className="mt-4"><EventForm treeId={treeId} personId={personId} event={event} /></div></details>}
            </li>)}
          </ol>
        )}
        {canEdit && <div className="soft-panel p-5 sm:p-6"><h3 className="mb-4 font-heading text-xl font-semibold text-[#193d2b]">Agregar acontecimiento</h3><EventForm treeId={treeId} personId={personId} /></div>}
      </section>
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
      <section aria-label="Parejas" className="space-y-6">
        <div><p className="eyebrow mb-2">Vínculos de pareja</p><h2 className="section-title">Parejas</h2></div>
        {partners.length === 0 ? (
          <div className="soft-panel border-dashed p-5 text-sm text-[#718274]">No hay relaciones de pareja registradas.</div>
        ) : (
          <ul className="grid items-start gap-4 sm:grid-cols-2">
            {partners.map((partner) => (
              <li key={partner.partnershipId} className="soft-panel space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/dashboard/trees/${treeId}/people/${partner.id}`} className="text-link inline-flex max-w-full items-center gap-1 font-semibold"><span className="truncate">{partner.displayName}</span><ArrowUpRight className="size-4 shrink-0" /></Link>
                    <p className="mt-1 text-sm text-[#667a6a]">{partnershipLabels[partner.kind]}</p>
                  </div>
                </div>
                <p className="text-sm text-[#667a6a]">Inicio: {formatPartialDate(partner.startYear, partner.startMonth, partner.startDay, partner.startQualifier) ?? "Sin fecha de inicio"}</p>
                <p className="text-sm text-[#667a6a]">Fin: {formatPartialDate(partner.endYear, partner.endMonth, partner.endDay, partner.endQualifier) ?? "Sin fecha de fin"}</p>
                {canEdit && <div className="border-t border-[#e8eee5] pt-3"><RemovePartnershipButton treeId={treeId} partnershipId={partner.partnershipId} /></div>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
