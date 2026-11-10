"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addPersonAction } from "@/lib/tree-actions";
import { addPersonSchema } from "@/lib/tree-form-schemas";

export function AddPersonForm({ treeId }: { treeId: string }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.input<typeof addPersonSchema>, unknown, z.output<typeof addPersonSchema>>({
    resolver: zodResolver(addPersonSchema),
    defaultValues: { treeId, displayName: "", givenName: "", familyName: "", lifeStatus: "unknown", whereaboutsStatus: "unknown" },
  });

  const submit = handleSubmit(async (values) => {
    setError("");
    setSuccess("");
    try {
      const result = await addPersonAction(values);
      if (!result.ok) return setError(result.message);
      reset();
      setSuccess("Persona agregada al árbol.");
    } catch {
      setError("No se pudo conectar con el servidor. Inténtalo de nuevo.");
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agregar un familiar</CardTitle>
        <CardDescription className="leading-6">Registra a la persona y después podrás establecer sus vínculos familiares.</CardDescription>
      </CardHeader>
      <CardContent>
          <form noValidate onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" {...register("treeId")} />
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="person-display-name">Nombre para mostrar</Label>
            <Input id="person-display-name" placeholder="Elena Rivera" aria-invalid={!!errors.displayName} disabled={isSubmitting} {...register("displayName")} />
            {errors.displayName && <p role="alert" className="text-sm text-red-700">{errors.displayName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="person-given-name">Nombre (opcional)</Label>
            <Input id="person-given-name" disabled={isSubmitting} {...register("givenName")} />
            {errors.givenName && <p role="alert" className="text-sm text-red-700">{errors.givenName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="person-family-name">Apellidos (opcional)</Label>
            <Input id="person-family-name" disabled={isSubmitting} {...register("familyName")} />
            {errors.familyName && <p role="alert" className="text-sm text-red-700">{errors.familyName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="person-life-status">Estado vital</Label>
            <select id="person-life-status" disabled={isSubmitting} className="field-select" {...register("lifeStatus")}>
              <option value="unknown">Desconocido</option><option value="living">Vive</option><option value="deceased">Falleció</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="person-whereabouts">Paradero</Label>
            <select id="person-whereabouts" disabled={isSubmitting} className="field-select" {...register("whereaboutsStatus")}>
              <option value="unknown">Desconocido</option><option value="known">Conocido</option><option value="missing">Desaparecido/a</option>
            </select>
          </div>
          <div className="space-y-3 sm:col-span-2">
            {error && <p role="alert" className="form-error">{error}</p>}
            {success && <p role="status" className="form-success">{success}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Guardando…" : "Agregar persona"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
