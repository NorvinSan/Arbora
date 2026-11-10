"use server";

import { revalidatePath } from "next/cache";
import { eventSchema, updateEventSchema, deleteEventSchema } from "@/lib/event-form-schemas";
import { createPersonEvent, updatePersonEvent, deletePersonEvent } from "@/lib/person-events";
import { postgresErrorCode, type ActionResult } from "@/lib/action-result";
import { validatedAction } from "@/lib/validated-action";

const duplicateMessage = (error: unknown) => postgresErrorCode(error) === "23505"
  ? "Ya existe un nacimiento o fallecimiento para esta persona." : "No se pudo guardar el acontecimiento. Inténtalo de nuevo.";

export async function createEventAction(input: unknown): Promise<ActionResult> {
  return validatedAction(input, eventSchema, "createEvent", createPersonEvent,
    ({ treeId, personId }) => revalidatePath(`/dashboard/trees/${treeId}/people/${personId}`), duplicateMessage);
}

export async function updateEventAction(input: unknown): Promise<ActionResult> {
  return validatedAction(input, updateEventSchema, "updateEvent", updatePersonEvent,
    ({ treeId, personId }) => revalidatePath(`/dashboard/trees/${treeId}/people/${personId}`), duplicateMessage);
}

export async function deleteEventAction(input: unknown): Promise<ActionResult> {
  return validatedAction(input, deleteEventSchema, "deleteEvent", deletePersonEvent,
    ({ treeId, personId }) => revalidatePath(`/dashboard/trees/${treeId}/people/${personId}`),
    () => "No se pudo eliminar el acontecimiento. Inténtalo de nuevo.");
}
