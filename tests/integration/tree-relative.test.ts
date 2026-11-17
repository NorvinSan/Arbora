import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local", quiet: true });

test("acciones desde el árbol: altas atómicas, personas existentes, permisos y aislamiento", { timeout: 60_000 }, async () => {
  const url = process.env.DATABASE_URL;
  assert.ok(url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname), "Se requiere PostgreSQL local.");
  const { addRelative } = await import("../../src/lib/tree-relative");
  const { addRelativeSchema } = await import("../../src/lib/tree-form-schemas");
  const { getAccessibleTreeGraph } = await import("../../src/lib/tree-graph-data");
  const pool = new Pool({ connectionString: url });
  const [owner, editor, viewer, outsider] = Array.from({ length: 4 }, () => randomUUID());
  const [treeId, otherTreeId, anchor, existing, foreign] = Array.from({ length: 5 }, () => randomUUID());
  const input = (values: Record<string, unknown> = {}) => addRelativeSchema.parse({
    treeId, anchorId: anchor, relationship: "parent", personMode: "new", existingId: "",
    person: { displayName: "Familiar nuevo", givenName: "", familyName: "", lifeStatus: "unknown", whereaboutsStatus: "unknown" },
    relationType: "biological", kind: "partnership", startDate: "", endDate: "", ...values,
  });
  try {
    for (const id of [owner, editor, viewer, outsider]) await pool.query('insert into "user" (id, name, email) values ($1, $2, $3)', [id, "Test", `${id}@example.invalid`]);
    await pool.query("insert into family_tree (id, owner_id, name) values ($1, $2, 'Principal'), ($3, $2, 'Aislado')", [treeId, owner, otherTreeId]);
    await pool.query("insert into tree_collaborator (tree_id, user_id, role) values ($1, $2, 'editor'), ($1, $3, 'viewer')", [treeId, editor, viewer]);
    await pool.query("insert into person (id, tree_id, display_name) values ($1, $2, 'Seleccionado'), ($3, $2, 'Existente'), ($4, $5, 'Ajeno')", [anchor, treeId, existing, foreign, otherTreeId]);

    const parent = await addRelative(owner, input());
    assert.equal(parent.ok, true);
    if (!parent.ok) return;
    assert.equal((await pool.query("select count(*)::int as n from parent_child where tree_id = $1 and parent_id = $2 and child_id = $3", [treeId, parent.id, anchor])).rows[0].n, 1);

    const child = await addRelative(editor, input({ relationship: "child", person: { displayName: "Hija", givenName: "", familyName: "", lifeStatus: "unknown", whereaboutsStatus: "unknown" } }));
    assert.equal(child.ok, true);
    if (!child.ok) return;
    assert.equal((await pool.query("select count(*)::int as n from parent_child where tree_id = $1 and parent_id = $2 and child_id = $3", [treeId, anchor, child.id])).rows[0].n, 1);

    const existingLink = input({ relationship: "child", personMode: "existing", existingId: existing });
    assert.equal((await addRelative(owner, existingLink)).ok, true);
    assert.equal((await addRelative(editor, existingLink)).ok, false, "No se duplica el parentesco.");
    assert.equal((await addRelative(owner, input({ relationship: "parent", anchorId: parent.id, personMode: "existing", existingId: child.id }))).ok, false, "Se rechaza un ciclo.");
    assert.equal((await addRelative(owner, input({ personMode: "existing", existingId: foreign }))).ok, false, "No se vinculan árboles distintos.");
    assert.equal((await addRelative(viewer, input())).ok, false);
    assert.equal((await addRelative(outsider, input())).ok, false);

    const couple = await addRelative(editor, input({ relationship: "partner", personMode: "existing", existingId: existing, kind: "marriage" }));
    assert.equal(couple.ok, true);
    assert.equal((await addRelative(owner, input({ relationship: "partner", personMode: "existing", existingId: existing, kind: "marriage" }))).ok, false);
    const graph = await getAccessibleTreeGraph(viewer, treeId);
    assert.equal(graph?.people.length, 4);
    assert.equal(graph?.parents.length, 3);
    assert.equal(graph?.partners.length, 1);
    assert.equal(await getAccessibleTreeGraph(outsider, treeId), null);
    assert.equal((await pool.query("select count(*)::int as n from person where tree_id = $1", [otherTreeId])).rows[0].n, 1);

    // Force a late relationship failure after inserting a new person: the transaction must roll back both.
    const before = (await pool.query("select count(*)::int as n from person where tree_id = $1", [treeId])).rows[0].n;
    const invalid = { ...input({ relationship: "partner" }), startDate: "2020-12-30", endDate: "2020-01-01" };
    assert.equal((await addRelative(owner, invalid)).ok, false);
    assert.equal((await pool.query("select count(*)::int as n from person where tree_id = $1", [treeId])).rows[0].n, before);
  } finally {
    await pool.query("delete from family_tree where id in ($1, $2)", [treeId, otherTreeId]);
    await pool.query('delete from "user" where id = any($1::text[])', [[owner, editor, viewer, outsider]]);
    await pool.end();
  }
});
