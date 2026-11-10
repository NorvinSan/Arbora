"use client";

import { Button } from "@/components/ui/button";

export default function StoriesError({ reset }: { error: Error; reset: () => void }) {
  return <div role="alert" className="soft-panel space-y-4 p-8"><h1 className="section-title">No se pudieron cargar las historias familiares</h1><p className="text-sm text-[#607266]">Comprueba la conexión e inténtalo de nuevo.</p><Button onClick={reset}>Reintentar</Button></div>;
}
