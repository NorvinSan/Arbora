"use server";

import { requireSession } from "@/lib/session";
import { getTreeBranch, searchTreePeople } from "@/lib/tree-exploration";
import { getAccessibleTreeGraph } from "@/lib/tree-graph-data";
import { z } from "zod";
import type { BranchMode } from "@/lib/tree-exploration-options";

export async function searchTreePeopleAction(treeId: string, query: string) {
  const { user } = await requireSession();
  return searchTreePeople(user.id, treeId, query);
}

export async function getTreeBranchAction(treeId: string, personId: string, mode: BranchMode, generations: number) {
  const { user } = await requireSession();
  return getTreeBranch(user.id, treeId, personId, mode, generations);
}

export async function getTreeGraphAction(treeId: string) {
  const { user } = await requireSession();
  if (!z.uuid().safeParse(treeId).success) return null;
  return getAccessibleTreeGraph(user.id, treeId);
}
