import "server-only";

import { and, desc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import { familyTree, parentChild, partnership, person, treeCollaborator } from "@/db/app-schema";

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

export async function getAccessiblePerson(userId: string, treeId: string, personId: string) {
  const [member] = await db.select({
    id: person.id,
    displayName: person.displayName,
    givenName: person.givenName,
    familyName: person.familyName,
    biography: person.biography,
    lifeStatus: person.lifeStatus,
    whereaboutsStatus: person.whereaboutsStatus,
  }).from(person)
    .innerJoin(familyTree, eq(person.treeId, familyTree.id))
    .leftJoin(treeCollaborator, and(eq(treeCollaborator.treeId, familyTree.id), eq(treeCollaborator.userId, userId)))
    .where(and(
      eq(person.treeId, treeId),
      eq(person.id, personId),
      or(eq(familyTree.ownerId, userId), eq(treeCollaborator.userId, userId)),
    )).limit(1);
  return member ?? null;
}

// Call after checking access to the tree and the profile person.
export async function getFamilyRelations(treeId: string, personId: string) {
  const [parents, children, partners] = await Promise.all([
    db.select({ id: person.id, displayName: person.displayName, relationType: parentChild.relationType })
      .from(parentChild)
      .innerJoin(person, and(eq(person.treeId, parentChild.treeId), eq(person.id, parentChild.parentId)))
      .where(and(eq(parentChild.treeId, treeId), eq(parentChild.childId, personId)))
      .orderBy(person.displayName),
    db.select({ id: person.id, displayName: person.displayName, relationType: parentChild.relationType })
      .from(parentChild)
      .innerJoin(person, and(eq(person.treeId, parentChild.treeId), eq(person.id, parentChild.childId)))
      .where(and(eq(parentChild.treeId, treeId), eq(parentChild.parentId, personId)))
      .orderBy(person.displayName),
    db.select({
      id: person.id, displayName: person.displayName, partnershipId: partnership.id,
      kind: partnership.kind, startYear: partnership.startYear, startMonth: partnership.startMonth,
      startDay: partnership.startDay, startQualifier: partnership.startQualifier,
      endYear: partnership.endYear, endMonth: partnership.endMonth,
      endDay: partnership.endDay, endQualifier: partnership.endQualifier,
    }).from(partnership)
      .innerJoin(person, and(eq(person.treeId, partnership.treeId), or(
        and(eq(partnership.personAId, personId), eq(person.id, partnership.personBId)),
        and(eq(partnership.personBId, personId), eq(person.id, partnership.personAId)),
      )))
      .where(and(eq(partnership.treeId, treeId), or(eq(partnership.personAId, personId), eq(partnership.personBId, personId))))
      .orderBy(desc(partnership.createdAt)),
  ]);
  return { parents, children, partners };
}
