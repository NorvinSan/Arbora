import "server-only";

import { and, desc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { familyTree, person, treeCollaborator } from "@/db/app-schema";

// Authorization is part of the database query, not just the navigation UI.
export async function getAccessibleTrees(userId: string) {
  return db.select({
    id: familyTree.id,
    name: familyTree.name,
    description: familyTree.description,
    ownerId: familyTree.ownerId,
    collaboratorRole: treeCollaborator.role,
  }).from(familyTree)
    .leftJoin(treeCollaborator, and(eq(treeCollaborator.treeId, familyTree.id), eq(treeCollaborator.userId, userId)))
    .where(or(eq(familyTree.ownerId, userId), eq(treeCollaborator.userId, userId)))
    .orderBy(desc(familyTree.createdAt));
}

export async function getAccessibleTree(userId: string, treeId: string) {
  const [tree] = await db.select({
    id: familyTree.id,
    name: familyTree.name,
    description: familyTree.description,
    ownerId: familyTree.ownerId,
    collaboratorRole: treeCollaborator.role,
  })
    .from(familyTree)
    .leftJoin(treeCollaborator, and(eq(treeCollaborator.treeId, familyTree.id), eq(treeCollaborator.userId, userId)))
    .where(and(
      eq(familyTree.id, treeId),
      or(eq(familyTree.ownerId, userId), eq(treeCollaborator.userId, userId)),
    ))
    .limit(1);

  return tree ?? null;
}

export async function getAccessiblePeople(userId: string, treeId: string) {
  return db.select({
    id: person.id,
    displayName: person.displayName,
    lifeStatus: person.lifeStatus,
    whereaboutsStatus: person.whereaboutsStatus,
  }).from(person)
    .innerJoin(familyTree, eq(person.treeId, familyTree.id))
    .leftJoin(treeCollaborator, and(eq(treeCollaborator.treeId, familyTree.id), eq(treeCollaborator.userId, userId)))
    .where(and(
      eq(person.treeId, treeId),
      or(eq(familyTree.ownerId, userId), eq(treeCollaborator.userId, userId)),
    ))
    .orderBy(person.displayName);
}
