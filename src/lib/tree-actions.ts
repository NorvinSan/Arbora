"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { familyTree } from "@/db/app-schema";
import { getCurrentSession } from "@/lib/session";
import { addPersonSchema, createTreeSchema } from "@/lib/tree-form-schemas";

type Result = { ok: true; id: string } | { ok: false; message: string };

export async function createTreeAction(input: unknown): Promise<Result> {
  const parsed = createTreeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const session = await getCurrentSession();
  if (!session) return { ok: false, message: "Tu sesión ha terminado. Vuelve a iniciar sesión." };

  try {
    const [tree] = await db.insert(familyTree).values({
      ownerId: session.user.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
    }).returning({ id: familyTree.id });
    revalidatePath("/dashboard");
    return { ok: true, id: tree.id };
  } catch {
    return { ok: false, message: "No se pudo crear el árbol. Inténtalo de nuevo." };
  }
}

export async function addPersonAction(input: unknown): Promise<Result> {
  const parsed = addPersonSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const session = await getCurrentSession();
  if (!session) return { ok: false, message: "Tu sesión ha terminado. Vuelve a iniciar sesión." };

  const { treeId, displayName, givenName, familyName, lifeStatus, whereaboutsStatus } = parsed.data;
  try {
    // A single INSERT ... SELECT makes the owner/editor check part of the write.
    // A viewer or a user from another tree inserts zero rows.
    const result = await db.execute<{ id: string }>(sql`
      insert into person (tree_id, display_name, given_name, family_name, life_status, whereabouts_status)
      select t.id, ${displayName}, ${givenName || null}, ${familyName || null},
        ${lifeStatus}::life_status, ${whereaboutsStatus}::whereabouts_status
      from family_tree t
      left join tree_collaborator c on c.tree_id = t.id and c.user_id = ${session.user.id}
      where t.id = ${treeId} and (t.owner_id = ${session.user.id} or c.role = 'editor')
      returning id
    `);

    if (result.rows.length === 0) return { ok: false, message: "No tienes permiso para agregar personas a este árbol." };
    revalidatePath(`/dashboard/trees/${treeId}`);
    return { ok: true, id: result.rows[0].id };
  } catch {
    return { ok: false, message: "No se pudo agregar la persona. Inténtalo de nuevo." };
  }
}
