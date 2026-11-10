"use server";

import { revalidatePath } from "next/cache";
import { createParentChild, deleteParentChild } from "@/lib/parent-child";
import { createPartnership, deletePartnership } from "@/lib/partnerships";
import { createParentChildSchema, createPartnershipSchema, deleteParentChildSchema, deletePartnershipSchema } from "@/lib/tree-form-schemas";
import { validatedAction } from "@/lib/validated-action";
import type { ActionResult } from "@/lib/action-result";

function refreshFamily(treeId: string, parentId: string, childId: string) {
  revalidatePath(`/dashboard/trees/${treeId}`);
  revalidatePath(`/dashboard/trees/${treeId}/people/${parentId}`);
  revalidatePath(`/dashboard/trees/${treeId}/people/${childId}`);
}

export async function createParentChildAction(input: unknown): Promise<ActionResult> {
  return validatedAction(input, createParentChildSchema, "createParentChild", createParentChild,
    ({ treeId, parentId, childId }) => refreshFamily(treeId, parentId, childId),
    () => "No se pudo registrar la relación. Inténtalo de nuevo.");
}

export async function deleteParentChildAction(input: unknown): Promise<ActionResult> {
  return validatedAction(input, deleteParentChildSchema, "deleteParentChild", deleteParentChild,
    ({ treeId, parentId, childId }) => refreshFamily(treeId, parentId, childId),
    () => "No se pudo eliminar la relación. Inténtalo de nuevo.");
}

export async function createPartnershipAction(input: unknown): Promise<ActionResult> {
  return validatedAction(input, createPartnershipSchema, "createPartnership", createPartnership,
    ({ treeId, personAId, personBId }) => refreshFamily(treeId, personAId, personBId),
    () => "No se pudo registrar la pareja. Inténtalo de nuevo.");
}

export async function deletePartnershipAction(input: unknown): Promise<ActionResult> {
  return validatedAction(input, deletePartnershipSchema, "deletePartnership", async (userId, data) => {
    const result = await deletePartnership(userId, data);
    if (result.ok) refreshFamily(data.treeId, result.personAId, result.personBId);
    return result.ok ? { ok: true } : result;
  }, () => {}, () => "No se pudo eliminar la pareja. Inténtalo de nuevo.");
}
