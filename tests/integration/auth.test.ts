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
  assert.equal(new URL(baseURL).hostname, "localhost", "La prueba solo se ejecuta contra la app local.");
  const origin = new URL(baseURL).origin;

  const suffix = randomUUID();
  const firstEmail = `arbora-integration-${suffix}@example.invalid`;
  const secondEmail = `arbora-integration-other-${suffix}@example.invalid`;
  const originalPassword = `dev-${randomUUID()}`;
  const changedPassword = `new-${randomUUID()}`;
  const treeId = randomUUID();
  const treeName = `Arbora integration ${suffix}`;
  const pool = new Pool({ connectionString: databaseUrl });

  async function post(path: string, body: object, cookie?: string) {
    return fetch(new URL(`/api/auth/${path}`, origin), {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin, ...(cookie ? { Cookie: cookie } : {}) },
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

    const firstSession = await fetch(new URL("/api/auth/get-session", baseURL), { headers: { Cookie: firstCookie } });
    const sessionData = await firstSession.json();
    assert.equal(sessionData.user.email, firstEmail);
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
  } finally {
    await pool.query("DELETE FROM family_tree WHERE id = $1", [treeId]);
    await pool.query('DELETE FROM "user" WHERE email = ANY($1::text[])', [[firstEmail, secondEmail]]);
    await pool.end();
  }
});
