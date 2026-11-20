import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { buildFamilyGraph, layoutFamilyGraph, type FamilyGraphData } from "../src/lib/family-graph";

function family(size: number): FamilyGraphData {
  const people: FamilyGraphData["people"] = Array.from({ length: size }, (_, i) => ({ id: `person-${i}`, displayName: `Familiar ${i}`, lifeStatus: "unknown", whereaboutsStatus: "unknown" }));
  const partners: FamilyGraphData["partners"] = [];
  const parents: FamilyGraphData["parents"] = [];
  for (let group = 0; group < Math.floor(size / 2); group++) {
    const a = `person-${group * 2}`, b = `person-${group * 2 + 1}`;
    partners.push({ personAId: a, personBId: b });
    if (group) {
      const parent = Math.floor((group - 1) / 2) * 2;
      for (const child of [a, b]) for (const index of [parent, parent + 1]) parents.push({ parentId: `person-${index}`, childId: child });
    }
  }
  return { people, parents, partners };
}

async function measure(size: number) {
  const data = family(size);
  const start = performance.now();
  buildFamilyGraph(data);
  const buildMs = performance.now() - start;
  const layoutStart = performance.now();
  const graph = await layoutFamilyGraph(data);
  const layoutMs = performance.now() - layoutStart;
  const reuseStart = performance.now();
  const reused = await layoutFamilyGraph({ ...data, people: data.people.map((person) => ({ ...person, displayName: `${person.displayName} editado` })) }, graph);
  const reuseMs = performance.now() - reuseStart;
  assert.equal(graph.nodes.length, size);
  assert.equal(graph.edges.length, data.parents.length + data.partners.length);
  const ids = new Set(graph.nodes.map((node) => node.id));
  for (const edge of graph.edges) { assert.ok(ids.has(edge.source)); assert.ok(ids.has(edge.target)); }
  for (let i = 0; i < graph.nodes.length; i++) for (let j = i + 1; j < graph.nodes.length; j++) {
    const a = graph.nodes[i].position, b = graph.nodes[j].position;
    assert.ok(a.x + 160 <= b.x || b.x + 160 <= a.x || a.y + 72 <= b.y || b.y + 72 <= a.y, `${size}: nodos ${i} y ${j} superpuestos`);
  }
  assert.deepEqual(reused.nodes.map((node) => node.position), graph.nodes.map((node) => node.position));
  console.log(`${size} personas: grafo ${buildMs.toFixed(1)} ms · ELK + grafo ${layoutMs.toFixed(1)} ms · edición sin ELK ${reuseMs.toFixed(1)} ms · ${graph.edges.length} conexiones verificadas`);
}

async function main() {
  for (const size of [50, 100, 300]) await measure(size);
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
