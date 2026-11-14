"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteDocumentAction, removeDocumentAssociationAction, updateDocumentAction } from "@/lib/media-actions";
import { MAX_DOCUMENT_SIZE, documentTypes } from "@/lib/media-validation";
import type { getPersonDocuments } from "@/lib/person-media";

type Document = Awaited<ReturnType<typeof getPersonDocuments>>[number];
const labels: Record<(typeof documentTypes)[number], string> = {
  birth: "Certificado de nacimiento", marriage: "Certificado de matrimonio", death: "Certificado de defunción",
  letter: "Carta", record: "Registro histórico", other: "Otro documento",
};

export function PersonDocuments({ treeId, personId, documents, people, canEdit }: {
  treeId: string; personId: string; documents: Document[];
  people: { id: string; displayName: string }[]; canEdit: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([personId]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [opened, setOpened] = useState<Document | null>(null);
  const url = (id: string) => `/api/trees/${treeId}/media/${id}`;

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || file.type !== "application/pdf" || file.size < 1 || file.size > MAX_DOCUMENT_SIZE || !selected.length) {
      setError("Selecciona un PDF de hasta 20 MB y al menos un familiar."); return;
    }
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    form.set("kind", "document"); form.set("file", file); form.delete("personId");
    selected.forEach((id) => form.append("personId", id));
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/trees/${treeId}/media`, { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) { setError(result.message ?? "No se pudo subir el documento."); return; }
      setFile(null); setSelected([personId]); formElement.reset(); router.refresh();
    } catch { setError("No se pudo subir el documento."); }
    finally { setBusy(false); }
  }

  async function change(action: () => Promise<{ ok: boolean; message?: string }>, confirmation?: string) {
    if (confirmation && !window.confirm(confirmation)) return;
    setBusy(true); setError("");
    try {
      const result = await action();
      if (!result.ok) setError(result.message ?? "No se pudo modificar el documento.");
      else { setOpened(null); router.refresh(); }
    } catch { setError("No se pudo modificar el documento."); }
    finally { setBusy(false); }
  }

  function peoplePicker(ids: string[], onChange: (ids: string[]) => void) {
    return <fieldset><legend className="mb-2 text-sm font-medium">Familiares relacionados</legend>
      <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[#dbe5d9] p-3">
        {people.map((person) => <label key={person.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={ids.includes(person.id)} onChange={(event) => onChange(event.target.checked ? [...ids, person.id] : ids.filter((id) => id !== person.id))} />{person.displayName}
        </label>)}
      </div>
    </fieldset>;
  }

  return <section aria-label="Documentos" className="space-y-5">
    <div><p className="eyebrow mb-2">Archivo familiar</p><h2 className="section-title">Documentos</h2></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {documents.length === 0 ? <p className="soft-panel border-dashed p-6 text-sm text-[#718274]">Todavía no hay documentos asociados.</p> :
      <ul className="grid gap-4 sm:grid-cols-2">{documents.map((document) => <li key={document.id} className="soft-panel space-y-2 p-5 text-sm">
        <p className="text-xs font-semibold text-[#587b60]">{labels[document.documentType as keyof typeof labels] ?? "Documento"}</p>
        <h3 className="font-heading text-xl text-[#193d2b]">{document.title}</h3>
        {document.historicalDate && <p>Fecha histórica: {document.historicalDate}</p>}
        {document.description && <p className="whitespace-pre-wrap">{document.description}</p>}
        <p>Familiares: {document.people.map((p) => p.displayName).join(", ")}</p>
        <div className="flex flex-wrap gap-4"><button type="button" className="text-link" onClick={() => setOpened(document)}>Ver detalles y PDF</button>
          <a className="text-link" href={`${url(document.id)}?download=1`}>Descargar</a></div>
        {canEdit && <div className="flex flex-wrap gap-4 border-t border-[#e8eee5] pt-3">
          <button disabled={busy} type="button" className="text-link" onClick={() => setOpened(document)}>Editar metadatos</button>
          <button disabled={busy} type="button" className="text-link" onClick={() => void change(() => removeDocumentAssociationAction({ treeId, personId, mediaId: document.id }), "¿Desvincular de esta persona? Las demás asociaciones se conservan.")}>Desvincular</button>
          <button disabled={busy} type="button" className="text-red-700 underline" onClick={() => void change(() => deleteDocumentAction({ treeId, mediaId: document.id }), "¿Eliminar el documento de todo el árbol?")}>Eliminar archivo</button>
        </div>}
      </li>)}</ul>}
    {canEdit && <form onSubmit={(event) => void upload(event)} className="soft-panel space-y-4 p-5 sm:p-6">
      <h3 className="font-heading text-xl font-semibold text-[#193d2b]">Agregar documento</h3>
      <label className="block text-sm font-medium" htmlFor="document-file">Documento PDF (máximo 20 MB)</label>
      <input id="document-file" name="file" type="file" accept="application/pdf" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      <MetadataFields />
      {peoplePicker(selected, setSelected)}
      <button disabled={busy} type="submit" className="rounded-lg bg-[#356747] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Subiendo…" : "Subir documento"}</button>
    </form>}
    {opened && <DocumentDialog key={opened.id} document={opened} treeId={treeId} canEdit={canEdit} busy={busy} people={people}
      onClose={() => setOpened(null)} onSave={(input) => change(() => updateDocumentAction(input))} url={url(opened.id)} />}
  </section>;
}

function MetadataFields({ document }: { document?: Document }) {
  return <div className="space-y-3 text-sm">
    <label className="block">Título<input name="title" required maxLength={200} defaultValue={document?.title ?? ""} className="mt-1 block w-full rounded-lg border p-2" /></label>
    <label className="block">Tipo<select name="documentType" defaultValue={document?.documentType ?? "record"} className="mt-1 block w-full rounded-lg border p-2">
      {documentTypes.map((type) => <option key={type} value={type}>{labels[type]}</option>)}</select></label>
    <label className="block">Fecha histórica (opcional)<input name="historicalDate" type="date" defaultValue={document?.historicalDate ?? ""} className="mt-1 block w-full rounded-lg border p-2" /></label>
    <label className="block">Descripción (opcional)<textarea name="description" maxLength={1000} defaultValue={document?.description ?? ""} rows={2} className="mt-1 block w-full rounded-lg border p-2" /></label>
  </div>;
}

function DocumentDialog({ document, treeId, url, people, canEdit, busy, onClose, onSave }: {
  document: Document; treeId: string; url: string; people: { id: string; displayName: string }[];
  canEdit: boolean; busy: boolean; onClose: () => void;
  onSave: (input: { treeId: string; mediaId: string; title: string; description: string; documentType: string; historicalDate: string; personIds: string[] }) => Promise<void>;
}) {
  const [ids, setIds] = useState(document.people.map((person) => person.id));
  return <div role="dialog" aria-modal="true" aria-label={document.title ?? document.fileName} className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-4">
    <div className="mx-auto max-w-5xl space-y-4 rounded-xl bg-white p-5">
      <button type="button" onClick={onClose} className="text-link">Cerrar ×</button>
      <h3 className="font-heading text-xl">{document.title}</h3>
      <p className="text-sm">{labels[document.documentType as keyof typeof labels]} · {document.historicalDate || "Sin fecha histórica"} · {document.fileName}</p>
      {document.description && <p className="whitespace-pre-wrap text-sm">{document.description}</p>}
      <p className="text-sm">Familiares: {document.people.map((person, index) => <span key={person.id}>{index > 0 && ", "}<Link className="text-link" href={`/dashboard/trees/${treeId}/people/${person.id}`}>{person.displayName}</Link></span>)}</p>
      <iframe title={`Documento: ${document.title}`} src={url} className="h-[65vh] w-full border" />
      <a className="text-link" href={`${url}?download=1`}>Descargar PDF</a>
      {canEdit && <form className="space-y-4 border-t pt-4" onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        void onSave({ treeId, mediaId: document.id, title: String(data.get("title")), description: String(data.get("description")),
          documentType: String(data.get("documentType")), historicalDate: String(data.get("historicalDate")), personIds: ids });
      }}>
        <h4 className="font-semibold">Editar metadatos y asociaciones</h4>
        <MetadataFields document={document} />
        <fieldset><legend>Familiares relacionados</legend>{people.map((person) => <label key={person.id} className="block text-sm"><input type="checkbox" checked={ids.includes(person.id)} onChange={(event) => setIds(event.target.checked ? [...ids, person.id] : ids.filter((id) => id !== person.id))} /> {person.displayName}</label>)}</fieldset>
        <button disabled={busy || !ids.length} type="submit" className="rounded-lg bg-[#356747] px-4 py-2 text-white disabled:opacity-50">{busy ? "Guardando…" : "Guardar cambios"}</button>
      </form>}
    </div>
  </div>;
}
