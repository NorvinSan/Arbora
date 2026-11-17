import { and, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { familyTree, parentChild, partnership, person, treeCollaborator } from "@/db/app-schema";

export async function getAccessibleTreeGraph(userId: string, treeId: string) {
  // Authorization is checked before querying links, and every query is scoped
  // to this tree. An unshared tree is indistinguishable from a missing one.
  const [accessible] = await db.select({ id: familyTree.id }).from(familyTree)
    .leftJoin(treeCollaborator, and(eq(treeCollaborator.treeId, familyTree.id), eq(treeCollaborator.userId, userId)))
    .where(and(eq(familyTree.id, treeId), or(eq(familyTree.ownerId, userId), eq(treeCollaborator.userId, userId))))
    .limit(1);
  if (!accessible) return null;

  const [people, parents, partners] = await Promise.all([
    db.select({
      id: person.id, displayName: person.displayName,
      lifeStatus: person.lifeStatus, whereaboutsStatus: person.whereaboutsStatus,
      profileMediaId: sql<string | null>`(
        select pm.media_id from person_media pm
        inner join media m on m.id = pm.media_id and m.tree_id = pm.tree_id
        where pm.tree_id = ${treeId} and pm.person_id = person.id and m.kind = 'photo'
        order by pm.is_profile desc, m.created_at, m.id
        limit 1
      )`,
    }).from(person).where(eq(person.treeId, treeId)).orderBy(person.displayName),
    db.select({ parentId: parentChild.parentId, childId: parentChild.childId, relationType: parentChild.relationType })
      .from(parentChild).where(eq(parentChild.treeId, treeId)),
    db.select({ personAId: partnership.personAId, personBId: partnership.personBId })
      .from(partnership).where(eq(partnership.treeId, treeId)),
  ]);
  return { people, parents, partners };
}
