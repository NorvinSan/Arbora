"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deletePartnershipAction } from "@/lib/relation-actions";

export function RemovePartnershipButton({ treeId, partnershipId }: { treeId: string; partnershipId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function remove() {
    setError("");
    setPending(true);
    try {
      const result = await deletePartnershipAction({ treeId, partnershipId });
      if (!result.ok) setError(result.message);
      else router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor. Inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      {confirming ? (
        <div className="space-y-2">
          <p className="text-xs text-[#8e5644]">¿Eliminar esta relación de pareja?</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={pending}>Cancelar</Button>
            <Button type="button" variant="destructive" size="sm" onClick={remove} disabled={pending}>{pending ? "Eliminando…" : "Sí, eliminar"}</Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="ghost" size="sm" className="text-[#8e5644] hover:bg-[#fbefea] hover:text-[#743c2d]" onClick={() => setConfirming(true)} aria-label="Eliminar relación de pareja">Eliminar vínculo</Button>
      )}
      {error && <p role="alert" className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}
