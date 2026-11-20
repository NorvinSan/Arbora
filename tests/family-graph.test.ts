import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFamilyGraph, layoutFamilyGraph, viewportKeepingNode, type FamilyGraphData } from "../src/lib/family-graph";

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
  const result = await layoutFamilyGraph({ people: [], parents: [], partners: [] });
  assert.deepEqual({ nodes: result.nodes, edges: result.edges }, { nodes: [], edges: [] });
});

test("múltiples parejas y medios hermanos conservan generaciones, conexiones y nodos separados", async () => {
  const data: FamilyGraphData = {
    people: ["grandmother", "grandfather", "mother", "firstPartner", "secondPartner", "thirdPartner", "firstChild", "secondChild"].map(person),
    parents: [
      { parentId: "grandmother", childId: "mother" }, { parentId: "grandfather", childId: "mother" },
      { parentId: "mother", childId: "firstChild" }, { parentId: "firstPartner", childId: "firstChild" },
      { parentId: "mother", childId: "secondChild" }, { parentId: "secondPartner", childId: "secondChild" },
    ],
    partners: [
      { personAId: "grandmother", personBId: "grandfather" },
      { personAId: "mother", personBId: "firstPartner" },
      { personAId: "mother", personBId: "secondPartner" },
      { personAId: "mother", personBId: "thirdPartner" },
    ],
  };
  const { nodes, edges } = await layoutFamilyGraph(data);
  const positions = new Map(nodes.map((node) => [node.id, node.position]));
  assert.equal(edges.filter((edge) => edge.id.startsWith("parent:")).length, 6);
  assert.equal(edges.filter((edge) => edge.id.startsWith("partner:")).length, 4);
  assert.ok(edges.some((edge) => edge.type === "partnerArc"));
  assert.ok(positions.get("grandmother")!.y < positions.get("mother")!.y);
  assert.ok(positions.get("mother")!.y < positions.get("firstChild")!.y);
  assert.equal(positions.get("firstChild")!.y, positions.get("secondChild")!.y);
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i].position, b = nodes[j].position;
    assert.ok(a.x + 160 <= b.x || b.x + 160 <= a.x || a.y + 72 <= b.y || b.y + 72 <= a.y, `${nodes[i].id} y ${nodes[j].id} se superponen`);
  }
});

test("el diagrama sigue sin solapamientos tras añadir padre, hijo y pareja con nombres largos", async () => {
  const updated: FamilyGraphData = {
    people: [...family.people, { ...person("newParent"), displayName: "Nombre compuesto extremadamente largo de una persona" }, person("newChild"), person("newPartner")],
    parents: [...family.parents, { parentId: "newParent", childId: "mother" }, { parentId: "daughter", childId: "newChild" }],
    partners: [...family.partners, { personAId: "daughter", personBId: "newPartner" }],
  };
  const { nodes, edges } = await layoutFamilyGraph(updated);
  assert.equal(edges.length, family.parents.length + family.partners.length + 3);
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i].position, b = nodes[j].position;
    assert.ok(a.x + 160 <= b.x || b.x + 160 <= a.x || a.y + 72 <= b.y || b.y + 72 <= a.y, `${nodes[i].id} y ${nodes[j].id} se superponen`);
  }
});

test("una reorganización conserva zoom y posición visual de la persona seleccionada", () => {
  const before = { x: 120, y: 80 }, after = { x: 340, y: 190 };
  const viewport = { x: -10, y: 22, zoom: 0.75 };
  const result = viewportKeepingNode(viewport, before, after);
  assert.equal(result.zoom, viewport.zoom);
  assert.equal(after.x * result.zoom + result.x, before.x * viewport.zoom + viewport.x);
  assert.equal(after.y * result.zoom + result.y, before.y * viewport.zoom + viewport.y);
});

test("ediciones de datos personales conservan coordenadas; cambiar vínculos recalcula el layout", async () => {
  const before = await layoutFamilyGraph(family);
  const renamed = await layoutFamilyGraph({ ...family, people: family.people.map((member) => ({ ...member, displayName: `Otro ${member.displayName}`, lifeStatus: "living" })) }, before);
  assert.deepEqual(renamed.nodes.map((node) => node.position), before.nodes.map((node) => node.position));
  assert.equal(renamed.nodes[0].data.name, "Otro grandmother");
  assert.equal(renamed.topologyKey, before.topologyKey);
  const reorderedNames = await layoutFamilyGraph({ ...family, people: family.people.map((member) => ({ ...member, displayName: member.id === "mother" ? "Zeta" : "Alfa" })) }, before);
  for (const edge of reorderedNames.edges.filter((link) => link.id.startsWith("partner:"))) {
    const source = reorderedNames.nodes.find((node) => node.id === edge.source)!;
    const target = reorderedNames.nodes.find((node) => node.id === edge.target)!;
    assert.ok(source.position.x < target.position.x, "una edición de nombre no invierte la conexión de pareja");
  }
  const changed = await layoutFamilyGraph({ ...family, parents: family.parents.slice(1) }, renamed);
  assert.notEqual(changed.topologyKey, before.topologyKey);
  assert.equal(changed.edges.length, before.edges.length - 1);
});
