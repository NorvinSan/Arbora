"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTreeAction } from "@/lib/tree-actions";
import { createTreeSchema } from "@/lib/tree-form-schemas";

export function CreateTreeForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof createTreeSchema>, unknown, z.output<typeof createTreeSchema>>({
    resolver: zodResolver(createTreeSchema),
    defaultValues: { name: "", description: "" },
  });

  const submit = handleSubmit(async (values) => {
    setError("");
    try {
      const result = await createTreeAction(values);
      if (!result.ok) return setError(result.message);
      router.push(`/dashboard/trees/${result.id}`);
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor. Inténtalo de nuevo.");
    }
  });

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Crear un árbol familiar</CardTitle>
        <CardDescription>Empieza con un nombre. Podrás agregar integrantes desde el árbol.</CardDescription>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tree-name">Nombre del árbol</Label>
            <Input id="tree-name" placeholder="Mi familia" aria-invalid={!!errors.name} disabled={isSubmitting} {...register("name")} />
            {errors.name && <p role="alert" className="text-sm text-red-700">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="tree-description">Descripción (opcional)</Label>
            <textarea id="tree-description" rows={3} aria-invalid={!!errors.description} disabled={isSubmitting} className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" {...register("description")} />
            {errors.description && <p role="alert" className="text-sm text-red-700">{errors.description.message}</p>}
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Creando…" : "Crear árbol"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
