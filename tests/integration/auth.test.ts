import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local", quiet: true });

test("cuentas, sesiones y aislamiento de árboles con PostgreSQL real", { timeout: 60_000 }, async () => {
  const databaseUrl = process.env.DATABASE_URL;
  const baseURL = process.env.BETTER_AUTH_URL;
  assert.ok(databaseUrl && baseURL, "Configura .env.local y arranca la app antes de esta prueba.");
  assert.ok(["127.0.0.1", "localhost"].includes(new URL(databaseUrl).hostname), "La prueba solo se ejecuta contra PostgreSQL local.");
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname), "La prueba solo se ejecuta contra la app local.");
  const origin = new URL(baseURL).origin;

  const suffix = randomUUID();
  const firstEmail = `arbora-integration-${suffix}@example.invalid`;
  const secondEmail = `arbora-integration-other-${suffix}@example.invalid`;
  const originalPassword = `dev-${randomUUID()}`;
  const changedPassword = `new-${randomUUID()}`;
  const treeId = randomUUID();
  const treeName = `Arbora integration ${suffix}`;
  const testIp = `100.64.${parseInt(suffix.slice(0, 2), 16)}.${parseInt(suffix.slice(2, 4), 16)}`;
  const limiterIp = `100.65.${parseInt(suffix.slice(0, 2), 16)}.${parseInt(suffix.slice(2, 4), 16)}`;
  const pool = new Pool({ connectionString: databaseUrl });

  async function post(path: string, body: object, cookie?: string, ip = testIp) {
    return fetch(new URL(`/api/auth/${path}`, origin), {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin, "X-Forwarded-For": ip, "User-Agent": "ArboraIntegration/1.0", ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify(body),
      redirect: "manual",
    });
  }

  function sessionCookie(response: Response) {
    const cookies = response.headers.getSetCookie().map((value) => value.split(";")[0]);
    assert.ok(cookies.some((value) => value.includes("session_token=")), "Better Auth debe devolver una cookie de sesión.");
    return cookies.join("; ");
  }

  try {
    const firstSignUp = await post("sign-up/email", { name: "Ana de prueba", email: firstEmail, password: originalPassword });
    assert.equal(firstSignUp.status, 200, await firstSignUp.text());
    const firstCookie = sessionCookie(firstSignUp);

    const secondSignUp = await post("sign-up/email", { name: "Otra persona", email: secondEmail, password: originalPassword });
    assert.equal(secondSignUp.status, 200, await secondSignUp.text());
    const secondCookie = sessionCookie(secondSignUp);

    const duplicate = await post("sign-up/email", { name: "Duplicado", email: firstEmail, password: originalPassword });
    assert.equal(duplicate.status, 422, "No se deben registrar dos usuarios con el mismo correo.");
    const blockedRegistration = await post("sign-up/email", { name: "Cuarto intento", email: `blocked-${suffix}@example.invalid`, password: originalPassword });
    assert.equal(blockedRegistration.status, 429, "El registro por HTTP debe tener límite de intentos.");

    const firstSession = await fetch(new URL("/api/auth/get-session", baseURL), { headers: { Cookie: firstCookie } });
    const sessionData = await firstSession.json();
    assert.equal(sessionData.user.email, firstEmail);
    assert.equal(sessionData.session.ipAddress, testIp);
    assert.equal(sessionData.session.userAgent, "ArboraIntegration/1.0");
    await pool.query("INSERT INTO family_tree (id, owner_id, name) VALUES ($1, $2, $3)", [treeId, sessionData.user.id, treeName]);

    const firstDashboard = await fetch(new URL("/dashboard", baseURL), { headers: { Cookie: firstCookie } });
    assert.equal(firstDashboard.status, 200);
    assert.match(await firstDashboard.text(), new RegExp(treeName));

    const secondDashboard = await fetch(new URL("/dashboard", baseURL), { headers: { Cookie: secondCookie } });
    assert.equal(secondDashboard.status, 200);
    assert.doesNotMatch(await secondDashboard.text(), new RegExp(treeName));

    const ownerTree = await fetch(new URL(`/dashboard/trees/${treeId}`, baseURL), { headers: { Cookie: firstCookie } });
    assert.equal(ownerTree.status, 200);
    assert.match(await ownerTree.text(), new RegExp(treeName));

    const unauthorizedTree = await fetch(new URL(`/dashboard/trees/${treeId}`, baseURL), { headers: { Cookie: secondCookie } });
    const unauthorizedBody = await unauthorizedTree.text();
    assert.doesNotMatch(unauthorizedBody, new RegExp(treeName), "Otro usuario no puede consultar un árbol privado.");
    assert.match(unauthorizedBody, /Árbol no disponible/, "El usuario no autorizado debe ver el estado de no encontrado.");

    const secondSession = await fetch(new URL("/api/auth/get-session", baseURL), { headers: { Cookie: secondCookie } });
    const secondUser = (await secondSession.json()).user;
    await pool.query("INSERT INTO tree_collaborator (tree_id, user_id, role) VALUES ($1, $2, 'viewer')", [treeId, secondUser.id]);
    const member = await pool.query("INSERT INTO person (tree_id, display_name) VALUES ($1, 'Persona de prueba') RETURNING id", [treeId]);
    const personId = member.rows[0].id as string;
    await pool.query("INSERT INTO person_event (tree_id, person_id, type, title, year, qualifier, place, description) VALUES ($1, $2, 'education', 'Graduación de prueba', 2001, 'exact', 'Sevilla', 'Terminó sus estudios')", [treeId, personId]);
    const viewerTree = await fetch(new URL(`/dashboard/trees/${treeId}`, baseURL), { headers: { Cookie: secondCookie } });
    assert.equal(viewerTree.status, 200);
    const viewerBody = await viewerTree.text();
    assert.match(viewerBody, /Árbol interactivo/);
    assert.match(viewerBody, /Tienes acceso de lectura a este árbol/);
    assert.doesNotMatch(viewerBody, /Registrar pareja/, "Un lector no debe ver formularios de edición.");

    const profilePath = `/dashboard/trees/${treeId}/people/${personId}`;
    const viewerProfile = await fetch(new URL(profilePath, baseURL), { headers: { Cookie: secondCookie } });
    assert.equal(viewerProfile.status, 200);
    const viewerProfileBody = await viewerProfile.text();
    assert.match(viewerProfileBody, /Historia de vida/);
    assert.match(viewerProfileBody, /Graduación de prueba/);
    assert.match(viewerProfileBody, /Sevilla/);
    assert.doesNotMatch(viewerProfileBody, /Agregar acontecimiento/);
    const ownerProfile = await fetch(new URL(profilePath, baseURL), { headers: { Cookie: firstCookie } });
    assert.match(await ownerProfile.text(), /Agregar acontecimiento/);

    const story = await pool.query("INSERT INTO family_story (tree_id, author_id, title, body) VALUES ($1, $2, 'Relato de prueba', 'Una historia compartida') RETURNING id", [treeId, sessionData.user.id]);
    const storyId = story.rows[0].id as string;
    await pool.query("INSERT INTO story_person (tree_id, story_id, person_id) VALUES ($1, $2, $3)", [treeId, storyId, personId]);
    const storiesPath = `/dashboard/trees/${treeId}/stories`;
    const detailPath = `${storiesPath}/${storyId}`;
    const viewerStories = await fetch(new URL(storiesPath, baseURL), { headers: { Cookie: secondCookie } });
    assert.equal(viewerStories.status, 200);
    assert.match(await viewerStories.text(), /Relato de prueba/);
    const viewerDetail = await fetch(new URL(detailPath, baseURL), { headers: { Cookie: secondCookie } });
    assert.equal(viewerDetail.status, 200);
    const detailBody = await viewerDetail.text();
    assert.match(detailBody, /Una historia compartida/);
    assert.match(detailBody, new RegExp(profilePath));
    assert.doesNotMatch(detailBody, /Editar relato y participantes/);
    const ownerDetail = await fetch(new URL(detailPath, baseURL), { headers: { Cookie: firstCookie } });
    assert.match(await ownerDetail.text(), /Editar relato y participantes/);
    const profileWithStory = await fetch(new URL(profilePath, baseURL), { headers: { Cookie: secondCookie } });
    assert.match(await profileWithStory.text(), new RegExp(detailPath));
    const privateStory = await fetch(new URL(detailPath, baseURL), { headers: { Cookie: randomUUID() }, redirect: "manual" });
    assert.notEqual(privateStory.status, 200, "Una sesión ajena no puede consultar un relato privado.");

    const updated = await post("update-user", { name: "Ana actualizada" }, firstCookie);
    assert.equal(updated.status, 200, await updated.text());
    const changed = await post("change-password", { currentPassword: originalPassword, newPassword: changedPassword, revokeOtherSessions: true }, firstCookie);
    assert.equal(changed.status, 200, await changed.text());

    const signedOut = await post("sign-out", {}, firstCookie);
    assert.equal(signedOut.status, 200, await signedOut.text());
    const revoked = await fetch(new URL("/dashboard", baseURL), { headers: { Cookie: firstCookie }, redirect: "manual" });
    assert.equal(revoked.status, 307, "La sesión cerrada no debe permitir acceso privado.");

    const oldLogin = await post("sign-in/email", { email: firstEmail, password: originalPassword });
    assert.equal(oldLogin.status, 401, "La contraseña antigua no debe seguir funcionando.");
    const newLogin = await post("sign-in/email", { email: firstEmail, password: changedPassword });
    assert.equal(newLogin.status, 200, await newLogin.text());
    assert.ok(sessionCookie(newLogin));

    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await post("sign-in/email", { email: firstEmail, password: "contraseña incorrecta" }, undefined, limiterIp);
      assert.equal(response.status, attempt === 3 ? 429 : 401, `Intento ${attempt + 1}: ${await response.text()}`);
    }
  } finally {
    await pool.query("DELETE FROM family_tree WHERE id = $1", [treeId]);
    await pool.query('DELETE FROM "user" WHERE email = ANY($1::text[])', [[firstEmail, secondEmail]]);
    await pool.end();
  }
});
