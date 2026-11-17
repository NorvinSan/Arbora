import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local", quiet: true });

test("la seed completa biografías y acontecimientos sin sobrescribir ediciones", { timeout: 60_000 }, async () => {
  const url = process.env.DATABASE_URL;
  assert.ok(url);
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(url).hostname), "Solo se usa PostgreSQL local.");
  const pool = new Pool({ connectionString: url });
  const userId = randomUUID();
  const email = `seed-biographies-${userId}@example.invalid`;
  const seed = () => execFileSync("pnpm", ["db:seed", "--owner-email", email], { cwd: process.cwd(), timeout: 30_000 });
  let storageKeys: string[] = [];

  try {
    await pool.query('insert into "user" (id, name, email) values ($1, $2, $3)', [userId, "Prueba", email]);
    seed();
    const first = await pool.query<{ id: string; display_name: string; biography: string | null }>(
      "select p.id, p.display_name, p.biography from person p join family_tree t on t.id = p.tree_id where t.owner_id = $1", [userId],
    );
    assert.equal(first.rows.length, 7);
    const photos = await pool.query<{ storage_key: string; person_id: string; media_id: string }>(
      "select m.storage_key, pm.person_id, pm.media_id from media m join person_media pm on pm.media_id = m.id and pm.tree_id = m.tree_id join family_tree t on t.id = m.tree_id where t.owner_id = $1 and pm.is_profile = true", [userId],
    );
    storageKeys = photos.rows.map((photo) => photo.storage_key);
    assert.equal(photos.rows.length, 7);
    for (const member of first.rows) {
      assert.ok(member.biography && member.biography.length > 250 && member.biography.includes("\n\n"), member.display_name);
    }
    const events = await pool.query<{ person_id: string; count: number }>(
      "select e.person_id, count(*)::int as count from person_event e join person p on p.id = e.person_id join family_tree t on t.id = p.tree_id where t.owner_id = $1 group by e.person_id", [userId],
    );
    assert.equal(events.rows.length, 7);
    assert.equal(events.rows.reduce((total, row) => total + row.count, 0), 36);
    assert.ok(events.rows.every((row) => row.count >= 4), "Cada familiar tiene al menos cuatro acontecimientos.");
    const elena = first.rows.find((member) => member.display_name === "Elena Rivera")!;
    const sofia = first.rows.find((member) => member.display_name === "Sofía Mora Vidal")!;
    const { rows: [sofiaEvent] } = await pool.query<{ id: string }>("select id from person_event where person_id = $1 and title = 'Catalogación del archivo familiar'", [sofia.id]);
    assert.ok(sofiaEvent);
    await pool.query("update person set biography = 'Guardaba las cartas y relatos de la familia.' where id = $1", [elena.id]);
    await pool.query("update person set biography = 'Mi propia biografía' where id = $1", [sofia.id]);
    await pool.query("update person_event set description = 'Mi recuerdo personal' where id = $1", [sofiaEvent.id]);
    seed();
    const photosAfter = await pool.query<{ person_id: string; media_id: string }>(
      "select pm.person_id, pm.media_id from person_media pm join family_tree t on t.id = pm.tree_id where t.owner_id = $1 and pm.is_profile = true", [userId],
    );
    assert.deepEqual(photosAfter.rows.sort((a, b) => a.person_id.localeCompare(b.person_id)), photos.rows.map(({ person_id, media_id }) => ({ person_id, media_id })).sort((a, b) => a.person_id.localeCompare(b.person_id)));
    const updated = await pool.query<{ id: string; biography: string | null }>("select id, biography from person where id = any($1::uuid[])", [[elena.id, sofia.id]]);
    assert.equal(updated.rows.find((member) => member.id === elena.id)?.biography, elena.biography);
    assert.equal(updated.rows.find((member) => member.id === sofia.id)?.biography, "Mi propia biografía");
    const retained = await pool.query<{ description: string; count: number }>(
      "select e.description, (select count(*)::int from person_event where tree_id = e.tree_id) as count from person_event e where e.id = $1", [sofiaEvent.id],
    );
    assert.equal(retained.rows[0].description, "Mi recuerdo personal");
    assert.equal(retained.rows[0].count, 36);
  } finally {
    await pool.query("delete from family_tree where owner_id = $1", [userId]);
    for (const key of storageKeys) await unlink(join(process.env.MEDIA_STORAGE_DIR ?? join(process.cwd(), ".data", "media"), key));
    await pool.query('delete from "user" where id = $1', [userId]);
    await pool.end();
  }
});
