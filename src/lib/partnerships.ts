import { sql } from "drizzle-orm";
import type { z } from "zod";
import type { createPartnershipSchema, deletePartnershipSchema } from "@/lib/tree-form-schemas";
import { withWritableTree } from "@/lib/tree-write";

type Create = z.output<typeof createPartnershipSchema>;
type Delete = z.output<typeof deletePartnershipSchema>;
type Result = { ok: true } | { ok: false; message: string };

function dateParts(value: string) {
  if (!value) return { year: null, month: null, day: null, qualifier: null };
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day, qualifier: "exact" };
}

export async function createPartnership(userId: string, input: Create): Promise<Result> {
  const { treeId, kind } = input;
  if (input.personAId === input.personBId) return { ok: false, message: "Una persona no puede ser su propia pareja." };
  if (input.startDate && input.endDate && input.endDate < input.startDate) return { ok: false, message: "La fecha de fin no puede ser anterior a la de inicio." };
  const [personAId, personBId] = [input.personAId, input.personBId].sort();
  const start = dateParts(input.startDate);
  const end = dateParts(input.endDate);

  return withWritableTree(userId, treeId, async (tx) => {
    const people = await tx.execute(sql`select id from person where tree_id = ${treeId} and id in (${personAId}, ${personBId})`);
    if (people.rows.length !== 2) return { ok: false, message: "Ambas personas deben pertenecer al mismo árbol." };

    // PostgreSQL's NULLS NOT DISTINCT constraint arbitrates simultaneous requests,
    // including two relationships with unknown start dates.
    const inserted = await tx.execute(sql`
      insert into partnership (tree_id, person_a_id, person_b_id, kind,
        start_year, start_month, start_day, start_qualifier,
        end_year, end_month, end_day, end_qualifier)
      values (${treeId}, ${personAId}, ${personBId}, ${kind}::partnership_kind,
        ${start.year}, ${start.month}, ${start.day}, ${start.qualifier}::date_qualifier,
        ${end.year}, ${end.month}, ${end.day}, ${end.qualifier}::date_qualifier)
      on conflict on constraint partnership_pair_kind_start_unique do nothing
      returning id
    `);
    if (!inserted.rows.length) return { ok: false, message: "Esta relación de pareja ya está registrada." };
    return { ok: true };
  });
}

export async function deletePartnership(userId: string, { treeId, partnershipId }: Delete): Promise<{ ok: true; personAId: string; personBId: string } | { ok: false; message: string }> {
  return withWritableTree<{ ok: true; personAId: string; personBId: string }>(userId, treeId, async (tx) => {
    const deleted = await tx.execute<{ person_a_id: string; person_b_id: string }>(sql`
      delete from partnership where tree_id = ${treeId} and id = ${partnershipId} returning person_a_id, person_b_id
    `);
    if (!deleted.rows.length) return { ok: false, message: "La relación ya no existe." };
    return { ok: true, personAId: deleted.rows[0].person_a_id, personBId: deleted.rows[0].person_b_id };
  });
}
