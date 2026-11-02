"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-xl space-y-4 p-10">
      <h1 className="text-xl font-semibold">No se pudo cargar tu espacio</h1>
      <p className="text-sm text-slate-600">Comprueba la conexión e inténtalo de nuevo.</p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
