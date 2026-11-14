import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { media, person, personMedia } from "@/db/app-schema";
import { mediaStorage } from "@/lib/media-storage";
import { documentMetadataSchema, validateDocument, validatePhoto } from "@/lib/media-validation";
import type { z } from "zod";
import { withWritableTree } from "@/lib/tree-write";

async function getPersonMedia(treeId: string, personId: string, kind: "photo" | "document") {
  const photos = await db.select({
    id: media.id, fileName: media.fileName, description: media.description,
    createdAt: media.createdAt, isProfile: personMedia.isProfile,
    title: media.title, documentType: media.documentType, historicalDate: media.historicalDate,
  }).from(personMedia).innerJoin(media, and(eq(media.treeId, personMedia.treeId), eq(media.id, personMedia.mediaId)))
    .where(and(eq(personMedia.treeId, treeId), eq(personMedia.personId, personId), eq(media.kind, kind)))
    .orderBy(media.createdAt);
  if (!photos.length) return [];
  const links = await db.select({ mediaId: personMedia.mediaId, id: person.id, displayName: person.displayName })
    .from(personMedia).innerJoin(person, and(eq(person.treeId, personMedia.treeId), eq(person.id, personMedia.personId)))
    .where(and(eq(personMedia.treeId, treeId), inArray(personMedia.mediaId, photos.map((photo) => photo.id))));
  return photos.map((photo) => ({ ...photo, people: links.filter((link) => link.mediaId === photo.id).map(({ id, displayName }) => ({ id, displayName })) }));
}
export const getPersonPhotos = (treeId: string, personId: string) => getPersonMedia(treeId, personId, "photo");
export const getPersonDocuments = (treeId: string, personId: string) => getPersonMedia(treeId, personId, "document");

export async function getAuthorizedMedia(userId: string, treeId: string, mediaId: string) {
  const [photo] = await db.execute<{ storage_key: string; mime_type: string; file_name: string }>(sql`
    select m.storage_key, m.mime_type, m.file_name from media m
    join family_tree t on t.id = m.tree_id
    where m.id = ${mediaId} and m.tree_id = ${treeId}
      and (t.owner_id = ${userId} or exists (
        select 1 from tree_collaborator c where c.tree_id = t.id and c.user_id = ${userId}
      )) limit 1
  `).then((result) => result.rows);
  return photo ?? null;
}
export const getAuthorizedPhoto = getAuthorizedMedia;

type DocumentMetadata = Omit<z.output<typeof documentMetadataSchema>, "treeId" | "mediaId">;

async function uploadMedia(userId: string, treeId: string, file: File, personIds: string[],
  kind: "photo" | "document", description: string, metadata?: Omit<DocumentMetadata, "description" | "personIds">) {
  if (description.length > 1000 || !personIds.length || personIds.length > 50 || new Set(personIds).size !== personIds.length) {
    return { ok: false, message: "Selecciona entre 1 y 50 familiares y una descripción de hasta 1000 caracteres." } as const;
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const error = kind === "photo" ? validatePhoto(bytes, file.type, file.size) : validateDocument(bytes, file.type, file.size);
  if (error) return { ok: false, message: error } as const;
  const hash = createHash("sha256").update(bytes).digest("hex");
  let storageKey: string | undefined;
  try {
    return await withWritableTree<{ ok: true; id: string }>(userId, treeId, async (tx) => {
      const matches = await tx.select({ id: person.id }).from(person)
        .where(and(eq(person.treeId, treeId), inArray(person.id, personIds)));
      if (matches.length !== personIds.length) return { ok: false, message: "Algún familiar no pertenece a este árbol." } as const;
      // Reuse only identical records: different captions or document metadata remain independent.
      const [existing] = await tx.select({ id: media.id }).from(media).where(and(
        eq(media.treeId, treeId), eq(media.kind, kind), eq(media.contentHash, hash), eq(media.mimeType, file.type),
        eq(media.fileName, file.name.slice(0, 255)),
        sql`${media.description} is not distinct from ${description.trim() || null}`,
        sql`${media.title} is not distinct from ${metadata?.title ?? null}`,
        sql`${media.documentType} is not distinct from ${metadata?.documentType ?? null}`,
        sql`${media.historicalDate} is not distinct from ${metadata?.historicalDate || null}`,
      )).limit(1);
      if (existing) {
        await tx.insert(personMedia).values(personIds.map((personId) => ({ treeId, personId, mediaId: existing.id }))).onConflictDoNothing();
        return { ok: true, id: existing.id } as const;
      }
      storageKey = await mediaStorage.put(treeId, bytes);
      const [item] = await tx.insert(media).values({ treeId, uploadedBy: userId, fileName: file.name.slice(0, 255),
        mimeType: file.type, fileSize: file.size, storageKey, contentHash: hash, kind,
        description: description.trim() || null, title: metadata?.title, documentType: metadata?.documentType,
        historicalDate: metadata?.historicalDate || null }).returning({ id: media.id });
      await tx.insert(personMedia).values(personIds.map((personId) => ({ treeId, personId, mediaId: item.id })));
      return { ok: true, id: item.id } as const;
    });
  } catch (error) {
    if (storageKey) await mediaStorage.remove(storageKey).catch((cleanupError) => console.error("Media cleanup failed", cleanupError));
    throw error;
  }
}

export async function uploadPhoto(userId: string, treeId: string, file: File, description: string, personIds: string[]) {
  return uploadMedia(userId, treeId, file, personIds, "photo", description);
}

export async function uploadDocument(userId: string, treeId: string, file: File, input: DocumentMetadata) {
  const parsed = documentMetadataSchema.safeParse({ ...input, treeId, mediaId: randomUUID() });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message } as const;
  return uploadMedia(userId, treeId, file, parsed.data.personIds, "document", parsed.data.description, parsed.data);
}

