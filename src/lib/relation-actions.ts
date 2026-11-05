"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/session";
import { createParentChild, deleteParentChild } from "@/lib/parent-child";
import { createPartnership, deletePartnership } from "@/lib/partnerships";
import { createParentChildSchema, createPartnershipSchema, deleteParentChildSchema, deletePartnershipSchema } from "@/lib/tree-form-schemas";

type Result = { ok: true } | { ok: false; message: string };

function refreshFamily(treeId: string, parentId: string, childId: string) {
  revalidatePath(`/dashboard/trees/${treeId}`);
  revalidatePath(`/dashboard/trees/${treeId}/people/${parentId}`);
  revalidatePath(`/dashboard/trees/${treeId}/people/${childId}`);
}

export async function createParentChildAction(input: unknown): Promise<Result> {
  const parsed = createParentChildSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const session = await getCurrentSession();
  if (!session) return { ok: false, message: "Tu sesión ha terminado. Vuelve a iniciar sesión." };
  try {
    const result = await createParentChild(session.user.id, parsed.data);
    if (result.ok) refreshFamily(parsed.data.treeId, parsed.data.parentId, parsed.data.childId);
    return result;
  } catch {
    return { ok: false, message: "No se pudo registrar la relación. Inténtalo de nuevo." };
  }
}

export async function deleteParentChildAction(input: unknown): Promise<Result> {
  const parsed = deleteParentChildSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const session = await getCurrentSession();
  if (!session) return { ok: false, message: "Tu sesión ha terminado. Vuelve a iniciar sesión." };
  try {
    const result = await deleteParentChild(session.user.id, parsed.data);
    if (result.ok) refreshFamily(parsed.data.treeId, parsed.data.parentId, parsed.data.childId);
    return result;
  } catch {
    return { ok: false, message: "No se pudo eliminar la relación. Inténtalo de nuevo." };
  }
}

export async function createPartnershipAction(input: unknown): Promise<Result> {
  const parsed = createPartnershipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const session = await getCurrentSession();
  if (!session) return { ok: false, message: "Tu sesión ha terminado. Vuelve a iniciar sesión." };
  try {
    const result = await createPartnership(session.user.id, parsed.data);
    if (result.ok) refreshFamily(parsed.data.treeId, parsed.data.personAId, parsed.data.personBId);
    return result;
  } catch {
    return { ok: false, message: "No se pudo registrar la pareja. Inténtalo de nuevo." };
  }
}

export async function deletePartnershipAction(input: unknown): Promise<Result> {
  const parsed = deletePartnershipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const session = await getCurrentSession();
  if (!session) return { ok: false, message: "Tu sesión ha terminado. Vuelve a iniciar sesión." };
  try {
    const result = await deletePartnership(session.user.id, parsed.data);
    if (result.ok) refreshFamily(parsed.data.treeId, result.personAId, result.personBId);
    return result.ok ? { ok: true } : result;
  } catch {
    return { ok: false, message: "No se pudo eliminar la pareja. Inténtalo de nuevo." };
  }
}
