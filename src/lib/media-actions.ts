"use server";

import { revalidatePath } from "next/cache";
import { validatedAction } from "@/lib/validated-action";
import { documentMetadataSchema, mediaInputSchema, mediaPersonSchema } from "@/lib/media-validation";
import { deleteDocument, deletePhoto, removeDocumentAssociation, removePhotoAssociation, setProfilePhoto, updateDocument } from "@/lib/person-media";

function refresh() { revalidatePath("/dashboard/trees/[treeId]/people/[personId]", "page"); }
const errorMessage = () => "No se pudo modificar la fotografía.";

export async function setProfilePhotoAction(input: unknown) {
  return validatedAction(input, mediaPersonSchema, "setProfilePhoto",
    (userId, data) => setProfilePhoto(userId, data.treeId, data.mediaId, data.personId), refresh, errorMessage);
}

export async function removePhotoAssociationAction(input: unknown) {
  return validatedAction(input, mediaPersonSchema, "removePhotoAssociation",
    (userId, data) => removePhotoAssociation(userId, data.treeId, data.mediaId, data.personId), refresh, errorMessage);
}

export async function deletePhotoAction(input: unknown) {
  return validatedAction(input, mediaInputSchema, "deletePhoto",
    (userId, data) => deletePhoto(userId, data.treeId, data.mediaId), refresh, errorMessage);
}

export async function updateDocumentAction(input: unknown) {
  return validatedAction<typeof documentMetadataSchema, object>(input, documentMetadataSchema, "updateDocument",
    (userId, data) => updateDocument(userId, data.treeId, data.mediaId, data), refresh);
}
export async function removeDocumentAssociationAction(input: unknown) {
  return validatedAction(input, mediaPersonSchema, "removeDocumentAssociation",
    (userId, data) => removeDocumentAssociation(userId, data.treeId, data.mediaId, data.personId), refresh);
}
export async function deleteDocumentAction(input: unknown) {
  return validatedAction(input, mediaInputSchema, "deleteDocument",
    (userId, data) => deleteDocument(userId, data.treeId, data.mediaId), refresh);
}
