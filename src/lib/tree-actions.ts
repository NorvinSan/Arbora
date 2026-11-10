"use server";

import { revalidatePath } from "next/cache";
import { createTree, addPerson } from "@/lib/tree-mutations";
import { addPersonSchema, createTreeSchema } from "@/lib/tree-form-schemas";
import { validatedAction } from "@/lib/validated-action";
import type { ActionResult } from "@/lib/action-result";

export async function createTreeAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return validatedAction(input, createTreeSchema, "createTree", createTree,
    () => revalidatePath("/dashboard"), () => "No se pudo crear el árbol. Inténtalo de nuevo.");
}

export async function addPersonAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return validatedAction(input, addPersonSchema, "addPerson", addPerson,
    ({ treeId }) => revalidatePath(`/dashboard/trees/${treeId}`),
    () => "No se pudo agregar la persona. Inténtalo de nuevo.");
}
