import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local", quiet: true });

test("documentos: carga, permisos, edición, privacidad, asociaciones, persistencia y limpieza", { timeout: 60_000 }, async () => {
  const url = process.env.DATABASE_URL;
  assert.ok(url);
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(url).hostname));
  const { uploadDocument, getPersonDocuments, getPersonPhotos, getAuthorizedMedia, updateDocument,
    removeDocumentAssociation, deleteDocument, setProfilePhoto } = await import("../../src/lib/person-media");
  const { mediaStorage } = await import("../../src/lib/media-storage");
  const pool = new Pool({ connectionString: url });
  const [owner, editor, viewer, outsider, treeId, otherTree, first, second, foreign] = Array.from({ length: 9 }, () => randomUUID());
  const bytes = new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
  const file = new File([bytes], "acta.pdf", { type: "application/pdf" });
  const metadata = { title: "Acta", description: "Registro", documentType: "birth" as const, historicalDate: "1899-12-31", personIds: [first, second] };
  let documentId: string | undefined;
  try {
    for (const id of [owner, editor, viewer, outsider]) {
      await pool.query('insert into "user" (id, name, email) values ($1, $2, $3)', [id, "Prueba", `${id}@example.invalid`]);
    }
    await pool.query("insert into family_tree (id, owner_id, name) values ($1, $2, 'Árbol'), ($3, $2, 'Otro')", [treeId, owner, otherTree]);
    await pool.query("insert into tree_collaborator (tree_id, user_id, role) values ($1, $2, 'editor'), ($1, $3, 'viewer')", [treeId, editor, viewer]);
    for (const [id, tree] of [[first, treeId], [second, treeId], [foreign, otherTree]]) {
      await pool.query("insert into person (id, tree_id, display_name) values ($1, $2, 'Familiar')", [id, tree]);
    }
    assert.equal((await uploadDocument(viewer, treeId, file, metadata)).ok, false);
    assert.equal((await uploadDocument(outsider, treeId, file, metadata)).ok, false);
    assert.equal((await uploadDocument(editor, treeId, file, { ...metadata, personIds: [first, foreign] })).ok, false);
    assert.equal((await uploadDocument(editor, treeId, new File([bytes], "falso.png", { type: "image/png" }), metadata)).ok, false);
    const result = await uploadDocument(editor, treeId, file, metadata);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    documentId = result.id;
    const duplicate = await uploadDocument(owner, treeId, file, metadata);
    assert.equal(duplicate.ok, true);
    if (duplicate.ok) assert.equal(duplicate.id, documentId);
    assert.equal((await getPersonDocuments(treeId, first))[0].people.length, 2);
    assert.equal((await getPersonPhotos(treeId, first)).length, 0);
    assert.equal((await setProfilePhoto(editor, treeId, documentId, first)).ok, false);
    assert.equal(await getAuthorizedMedia(outsider, treeId, documentId), null);
    assert.equal(await getAuthorizedMedia(viewer, otherTree, documentId), null);
    const authorized = await getAuthorizedMedia(viewer, treeId, documentId);
    assert.ok(authorized);
    assert.deepEqual([...await mediaStorage.get(authorized.storage_key)], [...bytes]);
    // A separate process can read the private file: uploads survive application process restarts.
    const persisted = execFileSync(process.execPath, ["-e", "process.stdout.write(require('node:fs').readFileSync(process.argv[1]))",
      join(process.env.MEDIA_STORAGE_DIR ?? join(process.cwd(), ".data", "media"), authorized.storage_key)]);
    assert.deepEqual([...persisted], [...bytes]);
    assert.equal((await updateDocument(viewer, treeId, documentId, { ...metadata, title: "Nueva acta" })).ok, false);
    assert.equal((await updateDocument(editor, treeId, documentId, { ...metadata, personIds: [foreign] })).ok, false);
    assert.equal((await updateDocument(editor, treeId, documentId, { ...metadata, title: "Nueva acta" })).ok, true);
    assert.equal((await getPersonDocuments(treeId, second))[0].title, "Nueva acta");
    assert.equal((await removeDocumentAssociation(viewer, treeId, documentId, first)).ok, false);
    assert.equal((await removeDocumentAssociation(editor, treeId, documentId, first)).ok, true);
    assert.equal((await getPersonDocuments(treeId, first)).length, 0);
    assert.equal((await getPersonDocuments(treeId, second)).length, 1);
    assert.deepEqual([...await mediaStorage.get(authorized.storage_key)], [...bytes]);
    assert.equal((await deleteDocument(viewer, treeId, documentId)).ok, false);
    assert.equal((await removeDocumentAssociation(owner, treeId, documentId, second)).ok, true);
    documentId = undefined;
    assert.equal((await getPersonDocuments(treeId, second)).length, 0);
    await assert.rejects(mediaStorage.get(authorized.storage_key), { code: "ENOENT" });
    const another = await uploadDocument(owner, treeId, file, { ...metadata, title: "Otro registro" });
    assert.equal(another.ok, true);
    if (another.ok) {
      documentId = another.id;
      const storedAgain = await getAuthorizedMedia(owner, treeId, another.id);
      assert.ok(storedAgain);
      assert.equal((await deleteDocument(owner, treeId, another.id)).ok, true);
      documentId = undefined;
      await assert.rejects(mediaStorage.get(storedAgain.storage_key), { code: "ENOENT" });
    }
  } finally {
    if (documentId) await deleteDocument(owner, treeId, documentId);
    await pool.query("delete from family_tree where id in ($1, $2)", [treeId, otherTree]);
    await pool.query('delete from "user" where id = any($1::text[])', [[owner, editor, viewer, outsider]]);
    await pool.end();
  }
});
