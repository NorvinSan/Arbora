import { createHash } from "node:crypto";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  familyStory,
  familyTree,
  parentChild,
  partnership,
  person,
  personEvent,
} from "../src/db/app-schema";
import { user } from "../src/db/schema";

config({ path: ".env.local", quiet: true });

const demo = { name: "Cuenta de demostración", email: "demo@arbora.local", password: "ArboraDemo2026!" };
const usage = "Uso: pnpm db:seed [--owner-email correo-de-tu-cuenta]";

function seedId(ownerId: string, key: string): string {
  const bytes = createHash("sha256").update(`arbora:demo:v1:${ownerId}:${key}`).digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") {
    console.log(usage);
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("El seed de demostración no se ejecuta con NODE_ENV=production.");
  }

  const useDemoAccount = args.length === 0;
  if (!useDemoAccount && (args.length !== 2 || args[0] !== "--owner-email" || !args[1]?.includes("@"))) {
    throw new Error(usage);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Falta DATABASE_URL. Configúrala fuera del repositorio y ejecuta las migraciones primero.");
  }
  if (useDemoAccount) {
    const authUrl = process.env.BETTER_AUTH_URL;
    if (!process.env.BETTER_AUTH_SECRET || !authUrl ||
      !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname) ||
      !["localhost", "127.0.0.1"].includes(new URL(authUrl).hostname)) {
      throw new Error("La cuenta demo solo se crea con la base de datos y la app configuradas en localhost.");
    }
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool);

  try {
    const email = useDemoAccount ? demo.email : args[1].trim().toLowerCase();
    let [owner] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
    let demoPasswordWorks = false;
    if (useDemoAccount) {
      // Use the same Better Auth configuration as the app so the demo password
      // is hashed and its account can sign in through the normal login form.
      const { auth } = await import("../src/lib/auth");
      if (!owner) {
        await auth.api.signUpEmail({ body: demo });
        [owner] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
        demoPasswordWorks = true;
      } else {
        try {
          await auth.api.signInEmail({ body: { email, password: demo.password } });
          demoPasswordWorks = true;
        } catch {
          // An existing demo account may have a user-changed password.
        }
      }
    }
    if (!owner) {
      throw new Error("No existe esa cuenta. Regístrala primero con Better Auth y repite el comando.");
    }

    const id = (key: string) => seedId(owner.id, key);
    const treeId = id("tree");
    const keys = ["elena", "marcos", "lucia", "daniel", "sofia", "gabriel", "tomas"] as const;
    type PersonKey = (typeof keys)[number];
    const peopleIds = Object.fromEntries(keys.map((key) => [key, id(`person:${key}`)])) as Record<PersonKey, string>;

    const people: (typeof person.$inferInsert)[] = [
      { id: peopleIds.elena, treeId, displayName: "Elena Rivera", givenName: "Elena", familyName: "Rivera", lifeStatus: "deceased", whereaboutsStatus: "known", biography: "Guardaba las cartas y relatos de la familia." },
      { id: peopleIds.marcos, treeId, displayName: "Marcos Vidal", givenName: "Marcos", familyName: "Vidal", lifeStatus: "deceased", whereaboutsStatus: "known" },
      { id: peopleIds.lucia, treeId, displayName: "Lucía Vidal Rivera", givenName: "Lucía", familyName: "Vidal Rivera", lifeStatus: "living", whereaboutsStatus: "known" },
      { id: peopleIds.daniel, treeId, displayName: "Daniel Mora", givenName: "Daniel", familyName: "Mora", lifeStatus: "living", whereaboutsStatus: "known" },
      { id: peopleIds.sofia, treeId, displayName: "Sofía Mora Vidal", givenName: "Sofía", familyName: "Mora Vidal", lifeStatus: "living", whereaboutsStatus: "known" },
      { id: peopleIds.gabriel, treeId, displayName: "Gabriel Mora Vidal", givenName: "Gabriel", familyName: "Mora Vidal", lifeStatus: "unknown", whereaboutsStatus: "missing", biography: "La familia no tiene noticias recientes sobre su paradero." },
      { id: peopleIds.tomas, treeId, displayName: "Tomás Mora Vidal", givenName: "Tomás", familyName: "Mora Vidal", lifeStatus: "living", whereaboutsStatus: "known" },
    ];

    const links = [
      ["elena", "lucia", "biological"],
      ["marcos", "lucia", "biological"],
      ["lucia", "sofia", "biological"],
      ["daniel", "sofia", "biological"],
      ["lucia", "gabriel", "biological"],
      ["daniel", "gabriel", "biological"],
      ["lucia", "tomas", "adoptive"],
      ["daniel", "tomas", "adoptive"],
    ] as const satisfies readonly (readonly [PersonKey, PersonKey, "biological" | "adoptive"])[];

    type EventInsert = typeof personEvent.$inferInsert;
    const event = (
      key: string,
      personKey: PersonKey,
      type: EventInsert["type"],
      details: Pick<EventInsert, "year" | "month" | "day" | "qualifier" | "place" | "description">,
    ): EventInsert => ({ id: id(`event:${key}`), treeId, personId: peopleIds[personKey], type, ...details });

    const events = [
      event("elena-birth", "elena", "birth", { year: 1936, qualifier: "approximate" }),
      event("elena-death", "elena", "death", { year: 2018, qualifier: "exact" }),
      event("marcos-birth", "marcos", "birth", { year: 1934, qualifier: "approximate" }),
      event("marcos-death", "marcos", "death", { year: 2004, qualifier: "exact" }),
      event("lucia-birth", "lucia", "birth", { year: 1963, qualifier: "exact" }),
      event("daniel-birth", "daniel", "birth", { year: 1961, qualifier: "exact" }),
      event("sofia-birth", "sofia", "birth", { year: 1992, month: 4, day: 12, qualifier: "exact" }),
      event("gabriel-birth", "gabriel", "birth", { year: 1995, qualifier: "exact" }),
      event("gabriel-last-contact", "gabriel", "last_contact", { year: 2018, month: 6, qualifier: "approximate", place: "Valle Claro", description: "Última noticia recibida por la familia." }),
      event("gabriel-disappearance", "gabriel", "disappearance", { year: 2019, qualifier: "approximate", description: "Se desconoce su paradero; no hay constancia de fallecimiento." }),
      event("tomas-birth", "tomas", "birth", { year: 2000, qualifier: "approximate" }),
    ];

    await db.transaction(async (tx) => {
      await tx.insert(familyTree).values({
        id: treeId,
        ownerId: owner.id,
        name: "Árbol de demostración",
        description: "Familia ficticia de tres generaciones para desarrollo.",
      }).onConflictDoNothing();

      await tx.insert(person).values(people).onConflictDoNothing();
      await tx.insert(parentChild).values(links.map(([parent, child, relationType]) => ({
        treeId, parentId: peopleIds[parent], childId: peopleIds[child], relationType,
      }))).onConflictDoNothing();

      const pair = (a: PersonKey, b: PersonKey) => [peopleIds[a], peopleIds[b]].sort() as [string, string];
      const [olderA, olderB] = pair("elena", "marcos");
      const [youngerA, youngerB] = pair("lucia", "daniel");
      await tx.insert(partnership).values([
        { id: id("partnership:elena-marcos"), treeId, personAId: olderA, personBId: olderB, kind: "marriage", startYear: 1959, startQualifier: "exact" },
        { id: id("partnership:lucia-daniel"), treeId, personAId: youngerA, personBId: youngerB, kind: "partnership", startYear: 1987, startQualifier: "approximate" },
      ]).onConflictDoNothing();

      await tx.insert(personEvent).values(events).onConflictDoNothing();
      await tx.insert(familyStory).values([
        { id: id("story:family"), treeId, authorId: owner.id, title: "Recuerdos de familia", body: "Elena conservó cartas y fotografías que hoy ayudan a reconstruir la historia familiar." },
        { id: id("story:gabriel"), treeId, personId: peopleIds.gabriel, authorId: owner.id, title: "Últimas noticias de Gabriel", body: "El paradero de Gabriel sigue sin confirmarse. La familia conserva las fechas como aproximadas." },
      ]).onConflictDoNothing();
    });

    console.log("Seed listo: 1 árbol ficticio, 7 personas, 8 vínculos padre-hijo, 2 parejas, 11 eventos y 2 historias.");
    if (useDemoAccount) {
      console.log(`Cuenta demo: ${demo.email}`);
      console.log(demoPasswordWorks ? `Contraseña demo: ${demo.password}` : "La contraseña demo se cambió; inicia sesión con la contraseña actual.");
    }
    console.log("Puedes repetir el comando: no duplica registros ni sobrescribe cambios existentes.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "No se pudo ejecutar el seed.");
  process.exitCode = 1;
});
