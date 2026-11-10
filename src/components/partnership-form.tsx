"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPartnershipAction } from "@/lib/relation-actions";
import { createPartnershipSchema } from "@/lib/tree-form-schemas";

export function PartnershipForm({ treeId, people }: { treeId: string; people: { id: string; displayName: string }[] }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.input<typeof createPartnershipSchema>, unknown, z.output<typeof createPartnershipSchema>>({
    resolver: zodResolver(createPartnershipSchema),
    defaultValues: { treeId, personAId: "", personBId: "", kind: "partnership", startDate: "", endDate: "" },
  });

  const submit = handleSubmit(async (values) => {
    setError("");
    setSuccess("");
    try {
      const result = await createPartnershipAction(values);
      if (!result.ok) return setError(result.message);
      reset();
      setSuccess("Relación de pareja registrada correctamente.");
    } catch {
      setError("No se pudo conectar con el servidor. Inténtalo de nuevo.");
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar pareja</CardTitle>
        <CardDescription className="leading-6">Registra matrimonios, uniones o parejas sin alterar los vínculos parentales.</CardDescription>
      </CardHeader>
      <CardContent>
        {people.length < 2 ? (
          <p className="rounded-xl bg-[#f1f6ee] p-4 text-sm leading-6 text-[#57715c]">Agrega al menos dos personas para registrar una pareja.</p>
        ) : (
          <form noValidate onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" {...register("treeId")} />
            <div className="space-y-2">
              <Label htmlFor="partnership-person-a">Persona</Label>
              <select id="partnership-person-a" disabled={isSubmitting} aria-invalid={!!errors.personAId} className="field-select" {...register("personAId")}>
                <option value="">Selecciona una persona</option>
                {people.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}
              </select>
              {errors.personAId && <p role="alert" className="text-sm text-red-700">{errors.personAId.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="partnership-person-b">Pareja</Label>
              <select id="partnership-person-b" disabled={isSubmitting} aria-invalid={!!errors.personBId} className="field-select" {...register("personBId")}>
                <option value="">Selecciona una persona</option>
                {people.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}
              </select>
              {errors.personBId && <p role="alert" className="text-sm text-red-700">{errors.personBId.message}</p>}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="partnership-kind">Tipo de relación</Label>
              <select id="partnership-kind" disabled={isSubmitting} aria-invalid={!!errors.kind} className="field-select" {...register("kind")}>
                <option value="marriage">Matrimonio</option>
                <option value="union">Unión</option>
                <option value="partnership">Pareja</option>
              </select>
              {errors.kind && <p role="alert" className="text-sm text-red-700">{errors.kind.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="partnership-start">Fecha de inicio (opcional)</Label>
              <Input id="partnership-start" type="date" disabled={isSubmitting} aria-invalid={!!errors.startDate} {...register("startDate")} />
              {errors.startDate && <p role="alert" className="text-sm text-red-700">{errors.startDate.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="partnership-end">Fecha de fin (opcional)</Label>
              <Input id="partnership-end" type="date" disabled={isSubmitting} aria-invalid={!!errors.endDate} {...register("endDate")} />
              {errors.endDate && <p role="alert" className="text-sm text-red-700">{errors.endDate.message}</p>}
            </div>
            <div className="space-y-3 sm:col-span-2">
              <p className="text-xs leading-5 text-[#718274]">Una fecha de fin vacía no indica si la relación continúa.</p>
              {error && <p role="alert" className="form-error">{error}</p>}
              {success && <p role="status" className="form-success">{success}</p>}
              <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Guardando…" : "Registrar pareja"}</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
