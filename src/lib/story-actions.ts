"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/session";
import { storySchema, updateStorySchema, deleteStorySchema, storyParticipantSchema } from "@/lib/story-form-schemas";
import { createFamilyStory, updateFamilyStory, deleteFamilyStory, addStoryParticipant, removeStoryParticipant } from "@/lib/family-stories";

type Result = { ok: true } | { ok: false; message: string };

async function run(input: unknown, mode: "create" | "update" | "delete" | "add" | "remove"): Promise<Result> {
  const parsed = mode === "create" ? storySchema.safeParse(input)
    : mode === "update" ? updateStorySchema.safeParse(input)
      : mode === "delete" ? deleteStorySchema.safeParse(input) : storyParticipantSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const session = await getCurrentSession();
  if (!session) return { ok: false, message: "Tu sesión ha terminado. Vuelve a iniciar sesión." };
  try {
    const result = mode === "create" ? await createFamilyStory(session.user.id, storySchema.parse(parsed.data))
      : mode === "update" ? await updateFamilyStory(session.user.id, updateStorySchema.parse(parsed.data))
        : mode === "delete" ? await deleteFamilyStory(session.user.id, deleteStorySchema.parse(parsed.data))
          : mode === "add" ? await addStoryParticipant(session.user.id, storyParticipantSchema.parse(parsed.data))
            : await removeStoryParticipant(session.user.id, storyParticipantSchema.parse(parsed.data));
    if (result.ok) {
      revalidatePath(`/dashboard/trees/${parsed.data.treeId}`);
      revalidatePath(`/dashboard/trees/${parsed.data.treeId}/stories`);
      if ("storyId" in parsed.data) revalidatePath(`/dashboard/trees/${parsed.data.treeId}/stories/${parsed.data.storyId}`);
      // Profiles are dynamic; invalidate all participants, including ones just unlinked.
      revalidatePath(`/dashboard/trees/${parsed.data.treeId}/people/[personId]`, "page");
    }
    return result;
  } catch {
    return { ok: false, message: "No se pudo guardar el relato. Inténtalo de nuevo." };
  }
}

export async function createStoryAction(input: unknown): Promise<Result> { return run(input, "create"); }
export async function updateStoryAction(input: unknown): Promise<Result> { return run(input, "update"); }
export async function deleteStoryAction(input: unknown): Promise<Result> { return run(input, "delete"); }
export async function addStoryParticipantAction(input: unknown): Promise<Result> { return run(input, "add"); }
export async function removeStoryParticipantAction(input: unknown): Promise<Result> { return run(input, "remove"); }
