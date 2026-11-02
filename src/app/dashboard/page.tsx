import Link from "next/link";
import { CreateTreeForm } from "@/components/create-tree-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/session";
import { getAccessibleTrees } from "@/lib/trees";

export default async function DashboardPage() {
  const { user } = await requireSession();
  const trees = await getAccessibleTrees(user.id);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Bienvenido, {user.name}</h1>
        <p className="text-slate-600">Aquí encontrarás tus árboles familiares y aquellos que comparten contigo.</p>
      </div>
      <CreateTreeForm />
      {trees.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Tu espacio está listo</CardTitle>
            <CardDescription>Todavía no tienes árboles familiares. Usa el formulario para crear el primero.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <section aria-label="Árboles familiares" className="grid gap-4 sm:grid-cols-2">
          {trees.map((tree) => (
            <Card key={tree.id}>
              <CardHeader>
                <CardTitle>{tree.name}</CardTitle>
                <CardDescription>{tree.ownerId === user.id ? "Propietario" : tree.collaboratorRole === "editor" ? "Colaborador" : "Solo lectura"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {tree.description && <p className="text-sm text-slate-600">{tree.description}</p>}
                <Link className="inline-block text-sm font-semibold text-emerald-800 underline" href={`/dashboard/trees/${tree.id}`}>
                  Explorar árbol
                </Link>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
