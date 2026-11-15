"use client";

import { useState } from "react";

export function TreeExport({ treeId, personCount }: { treeId: string; personCount: number }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/trees/${treeId}/export`, { method: "POST", cache: "no-store" });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message ?? "No se pudo exportar el árbol.");
      }
      const file = await response.blob();
      const name = response.headers.get("Content-Disposition")?.match(/filename="([a-z0-9-]+\.ged)"/)?.[1] ?? "arbol.ged";
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = name;
      document.body.append(anchor);
      anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setConfirming(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo exportar el árbol.");
    } finally { setBusy(false); }
  }

  return <section aria-label="Configuración del árbol" className="soft-panel space-y-4 p-5 sm:p-6">
    <div><p className="eyebrow mb-2">Configuración del árbol</p><h2 className="font-heading text-xl font-semibold text-[#193d2b]">Exportar árbol</h2></div>
    <p className="text-sm leading-6 text-[#607266]">Descarga un archivo GEDCOM 7.0 con {personCount} {personCount === 1 ? "persona" : "personas"}, parentescos y acontecimientos. La exportación no modifica el árbol.</p>
    <button type="button" onClick={() => { setConfirming(true); setError(""); }} className="rounded-lg bg-[#356747] px-4 py-2 text-sm font-semibold text-white">Exportar árbol</button>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {confirming && <div role="dialog" aria-modal="true" aria-labelledby="export-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow-xl">
        <h3 id="export-title" className="font-heading text-xl font-semibold">Confirmar exportación</h3>
        <p className="text-sm leading-6">Vas a descargar información privada de {personCount} {personCount === 1 ? "persona" : "personas"}. El archivo contiene datos personales: guárdalo y compártelo con cuidado.</p>
        <p className="text-sm leading-6 text-[#607266]">GEDCOM conserva personas, fechas conocidas, parentescos, parejas y acontecimientos. No incluye fotografías, documentos ni historias completas; algunos estados propios de Arbora se anotan como notas y puede variar su interpretación en otras aplicaciones. El archivo indica sus limitaciones.</p>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => void download()} className="rounded-lg bg-[#356747] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Preparando archivo…" : "Descargar .ged"}</button>
          <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button></div>
      </div>
    </div>}
  </section>;
}
