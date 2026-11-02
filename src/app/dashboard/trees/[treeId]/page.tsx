import Link from "next/link";
import { notFound } from "next/navigation";
import { AddPersonForm } from "@/components/add-person-form";
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
    <div className="space-y-6">
      <Link href="/dashboard" className="text-sm text-emerald-800 underline">← Mis árboles</Link>
      <div>
        <h1 className="text-3xl font-semibold">{tree.name}</h1>
        {tree.description && <p className="mt-2 text-slate-600">{tree.description}</p>}
      </div>
      <section aria-label="Familiares" className="space-y-3">
        <h2 className="text-xl font-semibold">Familiares ({people.length})</h2>
        {people.length === 0 ? (
          <p className="text-sm text-slate-600">Este árbol todavía no tiene integrantes.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {people.map((member) => (
              <li key={member.id} className="rounded-xl border border-emerald-900/10 bg-white p-4">
                <p className="font-medium">{member.displayName}</p>
                <p className="text-sm text-slate-600">
                  {member.whereaboutsStatus === "missing" ? "Paradero desconocido · " : ""}
                  {member.lifeStatus === "living" ? "Vive" : member.lifeStatus === "deceased" ? "Fallecido/a" : "Estado vital desconocido"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      {(tree.ownerId === user.id || tree.collaboratorRole === "editor") && <AddPersonForm treeId={tree.id} />}
      <p className="text-sm text-slate-500">Los vínculos de parentesco y la visualización interactiva llegarán en una etapa posterior.</p>
    </div>
  );
}
