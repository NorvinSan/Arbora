import "server-only";

import { and, count, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { familyTree, familyStory, media, parentChild, partnership, person, personEvent, treeCollaborator } from "@/db/app-schema";
import { generateGedcom } from "@/lib/gedcom";

// Keep permission check and every tree-scoped read in the same snapshot. A
// viewer can browse a tree but cannot take away a copy of the whole dataset.
export async function exportTreeGedcom(userId: string, treeId: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET TRANSACTION READ ONLY`);
    const [tree] = await tx.select({ name: familyTree.name }).from(familyTree)
      .leftJoin(treeCollaborator, and(eq(treeCollaborator.treeId, familyTree.id), eq(treeCollaborator.userId, userId), eq(treeCollaborator.role, "editor")))
      .where(and(eq(familyTree.id, treeId), or(eq(familyTree.ownerId, userId), eq(treeCollaborator.userId, userId)))).limit(1);
    if (!tree) return null;
    const people = await tx.select().from(person).where(eq(person.treeId, treeId));
    const parents = await tx.select().from(parentChild).where(eq(parentChild.treeId, treeId));
    const partners = await tx.select().from(partnership).where(eq(partnership.treeId, treeId));
    const events = await tx.select().from(personEvent).where(eq(personEvent.treeId, treeId));
    const [stories] = await tx.select({ total: count() }).from(familyStory).where(eq(familyStory.treeId, treeId));
    const [files] = await tx.select({ total: count() }).from(media).where(eq(media.treeId, treeId));
    return { name: tree.name, content: generateGedcom({ treeId, people, parents, partners, events, storyCount: stories.total, mediaCount: files.total }) };
  }, { isolationLevel: "repeatable read" });
}
