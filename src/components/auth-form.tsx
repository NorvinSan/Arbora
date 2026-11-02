"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { loginAction, registerAction } from "@/lib/auth-actions";
import { loginSchema, registerSchema } from "@/lib/form-schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function FormShell({ registering, children }: { registering: boolean; children: ReactNode }) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">{registering ? "Crea tu cuenta" : "Inicia sesión"}</CardTitle>
        <CardDescription>{registering ? "Guarda y explora tu historia familiar en un espacio privado." : "Vuelve a tus árboles familiares."}</CardDescription>
      </CardHeader>
      <CardContent>
        {children}
        <p className="mt-6 text-center text-sm text-slate-600">
          {registering ? "¿Ya tienes cuenta? " : "¿Aún no tienes cuenta? "}
          <Link className="font-medium text-emerald-800 underline" href={registering ? "/login" : "/register"}>
            {registering ? "Inicia sesión" : "Regístrate"}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p role="alert" className="text-sm text-red-700">{message}</p> : null;
}

function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof registerSchema>, unknown, z.output<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const submit = handleSubmit(async (values) => {
    setServerError("");
    try {
      const result = await registerAction(values);
      if (!result.ok) return setServerError(result.message);
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setServerError("No se pudo conectar con el servidor. Inténtalo de nuevo.");
    }
  });

  return (
    <FormShell registering>
      <form noValidate onSubmit={submit} className="space-y-5">
        <div className="space-y-2"><Label htmlFor="name">Nombre</Label><Input id="name" autoComplete="name" aria-invalid={!!errors.name} disabled={isSubmitting} {...register("name")} /><FieldError message={errors.name?.message} /></div>
        <div className="space-y-2"><Label htmlFor="email">Correo electrónico</Label><Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} disabled={isSubmitting} {...register("email")} /><FieldError message={errors.email?.message} /></div>
        <div className="space-y-2"><Label htmlFor="password">Contraseña</Label><Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} disabled={isSubmitting} {...register("password")} /><p className="text-xs text-slate-500">Entre 8 y 128 caracteres.</p><FieldError message={errors.password?.message} /></div>
        <FieldError message={serverError} />
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Procesando…" : "Crear cuenta"}</Button>
      </form>
    </FormShell>
  );
}

function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof loginSchema>, unknown, z.output<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const submit = handleSubmit(async (values) => {
    setServerError("");
    try {
      const result = await loginAction(values);
      if (!result.ok) return setServerError(result.message);
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setServerError("No se pudo conectar con el servidor. Inténtalo de nuevo.");
    }
  });

  return (
    <FormShell registering={false}>
      <form noValidate onSubmit={submit} className="space-y-5">
        <div className="space-y-2"><Label htmlFor="email">Correo electrónico</Label><Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} disabled={isSubmitting} {...register("email")} /><FieldError message={errors.email?.message} /></div>
        <div className="space-y-2"><Label htmlFor="password">Contraseña</Label><Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} disabled={isSubmitting} {...register("password")} /><FieldError message={errors.password?.message} /></div>
        <FieldError message={serverError} />
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>{isSubmitting ? "Procesando…" : "Entrar"}</Button>
      </form>
    </FormShell>
  );
}

export function AuthForm({ mode }: { mode: "register" | "login" }) {
  return mode === "register" ? <RegisterForm /> : <LoginForm />;
}
