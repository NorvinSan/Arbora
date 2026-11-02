"use server";

import { headers } from "next/headers";
import { isAPIError } from "better-auth/api";
import { authErrorMessage } from "@/lib/auth-errors";
import { getCurrentSession } from "@/lib/session";
import { loginSchema, nameSchema, passwordSchema, registerSchema } from "@/lib/form-schemas";

type Result = { ok: true } | { ok: false; message: string };
type Context = Parameters<typeof authErrorMessage>[1];

function configured() {
  return Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_URL);
}

async function getAuth() {
  return (await import("@/lib/auth")).auth;
}

function failure(error: unknown, context: Context): Result {
  if (isAPIError(error)) {
    return { ok: false, message: authErrorMessage({ code: error.body?.code, status: error.statusCode }, context) };
  }
  return { ok: false, message: "No se pudo completar la operación. Inténtalo de nuevo." };
}

export async function registerAction(input: unknown): Promise<Result> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  if (!configured()) return { ok: false, message: authErrorMessage({ status: 503 }, "register") };

  try {
    const auth = await getAuth();
    await auth.api.signUpEmail({ body: parsed.data });
    return { ok: true };
  } catch (error) {
    return failure(error, "register");
  }
}

export async function loginAction(input: unknown): Promise<Result> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  if (!configured()) return { ok: false, message: authErrorMessage({ status: 503 }, "login") };

  try {
    const auth = await getAuth();
    await auth.api.signInEmail({ body: parsed.data });
    return { ok: true };
  } catch (error) {
    return failure(error, "login");
  }
}

export async function updateNameAction(input: unknown): Promise<Result> {
  const parsed = nameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  if (!await getCurrentSession()) return { ok: false, message: "Tu sesión ha terminado. Vuelve a iniciar sesión." };

  try {
    const auth = await getAuth();
    await auth.api.updateUser({ body: parsed.data, headers: await headers() });
    return { ok: true };
  } catch (error) {
    return failure(error, "profile");
  }
}

export async function changePasswordAction(input: unknown): Promise<Result> {
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  if (!await getCurrentSession()) return { ok: false, message: "Tu sesión ha terminado. Vuelve a iniciar sesión." };

  try {
    const auth = await getAuth();
    await auth.api.changePassword({
      body: { currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword, revokeOtherSessions: true },
      headers: await headers(),
    });
    return { ok: true };
  } catch (error) {
    return failure(error, "password");
  }
}

export async function signOutAction(): Promise<Result> {
  if (!configured()) return { ok: false, message: authErrorMessage({ status: 503 }, "logout") };
  try {
    const auth = await getAuth();
    await auth.api.signOut({ headers: await headers() });
    return { ok: true };
  } catch (error) {
    return failure(error, "logout");
  }
}
