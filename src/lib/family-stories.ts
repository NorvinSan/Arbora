import "server-only";

import { and, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { familyStory, familyTree, person, storyPerson, treeCollaborator } from "@/db/app-schema";
import { withWritableTree } from "@/lib/tree-write";
import type { z } from "zod";
import type { storySchema, updateStorySchema, deleteStorySchema, storyParticipantSchema } from "@/lib/story-form-schemas";
import type { ActionResult } from "@/lib/action-result";

type Create = z.output<typeof storySchema>;
type Update = z.output<typeof updateStorySchema>;
type Delete = z.output<typeof deleteStorySchema>;
type Participant = z.output<typeof storyParticipantSchema>;

async function participantsBelongToTree(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], treeId: string, ids: string[]) {
  if (!ids.length) return true;
  const found = await tx.select({ id: person.id }).from(person)
    .where(and(eq(person.treeId, treeId), inArray(person.id, ids)));
  return found.length === ids.length;
}

export async function createFamilyStory(userId: string, input: Create): Promise<ActionResult> {
  return withWritableTree(userId, input.treeId, async (tx) => {
    if (!await participantsBelongToTree(tx, input.treeId, input.personIds))
      return { ok: false, message: "Todos los participantes deben pertenecer a este árbol." };
    const [story] = await tx.insert(familyStory).values({
      treeId: input.treeId, authorId: userId, title: input.title, body: input.body,
    }).returning({ id: familyStory.id });
    if (input.personIds.length) await tx.insert(storyPerson).values(input.personIds.map((personId) => ({ treeId: input.treeId, storyId: story.id, personId })));
    return { ok: true };
  });
}

export async function updateFamilyStory(userId: string, input: Update): Promise<ActionResult> {
  return withWritableTree(userId, input.treeId, async (tx) => {
    if (!await participantsBelongToTree(tx, input.treeId, input.personIds))
      return { ok: false, message: "Todos los participantes deben pertenecer a este árbol." };
    const updated = await tx.update(familyStory).set({ title: input.title, body: input.body, updatedAt: new Date() })
      .where(and(eq(familyStory.id, input.storyId), eq(familyStory.treeId, input.treeId)))
      .returning({ id: familyStory.id });
    if (!updated.length) return { ok: false, message: "El relato ya no existe en este árbol." };
    await tx.delete(storyPerson).where(and(eq(storyPerson.treeId, input.treeId), eq(storyPerson.storyId, input.storyId)));
    if (input.personIds.length) await tx.insert(storyPerson).values(input.personIds.map((personId) => ({ treeId: input.treeId, storyId: input.storyId, personId })));
    return { ok: true };
  });
}

export async function deleteFamilyStory(userId: string, input: Delete): Promise<ActionResult> {
  return withWritableTree(userId, input.treeId, async (tx) => {
    const deleted = await tx.delete(familyStory).where(and(eq(familyStory.treeId, input.treeId), eq(familyStory.id, input.storyId)))
      .returning({ id: familyStory.id });
    return deleted.length ? { ok: true } : { ok: false, message: "El relato ya no existe en este árbol." };
  });
}

export async function addStoryParticipant(userId: string, input: Participant): Promise<ActionResult> {
  return withWritableTree(userId, input.treeId, async (tx) => {
    const [story] = await tx.select({ id: familyStory.id }).from(familyStory)
      .where(and(eq(familyStory.treeId, input.treeId), eq(familyStory.id, input.storyId))).limit(1);
    if (!story) return { ok: false, message: "El relato ya no existe en este árbol." };
    if (!await participantsBelongToTree(tx, input.treeId, [input.personId]))
      return { ok: false, message: "La persona no pertenece a este árbol." };
    await tx.insert(storyPerson).values({ treeId: input.treeId, storyId: input.storyId, personId: input.personId }).onConflictDoNothing();
    return { ok: true };
  });
}

export async function removeStoryParticipant(userId: string, input: Participant): Promise<ActionResult> {
  return withWritableTree(userId, input.treeId, async (tx) => {
    const [story] = await tx.select({ id: familyStory.id }).from(familyStory)
      .where(and(eq(familyStory.treeId, input.treeId), eq(familyStory.id, input.storyId))).limit(1);
    if (!story) return { ok: false, message: "El relato ya no existe en este árbol." };
    await tx.delete(storyPerson).where(and(eq(storyPerson.treeId, input.treeId), eq(storyPerson.storyId, input.storyId), eq(storyPerson.personId, input.personId)));
    return { ok: true };
  });
}

// Reads include their own access check, even when called by an authorized page.
export async function getAccessibleStories(userId: string, treeId: string, filter?: { personId?: string; storyId?: string }) {
  const [accessible] = await db.select({ id: familyTree.id }).from(familyTree)
    .leftJoin(treeCollaborator, and(eq(treeCollaborator.treeId, familyTree.id), eq(treeCollaborator.userId, userId)))
    .where(and(eq(familyTree.id, treeId), or(eq(familyTree.ownerId, userId), eq(treeCollaborator.userId, userId)))).limit(1);
  if (!accessible) return null;
  const stories = await db.select({
    id: familyStory.id, title: familyStory.title, body: familyStory.body,
    authorId: familyStory.authorId, createdAt: familyStory.createdAt, updatedAt: familyStory.updatedAt,
  }).from(familyStory)
    .where(and(eq(familyStory.treeId, treeId),
      filter?.storyId ? eq(familyStory.id, filter.storyId) : undefined,
      filter?.personId ? inArray(familyStory.id, db.select({ id: storyPerson.storyId }).from(storyPerson)
        .where(and(eq(storyPerson.treeId, treeId), eq(storyPerson.personId, filter.personId)))) : undefined))
    .orderBy(desc(familyStory.createdAt), desc(familyStory.id));
  if (!stories.length) return [];
  const links = await db.select({ storyId: storyPerson.storyId, id: person.id, displayName: person.displayName })
    .from(storyPerson).innerJoin(person, and(eq(person.treeId, storyPerson.treeId), eq(person.id, storyPerson.personId)))
    .where(and(eq(storyPerson.treeId, treeId), inArray(storyPerson.storyId, stories.map((story) => story.id))))
    .orderBy(person.displayName);
  return stories.map((story) => ({ ...story, participants: links.filter((link) => link.storyId === story.id).map(({ id, displayName }) => ({ id, displayName })) }));
}
