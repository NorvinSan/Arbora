import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { MAX_GENERATIONS, type BranchMode } from "@/lib/tree-exploration-options";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function searchTreePeople(userId: string, treeId: string, input: string) {
  if (typeof input !== "string") return [];
  const query = input.trim().slice(0, 100);
  if (!uuid.test(treeId) || !query) return [];
  // Escape LIKE metacharacters: a typed percent or underscore is literal.
  const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
  const result = await db.execute<{ id: string; display_name: string; given_name: string | null; family_name: string | null }>(sql`
    select p.id::text, p.display_name, p.given_name, p.family_name
    from person p
    join family_tree t on t.id = p.tree_id
    where p.tree_id = ${treeId}::uuid
      and (t.owner_id = ${userId} or exists (
        select 1 from tree_collaborator c where c.tree_id = t.id and c.user_id = ${userId}
      ))
      and (p.display_name ilike ${pattern} escape '\' or p.given_name ilike ${pattern} escape '\'
        or p.family_name ilike ${pattern} escape '\' or p.preferred_name ilike ${pattern} escape '\'
        or concat_ws(' ', p.given_name, p.family_name) ilike ${pattern} escape '\')
    order by p.display_name, p.id limit 20
  `);
  return result.rows.map((row) => ({ id: row.id, displayName: row.display_name, givenName: row.given_name, familyName: row.family_name }));
}

export async function getTreeBranch(userId: string, treeId: string, personId: string, mode: BranchMode, generations: number) {
  if (!uuid.test(treeId) || !uuid.test(personId) || !["ancestors", "descendants"].includes(mode) ||
    !Number.isInteger(generations) || generations < 1 || generations > MAX_GENERATIONS) return null;

  const upwards = mode === "ancestors";
  // UNION deduplicates a person at each depth; the cap also bounds malformed cycles.
  // Min depth picks the nearest generation when several family paths reach one person.
  const result = await db.execute<{ id: string; depth: number; parent_id: string | null; child_id: string | null; relation_type: "biological" | "adoptive" | "other" | null }>(sql`
    with recursive walk(id, depth) as (
      select p.id, 0 from person p
      join family_tree t on t.id = p.tree_id
      where p.tree_id = ${treeId}::uuid and p.id = ${personId}::uuid
        and (t.owner_id = ${userId} or exists (
          select 1 from tree_collaborator c where c.tree_id = t.id and c.user_id = ${userId}
        ))
      union
      select ${upwards ? sql`pc.parent_id` : sql`pc.child_id`}, w.depth + 1
      from walk w join parent_child pc on pc.tree_id = ${treeId}::uuid
        and ${upwards ? sql`pc.child_id` : sql`pc.parent_id`} = w.id
      where w.depth < ${generations}
    ), reached as (
      select id, min(depth) as depth from walk group by id
    )
    select r.id::text, r.depth, pc.parent_id::text, pc.child_id::text, pc.relation_type
    from reached r
    left join parent_child pc on pc.tree_id = ${treeId}::uuid
      and ${upwards ? sql`pc.parent_id` : sql`pc.child_id`} = r.id
      and exists (select 1 from reached near
        where near.id = ${upwards ? sql`pc.child_id` : sql`pc.parent_id`}
          and near.depth = r.depth - 1)
    order by r.depth, r.id
  `);
  if (!result.rows.length) return null;
  const edges = new Map<string, { parentId: string; childId: string; relationType: "biological" | "adoptive" | "other" }>();
  for (const row of result.rows) {
    if (row.parent_id && row.child_id && row.relation_type) {
      edges.set(`${row.parent_id}:${row.child_id}`, { parentId: row.parent_id, childId: row.child_id, relationType: row.relation_type });
    }
  }
  return { personIds: [...new Set(result.rows.map((row) => row.id))], edges: [...edges.values()] };
}
