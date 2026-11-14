import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local", quiet: true });

test("fotografías: permisos, múltiples asociaciones, perfiles, lectura privada y borrado", { timeout: 60_000 }, async () => {
  const url = process.env.DATABASE_URL;
  assert.ok(url);
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(url).hostname));
  const { uploadPhoto, getPersonPhotos, getAuthorizedPhoto, setProfilePhoto, removePhotoAssociation, deletePhoto } = await import("../../src/lib/person-media");
  const { mediaStorage } = await import("../../src/lib/media-storage");
  const pool = new Pool({ connectionString: url });
  const [owner, editor, viewer, outsider, treeId, otherTree, first, second, foreign] = Array.from({ length: 9 }, () => randomUUID());
  const file = new File([Uint8Array.from([255, 216, 255, 0])], "familia.jpg", { type: "image/jpeg" });
  let photoId: string | undefined;
  try {
    for (const id of [owner, editor, viewer, outsider]) {
      await pool.query('insert into "user" (id, name, email) values ($1, $2, $3)', [id, "Prueba", `${id}@example.invalid`]);
    }
    await pool.query("insert into family_tree (id, owner_id, name) values ($1, $2, 'Árbol'), ($3, $2, 'Otro')", [treeId, owner, otherTree]);
    await pool.query("insert into tree_collaborator (tree_id, user_id, role) values ($1, $2, 'editor'), ($1, $3, 'viewer')", [treeId, editor, viewer]);
    for (const [id, tree] of [[first, treeId], [second, treeId], [foreign, otherTree]]) {
      await pool.query("insert into person (id, tree_id, display_name) values ($1, $2, 'Familiar')", [id, tree]);
    }
    assert.equal((await uploadPhoto(viewer, treeId, file, "", [first])).ok, false);
    assert.equal((await uploadPhoto(outsider, treeId, file, "", [first])).ok, false);
    assert.equal((await uploadPhoto(editor, treeId, file, "", [first, foreign])).ok, false);
    const result = await uploadPhoto(editor, treeId, file, "Retrato", [first, second]);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    photoId = result.id;
    assert.equal((await getPersonPhotos(treeId, first))[0].people.length, 2);
    assert.equal(await getAuthorizedPhoto(outsider, treeId, photoId), null);
    assert.equal(await getAuthorizedPhoto(viewer, otherTree, photoId), null);
    const stored = await getAuthorizedPhoto(viewer, treeId, photoId);
    assert.ok(stored);
    assert.deepEqual([...await mediaStorage.get(stored.storage_key)], [...new Uint8Array(await file.arrayBuffer())]);
    assert.equal((await setProfilePhoto(viewer, treeId, photoId, first)).ok, false);
    assert.equal((await setProfilePhoto(editor, treeId, photoId, foreign)).ok, false);
    assert.equal((await setProfilePhoto(editor, treeId, photoId, first)).ok, true);
    assert.equal((await getPersonPhotos(treeId, first))[0].isProfile, true);
    assert.equal((await removePhotoAssociation(viewer, treeId, photoId, first)).ok, false);
    assert.equal((await removePhotoAssociation(editor, treeId, photoId, first)).ok, true);
    assert.equal((await getPersonPhotos(treeId, first)).length, 0);
    assert.equal((await getPersonPhotos(treeId, second)).length, 1);
    assert.equal((await deletePhoto(viewer, treeId, photoId)).ok, false);
    assert.equal((await deletePhoto(owner, treeId, photoId)).ok, true);
    photoId = undefined;
    assert.equal((await getPersonPhotos(treeId, second)).length, 0);
    await assert.rejects(mediaStorage.get(stored.storage_key), { code: "ENOENT" });
  } finally {
    if (photoId) await deletePhoto(owner, treeId, photoId);
    await pool.query("delete from family_tree where id in ($1, $2)", [treeId, otherTree]);
    await pool.query('delete from "user" where id = any($1::text[])', [[owner, editor, viewer, outsider]]);
    await pool.end();
  }
});
