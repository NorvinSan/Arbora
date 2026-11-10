import assert from "node:assert/strict";
import { test } from "node:test";
import { storySchema, storyParticipantSchema } from "../src/lib/story-form-schemas";

const treeId = "60a4c118-cf3e-48cb-b18f-77f53bb50fc6";
const personId = "b38a6471-c383-4265-abdc-e17e5c3a228a";
const data = { treeId, title: "Una tarde", body: "Un recuerdo familiar\ncon varias líneas.", personIds: [] as string[] };

test("relatos generales y múltiples participantes son válidos; no admite duplicados ni HTML", () => {
  assert.equal(storySchema.safeParse(data).success, true);
  assert.equal(storySchema.safeParse({ ...data, personIds: [personId] }).success, true);
  for (const value of [
    { ...data, personIds: [personId, personId] },
    { ...data, title: "  " },
    { ...data, body: "<script>alert(1)</script>" },
    { ...data, body: "<img src=x onerror=alert(1)>" },
    { ...data, title: "<b>Hola</b>" },
  ]) assert.equal(storySchema.safeParse(value).success, false);
  assert.equal(storyParticipantSchema.safeParse({ treeId, storyId: personId, personId }).success, true);
});
