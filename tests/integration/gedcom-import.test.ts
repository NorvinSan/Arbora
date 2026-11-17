import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local", quiet: true });

test("GEDCOM import creates an isolated tree atomically for the importing user", { timeout: 60_000 }, async () => {
  const url = process.env.DATABASE_URL;
  assert.ok(url, "Configura .env.local para las pruebas de integración.");
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(url).hostname), "Solo se usa PostgreSQL local.");
  const { importTreeGedcom } = await import("../../src/lib/gedcom-import-store");
  const { parseGedcom } = await import("../../src/lib/gedcom-import");
  const pool = new Pool({ connectionString: url });
  const [owner, editor, viewer, outsider] = Array.from({ length: 4 }, () => randomUUID());
  const [treeId, otherTreeId] = [randomUUID(), randomUUID()];
  const importedTrees: string[] = [];
  const input = `0 HEAD
1 GEDC
2 VERS 7.0
0 @I1@ INDI
1 NAME María /Pérez/
1 BIRT
2 DATE 1900
0 @I2@ INDI
1 NAME José /López/
0 @I3@ INDI
1 NAME Hija /López/
1 FAMC @F1@
2 PEDI ADOPTED
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
1 MARR
2 DATE 1920
0 TRLR
`;
  try {
    for (const id of [owner, editor, viewer, outsider]) await pool.query('insert into "user" (id, name, email) values ($1, $2, $3)', [id, "Test", `${id}@example.invalid`]);
    await pool.query("insert into family_tree (id, owner_id, name) values ($1, $2, 'Principal'), ($3, $2, 'Otro')", [treeId, owner, otherTreeId]);
    await pool.query("insert into tree_collaborator (tree_id, user_id, role) values ($1, $2, 'editor'), ($1, $3, 'viewer')", [treeId, editor, viewer]);
    const parsed = parseGedcom(input);
    assert.deepEqual(parsed.errors, []);
    // Every import is a new tree owned by its importer, never a write to a viewed tree.
    assert.equal((await pool.query("select count(*)::int as n from person where tree_id = $1", [treeId])).rows[0].n, 0);
    const imported = await importTreeGedcom(editor, "Árbol importado", parsed);
    assert.equal(imported.ok, true);
    if (!imported.ok) throw new Error("Importación inesperadamente rechazada.");
    importedTrees.push(imported.treeId);
    assert.equal((await pool.query("select owner_id from family_tree where id = $1", [imported.treeId])).rows[0].owner_id, editor);
    const rows = await pool.query("select id, display_name from person where tree_id = $1", [imported.treeId]);
    assert.equal(rows.rows.length, 3);
    assert.ok(rows.rows.every((row) => !["@I1@", "@I2@", "@I3@"].includes(row.id)));
    const links = await pool.query("select parent_id, child_id, relation_type from parent_child where tree_id = $1", [imported.treeId]);
    assert.equal(links.rows.length, 2);
    assert.ok(links.rows.every((row) => row.relation_type === "adoptive" && rows.rows.some((person) => person.id === row.parent_id) && rows.rows.some((person) => person.id === row.child_id)));
    assert.equal((await pool.query("select kind, start_year from partnership where tree_id = $1", [imported.treeId])).rows[0].start_year, 1920);
    assert.equal((await pool.query("select year from person_event where tree_id = $1", [imported.treeId])).rows[0].year, 1900);
    assert.equal((await pool.query("select count(*)::int as n from person where tree_id = $1", [treeId])).rows[0].n, 0);
    assert.equal((await pool.query("select count(*)::int as n from person where tree_id = $1", [otherTreeId])).rows[0].n, 0);
    const broken = parseGedcom(input);
    broken.people[0].events.push({ ...broken.people[0].events[0] }); // Violates the unique birth index after inserting people.
    await assert.rejects(importTreeGedcom(owner, "Fallido", broken));
    assert.equal((await pool.query("select count(*)::int as n from family_tree where owner_id = $1 and name = 'Fallido'", [owner])).rows[0].n, 0);
    assert.equal((await pool.query("select count(*)::int as n from person where tree_id = $1", [imported.treeId])).rows[0].n, 3);
    const personal = await importTreeGedcom(viewer, "Árbol propio", parsed);
    assert.equal(personal.ok, true);
    if (!personal.ok) throw new Error("Importación inesperadamente rechazada.");
    importedTrees.push(personal.treeId);
    assert.equal((await pool.query("select owner_id from family_tree where id = $1", [personal.treeId])).rows[0].owner_id, viewer);
    assert.equal((await pool.query("select count(*)::int as n from person where tree_id = $1", [treeId])).rows[0].n, 0);
  } finally {
    await pool.query("delete from family_tree where id = any($1::uuid[])", [[treeId, otherTreeId, ...importedTrees]]);
    await pool.query('delete from "user" where id = any($1::text[])', [[owner, editor, viewer, outsider]]);
    await pool.end();
  }
});
