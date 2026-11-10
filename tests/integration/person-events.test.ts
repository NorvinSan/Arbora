import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local", quiet: true });

test("acontecimientos: CRUD, fechas parciales, orden, aislamiento, roles e integridad", { timeout: 60_000 }, async () => {
  const url = process.env.DATABASE_URL;
  assert.ok(url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname), "Se requiere PostgreSQL local.");
  const { createPersonEvent, updatePersonEvent, deletePersonEvent, getPersonEvents } = await import("../../src/lib/person-events");
  const pool = new Pool({ connectionString: url });
  const [owner, editor, viewer, outsider] = Array.from({ length: 4 }, () => randomUUID());
  const [treeId, otherTree] = [randomUUID(), randomUUID()];
  const [personId, siblingId, otherPerson] = [randomUUID(), randomUUID(), randomUUID()];
  const data = { treeId, personId, type: "other" as const, title: "Un recuerdo", description: "Descripción", place: "Madrid", date: "1990", qualifier: "exact" as const };
  try {
    for (const id of [owner, editor, viewer, outsider]) await pool.query('insert into "user" (id, name, email) values ($1, $2, $3)', [id, "Prueba", `${id}@example.invalid`]);
    await pool.query("insert into family_tree (id, owner_id, name) values ($1, $2, 'Árbol'), ($3, $2, 'Otro')", [treeId, owner, otherTree]);
    await pool.query("insert into tree_collaborator (tree_id, user_id, role) values ($1, $2, 'editor'), ($1, $3, 'viewer')", [treeId, editor, viewer]);
    await pool.query("insert into person (id, tree_id, display_name) values ($1, $2, 'Uno'), ($3, $2, 'Dos'), ($4, $5, 'Otro')", [personId, treeId, siblingId, otherPerson, otherTree]);
    await pool.query("insert into parent_child (tree_id, parent_id, child_id, relation_type) values ($1, $2, $3, 'biological')", [treeId, personId, siblingId]);
    const [a, b] = [personId, siblingId].sort();
    await pool.query("insert into partnership (tree_id, person_a_id, person_b_id, kind) values ($1, $2, $3, 'partnership')", [treeId, a, b]);
    assert.equal((await createPersonEvent(owner, { ...data, personId: otherPerson })).ok, false);
    assert.equal((await createPersonEvent(viewer, data)).ok, false);
    assert.equal((await createPersonEvent(outsider, data)).ok, false);
    assert.deepEqual(await createPersonEvent(owner, data), { ok: true });
    assert.deepEqual(await createPersonEvent(editor, { ...data, title: "Sin fecha", date: "" }), { ok: true });
    assert.deepEqual(await createPersonEvent(owner, { ...data, title: "Mes y año", date: "1989-05" }), { ok: true });
    assert.deepEqual(await createPersonEvent(owner, { ...data, type: "birth", title: "Nacimiento" }), { ok: true });
    let events = await getPersonEvents(treeId, personId);
    assert.deepEqual(events.map((event) => event.title), ["Mes y año", "Un recuerdo", "Nacimiento", "Sin fecha"]);
    assert.deepEqual([events[0].year, events[0].month, events[0].day], [1989, 5, null]);
    assert.equal(events[3].qualifier, null);
    assert.deepEqual(await getPersonEvents(treeId, siblingId), []);
    const eventId = events[1].id;
    const { postgresErrorCode } = await import("../../src/lib/action-result");
    await assert.rejects(updatePersonEvent(editor, { ...data, eventId, type: "birth" }), (error: unknown) => postgresErrorCode(error) === "23505");
    assert.equal((await updatePersonEvent(viewer, { ...data, eventId })).ok, false);
    assert.equal((await deletePersonEvent(viewer, { treeId, personId, eventId })).ok, false);
    assert.equal((await updatePersonEvent(editor, { ...data, personId: siblingId, eventId })).ok, false);
    assert.equal((await deletePersonEvent(owner, { treeId: otherTree, personId: otherPerson, eventId })).ok, false);
    assert.deepEqual(await updatePersonEvent(editor, { ...data, eventId, title: "Trabajo", type: "work", date: "1991-02-03" }), { ok: true });
    events = await getPersonEvents(treeId, personId);
    assert.equal(events.find((event) => event.id === eventId)?.title, "Trabajo");
    assert.deepEqual(await deletePersonEvent(owner, { treeId, personId, eventId }), { ok: true });
    assert.equal((await getPersonEvents(treeId, personId)).length, 3);
    assert.equal((await pool.query("select count(*)::int as count from person where tree_id = $1", [treeId])).rows[0].count, 2);
    assert.equal((await pool.query("select count(*)::int as count from parent_child where tree_id = $1", [treeId])).rows[0].count, 1);
    assert.equal((await pool.query("select count(*)::int as count from partnership where tree_id = $1", [treeId])).rows[0].count, 1);
  } finally {
    await pool.query("delete from family_tree where id in ($1, $2)", [treeId, otherTree]);
    await pool.query('delete from "user" where id = any($1::text[])', [[owner, editor, viewer, outsider]]);
    await pool.end();
  }
});
