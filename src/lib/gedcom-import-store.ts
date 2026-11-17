import "server-only";

import { randomUUID } from "node:crypto";
import { parentChild, partnership, person, personEvent } from "@/db/app-schema";
import type { GedcomImport } from "@/lib/gedcom-import";
import { withWritableTree } from "@/lib/tree-write";

export async function importTreeGedcom(userId: string, treeId: string, parsed: GedcomImport) {
  if (parsed.errors.length || !parsed.people.length) return { ok: false as const, message: parsed.errors[0] ?? "No hay personas para importar." };
  return withWritableTree(userId, treeId, async (tx) => {
    const ids = new Map(parsed.people.map((member) => [member.id, randomUUID()]));
    for (let i = 0; i < parsed.people.length; i += 300) await tx.insert(person).values(parsed.people.slice(i, i + 300).map((member) => ({
      id: ids.get(member.id)!, treeId, displayName: member.displayName, givenName: member.givenName,
      familyName: member.familyName, biography: member.biography, lifeStatus: member.lifeStatus,
    })));
    for (let i = 0; i < parsed.parents.length; i += 300) await tx.insert(parentChild).values(parsed.parents.slice(i, i + 300).map((link) => ({
      treeId, parentId: ids.get(link.parentId)!, childId: ids.get(link.childId)!, relationType: link.relationType,
    })));
    for (let i = 0; i < parsed.partners.length; i += 300) await tx.insert(partnership).values(parsed.partners.slice(i, i + 300).map((couple) => {
      const [personAId, personBId] = [ids.get(couple.personAId)!, ids.get(couple.personBId)!].sort();
      return { treeId, personAId, personBId, kind: couple.kind,
        startYear: couple.start.year, startMonth: couple.start.month, startDay: couple.start.day, startQualifier: couple.start.qualifier,
        endYear: couple.end.year, endMonth: couple.end.month, endDay: couple.end.day, endQualifier: couple.end.qualifier, notes: couple.notes };
    }));
    const events = parsed.people.flatMap((member) => member.events.map((event) => ({
      treeId, personId: ids.get(member.id)!, ...event,
    })));
    for (let i = 0; i < events.length; i += 300) await tx.insert(personEvent).values(events.slice(i, i + 300));
    return { ok: true as const, counts: parsed.counts };
  });
}
