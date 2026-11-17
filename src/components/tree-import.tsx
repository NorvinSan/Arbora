"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmGedcomAction, previewGedcomAction } from "@/lib/gedcom-import-actions";
import { MAX_GEDCOM_BYTES } from "@/lib/gedcom-import";

type Preview = Extract<Awaited<ReturnType<typeof previewGedcomAction>>, { ok: true }>;

export function TreeImport() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function review() {
    if (!file || !name.trim()) return;
    setBusy(true); setError(""); setPreview(null); setSuccess("");
    try {
      const response = await previewGedcomAction({ name, file });
      if (!response.ok) setError(response.message);
      else setPreview(response);
    } catch { setError("No se pudo leer el archivo."); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (!file || !preview?.token) return;
    setBusy(true); setError("");
    try {
      const response = await confirmGedcomAction({ name, file, token: preview.token });
      if (!response.ok) { setError(response.message); setPreview(null); }
      else { setSuccess(`Importación completa: ${response.counts.people} personas y ${response.counts.relations} relaciones.`); setPreview(null); setFile(null); router.push(`/dashboard/trees/${response.treeId}?imported=${response.counts.people}&relations=${response.counts.relations}&events=${response.counts.events}`); }
    } catch { setError("No se pudo importar el archivo. Inténtalo de nuevo."); setPreview(null); }
    finally { setBusy(false); }
  }

  return <section aria-label="Importar GEDCOM" className="soft-panel space-y-4 p-5 sm:p-6">
    <div><p className="eyebrow mb-2">Mis árboles</p><h2 className="font-heading text-xl font-semibold text-[#193d2b]">Importar GEDCOM</h2></div>
    <p className="text-sm leading-6 text-[#607266]">Crea un árbol nuevo a partir de un archivo GEDCOM 7.0. Revisa la vista previa antes de confirmar. Máximo 5 MB y 5 000 personas.</p>
    <label className="block text-sm font-medium" htmlFor="gedcom-tree-name">Nombre del nuevo árbol</label>
    <input id="gedcom-tree-name" type="text" maxLength={200} value={name} disabled={busy} onChange={(event) => { setName(event.target.value); setPreview(null); setError(""); }} className="w-full rounded-lg border border-[#dce7d9] px-3 py-2 text-sm" />
    <label className="block text-sm font-medium" htmlFor="gedcom-file">Archivo .ged (UTF-8)</label>
    <input id="gedcom-file" type="file" accept=".ged" disabled={busy} className="block max-w-full text-sm" onChange={(event) => {
      const next = event.target.files?.[0] ?? null;
      setFile(next); setPreview(null); setError(""); setSuccess("");
      if (next) setName(next.name.replace(/\.ged$/i, "").slice(0, 200));
      if (next && (next.size > MAX_GEDCOM_BYTES || !next.name.toLowerCase().endsWith(".ged"))) setError("Selecciona un archivo .ged de hasta 5 MB.");
    }} />
    <button type="button" disabled={!file || !name.trim() || busy || !!error} onClick={() => void review()} className="rounded-lg bg-[#356747] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Procesando…" : "Revisar archivo"}</button>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {success && <p role="status" className="text-sm text-[#356747]">{success}</p>}
    {preview && <div className="space-y-3 rounded-lg border border-[#dce7d9] p-4" aria-label="Vista previa de importación">
      <h3 className="font-heading text-lg font-semibold">Vista previa</h3>
      <p className="text-sm">{preview.counts.people} personas · {preview.counts.relations} relaciones familiares y de pareja · {preview.counts.events} acontecimientos</p>
      {preview.warnings.length > 0 && <div className="text-sm text-amber-800"><h4 className="font-semibold">Advertencias ({preview.warnings.length})</h4><ul className="list-disc pl-5">{preview.warnings.slice(0, 30).map((warning, i) => <li key={i}>{warning}</li>)}</ul>{preview.warnings.length > 30 && <p>Se muestran las primeras 30 advertencias.</p>}</div>}
      {preview.errors.length > 0 && <div role="alert" className="text-sm text-red-700"><h4 className="font-semibold">Errores que impiden la importación ({preview.errors.length})</h4><ul className="list-disc pl-5">{preview.errors.slice(0, 30).map((message, i) => <li key={i}>{message}</li>)}</ul></div>}
      {preview.token && <div className="flex flex-wrap items-center gap-3"><button type="button" disabled={busy} onClick={() => void confirm()} className="rounded-lg bg-[#356747] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Importando…" : "Confirmar importación"}</button><button type="button" disabled={busy} onClick={() => setPreview(null)} className="rounded-lg border px-4 py-2 text-sm">Cancelar</button></div>}
    </div>}
  </section>;
}
