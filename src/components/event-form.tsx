"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEventAction, updateEventAction, deleteEventAction } from "@/lib/event-actions";
import { eventLabels, eventSchema, eventTypes } from "@/lib/event-form-schemas";

type Event = {
  id: string; type: (typeof eventTypes)[number]; title: string; description: string | null;
  place: string | null; year: number | null; month: number | null; day: number | null;
  qualifier: "exact" | "approximate" | "before" | "after" | null;
};

export function EventForm({ treeId, personId, event }: { treeId: string; personId: string; event?: Event }) {
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.input<typeof eventSchema>, unknown, z.output<typeof eventSchema>>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      treeId, personId, type: event?.type ?? "other", title: event?.title ?? "",
      description: event?.description ?? "", place: event?.place ?? "",
      date: event?.year ? [String(event.year).padStart(4, "0"), event.month && String(event.month).padStart(2, "0"), event.day && String(event.day).padStart(2, "0")].filter(Boolean).join("-") : "",
      qualifier: event?.qualifier ?? "exact",
    },
  });
  const submit = handleSubmit(async (values) => {
    setMessage(""); setSuccess("");
    try {
      const result = event ? await updateEventAction({ ...values, eventId: event.id }) : await createEventAction(values);
      if (!result.ok) return setMessage(result.message);
      if (!event) reset();
      setSuccess(event ? "Acontecimiento actualizado." : "Acontecimiento registrado.");
    } catch { setMessage("No se pudo conectar con el servidor. Inténtalo de nuevo."); }
  });
  const remove = async () => {
    setMessage("");
    setIsDeleting(true);
    try {
      const result = await deleteEventAction({ treeId, personId, eventId: event!.id });
      if (!result.ok) return setMessage(result.message);
    } catch { setMessage("No se pudo eliminar el acontecimiento. Inténtalo de nuevo."); }
    finally { setIsDeleting(false); }
  };

  return <form noValidate onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
    <input type="hidden" {...register("treeId")} /><input type="hidden" {...register("personId")} />
    <div className="space-y-2"><Label htmlFor={`event-type-${event?.id ?? "new"}`}>Tipo</Label>
      <select id={`event-type-${event?.id ?? "new"}`} className="field-select" disabled={isSubmitting} aria-invalid={!!errors.type} {...register("type")}>
        {eventTypes.map((type) => <option key={type} value={type}>{eventLabels[type]}</option>)}
      </select>{errors.type && <p role="alert" className="text-sm text-red-700">{errors.type.message}</p>}
    </div>
    <div className="space-y-2"><Label htmlFor={`event-title-${event?.id ?? "new"}`}>Título</Label>
      <Input id={`event-title-${event?.id ?? "new"}`} disabled={isSubmitting} aria-invalid={!!errors.title} {...register("title")} />
      {errors.title && <p role="alert" className="text-sm text-red-700">{errors.title.message}</p>}
    </div>
    <div className="space-y-2"><Label htmlFor={`event-date-${event?.id ?? "new"}`}>Fecha (opcional)</Label>
      <Input id={`event-date-${event?.id ?? "new"}`} placeholder="AAAA, AAAA-MM o AAAA-MM-DD" inputMode="numeric" disabled={isSubmitting} aria-invalid={!!errors.date} {...register("date")} />
      {errors.date && <p role="alert" className="text-sm text-red-700">{errors.date.message}</p>}
    </div>
    <div className="space-y-2"><Label htmlFor={`event-qualifier-${event?.id ?? "new"}`}>Precisión de la fecha</Label>
      <select id={`event-qualifier-${event?.id ?? "new"}`} className="field-select" disabled={isSubmitting} {...register("qualifier")}>
        <option value="exact">Exacta según los datos disponibles</option><option value="approximate">Aproximada</option>
        <option value="before">Antes de</option><option value="after">Después de</option>
      </select>
    </div>
    <div className="space-y-2 sm:col-span-2"><Label htmlFor={`event-place-${event?.id ?? "new"}`}>Lugar (opcional)</Label>
      <Input id={`event-place-${event?.id ?? "new"}`} disabled={isSubmitting} aria-invalid={!!errors.place} {...register("place")} />
      {errors.place && <p role="alert" className="text-sm text-red-700">{errors.place.message}</p>}
    </div>
    <div className="space-y-2 sm:col-span-2"><Label htmlFor={`event-description-${event?.id ?? "new"}`}>Descripción (opcional)</Label>
      <textarea id={`event-description-${event?.id ?? "new"}`} rows={3} className="field-textarea" disabled={isSubmitting} aria-invalid={!!errors.description} {...register("description")} />
      {errors.description && <p role="alert" className="text-sm text-red-700">{errors.description.message}</p>}
    </div>
    <div className="space-y-3 sm:col-span-2">
      {message && <p role="alert" className="form-error">{message}</p>}
      {success && <p role="status" className="form-success">{success}</p>}
      <div className="flex flex-wrap gap-3"><Button disabled={isSubmitting} type="submit">{isSubmitting ? "Guardando…" : event ? "Guardar cambios" : "Agregar acontecimiento"}</Button>
        {event && !confirmDelete && <Button type="button" variant="outline" onClick={() => setConfirmDelete(true)}>Eliminar</Button>}
      </div>
      {confirmDelete && <div className="rounded-xl border border-red-200 p-4 text-sm"><p className="mb-3">¿Eliminar este acontecimiento? Esta acción no se puede deshacer.</p>
        <div className="flex gap-3"><Button type="button" variant="destructive" disabled={isDeleting} onClick={() => void remove()}>{isDeleting ? "Eliminando…" : "Confirmar eliminación"}</Button><Button type="button" variant="outline" disabled={isDeleting} onClick={() => setConfirmDelete(false)}>Cancelar</Button></div>
      </div>}
    </div>
  </form>;
}
