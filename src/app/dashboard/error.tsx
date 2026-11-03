"use client";

import { Button } from "@/components/ui/button";
import { CircleAlert } from "lucide-react";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="soft-panel mx-auto max-w-xl space-y-4 p-8 sm:p-10">
      <span className="flex size-12 items-center justify-center rounded-xl bg-red-50 text-red-700"><CircleAlert className="size-6" /></span>
      <h1 className="section-title">No se pudo cargar tu espacio</h1>
      <p className="text-sm text-[#607266]">Comprueba la conexión e inténtalo de nuevo.</p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
