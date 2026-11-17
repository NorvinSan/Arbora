import assert from "node:assert/strict";
import { test } from "node:test";
import { addRelativeSchema } from "../src/lib/tree-form-schemas";

const treeId = "c85d4aa1-2539-4ae5-8a8e-2cff847151aa";
const anchorId = "92275afd-a16a-4f7e-8ee5-d90208f47df5";
const existingId = "31f83388-ea28-47ac-90aa-de9961c9bcc2";
const valid = {
  treeId, anchorId, relationship: "child", personMode: "new", existingId: "",
  person: { displayName: "  María Álvarez ", givenName: "María", familyName: "Álvarez", lifeStatus: "unknown", whereaboutsStatus: "unknown" },
  relationType: "adoptive", kind: "partnership", startDate: "", endDate: "",
};

test("valida familiares nuevos y existentes antes de enviarlos", () => {
  assert.equal(addRelativeSchema.parse(valid).person.displayName, "María Álvarez");
  assert.equal(addRelativeSchema.safeParse({ ...valid, person: { ...valid.person, displayName: "  " } }).success, false);
  assert.equal(addRelativeSchema.safeParse({ ...valid, personMode: "existing", existingId: anchorId }).success, false);
  assert.equal(addRelativeSchema.safeParse({ ...valid, personMode: "existing", existingId: "" }).success, false);
  assert.equal(addRelativeSchema.safeParse({ ...valid, personMode: "existing", existingId, person: { ...valid.person, displayName: "" } }).success, true);
  assert.equal(addRelativeSchema.safeParse({ ...valid, relationship: "partner", startDate: "2022-02-28", endDate: "2022-02-01" }).success, false);
  assert.equal(addRelativeSchema.safeParse({ ...valid, relationship: "partner", startDate: "2022-02-30" }).success, false);
});
