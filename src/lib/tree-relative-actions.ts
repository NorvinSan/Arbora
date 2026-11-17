"use server";

import { revalidatePath } from "next/cache";
import { addRelativeSchema } from "@/lib/tree-form-schemas";
import { addRelative } from "@/lib/tree-relative";
import { validatedAction } from "@/lib/validated-action";
import type { ActionResult } from "@/lib/action-result";

export async function addRelativeAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return validatedAction(input, addRelativeSchema, "addRelative", addRelative,
    ({ treeId }) => revalidatePath(`/dashboard/trees/${treeId}`),
    () => "No se pudo guardar el familiar. Inténtalo de nuevo.");
}
