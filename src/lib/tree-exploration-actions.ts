"use server";

import { requireSession } from "@/lib/session";
import { getTreeBranch, searchTreePeople } from "@/lib/tree-exploration";
import type { BranchMode } from "@/lib/tree-exploration-options";

export async function searchTreePeopleAction(treeId: string, query: string) {
  const { user } = await requireSession();
  return searchTreePeople(user.id, treeId, query);
}

export async function getTreeBranchAction(treeId: string, personId: string, mode: BranchMode, generations: number) {
  const { user } = await requireSession();
  return getTreeBranch(user.id, treeId, personId, mode, generations);
}
