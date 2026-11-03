"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { changePasswordAction, updateNameAction } from "@/lib/auth-actions";
import { nameSchema, passwordSchema } from "@/lib/form-schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForms({ name, email, createdAt }: { name: string; email: string; createdAt: string }) {
  const router = useRouter();
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const profile = useForm<z.input<typeof nameSchema>, unknown, z.output<typeof nameSchema>>({
    resolver: zodResolver(nameSchema), defaultValues: { name },
  });
  const password = useForm<z.input<typeof passwordSchema>, unknown, z.output<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmation: "" },
  });

  const updateName = profile.handleSubmit(async (values) => {
    setProfileError("");
    setProfileSuccess("");
    try {
      const result = await updateNameAction(values);
      if (!result.ok) return setProfileError(result.message);
      profile.reset(values);
      setProfileSuccess("Nombre actualizado correctamente.");
      router.refresh();
    } catch {
      setProfileError("No se pudo conectar con el servidor.");
    }
  });

  const updatePassword = password.handleSubmit(async (values) => {
    setPasswordError("");
    setPasswordSuccess("");
    try {
      const result = await changePasswordAction(values);
      if (!result.ok) return setPasswordError(result.message);
      password.reset();
      setPasswordSuccess("Contraseña actualizada. Se cerraron las demás sesiones.");
    } catch {
      setPasswordError("No se pudo conectar con el servidor.");
    }
  });

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Datos de la cuenta</CardTitle><CardDescription>Tu correo no se puede cambiar desde este perfil.</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 rounded-xl bg-[#f3f7f1] p-4 sm:grid-cols-2"><div className="space-y-1"><p className="text-xs font-semibold uppercase tracking-wide text-[#6d846f]">Correo electrónico</p><p className="break-all text-sm font-medium text-[#294b35]">{email}</p></div>
          <div className="space-y-1"><p className="text-xs font-semibold uppercase tracking-wide text-[#6d846f]">Cuenta creada</p><p className="text-sm font-medium text-[#294b35]">{createdAt}</p></div></div>
          <form noValidate onSubmit={updateName} className="space-y-4">
            <Label htmlFor="profile-name">Nombre</Label>
            <Input id="profile-name" autoComplete="name" aria-invalid={!!profile.formState.errors.name} disabled={profile.formState.isSubmitting} {...profile.register("name")} />
            {profile.formState.errors.name && <p role="alert" className="text-sm text-red-700">{profile.formState.errors.name.message}</p>}
            {profileError && <p role="alert" className="form-error">{profileError}</p>}
            {profileSuccess && <p role="status" className="form-success">{profileSuccess}</p>}
            <Button type="submit" disabled={profile.formState.isSubmitting}>{profile.formState.isSubmitting ? "Guardando…" : "Guardar nombre"}</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Seguridad</CardTitle><CardDescription>Cambia la contraseña usando la actual.</CardDescription></CardHeader>
        <CardContent>
          <form noValidate onSubmit={updatePassword} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="current-password">Contraseña actual</Label><Input id="current-password" type="password" autoComplete="current-password" aria-invalid={!!password.formState.errors.currentPassword} disabled={password.formState.isSubmitting} {...password.register("currentPassword")} />{password.formState.errors.currentPassword && <p role="alert" className="text-sm text-red-700">{password.formState.errors.currentPassword.message}</p>}</div>
            <div className="space-y-2"><Label htmlFor="new-password">Contraseña nueva</Label><Input id="new-password" type="password" autoComplete="new-password" aria-invalid={!!password.formState.errors.newPassword} disabled={password.formState.isSubmitting} {...password.register("newPassword")} />{password.formState.errors.newPassword && <p role="alert" className="text-sm text-red-700">{password.formState.errors.newPassword.message}</p>}</div>
            <div className="space-y-2"><Label htmlFor="confirm-password">Confirmar contraseña nueva</Label><Input id="confirm-password" type="password" autoComplete="new-password" aria-invalid={!!password.formState.errors.confirmation} disabled={password.formState.isSubmitting} {...password.register("confirmation")} />{password.formState.errors.confirmation && <p role="alert" className="text-sm text-red-700">{password.formState.errors.confirmation.message}</p>}</div>
            {passwordError && <p role="alert" className="form-error">{passwordError}</p>}
            {passwordSuccess && <p role="status" className="form-success">{passwordSuccess}</p>}
            <Button type="submit" disabled={password.formState.isSubmitting}>{password.formState.isSubmitting ? "Actualizando…" : "Cambiar contraseña"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
