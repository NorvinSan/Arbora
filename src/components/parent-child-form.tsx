"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { createParentChildAction } from "@/lib/relation-actions";
import { createParentChildSchema } from "@/lib/tree-form-schemas";

export function ParentChildForm({ treeId, people }: { treeId: string; people: { id: string; displayName: string }[] }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.input<typeof createParentChildSchema>, unknown, z.output<typeof createParentChildSchema>>({
    resolver: zodResolver(createParentChildSchema),
    defaultValues: { treeId, parentId: "", childId: "", relationType: "other" },
  });

  const submit = handleSubmit(async (values) => {
    setError("");
    setSuccess("");
    try {
      const result = await createParentChildAction(values);
      if (!result.ok) return setError(result.message);
      reset();
      setSuccess("Parentesco registrado correctamente.");
    } catch {
      setError("No se pudo conectar con el servidor. Inténtalo de nuevo.");
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Establecer parentesco</CardTitle>
        <CardDescription className="leading-6">Conecta a un progenitor con su hijo o hija dentro de este árbol.</CardDescription>
      </CardHeader>
      <CardContent>
        {people.length < 2 ? (
          <p className="rounded-xl bg-[#f1f6ee] p-4 text-sm leading-6 text-[#57715c]">Agrega al menos dos personas para registrar un parentesco.</p>
        ) : (
          <form noValidate onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" {...register("treeId")} />
            <div className="space-y-2">
              <Label htmlFor="relation-parent">Progenitor</Label>
              <select id="relation-parent" disabled={isSubmitting} aria-invalid={!!errors.parentId} className="field-select" {...register("parentId")}>
                <option value="">Selecciona una persona</option>
                {people.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}
              </select>
              {errors.parentId && <p role="alert" className="text-sm text-red-700">{errors.parentId.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="relation-child">Hijo o hija</Label>
              <select id="relation-child" disabled={isSubmitting} aria-invalid={!!errors.childId} className="field-select" {...register("childId")}>
                <option value="">Selecciona una persona</option>
                {people.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}
              </select>
              {errors.childId && <p role="alert" className="text-sm text-red-700">{errors.childId.message}</p>}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="relation-type">Tipo de parentesco</Label>
              <select id="relation-type" disabled={isSubmitting} className="field-select" {...register("relationType")}>
                <option value="other">No especificado</option>
                <option value="biological">Biológico</option>
                <option value="adoptive">Adoptivo</option>
              </select>
              {errors.relationType && <p role="alert" className="text-sm text-red-700">{errors.relationType.message}</p>}
            </div>
            <div className="space-y-3 sm:col-span-2">
              {error && <p role="alert" className="form-error">{error}</p>}
              {success && <p role="status" className="form-success">{success}</p>}
              <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Guardando…" : "Registrar parentesco"}</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
