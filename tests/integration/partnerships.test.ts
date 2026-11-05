import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local", quiet: true });

test("parejas: períodos, duplicados simultáneos, fechas, roles y vínculos independientes", { timeout: 60_000 }, async () => {
  const url = process.env.DATABASE_URL;
  assert.ok(url, "Configura .env.local para las pruebas de integración.");
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(url).hostname), "Solo se usa PostgreSQL local.");
  const { createPartnership, deletePartnership } = await import("../../src/lib/partnerships");
  const pool = new Pool({ connectionString: url });
  const [owner, editor, viewer, outsider] = Array.from({ length: 4 }, () => randomUUID());
  const [treeId, otherTreeId] = [randomUUID(), randomUUID()];
  const [first, second, third, otherPerson] = Array.from({ length: 4 }, () => randomUUID());
  const relation = (personAId: string, personBId: string, kind: "marriage" | "union" | "partnership" = "marriage", startDate = "", endDate = "") =>
    ({ treeId, personAId, personBId, kind, startDate, endDate });

  try {
    for (const id of [owner, editor, viewer, outsider]) {
      await pool.query('insert into "user" (id, name, email) values ($1, $2, $3)', [id, "Prueba", `${id}@example.invalid`]);
    }
    await pool.query("insert into family_tree (id, owner_id, name) values ($1, $2, 'Familia'), ($3, $2, 'Otro árbol')", [treeId, owner, otherTreeId]);
    await pool.query("insert into tree_collaborator (tree_id, user_id, role) values ($1, $2, 'editor'), ($1, $3, 'viewer')", [treeId, editor, viewer]);
    for (const id of [first, second, third]) {
      await pool.query("insert into person (id, tree_id, display_name) values ($1, $2, $3)", [id, treeId, id]);
    }
    await pool.query("insert into person (id, tree_id, display_name) values ($1, $2, 'Otra persona')", [otherPerson, otherTreeId]);
    await pool.query("insert into parent_child (tree_id, parent_id, child_id, relation_type) values ($1, $2, $3, 'biological')", [treeId, first, third]);

    assert.deepEqual(await createPartnership(owner, relation(first, second, "marriage", "2000-01-01", "2010-01-01")), { ok: true });
    assert.deepEqual(await createPartnership(editor, relation(second, first, "marriage", "2015-01-01")), { ok: true });
    assert.deepEqual(await createPartnership(owner, relation(first, third, "partnership")), { ok: true });
    assert.deepEqual(await createPartnership(owner, relation(first, second, "union")), { ok: true });

    const stored = await pool.query("select id, kind, start_year, end_year from partnership where tree_id = $1 order by start_year nulls last", [treeId]);
    assert.equal(stored.rows.length, 4);
    assert.equal(stored.rows[0].start_year, 2000);
    assert.equal(stored.rows[0].end_year, 2010);
    assert.equal(stored.rows[1].start_year, 2015);
    assert.equal(stored.rows[1].end_year, null);

    const duplicate = await createPartnership(owner, relation(second, first, "marriage", "2000-01-01", "2020-01-01"));
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) assert.match(duplicate.message, /ya está registrada/);
    assert.equal((await createPartnership(owner, relation(second, first, "union"))).ok, false);
    assert.equal((await createPartnership(owner, relation(first, first))).ok, false);
    assert.equal((await createPartnership(owner, relation(first, otherPerson))).ok, false);
    assert.equal((await createPartnership(viewer, relation(second, third))).ok, false);
    assert.equal((await createPartnership(outsider, relation(second, third))).ok, false);
    assert.equal((await createPartnership(owner, relation(second, third, "marriage", "2020-01-01", "2019-01-01"))).ok, false);

    const simultaneous = await Promise.all([
      createPartnership(owner, relation(second, third, "union")),
      createPartnership(editor, relation(third, second, "union")),
    ]);
    assert.equal(simultaneous.filter((result) => result.ok).length, 1);
    assert.equal(simultaneous.filter((result) => !result.ok).length, 1);
    const newId = (await pool.query("select id from partnership where tree_id = $1 and kind = 'union' and person_a_id = $2 and person_b_id = $3", [treeId, ...[second, third].sort()])).rows[0].id;
    assert.equal((await deletePartnership(viewer, { treeId, partnershipId: newId })).ok, false);
    assert.equal((await deletePartnership(outsider, { treeId, partnershipId: newId })).ok, false);
    assert.equal((await deletePartnership(editor, { treeId, partnershipId: newId })).ok, true);
    assert.equal((await deletePartnership(owner, { treeId, partnershipId: newId })).ok, false);
    assert.equal((await pool.query("select count(*)::int as count from person where tree_id = $1", [treeId])).rows[0].count, 3);
    assert.equal((await pool.query("select count(*)::int as count from parent_child where tree_id = $1", [treeId])).rows[0].count, 1);

    // The database itself protects against bypassing the action, including NULL dates.
    await assert.rejects(pool.query("insert into partnership (tree_id, person_a_id, person_b_id, kind) values ($1, $2, $3, 'union')", [treeId, ...[first, second].sort()]), { code: "23505" });
    await assert.rejects(pool.query("insert into partnership (tree_id, person_a_id, person_b_id, kind, start_year, start_month, start_day, start_qualifier, end_year, end_month, end_day, end_qualifier) values ($1, $2, $3, 'marriage', 2020, 1, 1, 'exact', 2019, 1, 1, 'exact')", [treeId, ...[second, third].sort()]), { code: "23514" });
  } finally {
    await pool.query("delete from family_tree where id in ($1, $2)", [treeId, otherTreeId]);
    await pool.query('delete from "user" where id = any($1::text[])', [[owner, editor, viewer, outsider]]);
    await pool.end();
  }
});
