"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/session";
import { eventSchema, updateEventSchema, deleteEventSchema } from "@/lib/event-form-schemas";
import { createPersonEvent, updatePersonEvent, deletePersonEvent } from "@/lib/person-events";

type Result = { ok: true } | { ok: false; message: string };

async function run(input: unknown, mode: "create" | "update" | "delete"): Promise<Result> {
  const parsed = mode === "create" ? eventSchema.safeParse(input) : mode === "update" ? updateEventSchema.safeParse(input) : deleteEventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const session = await getCurrentSession();
  if (!session) return { ok: false, message: "Tu sesión ha terminado. Vuelve a iniciar sesión." };
  try {
    const result = mode === "create" ? await createPersonEvent(session.user.id, eventSchema.parse(parsed.data))
      : mode === "update" ? await updatePersonEvent(session.user.id, updateEventSchema.parse(parsed.data))
        : await deletePersonEvent(session.user.id, deleteEventSchema.parse(parsed.data));
    if (result.ok) revalidatePath(`/dashboard/trees/${parsed.data.treeId}/people/${parsed.data.personId}`);
    return result;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return { ok: false, message: "Ya existe un nacimiento o fallecimiento para esta persona." };
    }
    return { ok: false, message: "No se pudo guardar el acontecimiento. Inténtalo de nuevo." };
  }
}

export async function createEventAction(input: unknown): Promise<Result> { return run(input, "create"); }
export async function updateEventAction(input: unknown): Promise<Result> { return run(input, "update"); }
export async function deleteEventAction(input: unknown): Promise<Result> { return run(input, "delete"); }
