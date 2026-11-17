"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { addRelativeAction } from "@/lib/tree-relative-actions";
import { addRelativeSchema } from "@/lib/tree-form-schemas";

export type RelativeKind = "parent" | "child" | "partner";
const titles: Record<RelativeKind, string> = { parent: "Agregar padre/madre", child: "Agregar hijo/a", partner: "Agregar pareja" };

export function TreeRelativeEditor({ treeId, anchor, relationship, people, onClose, onSaved }: {
  treeId: string; anchor: { id: string; displayName: string }; relationship: RelativeKind;
  people: { id: string; displayName: string }[]; onClose: () => void; onSaved: (id: string) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof addRelativeSchema>, unknown, z.output<typeof addRelativeSchema>>({
    resolver: zodResolver(addRelativeSchema),
    defaultValues: {
      treeId, anchorId: anchor.id, relationship, personMode: "new", existingId: "",
      person: { displayName: "", givenName: "", familyName: "", lifeStatus: "unknown", whereaboutsStatus: "unknown" },
      relationType: "other", kind: "partnership", startDate: "", endDate: "",
    },
  });
  const personMode = useWatch({ control, name: "personMode" });
  const submit = handleSubmit(async (values) => {
    setError("");
    try {
      const response = await addRelativeAction(values);
      if (!response.ok) { setError(response.message); return; }
      await onSaved(response.id);
    } catch { setError("No se pudo actualizar el árbol. Comprueba los cambios e inténtalo de nuevo."); }
  });

  return <aside role="dialog" aria-label={titles[relationship]} aria-modal="false" className="absolute inset-y-0 right-0 z-20 w-full overflow-y-auto border-l border-[#dce7d9] bg-white p-4 shadow-2xl sm:max-w-sm sm:p-5">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div><h3 className="font-heading text-lg font-semibold text-[#193d2b]">{titles[relationship]}</h3><p className="mt-1 text-sm text-[#607266]">{relationship === "parent" ? "Progenitor/a de" : relationship === "child" ? "Hijo/a de" : "Pareja de"} <strong>{anchor.displayName}</strong></p></div>
      <button type="button" className="text-link text-sm" disabled={isSubmitting} onClick={onClose}>Cerrar</button>
    </div>
    <form noValidate onSubmit={submit} className="space-y-4">
      <div className="space-y-2"><Label htmlFor="relative-mode">Persona</Label><select id="relative-mode" className="field-select" disabled={isSubmitting} {...register("personMode")}><option value="new">Crear persona nueva</option><option value="existing">Seleccionar existente</option></select></div>
      {personMode === "new" ? <div className="space-y-3">
        <div className="space-y-1"><Label htmlFor="relative-display">Nombre para mostrar</Label><input id="relative-display" autoFocus className="field-select" aria-invalid={!!errors.person?.displayName} disabled={isSubmitting} {...register("person.displayName")} />{errors.person?.displayName && <p role="alert" className="text-sm text-red-700">{errors.person.displayName.message}</p>}</div>
        <div className="space-y-1"><Label htmlFor="relative-given">Nombre (opcional)</Label><input id="relative-given" className="field-select" disabled={isSubmitting} {...register("person.givenName")} />{errors.person?.givenName && <p role="alert" className="text-sm text-red-700">{errors.person.givenName.message}</p>}</div>
        <div className="space-y-1"><Label htmlFor="relative-family">Apellidos (opcional)</Label><input id="relative-family" className="field-select" disabled={isSubmitting} {...register("person.familyName")} />{errors.person?.familyName && <p role="alert" className="text-sm text-red-700">{errors.person.familyName.message}</p>}</div>
        <div className="space-y-1"><Label htmlFor="relative-life">Estado vital</Label><select id="relative-life" className="field-select" disabled={isSubmitting} {...register("person.lifeStatus")}><option value="unknown">Desconocido</option><option value="living">Vive</option><option value="deceased">Falleció</option></select></div>
        <div className="space-y-1"><Label htmlFor="relative-whereabouts">Paradero</Label><select id="relative-whereabouts" className="field-select" disabled={isSubmitting} {...register("person.whereaboutsStatus")}><option value="unknown">Desconocido</option><option value="known">Conocido</option><option value="missing">Desaparecido/a</option></select></div>
      </div> : <div className="space-y-1"><Label htmlFor="relative-existing">Familiar existente</Label><select id="relative-existing" className="field-select" disabled={isSubmitting} aria-invalid={!!errors.existingId} {...register("existingId")}><option value="">Selecciona una persona</option>{people.filter((member) => member.id !== anchor.id).map((member) => <option key={member.id} value={member.id}>{member.displayName} · {member.id.slice(0, 8)}</option>)}</select>{errors.existingId && <p role="alert" className="text-sm text-red-700">{errors.existingId.message}</p>}</div>}
      {relationship === "partner" ? <>
        <div className="space-y-1"><Label htmlFor="relative-kind">Tipo de relación</Label><select id="relative-kind" className="field-select" disabled={isSubmitting} {...register("kind")}><option value="partnership">Pareja</option><option value="union">Unión</option><option value="marriage">Matrimonio</option></select></div>
        <div className="space-y-1"><Label htmlFor="relative-start">Inicio (opcional)</Label><input id="relative-start" type="date" className="field-select" disabled={isSubmitting} {...register("startDate")} />{errors.startDate && <p role="alert" className="text-sm text-red-700">{errors.startDate.message}</p>}</div>
        <div className="space-y-1"><Label htmlFor="relative-end">Fin (opcional)</Label><input id="relative-end" type="date" className="field-select" disabled={isSubmitting} {...register("endDate")} />{errors.endDate && <p role="alert" className="text-sm text-red-700">{errors.endDate.message}</p>}</div>
      </> : <div className="space-y-1"><Label htmlFor="relative-type">Tipo de parentesco</Label><select id="relative-type" className="field-select" disabled={isSubmitting} {...register("relationType")}><option value="other">No especificado</option><option value="biological">Biológico</option><option value="adoptive">Adoptivo</option></select></div>}
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="flex gap-2"><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Guardando…" : "Guardar vínculo"}</Button><Button type="button" variant="outline" disabled={isSubmitting} onClick={onClose}>Cancelar</Button></div>
    </form>
  </aside>;
}
