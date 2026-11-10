"use server";

import { revalidatePath } from "next/cache";
import { storySchema, updateStorySchema, deleteStorySchema, storyParticipantSchema } from "@/lib/story-form-schemas";
import { createFamilyStory, updateFamilyStory, deleteFamilyStory, addStoryParticipant, removeStoryParticipant } from "@/lib/family-stories";
import { validatedAction } from "@/lib/validated-action";
import type { ActionResult } from "@/lib/action-result";

function refreshStory(treeId: string, storyId?: string) {
  revalidatePath(`/dashboard/trees/${treeId}`);
  revalidatePath(`/dashboard/trees/${treeId}/stories`);
  if (storyId) revalidatePath(`/dashboard/trees/${treeId}/stories/${storyId}`);
  revalidatePath("/dashboard/trees/[treeId]/people/[personId]", "page");
}

const saveError = () => "No se pudo guardar el relato. Inténtalo de nuevo.";

export async function createStoryAction(input: unknown): Promise<ActionResult> {
  return validatedAction(input, storySchema, "createStory", createFamilyStory,
    ({ treeId }) => refreshStory(treeId), saveError);
}

export async function updateStoryAction(input: unknown): Promise<ActionResult> {
  return validatedAction(input, updateStorySchema, "updateStory", updateFamilyStory,
    ({ treeId, storyId }) => refreshStory(treeId, storyId), saveError);
}

export async function deleteStoryAction(input: unknown): Promise<ActionResult> {
  return validatedAction(input, deleteStorySchema, "deleteStory", deleteFamilyStory,
    ({ treeId, storyId }) => refreshStory(treeId, storyId), saveError);
}

export async function addStoryParticipantAction(input: unknown): Promise<ActionResult> {
  return validatedAction(input, storyParticipantSchema, "addStoryParticipant", addStoryParticipant,
    ({ treeId, storyId }) => refreshStory(treeId, storyId), saveError);
}

export async function removeStoryParticipantAction(input: unknown): Promise<ActionResult> {
  return validatedAction(input, storyParticipantSchema, "removeStoryParticipant", removeStoryParticipant,
    ({ treeId, storyId }) => refreshStory(treeId, storyId), saveError);
}
