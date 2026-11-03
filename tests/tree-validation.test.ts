import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addPersonSchema, createParentChildSchema, createTreeSchema, deleteParentChildSchema } from "../src/lib/tree-form-schemas";

describe("árboles familiares", () => {
  it("exige un nombre y normaliza los espacios", () => {
    assert.equal(createTreeSchema.safeParse({ name: "  ", description: "" }).success, false);
    const result = createTreeSchema.parse({ name: "  Familia Rivera  ", description: "  Nuestros recuerdos  " });
    assert.deepEqual(result, { name: "Familia Rivera", description: "Nuestros recuerdos" });
  });

  it("limita la descripción para evitar entradas excesivas", () => {
    assert.equal(createTreeSchema.safeParse({ name: "Familia", description: "x".repeat(1001) }).success, false);
  });
});

describe("parentescos", () => {
  const valid = {
    treeId: "0194c35a-f60a-7c5a-9748-ec474469deba",
    parentId: "0194c35a-f60a-7c5a-9748-ec474469debb",
    childId: "0194c35a-f60a-7c5a-9748-ec474469debc",
    relationType: "adoptive",
  };

  it("acepta los tres tipos de parentesco y rechaza identificadores inválidos", () => {
    for (const relationType of ["biological", "adoptive", "other"]) {
      assert.equal(createParentChildSchema.safeParse({ ...valid, relationType }).success, true);
    }
    assert.equal(createParentChildSchema.safeParse({ ...valid, relationType: "unknown" }).success, false);
    assert.equal(createParentChildSchema.safeParse({ ...valid, childId: "invalid" }).success, false);
  });

  it("no permite que alguien sea su propio progenitor, ni al crear ni al eliminar", () => {
    assert.equal(createParentChildSchema.safeParse({ ...valid, childId: valid.parentId }).success, false);
    assert.equal(deleteParentChildSchema.safeParse({ ...valid, childId: valid.parentId }).success, false);
  });
});

describe("integrantes", () => {
  const valid = {
    treeId: "0194c35a-f60a-7c5a-9748-ec474469deba",
    displayName: "Gabriel Rivera",
    givenName: "Gabriel",
    familyName: "Rivera",
    lifeStatus: "unknown",
    whereaboutsStatus: "missing",
  };

  it("permite un familiar desaparecido sin declararlo fallecido", () => {
    assert.equal(addPersonSchema.safeParse(valid).success, true);
  });

  it("rechaza un árbol inválido, un nombre vacío y estados no previstos", () => {
    assert.equal(addPersonSchema.safeParse({ ...valid, treeId: "otro árbol" }).success, false);
    assert.equal(addPersonSchema.safeParse({ ...valid, displayName: "  " }).success, false);
    assert.equal(addPersonSchema.safeParse({ ...valid, lifeStatus: "missing" }).success, false);
  });
});
