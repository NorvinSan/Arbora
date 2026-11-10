import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local", quiet: true });

test("relatos: CRUD, participantes, aislamiento, roles, lectura y conservación al desvincular", { timeout: 60_000 }, async () => {
  const url = process.env.DATABASE_URL;
  assert.ok(url && ["localhost", "127.0.0.1"].includes(new URL(url).hostname), "Se requiere PostgreSQL local.");
  const { createFamilyStory, updateFamilyStory, deleteFamilyStory, addStoryParticipant, removeStoryParticipant, getAccessibleStories } = await import("../../src/lib/family-stories");
  const pool = new Pool({ connectionString: url });
  const [owner, editor, viewer, outsider] = Array.from({ length: 4 }, () => randomUUID());
  const [treeId, otherTree] = [randomUUID(), randomUUID()];
  const [first, second, foreign] = [randomUUID(), randomUUID(), randomUUID()];
  const data = { treeId, title: "Memorias", body: "Recuerdos de familia", personIds: [] as string[] };
  try {
    for (const id of [owner, editor, viewer, outsider]) await pool.query('insert into "user" (id, name, email) values ($1, $2, $3)', [id, "Prueba", `${id}@example.invalid`]);
    await pool.query("insert into family_tree (id, owner_id, name) values ($1, $2, 'Árbol'), ($3, $2, 'Otro')", [treeId, owner, otherTree]);
    await pool.query("insert into tree_collaborator (tree_id, user_id, role) values ($1, $2, 'editor'), ($1, $3, 'viewer')", [treeId, editor, viewer]);
    await pool.query("insert into person (id, tree_id, display_name) values ($1, $2, 'Uno'), ($3, $2, 'Dos'), ($4, $5, 'Ajeno')", [first, treeId, second, foreign, otherTree]);

    assert.deepEqual(await createFamilyStory(owner, data), { ok: true });
    let stories = (await getAccessibleStories(owner, treeId))!;
    const generalId = stories[0].id;
    assert.equal(stories[0].authorId, owner);
    assert.ok(stories[0].createdAt instanceof Date);
    assert.deepEqual(stories[0].participants, []);
    assert.equal(await getAccessibleStories(outsider, treeId), null);
    assert.equal(await getAccessibleStories(viewer, otherTree), null);
    assert.equal((await createFamilyStory(viewer, data)).ok, false);
    assert.equal((await createFamilyStory(outsider, data)).ok, false);
    assert.equal((await createFamilyStory(editor, { ...data, personIds: [first, foreign] })).ok, false);
    assert.deepEqual(await createFamilyStory(editor, { ...data, title: "De ambos", personIds: [first, second] }), { ok: true });
    stories = (await getAccessibleStories(viewer, treeId))!;
    const linkedId = stories.find((story) => story.title === "De ambos")!.id;
    assert.equal(stories.find((story) => story.id === linkedId)!.authorId, editor);
    assert.deepEqual(stories.find((story) => story.id === linkedId)!.participants.map((p) => p.id).sort(), [first, second].sort());
    assert.deepEqual((await getAccessibleStories(viewer, treeId, { personId: first }))!.map((story) => story.id), [linkedId]);
    assert.equal((await addStoryParticipant(owner, { treeId, storyId: linkedId, personId: foreign })).ok, false);
    await assert.rejects(pool.query("insert into story_person (tree_id, story_id, person_id) values ($1, $2, $3)", [treeId, linkedId, foreign]), { code: "23503" });
    assert.equal((await updateFamilyStory(viewer, { ...data, storyId: linkedId })).ok, false);
    assert.equal((await removeStoryParticipant(viewer, { treeId, storyId: linkedId, personId: first })).ok, false);
    assert.equal((await deleteFamilyStory(viewer, { treeId, storyId: linkedId })).ok, false);
    assert.equal((await updateFamilyStory(editor, { ...data, treeId: otherTree, storyId: linkedId })).ok, false);
    assert.equal((await deleteFamilyStory(owner, { treeId: otherTree, storyId: linkedId })).ok, false);
    assert.deepEqual(await updateFamilyStory(editor, { ...data, storyId: linkedId, title: "Actualizada", body: "Otro texto", personIds: [second] }), { ok: true });
    assert.deepEqual((await getAccessibleStories(owner, treeId, { storyId: linkedId }))![0].participants.map((p) => p.id), [second]);
    assert.deepEqual(await addStoryParticipant(owner, { treeId, storyId: linkedId, personId: first }), { ok: true });
    assert.deepEqual(await addStoryParticipant(owner, { treeId, storyId: linkedId, personId: first }), { ok: true });
    assert.equal((await getAccessibleStories(owner, treeId, { storyId: linkedId }))![0].participants.length, 2);
    assert.deepEqual(await removeStoryParticipant(editor, { treeId, storyId: linkedId, personId: second }), { ok: true });
    assert.equal((await getAccessibleStories(owner, treeId, { storyId: linkedId }))![0].participants.length, 1);
    await pool.query("delete from person where id = $1", [first]);
    assert.deepEqual((await getAccessibleStories(owner, treeId, { storyId: linkedId }))![0].participants, []);
    assert.equal((await getAccessibleStories(owner, treeId))!.length, 2);
    assert.deepEqual(await deleteFamilyStory(owner, { treeId, storyId: generalId }), { ok: true });
    assert.deepEqual(await deleteFamilyStory(editor, { treeId, storyId: linkedId }), { ok: true });
    assert.deepEqual(await getAccessibleStories(viewer, treeId), []);
  } finally {
    await pool.query("delete from family_tree where id in ($1, $2)", [treeId, otherTree]);
    await pool.query('delete from "user" where id = any($1::text[])', [[owner, editor, viewer, outsider]]);
    await pool.end();
  }
});
