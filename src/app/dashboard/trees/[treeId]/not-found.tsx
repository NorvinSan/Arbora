import Link from "next/link";
import { ArrowLeft, GitBranch } from "lucide-react";

export default function TreeNotFound() {
  return (
    <div className="soft-panel mx-auto max-w-xl space-y-4 p-8 sm:p-10">
      <span className="flex size-12 items-center justify-center rounded-xl bg-[#eaf2e7] text-[#4d7955]"><GitBranch className="size-6" /></span>
      <h1 className="section-title">Árbol no disponible</h1>
      <p className="text-sm leading-6 text-[#607266]">No se encontró este árbol o no tienes acceso a él.</p>
      <Link href="/dashboard" className="text-link inline-flex items-center gap-2 text-sm"><ArrowLeft className="size-4" /> Volver a mis árboles</Link>
    </div>
  );
}
