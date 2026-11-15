import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local", quiet: true });

test("GEDCOM export authorizes owner/editor, excludes viewer and other trees, and does not mutate data", { timeout: 60_000 }, async () => {
  const url = process.env.DATABASE_URL;
  assert.ok(url, "Configura .env.local para las pruebas de integración.");
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(url).hostname), "Solo se usa PostgreSQL local.");
  const { exportTreeGedcom } = await import("../../src/lib/gedcom-export");
  const pool = new Pool({ connectionString: url });
  const [owner, editor, viewer, outsider] = Array.from({ length: 4 }, () => randomUUID());
  const [treeId, otherTreeId, parent, child, other] = Array.from({ length: 5 }, () => randomUUID());
  try {
    for (const id of [owner, editor, viewer, outsider]) {
      await pool.query('insert into "user" (id, name, email) values ($1, $2, $3)', [id, "Test", `${id}@example.invalid`]);
    }
    await pool.query("insert into family_tree (id, owner_id, name) values ($1, $2, 'Familia Ávila'), ($3, $2, 'Otra familia')", [treeId, owner, otherTreeId]);
    await pool.query("insert into tree_collaborator (tree_id, user_id, role) values ($1, $2, 'editor'), ($1, $3, 'viewer')", [treeId, editor, viewer]);
    await pool.query("insert into person (id, tree_id, display_name) values ($1, $2, 'Madre'), ($3, $2, 'Hija'), ($4, $5, 'Secreto ajeno')", [parent, treeId, child, other, otherTreeId]);
    await pool.query("insert into parent_child (tree_id, parent_id, child_id, relation_type) values ($1, $2, $3, 'adoptive')", [treeId, parent, child]);
    await pool.query("insert into person_event (tree_id, person_id, type, title, year, qualifier) values ($1, $2, 'birth', 'Nacimiento', 1920, 'exact')", [treeId, parent]);

    const before = await pool.query("select count(*)::int as count from person where tree_id = $1", [treeId]);
    const exported = await exportTreeGedcom(owner, treeId);
    assert.ok(exported);
    assert.equal(exported.name, "Familia Ávila");
    assert.match(exported.content, /2 DATE 1920/);
    assert.match(exported.content, /2 PEDI ADOPTED/);
    assert.match(exported.content, /1 NAME Madre/);
    assert.doesNotMatch(exported.content, /Secreto ajeno|Otra familia/);
    assert.equal((await exportTreeGedcom(editor, treeId))?.content, exported.content);
    assert.equal(await exportTreeGedcom(viewer, treeId), null);
    assert.equal(await exportTreeGedcom(outsider, treeId), null);
    assert.equal(await exportTreeGedcom(editor, otherTreeId), null);
    assert.equal((await pool.query("select count(*)::int as count from person where tree_id = $1", [treeId])).rows[0].count, before.rows[0].count);
  } finally {
    await pool.query("delete from family_tree where id in ($1, $2)", [treeId, otherTreeId]);
    await pool.query('delete from "user" where id = any($1::text[])', [[owner, editor, viewer, outsider]]);
    await pool.end();
  }
});
