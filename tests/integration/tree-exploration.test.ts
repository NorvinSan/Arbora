import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local", quiet: true });

test("búsqueda y ramas: cuatro generaciones, adopción, caminos múltiples, lector y aislamiento", { timeout: 60_000 }, async () => {
  const url = process.env.DATABASE_URL;
  assert.ok(url, "Configura .env.local para las pruebas de integración.");
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(url).hostname), "Solo se usa PostgreSQL local.");
  const { searchTreePeople, getTreeBranch } = await import("../../src/lib/tree-exploration");
  const { buildFamilyGraph } = await import("../../src/lib/family-graph");
  const pool = new Pool({ connectionString: url });
  const [owner, reader, outsider] = Array.from({ length: 3 }, () => randomUUID());
  const [treeId, otherTree] = [randomUUID(), randomUUID()];
  const [great, grand, parent, adoptiveParent, child, secondChild, otherPerson] = Array.from({ length: 7 }, () => randomUUID());

  try {
    for (const id of [owner, reader, outsider]) {
      await pool.query('insert into "user" (id, name, email) values ($1, $2, $3)', [id, "Prueba", `${id}@example.invalid`]);
    }
    await pool.query("insert into family_tree (id, owner_id, name) values ($1, $2, 'Árbol'), ($3, $2, 'Privado')", [treeId, owner, otherTree]);
    await pool.query("insert into tree_collaborator (tree_id, user_id, role) values ($1, $2, 'viewer')", [treeId, reader]);
    for (const [id, name, given, family] of [
      [great, "Elena Rivera", "Elena", "Rivera"], [grand, "Elena Rivera", "Elena", "Rivera"],
      [parent, "Lucía Rivera", "Lucía", "Rivera"], [adoptiveParent, "Mario Soto", "Mario", "Soto"],
      [child, "Nora Soto", "Nora", "Soto"], [secondChild, "Nora Soto", "Nora", "Soto"],
    ]) {
      await pool.query("insert into person (id, tree_id, display_name, given_name, family_name) values ($1, $2, $3, $4, $5)", [id, treeId, name, given, family]);
    }
    await pool.query("insert into person (id, tree_id, display_name) values ($1, $2, 'Nora ajena')", [otherPerson, otherTree]);
    for (const [from, to, type] of [
      [great, grand, "biological"], [grand, parent, "biological"], [great, parent, "other"],
      [parent, child, "biological"], [adoptiveParent, child, "adoptive"],
      [parent, secondChild, "biological"], [adoptiveParent, secondChild, "adoptive"],
    ]) {
      await pool.query("insert into parent_child (tree_id, parent_id, child_id, relation_type) values ($1, $2, $3, $4)", [treeId, from, to, type]);
    }
    const [a, b] = [parent, adoptiveParent].sort();
    await pool.query("insert into partnership (tree_id, person_a_id, person_b_id, kind) values ($1, $2, $3, 'union')", [treeId, a, b]);
    const [p, q] = [parent, grand].sort();
    await pool.query("insert into partnership (tree_id, person_a_id, person_b_id, kind) values ($1, $2, $3, 'partnership')", [treeId, p, q]);

    assert.deepEqual((await searchTreePeople(reader, treeId, "ELENA RIVERA")).map((r) => r.id).sort(), [great, grand].sort());
    assert.deepEqual((await searchTreePeople(reader, treeId, "riv")).map((r) => r.id).sort(), [great, grand, parent].sort());
    assert.deepEqual((await searchTreePeople(reader, treeId, "nOr")).map((r) => r.id).sort(), [child, secondChild].sort());
    assert.deepEqual((await searchTreePeople(reader, treeId, "LUCÍA RIVERA")).map((r) => r.id), [parent]);
    assert.deepEqual(await searchTreePeople(reader, treeId, "%"), []);
    assert.deepEqual(await searchTreePeople(outsider, treeId, "Nora"), []);
    assert.deepEqual(await searchTreePeople(reader, otherTree, "Nora"), []);

    const direct = await getTreeBranch(reader, treeId, child, "ancestors", 1);
    assert.deepEqual(direct?.personIds.sort(), [child, parent, adoptiveParent].sort());
    assert.ok(direct?.edges.some((edge) => edge.parentId === adoptiveParent && edge.relationType === "adoptive"));
    const ancestors = await getTreeBranch(reader, treeId, child, "ancestors", 4);
    assert.deepEqual(ancestors?.personIds.sort(), [child, parent, adoptiveParent, grand, great].sort());
    assert.equal(ancestors?.edges.filter((edge) => edge.parentId === great).length, 1, "Solo se muestran vínculos de la generación más cercana");
    assert.deepEqual((await getTreeBranch(reader, treeId, great, "descendants", 1))?.personIds.sort(), [great, grand, parent].sort());
    const descendants = await getTreeBranch(reader, treeId, great, "descendants", 4);
    assert.deepEqual(descendants?.personIds.sort(), [great, grand, parent, child, secondChild].sort());
    assert.equal(descendants?.personIds.filter((id) => id === child).length, 1);
    assert.equal((await getTreeBranch(reader, treeId, child, "descendants", 4))?.personIds.length, 1);
    assert.equal(await getTreeBranch(outsider, treeId, child, "ancestors", 4), null);
    assert.equal(await getTreeBranch(reader, treeId, otherPerson, "ancestors", 4), null);
    assert.equal(await getTreeBranch(reader, treeId, child, "ancestors", 1000), null);
    const graph = buildFamilyGraph({
      people: [great, grand, parent, adoptiveParent, child, secondChild].map((id) => ({ id, displayName: id, lifeStatus: "unknown" as const, whereaboutsStatus: "unknown" as const })),
      parents: [{ parentId: adoptiveParent, childId: child, relationType: "adoptive" }],
      partners: [{ personAId: parent, personBId: adoptiveParent }, { personAId: parent, personBId: grand }],
    });
    assert.equal(graph.edges.filter((edge) => edge.id.startsWith("partner:")).length, 2);
    assert.equal(graph.edges.find((edge) => edge.id === `parent:${adoptiveParent}:${child}`)?.label, "Adopción");
  } finally {
    await pool.query("delete from family_tree where id in ($1, $2)", [treeId, otherTree]);
    await pool.query('delete from "user" where id = any($1::text[])', [[owner, reader, outsider]]);
    await pool.end();
  }
});
