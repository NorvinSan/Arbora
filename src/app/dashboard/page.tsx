import Link from "next/link";
import { ArrowUpRight, GitBranch, Leaf, Plus, TreePine } from "lucide-react";
import { CreateTreeForm } from "@/components/create-tree-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/session";
import { getAccessibleTrees } from "@/lib/trees";

export default async function DashboardPage() {
  const { user } = await requireSession();
  const trees = await getAccessibleTrees(user.id);

  return (
    <div className="space-y-10 lg:space-y-12">
      <section className="relative overflow-hidden rounded-3xl bg-[#214832] px-7 py-10 text-white sm:px-10 sm:py-12 lg:px-14 lg:py-14">
        <div className="pointer-events-none absolute -right-12 -top-24 size-80 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-24 top-0 size-96 rounded-full border border-white/10" />
        <div className="relative max-w-2xl">
          <p className="mb-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#b7d7b5]"><Leaf className="size-4" /> Tu espacio familiar</p>
          <h1 className="font-heading text-4xl leading-tight tracking-tight sm:text-5xl">Bienvenido, {user.name}</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[#d5e6d4] sm:text-base">Aquí comienzan las historias que nos conectan. Crea un árbol, reúne a tus familiares y descubre los vínculos entre generaciones.</p>
          <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white"><TreePine className="size-4" /> {trees.length} {trees.length === 1 ? "árbol disponible" : "árboles disponibles"}</div>
        </div>
      </section>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:gap-10">
        <section aria-label="Árboles familiares" className="space-y-5">
          <div className="flex items-end justify-between gap-4">
            <div><p className="eyebrow mb-2">Tu colección</p><h2 className="section-title">Mis árboles</h2></div>
            <span className="text-sm text-[#738675]">{trees.length} en total</span>
          </div>
          {trees.length === 0 ? (
            <Card className="border-dashed bg-[#fcfdf9] py-10 text-center">
              <CardHeader className="justify-items-center gap-3">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-[#e9f2e7] text-[#427652]"><GitBranch className="size-7" /></span>
                <CardTitle>Tu historia empieza aquí</CardTitle>
                <CardDescription className="max-w-sm leading-6">Todavía no tienes árboles familiares. Crea el primero para empezar a reunir tus recuerdos.</CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {trees.map((tree) => (
                <Card key={tree.id} className="group transition-all hover:-translate-y-0.5 hover:border-[#b9d2b8] hover:shadow-[0_14px_35px_rgba(30,68,43,0.09)]">
                  <CardHeader className="gap-3">
                    <div className="flex items-start justify-between gap-3"><span className="flex size-11 items-center justify-center rounded-xl bg-[#e9f2e7] text-[#3c7650]"><GitBranch className="size-5" /></span><span className="rounded-full bg-[#f0f5ed] px-2.5 py-1 text-[11px] font-semibold text-[#4b7754]">{tree.ownerId === user.id ? "Propietario" : tree.collaboratorRole === "editor" ? "Editor" : "Lector"}</span></div>
                    <CardTitle className="line-clamp-2">{tree.name}</CardTitle>
                    <CardDescription className="line-clamp-2 min-h-10 leading-5">{tree.description || "Un lugar para las historias de tu familia."}</CardDescription>
                  </CardHeader>
                  <CardContent><Link className="inline-flex items-center gap-1 text-sm font-semibold text-[#28543d] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#28543d]" href={`/dashboard/trees/${tree.id}`}>Explorar árbol <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></Link></CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
        <div className="space-y-3 lg:pt-8"><div className="flex items-center gap-2 text-sm font-medium text-[#56735b]"><Plus className="size-4" /> Empieza algo nuevo</div><CreateTreeForm /></div>
      </div>
    </div>
  );
}
