import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";

const container = "arbora-postgres";
const volume = "arbora-postgres-data";
const databasePort = 55432;
const appPort = 4327;
const appEnv = resolve(".env.local");
const podmanEnv = resolve(".env.podman.local");

function podman(args: string[]) {
  const result = spawnSync("podman", args, { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.error?.message || `Podman falló: ${args[0]}`);
  }
  return result.stdout.trim();
}

async function main() {
  const available = spawnSync("podman", ["--version"]);
  if (available.error || available.status !== 0) {
    throw new Error("Podman no está disponible. Instálalo o arranca su servicio antes de preparar la base local.");
  }
  if (existsSync(appEnv) || existsSync(podmanEnv)) {
    throw new Error("Ya existe una configuración local. No se sobrescribieron .env.local ni .env.podman.local.");
  }
  if (spawnSync("podman", ["container", "exists", container]).status === 0) {
    throw new Error(`Ya existe el contenedor ${container}. No se modificó.`);
  }
  if (spawnSync("podman", ["volume", "exists", volume]).status === 0) {
    throw new Error(`Ya existe el volumen ${volume}. No se modificó.`);
  }

  const password = randomBytes(32).toString("base64url");
  const authSecret = randomBytes(48).toString("base64url");
  const databaseUrl = `postgresql://arbora:${password}@127.0.0.1:${databasePort}/arbora`;

  writeFileSync(appEnv, `DATABASE_URL=${databaseUrl}\nBETTER_AUTH_SECRET=${authSecret}\nBETTER_AUTH_URL=http://127.0.0.1:${appPort}\n`, { flag: "wx", mode: 0o600 });
  writeFileSync(podmanEnv, `POSTGRES_USER=arbora\nPOSTGRES_PASSWORD=${password}\nPOSTGRES_DB=arbora\n`, { flag: "wx", mode: 0o600 });

  podman(["volume", "create", volume]);
  podman([
    "run", "-d", "--name", container,
    "--env-file", podmanEnv,
    "-p", `127.0.0.1:${databasePort}:5432`,
    "-v", `${volume}:/var/lib/postgresql/data`,
    "docker.io/library/postgres:17-alpine",
  ]);

  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 1000 });
  try {
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        await pool.query("select 1");
        console.log(`PostgreSQL de Arbora está listo en 127.0.0.1:${databasePort}.`);
        console.log("Configuración local creada e ignorada por Git. Ejecuta pnpm db:migrate.");
        return;
      } catch {
        await new Promise((done) => setTimeout(done, 1000));
      }
    }
    throw new Error("PostgreSQL no respondió a tiempo. Revisa: podman logs arbora-postgres");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "No se pudo preparar PostgreSQL local.");
  process.exitCode = 1;
});
