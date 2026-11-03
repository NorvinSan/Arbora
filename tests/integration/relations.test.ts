import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local", quiet: true });

test("parentescos de tres generaciones, ciclos, aislamiento y roles con PostgreSQL", { timeout: 60_000 }, async () => {
  const url = process.env.DATABASE_URL;
  assert.ok(url, "Configura .env.local para las pruebas de integración.");
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(url).hostname), "Solo se usa PostgreSQL local.");
  const { createParentChild, deleteParentChild } = await import("../../src/lib/parent-child");
  const pool = new Pool({ connectionString: url });
  const [owner, editor, viewer, outsider] = Array.from({ length: 4 }, () => randomUUID());
  const [treeId, otherTreeId] = [randomUUID(), randomUUID()];
  const [grandparent, parent, child, otherPerson, concurrentA, concurrentB] = Array.from({ length: 6 }, () => randomUUID());
  const relation = (parentId: string, childId: string, relationType: "biological" | "adoptive" | "other" = "biological") =>
    ({ treeId, parentId, childId, relationType });

  try {
    for (const id of [owner, editor, viewer, outsider]) {
      await pool.query('insert into "user" (id, name, email) values ($1, $2, $3)', [id, "Prueba", `${id}@example.invalid`]);
    }
    await pool.query("insert into family_tree (id, owner_id, name) values ($1, $2, 'Tres generaciones'), ($3, $2, 'Otro árbol')", [treeId, owner, otherTreeId]);
    await pool.query("insert into tree_collaborator (tree_id, user_id, role) values ($1, $2, 'editor'), ($1, $3, 'viewer')", [treeId, editor, viewer]);
    for (const id of [grandparent, parent, child, concurrentA, concurrentB]) {
      await pool.query("insert into person (id, tree_id, display_name) values ($1, $2, $3)", [id, treeId, id]);
    }
    await pool.query("insert into person (id, tree_id, display_name) values ($1, $2, 'Otra persona')", [otherPerson, otherTreeId]);

    assert.deepEqual(await createParentChild(owner, relation(grandparent, parent)), { ok: true });
    assert.deepEqual(await createParentChild(editor, relation(parent, child, "adoptive")), { ok: true });
    const stored = await pool.query("select parent_id, child_id, relation_type from parent_child where tree_id = $1 order by created_at", [treeId]);
    assert.equal(stored.rows.length, 2);
    assert.ok(stored.rows.some((row) => row.parent_id === grandparent && row.child_id === parent && row.relation_type === "biological"));
    assert.ok(stored.rows.some((row) => row.parent_id === parent && row.child_id === child && row.relation_type === "adoptive"));

    for (const [input, expected] of [
      [relation(grandparent, parent), /ya está registrada/],
      [relation(child, grandparent), /ciclo/],
      [relation(parent, parent), /propio progenitor/],
      [relation(grandparent, otherPerson), /mismo árbol/],
    ] as const) {
      const result = await createParentChild(owner, input);
      assert.equal(result.ok, false);
      if (!result.ok) assert.match(result.message, expected);
    }
    assert.equal((await createParentChild(viewer, relation(grandparent, child))).ok, false);
    assert.equal((await createParentChild(outsider, relation(grandparent, child))).ok, false);
    assert.equal((await deleteParentChild(viewer, relation(parent, child))).ok, false);
    assert.equal((await deleteParentChild(outsider, relation(parent, child))).ok, false);

    // Competing requests must not each pass a cycle check against stale data.
    const simultaneous = await Promise.all([
      createParentChild(owner, relation(concurrentA, concurrentB, "other")),
      createParentChild(editor, relation(concurrentB, concurrentA, "other")),
    ]);
    assert.equal(simultaneous.filter((result) => result.ok).length, 1);
    assert.equal(simultaneous.filter((result) => !result.ok).length, 1);

    assert.deepEqual(await deleteParentChild(editor, relation(parent, child)), { ok: true });
    assert.equal((await deleteParentChild(owner, relation(parent, child))).ok, false);
    assert.deepEqual(await createParentChild(owner, relation(parent, child, "other")), { ok: true });
  } finally {
    await pool.query("delete from family_tree where id in ($1, $2)", [treeId, otherTreeId]);
    await pool.query('delete from "user" where id = any($1::text[])', [[owner, editor, viewer, outsider]]);
    await pool.end();
  }
});
