import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFamilyGraph, layoutFamilyGraph, type FamilyGraphData } from "../src/lib/family-graph";

const person = (id: string) => ({ id, displayName: id, lifeStatus: "unknown" as const, whereaboutsStatus: "unknown" as const });

const family: FamilyGraphData = {
  people: ["grandmother", "grandfather", "mother", "father", "daughter", "son"].map(person),
  parents: [
    { parentId: "grandmother", childId: "mother" }, { parentId: "grandfather", childId: "mother" },
    { parentId: "mother", childId: "daughter" }, { parentId: "father", childId: "daughter" },
    { parentId: "mother", childId: "son" }, { parentId: "father", childId: "son" },
  ],
  partners: [
    { personAId: "grandmother", personBId: "grandfather" },
    { personAId: "mother", personBId: "father" },
  ],
};

test("ELK ordena tres generaciones y mantiene a las parejas juntas", async () => {
  const { nodes, edges } = await layoutFamilyGraph(family);
  const positions = new Map(nodes.map((node) => [node.id, node.position]));
  assert.equal(nodes.length, 6);
  assert.equal(edges.filter((edge) => edge.id.startsWith("parent:")).length, 6);
  assert.equal(edges.filter((edge) => edge.id.startsWith("partner:")).length, 2);
  assert.equal(positions.get("grandmother")!.y, positions.get("grandfather")!.y);
  assert.equal(positions.get("mother")!.y, positions.get("father")!.y);
  assert.equal(positions.get("daughter")!.y, positions.get("son")!.y);
  assert.ok(positions.get("grandmother")!.y < positions.get("mother")!.y);
  assert.ok(positions.get("mother")!.y < positions.get("daughter")!.y);
  assert.ok(Math.abs(Math.abs(positions.get("mother")!.x - positions.get("father")!.x) - 196) < 0.001);
});

test("una pareja con varios períodos solo dibuja una línea, sin perder sus vínculos parentales", () => {
  const { nodes, edges } = buildFamilyGraph({
    ...family,
    parents: [...family.parents, family.parents[0]],
    partners: [...family.partners, { personAId: "father", personBId: "mother" }],
  });
  assert.equal(nodes.length, 6);
  assert.equal(edges.filter((edge) => edge.id.startsWith("parent:")).length, 6);
  assert.equal(edges.filter((edge) => edge.id.startsWith("partner:")).length, 2);
  assert.ok(edges.some((edge) => edge.source === "mother" && edge.target === "daughter"));
  assert.ok(edges.some((edge) => edge.source === "father" && edge.target === "daughter"));
});

test("árbol sin personas no genera conexiones", async () => {
  assert.deepEqual(await layoutFamilyGraph({ people: [], parents: [], partners: [] }), { nodes: [], edges: [] });
});
