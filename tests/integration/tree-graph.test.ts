import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local", quiet: true });

test("grafo real: tres generaciones, parejas, lector y aislamiento entre árboles", { timeout: 60_000 }, async () => {
  const url = process.env.DATABASE_URL;
  assert.ok(url, "Configura .env.local para las pruebas de integración.");
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(url).hostname), "Solo se usa PostgreSQL local.");
  const { getAccessibleTreeGraph } = await import("../../src/lib/tree-graph-data");
  const { layoutFamilyGraph } = await import("../../src/lib/family-graph");
  const pool = new Pool({ connectionString: url });
  const [owner, viewer, outsider] = Array.from({ length: 3 }, () => randomUUID());
  const [treeId, otherTreeId] = [randomUUID(), randomUUID()];
  const [grandparent, parent, partner, child, otherPerson] = Array.from({ length: 5 }, () => randomUUID());

  try {
    for (const id of [owner, viewer, outsider]) {
      await pool.query('insert into "user" (id, name, email) values ($1, $2, $3)', [id, "Prueba", `${id}@example.invalid`]);
    }
    await pool.query("insert into family_tree (id, owner_id, name) values ($1, $2, 'Tres generaciones'), ($3, $2, 'Otro árbol')", [treeId, owner, otherTreeId]);
    await pool.query("insert into tree_collaborator (tree_id, user_id, role) values ($1, $2, 'viewer')", [treeId, viewer]);
    for (const id of [grandparent, parent, partner, child]) {
      await pool.query("insert into person (id, tree_id, display_name) values ($1, $2, $3)", [id, treeId, id]);
    }
    await pool.query("insert into person (id, tree_id, display_name) values ($1, $2, 'Persona ajena')", [otherPerson, otherTreeId]);
    for (const [from, to] of [[grandparent, parent], [parent, child], [partner, child]]) {
      await pool.query("insert into parent_child (tree_id, parent_id, child_id, relation_type) values ($1, $2, $3, 'biological')", [treeId, from, to]);
    }
    const [a, b] = [parent, partner].sort();
    await pool.query("insert into partnership (tree_id, person_a_id, person_b_id, kind) values ($1, $2, $3, 'union'), ($1, $2, $3, 'marriage')", [treeId, a, b]);

    const ownerGraph = await getAccessibleTreeGraph(owner, treeId);
    const viewerGraph = await getAccessibleTreeGraph(viewer, treeId);
    assert.deepEqual(viewerGraph, ownerGraph);
    assert.ok(viewerGraph);
    assert.equal(viewerGraph.people.length, 4);
    assert.equal(viewerGraph.parents.length, 3);
    assert.equal(viewerGraph.partners.length, 2);
    const rendered = await layoutFamilyGraph(viewerGraph);
    assert.equal(rendered.edges.filter((edge) => edge.id.startsWith("partner:")).length, 1);
    assert.equal(rendered.edges.filter((edge) => edge.id.startsWith("parent:")).length, 3);
    assert.ok(!rendered.nodes.some((node) => node.id === otherPerson));
    assert.equal(await getAccessibleTreeGraph(outsider, treeId), null);
    assert.equal(await getAccessibleTreeGraph(viewer, otherTreeId), null);
    const otherGraph = await getAccessibleTreeGraph(owner, otherTreeId);
    assert.deepEqual(otherGraph?.people.map((member) => member.id), [otherPerson]);
    assert.deepEqual(otherGraph?.parents, []);
    assert.deepEqual(otherGraph?.partners, []);
  } finally {
    await pool.query("delete from family_tree where id in ($1, $2)", [treeId, otherTreeId]);
    await pool.query('delete from "user" where id = any($1::text[])', [[owner, viewer, outsider]]);
    await pool.end();
  }
});
