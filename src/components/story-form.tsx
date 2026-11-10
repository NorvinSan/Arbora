"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStoryAction, updateStoryAction, deleteStoryAction } from "@/lib/story-actions";
import { storySchema } from "@/lib/story-form-schemas";

type ExistingStory = { id: string; title: string; body: string; participants: { id: string }[] };

export function StoryForm({ treeId, people, story }: {
  treeId: string; people: { id: string; displayName: string }[]; story?: ExistingStory;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.input<typeof storySchema>, unknown, z.output<typeof storySchema>>({
    resolver: zodResolver(storySchema),
    defaultValues: { treeId, title: story?.title ?? "", body: story?.body ?? "", personIds: story?.participants.map((person) => person.id) ?? [] },
  });

  const submit = handleSubmit(async (values) => {
    setError(""); setSuccess("");
    try {
      const result = story ? await updateStoryAction({ ...values, storyId: story.id }) : await createStoryAction(values);
      if (!result.ok) return setError(result.message);
      if (!story) reset();
      setSuccess(story ? "Relato actualizado." : "Relato registrado.");
      router.refresh();
    } catch { setError("No se pudo conectar con el servidor. Inténtalo de nuevo."); }
  });

  const remove = async () => {
    if (!story) return;
    setError(""); setIsDeleting(true);
    try {
      const result = await deleteStoryAction({ treeId, storyId: story.id });
      if (!result.ok) return setError(result.message);
      router.push(`/dashboard/trees/${treeId}/stories`);
      router.refresh();
    } catch { setError("No se pudo eliminar el relato. Inténtalo de nuevo."); }
    finally { setIsDeleting(false); }
  };

  return <form noValidate onSubmit={submit} className="space-y-5">
    <input type="hidden" {...register("treeId")} />
    <div className="space-y-2"><Label htmlFor={`story-title-${story?.id ?? "new"}`}>Título</Label>
      <Input id={`story-title-${story?.id ?? "new"}`} disabled={isSubmitting} aria-invalid={!!errors.title} {...register("title")} />
      {errors.title && <p role="alert" className="text-sm text-red-700">{errors.title.message}</p>}
    </div>
    <div className="space-y-2"><Label htmlFor={`story-body-${story?.id ?? "new"}`}>Contenido</Label>
      <textarea id={`story-body-${story?.id ?? "new"}`} rows={7} className="field-textarea" disabled={isSubmitting} aria-invalid={!!errors.body} {...register("body")} />
      {errors.body && <p role="alert" className="text-sm text-red-700">{errors.body.message}</p>}
    </div>
    <fieldset className="space-y-3 rounded-xl border border-[#dce8d8] p-4">
      <legend className="px-2 text-sm font-semibold text-[#284c34]">Familiares asociados (opcional)</legend>
      {people.length === 0 ? <p className="text-sm text-[#718274]">Aún no hay personas en este árbol. Puedes guardar un relato general.</p> :
        <div className="grid max-h-48 gap-3 overflow-y-auto sm:grid-cols-2">{people.map((person) =>
          <label key={person.id} className="flex items-center gap-2 text-sm text-[#284c34]">
            <input type="checkbox" value={person.id} disabled={isSubmitting} {...register("personIds")} className="size-4 accent-[#356747]" />
            <span>{person.displayName}</span>
          </label>)}</div>}
      {errors.personIds && <p role="alert" className="text-sm text-red-700">{errors.personIds.message}</p>}
    </fieldset>
    {error && <p role="alert" className="form-error">{error}</p>}
    {success && <p role="status" className="form-success">{success}</p>}
    <div className="flex flex-wrap gap-3"><Button type="submit" disabled={isSubmitting || isDeleting}>{isSubmitting ? "Guardando…" : story ? "Guardar cambios" : "Registrar relato"}</Button>
      {story && !confirmDelete && <Button type="button" variant="outline" onClick={() => setConfirmDelete(true)}>Eliminar relato</Button>}
    </div>
    {confirmDelete && <div className="rounded-xl border border-red-200 p-4 text-sm"><p className="mb-3">¿Eliminar este relato? Esta acción no se puede deshacer.</p>
      <div className="flex gap-3"><Button type="button" variant="destructive" disabled={isDeleting} onClick={() => void remove()}>{isDeleting ? "Eliminando…" : "Confirmar eliminación"}</Button><Button type="button" variant="outline" disabled={isDeleting} onClick={() => setConfirmDelete(false)}>Cancelar</Button></div>
    </div>}
  </form>;
}
