import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { media, person, personMedia } from "@/db/app-schema";
import { mediaStorage } from "@/lib/media-storage";
import { validatePhoto } from "@/lib/media-validation";
import { withWritableTree } from "@/lib/tree-write";

export async function getPersonPhotos(treeId: string, personId: string) {
  const photos = await db.select({
    id: media.id, fileName: media.fileName, description: media.description,
    createdAt: media.createdAt, isProfile: personMedia.isProfile,
  }).from(personMedia).innerJoin(media, and(eq(media.treeId, personMedia.treeId), eq(media.id, personMedia.mediaId)))
    .where(and(eq(personMedia.treeId, treeId), eq(personMedia.personId, personId)))
    .orderBy(media.createdAt);
  if (!photos.length) return [];
  const links = await db.select({ mediaId: personMedia.mediaId, id: person.id, displayName: person.displayName })
    .from(personMedia).innerJoin(person, and(eq(person.treeId, personMedia.treeId), eq(person.id, personMedia.personId)))
    .where(and(eq(personMedia.treeId, treeId), inArray(personMedia.mediaId, photos.map((photo) => photo.id))));
  return photos.map((photo) => ({ ...photo, people: links.filter((link) => link.mediaId === photo.id).map(({ id, displayName }) => ({ id, displayName })) }));
}

export async function getAuthorizedPhoto(userId: string, treeId: string, mediaId: string) {
  const [photo] = await db.execute<{ storage_key: string; mime_type: string }>(sql`
    select m.storage_key, m.mime_type from media m
    join family_tree t on t.id = m.tree_id
    where m.id = ${mediaId} and m.tree_id = ${treeId}
      and (t.owner_id = ${userId} or exists (
        select 1 from tree_collaborator c where c.tree_id = t.id and c.user_id = ${userId}
      )) limit 1
  `).then((result) => result.rows);
  return photo ?? null;
}

export async function uploadPhoto(userId: string, treeId: string, file: File, description: string, personIds: string[]) {
  if (description.length > 1000 || !personIds.length || personIds.length > 50 || new Set(personIds).size !== personIds.length) {
    return { ok: false, message: "Selecciona entre 1 y 50 familiares y una descripción de hasta 1000 caracteres." } as const;
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const error = validatePhoto(bytes, file.type, file.size);
  if (error) return { ok: false, message: error } as const;
  let storageKey: string | undefined;
  try {
    const result = await withWritableTree<{ ok: true; id: string }>(userId, treeId, async (tx) => {
      const matches = await tx.select({ id: person.id }).from(person)
        .where(and(eq(person.treeId, treeId), inArray(person.id, personIds)));
      if (matches.length !== personIds.length) return { ok: false, message: "Algún familiar no pertenece a este árbol." } as const;
      storageKey = await mediaStorage.put(treeId, bytes);
      const [photo] = await tx.insert(media).values({ treeId, uploadedBy: userId, fileName: file.name.slice(0, 255),
        mimeType: file.type, fileSize: file.size, storageKey, description: description.trim() || null }).returning({ id: media.id });
      await tx.insert(personMedia).values(personIds.map((personId) => ({ treeId, personId, mediaId: photo.id })));
      return { ok: true, id: photo.id } as const;
    });
    return result;
  } catch (error) {
    if (storageKey) await mediaStorage.remove(storageKey).catch((cleanupError) => console.error("Photo cleanup failed", cleanupError));
    throw error;
  }
}

export async function setProfilePhoto(userId: string, treeId: string, mediaId: string, personId: string) {
  return withWritableTree(userId, treeId, async (tx) => {
    const [link] = await tx.select({ id: personMedia.mediaId }).from(personMedia)
      .where(and(eq(personMedia.treeId, treeId), eq(personMedia.personId, personId), eq(personMedia.mediaId, mediaId)));
    if (!link) return { ok: false, message: "La fotografía no está asociada a esta persona." } as const;
    await tx.update(personMedia).set({ isProfile: false }).where(and(eq(personMedia.treeId, treeId), eq(personMedia.personId, personId)));
    await tx.update(personMedia).set({ isProfile: true }).where(and(eq(personMedia.treeId, treeId), eq(personMedia.personId, personId), eq(personMedia.mediaId, mediaId)));
    return { ok: true } as const;
  });
}

export async function removePhotoAssociation(userId: string, treeId: string, mediaId: string, personId: string) {
  return withWritableTree(userId, treeId, async (tx) => {
    const [link] = await tx.delete(personMedia).where(and(eq(personMedia.treeId, treeId), eq(personMedia.mediaId, mediaId), eq(personMedia.personId, personId))).returning({ id: personMedia.mediaId });
    if (!link) return { ok: false, message: "No existe esa asociación." } as const;
    return { ok: true } as const;
  });
}

export async function deletePhoto(userId: string, treeId: string, mediaId: string) {
  const result = await withWritableTree<{ ok: true; storageKey: string }>(userId, treeId, async (tx) => {
    const [deleted] = await tx.delete(media).where(and(eq(media.treeId, treeId), eq(media.id, mediaId))).returning({ storageKey: media.storageKey });
    if (!deleted) return { ok: false, message: "No existe esa fotografía." } as const;
    return { ok: true, storageKey: deleted.storageKey } as const;
  });
  // Database cascades remove links atomically; a failed unlink only leaves an unreferenced file.
  if (result.ok) await mediaStorage.remove(result.storageKey).catch((error) => console.error("Photo cleanup failed", error));
  return result;
}