export async function updateDocument(userId: string, treeId: string, mediaId: string, input: DocumentMetadata) {
  const parsed = documentMetadataSchema.safeParse({ ...input, treeId, mediaId });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message } as const;
  return withWritableTree<{ ok: true }>(userId, treeId, async (tx) => {
    const matches = await tx.select({ id: person.id }).from(person)
      .where(and(eq(person.treeId, treeId), inArray(person.id, parsed.data.personIds)));
    if (matches.length !== parsed.data.personIds.length) return { ok: false, message: "Algún familiar no pertenece a este árbol." } as const;
    const [updated] = await tx.update(media).set({ title: parsed.data.title, description: parsed.data.description || null,
      documentType: parsed.data.documentType, historicalDate: parsed.data.historicalDate || null })
      .where(and(eq(media.id, mediaId), eq(media.treeId, treeId), eq(media.kind, "document"))).returning({ id: media.id });
    if (!updated) return { ok: false, message: "No existe ese documento." } as const;
    await tx.delete(personMedia).where(and(eq(personMedia.treeId, treeId), eq(personMedia.mediaId, mediaId),
      sql`${personMedia.personId} not in (${sql.join(parsed.data.personIds.map((id) => sql`${id}`), sql`, `)})`));
    await tx.insert(personMedia).values(parsed.data.personIds.map((personId) => ({ treeId, personId, mediaId }))).onConflictDoNothing();
    return { ok: true } as const;
  });
}

export async function setProfilePhoto(userId: string, treeId: string, mediaId: string, personId: string) {
  return withWritableTree(userId, treeId, async (tx) => {
    const [link] = await tx.select({ id: personMedia.mediaId }).from(personMedia)
      .innerJoin(media, and(eq(media.treeId, personMedia.treeId), eq(media.id, personMedia.mediaId)))
      .where(and(eq(personMedia.treeId, treeId), eq(personMedia.personId, personId), eq(personMedia.mediaId, mediaId), eq(media.kind, "photo")));
    if (!link) return { ok: false, message: "La fotografía no está asociada a esta persona." } as const;
    await tx.update(personMedia).set({ isProfile: false }).where(and(eq(personMedia.treeId, treeId), eq(personMedia.personId, personId)));
    await tx.update(personMedia).set({ isProfile: true }).where(and(eq(personMedia.treeId, treeId), eq(personMedia.personId, personId), eq(personMedia.mediaId, mediaId)));
    return { ok: true } as const;
  });
}

export async function removePhotoAssociation(userId: string, treeId: string, mediaId: string, personId: string) {
  return removeMediaAssociation(userId, treeId, mediaId, personId, "photo");
}

export async function removeDocumentAssociation(userId: string, treeId: string, mediaId: string, personId: string) {
  return removeMediaAssociation(userId, treeId, mediaId, personId, "document");
}

async function removeMediaAssociation(userId: string, treeId: string, mediaId: string, personId: string, kind: "photo" | "document") {
  const result = await withWritableTree<{ ok: true; storageKey?: string }>(userId, treeId, async (tx) => {
    const [item] = await tx.select({ storageKey: media.storageKey }).from(media)
      .where(and(eq(media.treeId, treeId), eq(media.id, mediaId), eq(media.kind, kind)));
    if (!item) return { ok: false, message: "No existe ese archivo." } as const;
    const [link] = await tx.delete(personMedia).where(and(eq(personMedia.treeId, treeId), eq(personMedia.mediaId, mediaId), eq(personMedia.personId, personId))).returning({ id: personMedia.mediaId });
    if (!link) return { ok: false, message: "No existe esa asociación." } as const;
    const [remaining] = await tx.select({ id: personMedia.mediaId }).from(personMedia)
      .where(and(eq(personMedia.treeId, treeId), eq(personMedia.mediaId, mediaId))).limit(1);
    if (!remaining) await tx.delete(media).where(and(eq(media.treeId, treeId), eq(media.id, mediaId)));
    return { ok: true, storageKey: remaining ? undefined : item.storageKey } as const;
  });
  if (result.ok && result.storageKey) await mediaStorage.remove(result.storageKey);
  return result;
}

export async function deletePhoto(userId: string, treeId: string, mediaId: string) {
  return deleteMedia(userId, treeId, mediaId, "photo");
}
export async function deleteDocument(userId: string, treeId: string, mediaId: string) {
  return deleteMedia(userId, treeId, mediaId, "document");
}
async function deleteMedia(userId: string, treeId: string, mediaId: string, kind: "photo" | "document") {
  const result = await withWritableTree<{ ok: true; storageKey: string }>(userId, treeId, async (tx) => {
    const [deleted] = await tx.delete(media).where(and(eq(media.treeId, treeId), eq(media.id, mediaId), eq(media.kind, kind))).returning({ storageKey: media.storageKey });
    if (!deleted) return { ok: false, message: "No existe ese archivo." } as const;
    return { ok: true, storageKey: deleted.storageKey } as const;
  });
  if (result.ok) await mediaStorage.remove(result.storageKey);
  return result;
}
