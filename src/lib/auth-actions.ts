"use server";

import { headers } from "next/headers";
import { isAPIError } from "better-auth/api";
import { isAuthConfigured } from "@/lib/auth-config";
import { sessionExpired, type ActionResult } from "@/lib/action-result";
import { authErrorMessage } from "@/lib/auth-errors";
import { getCurrentSession } from "@/lib/session";
import { nameSchema, passwordSchema } from "@/lib/form-schemas";

type Context = Parameters<typeof authErrorMessage>[1];

async function getAuth() {
  return (await import("@/lib/auth")).auth;
}

function failure(error: unknown, context: Context): ActionResult {
  if (isAPIError(error)) {
    return { ok: false, message: authErrorMessage({ code: error.body?.code, status: error.statusCode }, context) };
  }
  console.error(`Auth ${context} failed`, error);
  return { ok: false, message: "No se pudo completar la operación. Inténtalo de nuevo." };
}

export async function updateNameAction(input: unknown): Promise<ActionResult> {
  if (!await getCurrentSession()) return sessionExpired;
  const parsed = nameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  try {
    const auth = await getAuth();
    await auth.api.updateUser({ body: parsed.data, headers: await headers() });
    return { ok: true };
  } catch (error) {
    return failure(error, "profile");
  }
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  if (!await getCurrentSession()) return sessionExpired;
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

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

export async function signOutAction(): Promise<ActionResult> {
  if (!isAuthConfigured()) return { ok: false, message: authErrorMessage({ status: 503 }, "logout") };
  try {
    const auth = await getAuth();
    await auth.api.signOut({ headers: await headers() });
    return { ok: true };
  } catch (error) {
    return failure(error, "logout");
  }
}
