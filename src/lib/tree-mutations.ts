import "server-only";

import { db } from "@/db";
import { familyTree, person } from "@/db/app-schema";
import { withWritableTree } from "@/lib/tree-write";
import type { z } from "zod";
import type { addPersonSchema, createTreeSchema } from "@/lib/tree-form-schemas";
import type { ActionResult } from "@/lib/action-result";

export async function createTree(userId: string, input: z.output<typeof createTreeSchema>): Promise<ActionResult<{ id: string }>> {
  const [tree] = await db.insert(familyTree).values({
    ownerId: userId, name: input.name, description: input.description || null,
  }).returning({ id: familyTree.id });
  return { ok: true, id: tree.id };
}

export async function addPerson(userId: string, input: z.output<typeof addPersonSchema>): Promise<ActionResult<{ id: string }>> {
  return withWritableTree<{ ok: true; id: string }>(userId, input.treeId, async (tx) => {
    const [member] = await tx.insert(person).values({
      treeId: input.treeId, displayName: input.displayName,
      givenName: input.givenName || null, familyName: input.familyName || null,
      lifeStatus: input.lifeStatus, whereaboutsStatus: input.whereaboutsStatus,
    }).returning({ id: person.id });
    return { ok: true, id: member.id };
  });
}
