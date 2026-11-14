"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deletePhotoAction, removePhotoAssociationAction, setProfilePhotoAction } from "@/lib/media-actions";
import { MAX_PHOTO_SIZE } from "@/lib/media-validation";
import type { getPersonPhotos } from "@/lib/person-media";

type Photo = Awaited<ReturnType<typeof getPersonPhotos>>[number];

export function PersonPhotos({ treeId, personId, photos, people, canEdit }: {
  treeId: string; personId: string; photos: Photo[];
  people: { id: string; displayName: string }[]; canEdit: boolean;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [selected, setSelected] = useState<string[]>([personId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [opened, setOpened] = useState<Photo | null>(null);
  const src = (id: string) => `/api/trees/${treeId}/media/${id}`;

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!file || file.size > MAX_PHOTO_SIZE || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || !selected.length) {
      setError("Selecciona una fotografía JPEG, PNG o WebP de hasta 10 MB y al menos un familiar."); return;
    }
    setBusy(true); setError("");
    const form = new FormData(formElement);
    form.set("file", file);
    form.delete("personId");
    selected.forEach((id) => form.append("personId", id));
    try {
      const response = await fetch(`/api/trees/${treeId}/media`, { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) { setError(result.message ?? "No se pudo subir la fotografía."); return; }
      setFile(null); setSelected([personId]);
      formElement.reset();
      router.refresh();
    } catch { setError("No se pudo subir la fotografía."); }
    finally { setBusy(false); }
  }

  async function change(action: () => Promise<{ ok: boolean; message?: string }>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true); setError("");
    try {
      const result = await action();
      if (!result.ok) setError(result.message ?? "No se pudo modificar la fotografía.");
      else { setOpened(null); router.refresh(); }
    } catch { setError("No se pudo modificar la fotografía."); }
    finally { setBusy(false); }
  }

  return <section aria-label="Fotografías" className="space-y-5">
    <div><p className="eyebrow mb-2">Álbum familiar</p><h2 className="section-title">Fotografías</h2></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {photos.length === 0 ? <p className="soft-panel border-dashed p-6 text-sm text-[#718274]">Todavía no hay fotografías asociadas.</p> :
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{photos.map((photo) => <li key={photo.id} className="soft-panel overflow-hidden">
        <button type="button" className="relative block aspect-square w-full bg-[#edf4e9]" onClick={() => setOpened(photo)} aria-label={`Abrir ${photo.fileName}`}>
          <Image src={src(photo.id)} alt={photo.description || photo.fileName} fill unoptimized className="object-cover" sizes="(max-width: 640px) 100vw, 33vw" />
        </button>
        <div className="space-y-2 p-4 text-sm">
          {photo.isProfile && <span className="text-xs font-semibold text-[#356747]">Foto de perfil</span>}
          <p className="break-words text-[#284c34]">{photo.description || photo.fileName}</p>
          <p className="text-xs text-[#607266]">Con: {photo.people.map((person) => person.displayName).join(", ") || "Sin asociaciones"}</p>
          {canEdit && <div className="flex flex-wrap gap-3 border-t border-[#e8eee5] pt-2">
            {!photo.isProfile && <button disabled={busy} type="button" className="text-link text-xs" onClick={() => void change(() => setProfilePhotoAction({ treeId, personId, mediaId: photo.id }))}>Usar como perfil</button>}
            <button disabled={busy} type="button" className="text-link text-xs" onClick={() => void change(() => removePhotoAssociationAction({ treeId, personId, mediaId: photo.id }), "¿Quitar la asociación con esta persona? La fotografía seguirá vinculada a los demás familiares.")}>Desvincular</button>
            <button disabled={busy} type="button" className="text-xs text-red-700 underline" onClick={() => void change(() => deletePhotoAction({ treeId, mediaId: photo.id }), "¿Eliminar esta fotografía de todo el árbol? Se quitará de todas las personas.")}>Eliminar archivo</button>
          </div>}
        </div>
      </li>)}</ul>}
    {canEdit && <form onSubmit={(event) => void upload(event)} className="soft-panel space-y-4 p-5 sm:p-6">
      <h3 className="font-heading text-xl font-semibold text-[#193d2b]">Agregar fotografía</h3>
      <label className="block text-sm font-medium" htmlFor="photo-file">Fotografía (JPEG, PNG o WebP; máximo 10 MB)</label>
      <input id="photo-file" name="file" type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="block w-full text-sm" />
      <label className="block text-sm font-medium" htmlFor="photo-description">Descripción (opcional)</label>
      <textarea id="photo-description" name="description" maxLength={1000} rows={2} className="w-full rounded-lg border border-[#cbdcc9] p-2 text-sm" />
      <fieldset><legend className="mb-2 text-sm font-medium">Familiares relacionados</legend>
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[#dbe5d9] p-3">
          {people.map((person) => <label key={person.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(person.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, person.id] : current.filter((id) => id !== person.id))} />{person.displayName}</label>)}
        </div>
      </fieldset>
      <button disabled={busy} type="submit" className="rounded-lg bg-[#356747] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Guardando…" : "Subir fotografía"}</button>
    </form>}
    {opened && <div role="dialog" aria-modal="true" aria-label={opened.fileName} className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setOpened(null)}>
      <div className="max-h-full w-full max-w-5xl overflow-y-auto rounded-xl bg-white p-4" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={() => setOpened(null)} className="text-link mb-3 block text-sm">Cerrar fotografía ×</button>
        <Image src={src(opened.id)} alt={opened.description || opened.fileName} width={1600} height={1200} unoptimized className="mx-auto max-h-[70vh] w-auto max-w-full object-contain" />
        <p className="mt-3 break-words text-sm">{opened.description || opened.fileName}</p>
        <p className="mt-2 text-sm">Familiares relacionados: {opened.people.map((person, index) => <span key={person.id}>{index > 0 && ", "}<Link className="text-link" href={`/dashboard/trees/${treeId}/people/${person.id}`}>{person.displayName}</Link></span>)}</p>
      </div>
    </div>}
  </section>;
}
