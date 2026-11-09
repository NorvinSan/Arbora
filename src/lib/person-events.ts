import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { person, personEvent } from "@/db/app-schema";
import { eventDateParts, type eventSchema, type updateEventSchema, type deleteEventSchema } from "@/lib/event-form-schemas";
import { withWritableTree } from "@/lib/tree-write";
import type { z } from "zod";

type Create = z.output<typeof eventSchema>;
type Update = z.output<typeof updateEventSchema>;
type Delete = z.output<typeof deleteEventSchema>;
type Result = { ok: true } | { ok: false; message: string };

// The caller verifies access to the person before using this read.
export async function getPersonEvents(treeId: string, personId: string) {
  return db.select({
    id: personEvent.id, type: personEvent.type, title: personEvent.title,
    description: personEvent.description, place: personEvent.place,
    year: personEvent.year, month: personEvent.month, day: personEvent.day,
    qualifier: personEvent.qualifier,
  }).from(personEvent).where(and(eq(personEvent.treeId, treeId), eq(personEvent.personId, personId)))
    .orderBy(sql`${personEvent.year} asc nulls last`, asc(personEvent.month), asc(personEvent.day), asc(personEvent.createdAt), asc(personEvent.id));
}

export async function createPersonEvent(userId: string, input: Create): Promise<Result> {
  return withWritableTree(userId, input.treeId, async (tx) => {
    const [member] = await tx.select({ id: person.id }).from(person)
      .where(and(eq(person.treeId, input.treeId), eq(person.id, input.personId))).limit(1);
    if (!member) return { ok: false, message: "La persona no pertenece a este árbol." };
    const inserted = await tx.insert(personEvent).values({
      treeId: input.treeId, personId: input.personId, type: input.type, title: input.title,
      description: input.description || null, place: input.place || null,
      ...eventDateParts(input.date, input.qualifier),
    }).onConflictDoNothing().returning({ id: personEvent.id });
    if (!inserted.length) return { ok: false, message: "Ya existe un nacimiento o fallecimiento para esta persona." };
    return { ok: true };
  });
}

export async function updatePersonEvent(userId: string, input: Update): Promise<Result> {
  return withWritableTree(userId, input.treeId, async (tx) => {
    const updated = await tx.update(personEvent).set({
      type: input.type, title: input.title, description: input.description || null,
      place: input.place || null, ...eventDateParts(input.date, input.qualifier), updatedAt: new Date(),
    }).where(and(eq(personEvent.id, input.eventId), eq(personEvent.treeId, input.treeId), eq(personEvent.personId, input.personId)))
      .returning({ id: personEvent.id });
    if (!updated.length) return { ok: false, message: "El acontecimiento ya no existe en esta ficha." };
    return { ok: true };
  });
}

export async function deletePersonEvent(userId: string, input: Delete): Promise<Result> {
  return withWritableTree(userId, input.treeId, async (tx) => {
    const deleted = await tx.delete(personEvent).where(and(
      eq(personEvent.id, input.eventId), eq(personEvent.treeId, input.treeId), eq(personEvent.personId, input.personId),
    )).returning({ id: personEvent.id });
    if (!deleted.length) return { ok: false, message: "El acontecimiento ya no existe en esta ficha." };
    return { ok: true };
  });
}
