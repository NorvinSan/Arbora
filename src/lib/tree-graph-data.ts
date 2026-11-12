import { and, eq, or } from "drizzle-orm";
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
    }).from(person).where(eq(person.treeId, treeId)).orderBy(person.displayName),
    db.select({ parentId: parentChild.parentId, childId: parentChild.childId, relationType: parentChild.relationType })
      .from(parentChild).where(eq(parentChild.treeId, treeId)),
    db.select({ personAId: partnership.personAId, personBId: partnership.personBId })
      .from(partnership).where(eq(partnership.treeId, treeId)),
  ]);
  return { people, parents, partners };
}
