import "server-only";

import { eq, and } from "drizzle-orm";
import type { z } from "zod";
import { person } from "@/db/app-schema";
import { insertPerson } from "@/lib/tree-mutations";
import { insertParentChild } from "@/lib/parent-child";
import { insertPartnership } from "@/lib/partnerships";
import { withWritableTree } from "@/lib/tree-write";
import type { addRelativeSchema } from "@/lib/tree-form-schemas";
import type { ActionResult } from "@/lib/action-result";

type Input = z.output<typeof addRelativeSchema>;

class RelativeError extends Error {}

export async function addRelative(userId: string, input: Input): Promise<ActionResult<{ id: string }>> {
  try {
    return await withWritableTree<{ ok: true; id: string }>(userId, input.treeId, async (tx) => {
      const [anchor] = await tx.select({ id: person.id }).from(person)
        .where(and(eq(person.treeId, input.treeId), eq(person.id, input.anchorId))).limit(1);
      if (!anchor) return { ok: false as const, message: "La persona seleccionada ya no pertenece a este árbol." };

      const relativeId = input.personMode === "new"
        ? await insertPerson(tx, { treeId: input.treeId, ...input.person })
        : input.existingId;
      const result = input.relationship === "partner"
        ? await insertPartnership(tx, {
          treeId: input.treeId, personAId: input.anchorId, personBId: relativeId,
          kind: input.kind, startDate: input.startDate, endDate: input.endDate,
        })
        : await insertParentChild(tx, {
          treeId: input.treeId, parentId: input.relationship === "parent" ? relativeId : input.anchorId,
          childId: input.relationship === "parent" ? input.anchorId : relativeId, relationType: input.relationType,
        });
      // Returning an error from a transaction commits it; roll back a newly created person too.
      if (!result.ok) throw new RelativeError(result.message);
      return { ok: true as const, id: relativeId };
    });
  } catch (error) {
    if (error instanceof RelativeError) return { ok: false as const, message: error.message };
    throw error;
  }
}
