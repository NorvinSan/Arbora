import Link from "next/link";

export default function TreeNotFound() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Árbol no disponible</h1>
      <p className="text-sm text-slate-600">No se encontró este árbol o no tienes acceso a él.</p>
      <Link href="/dashboard" className="text-sm font-medium text-emerald-800 underline">Volver a mis árboles</Link>
    </div>
  );
}
