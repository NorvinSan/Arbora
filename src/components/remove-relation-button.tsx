"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteParentChildAction } from "@/lib/relation-actions";

export function RemoveRelationButton({ treeId, parentId, childId }: { treeId: string; parentId: string; childId: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function remove() {
    setError("");
    setPending(true);
    try {
      const result = await deleteParentChildAction({ treeId, parentId, childId });
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
      <Button type="button" variant="ghost" size="sm" className="text-[#8e5644] hover:bg-[#fbefea] hover:text-[#743c2d]" onClick={remove} disabled={pending} aria-label="Eliminar parentesco">
        {pending ? "Eliminando…" : "Eliminar vínculo"}
      </Button>
      {error && <p role="alert" className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}
