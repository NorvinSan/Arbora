"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { loginSchema, registerSchema } from "@/lib/form-schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function FormShell({ registering, children }: { registering: boolean; children: ReactNode }) {
  return (
    <Card className="w-full max-w-md border-[#dce7d9] shadow-[0_18px_50px_rgba(30,68,43,0.07)] sm:gap-7 sm:p-2">
      <CardHeader className="space-y-2">
        <p className="eyebrow">{registering ? "Comienza tu historia" : "Bienvenido de nuevo"}</p>
        <CardTitle className="font-heading text-3xl sm:text-4xl">{registering ? "Crea tu cuenta" : "Inicia sesión"}</CardTitle>
        <CardDescription className="leading-6">{registering ? "Guarda y explora tu historia familiar en un espacio privado." : "Retoma la historia donde la dejaste."}</CardDescription>
      </CardHeader>
      <CardContent>
        {children}
        <p className="mt-7 border-t border-[#e6ece2] pt-6 text-center text-sm text-[#607266]">
          {registering ? "¿Ya tienes cuenta? " : "¿Aún no tienes cuenta? "}
          <Link className="text-link" href={registering ? "/login" : "/register"}>
            {registering ? "Inicia sesión" : "Regístrate"}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

function FieldError({ message }: { message?: string }) {
  return message ? <p role="alert" className="form-error">{message}</p> : null;
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
      const { error } = await authClient.signUp.email(values);
      if (error) return setServerError(authErrorMessage({ code: error.code, status: error.status }, "register"));
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
      const { error } = await authClient.signIn.email(values);
      if (error) return setServerError(authErrorMessage({ code: error.code, status: error.status }, "login"));
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
