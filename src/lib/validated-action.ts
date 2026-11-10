import "server-only";

import type { z } from "zod";
import { getCurrentSession } from "@/lib/session";
import { sessionExpired, type ActionResult } from "@/lib/action-result";

export async function validatedAction<S extends z.ZodType, T extends object = object>(
  input: unknown,
  schema: S,
  operation: string,
  work: (userId: string, data: z.output<S>) => Promise<ActionResult<T>>,
  onSuccess: (data: z.output<S>) => void,
  onError?: (error: unknown) => string | undefined,
): Promise<ActionResult<T>> {
  const session = await getCurrentSession();
  if (!session) return sessionExpired;
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  try {
    const result = await work(session.user.id, parsed.data);
    if (result.ok) onSuccess(parsed.data);
    return result;
  } catch (error) {
    console.error(`${operation} failed`, error);
    return { ok: false, message: onError?.(error) ?? "No se pudo completar la operación. Inténtalo de nuevo." };
  }
}
