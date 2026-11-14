"use server";

import { revalidatePath } from "next/cache";
import { validatedAction } from "@/lib/validated-action";
import { mediaInputSchema, mediaPersonSchema } from "@/lib/media-validation";
import { deletePhoto, removePhotoAssociation, setProfilePhoto } from "@/lib/person-media";

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
