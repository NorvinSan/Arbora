import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { ActionResult } from "@/lib/action-result";

type Failure = Extract<ActionResult, { ok: false }>;

// Serializing writes per tree also prevents concurrent parent/child cycle checks.
export async function withWritableTree<T extends { ok: true }>(userId: string, treeId: string, work: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T | Failure>): Promise<T | Failure> {
  return db.transaction(async (tx) => {
    const access = await tx.execute(sql`
      select id from family_tree
      where id = ${treeId} and (
        owner_id = ${userId} or exists (
          select 1 from tree_collaborator
          where tree_id = ${treeId} and user_id = ${userId} and role = 'editor'
        )
      ) for update
    `);
    if (access.rows.length === 0) return { ok: false, message: "No tienes permiso para modificar este árbol." };
    return work(tx);
  });
}
