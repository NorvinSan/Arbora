import { sql } from "drizzle-orm";
import { db } from "@/db";
import type { z } from "zod";
import type { createParentChildSchema, deleteParentChildSchema } from "@/lib/tree-form-schemas";

type Relation = z.output<typeof deleteParentChildSchema>;
type CreateRelation = z.output<typeof createParentChildSchema>;
type Result = { ok: true } | { ok: false; message: string };

// Locking the tree serializes relation writes in that tree. Without this lock,
// concurrent requests could each pass the cycle check and then create a cycle.
async function withWritableTree(userId: string, treeId: string, work: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<Result>): Promise<Result> {
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
    if (access.rows.length === 0) return { ok: false, message: "No tienes permiso para modificar las relaciones de este árbol." };
    return work(tx);
  });
}

export async function createParentChild(userId: string, { treeId, parentId, childId, relationType }: CreateRelation): Promise<Result> {
  if (parentId === childId) return { ok: false, message: "Una persona no puede ser su propio progenitor." };

  return withWritableTree(userId, treeId, async (tx) => {
    const people = await tx.execute(sql`
      select id from person where tree_id = ${treeId} and id in (${parentId}, ${childId})
    `);
    if (people.rows.length !== 2) return { ok: false, message: "Ambas personas deben pertenecer al mismo árbol." };

    const duplicate = await tx.execute(sql`
      select 1 from parent_child where tree_id = ${treeId}
        and parent_id = ${parentId} and child_id = ${childId}
    `);
    if (duplicate.rows.length) return { ok: false, message: "Esta relación ya está registrada." };

    const cycle = await tx.execute<{ would_cycle: boolean }>(sql`
      with recursive descendants(id) as (
        select child_id from parent_child where tree_id = ${treeId} and parent_id = ${childId}
        union
        select pc.child_id from parent_child pc
        join descendants d on pc.parent_id = d.id
        where pc.tree_id = ${treeId}
      )
      select exists(select 1 from descendants where id = ${parentId}) as would_cycle
    `);
    if (cycle.rows[0].would_cycle) return { ok: false, message: "Esta relación crearía un ciclo genealógico." };

    await tx.execute(sql`
      insert into parent_child (tree_id, parent_id, child_id, relation_type)
      values (${treeId}, ${parentId}, ${childId}, ${relationType}::parent_relation_type)
    `);
    return { ok: true };
  });
}

export async function deleteParentChild(userId: string, { treeId, parentId, childId }: Relation): Promise<Result> {
  return withWritableTree(userId, treeId, async (tx) => {
    const deleted = await tx.execute(sql`
      delete from parent_child where tree_id = ${treeId}
        and parent_id = ${parentId} and child_id = ${childId}
      returning parent_id
    `);
    if (!deleted.rows.length) return { ok: false, message: "La relación ya no existe." };
    return { ok: true };
  });
}
