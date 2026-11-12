import { createHash } from "node:crypto";
import { config } from "dotenv";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  familyStory,
  familyTree,
  parentChild,
  partnership,
  person,
  personEvent,
  storyPerson,
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
      { id: peopleIds.elena, treeId, displayName: "Elena Rivera", givenName: "Elena", familyName: "Rivera", lifeStatus: "deceased", whereaboutsStatus: "known", biography: [
        "Elena nació alrededor de 1936. Le gustaba escribir cartas a mano y guardar fotografías con el nombre de cada persona anotado al dorso. Con Marcos formó una familia en 1959 y, cuando nació Lucía, empezó a reunir en una caja los pequeños recuerdos de cada etapa de su vida.",
        "En las reuniones familiares era quien recordaba las anécdotas que los demás habían olvidado. Falleció en 2018; sus cartas siguen ayudando a Lucía y a sus nietos a reconstruir la historia de la familia.",
      ].join("\n\n") },
      { id: peopleIds.marcos, treeId, displayName: "Marcos Vidal", givenName: "Marcos", familyName: "Vidal", lifeStatus: "deceased", whereaboutsStatus: "known", biography: [
        "Marcos nació alrededor de 1934. Era paciente con los trabajos manuales: reparaba objetos de la casa y enseñaba a Lucía a arreglar lo que parecía perdido. Se casó con Elena en 1959 y compartió con ella la costumbre de recibir a familiares y amigos alrededor de la mesa.",
        "No solía escribir sobre sí mismo, pero aparece en muchas de las fotografías y cartas que Elena conservó. Falleció en 2004; Lucía recuerda especialmente sus conversaciones mientras trabajaban juntos.",
      ].join("\n\n") },
      { id: peopleIds.lucia, treeId, displayName: "Lucía Vidal Rivera", givenName: "Lucía", familyName: "Vidal Rivera", lifeStatus: "living", whereaboutsStatus: "known", biography: [
        "Lucía nació en 1963, hija de Elena y Marcos. Creció escuchando historias de generaciones anteriores y aprendió a distinguir, entre las cartas de su madre, las fechas seguras de los recuerdos aproximados. Esa curiosidad la llevó a poner nombres a fotografías que durante años habían quedado sin identificar.",
        "Desde finales de los años ochenta comparte su vida con Daniel. Juntos acompañaron a Sofía, Gabriel y Tomás durante su infancia; Tomás forma parte de la familia por adopción. Hoy Lucía continúa ordenando el archivo familiar y procura que cada recuerdo conserve también la voz de quien lo contó.",
      ].join("\n\n") },
      { id: peopleIds.daniel, treeId, displayName: "Daniel Mora", givenName: "Daniel", familyName: "Mora", lifeStatus: "living", whereaboutsStatus: "known", biography: [
        "Daniel nació en 1961. Disfruta preparando comidas para la familia y es de los que prefieren escuchar antes de contar una historia. Conoció a Lucía antes de que comenzaran su vida en común, aproximadamente en 1987, y encontró en su familia una tradición de conservar recuerdos que hizo suya.",
        "Es padre de Sofía y Gabriel y padre adoptivo de Tomás. Con Lucía ha intentado dejar espacio para que cada uno construya su propia historia. Desde que faltan noticias de Gabriel, ayuda a mantener reunidas las fechas confirmadas y los testimonios sin convertir las dudas en certezas.",
      ].join("\n\n") },
      { id: peopleIds.sofia, treeId, displayName: "Sofía Mora Vidal", givenName: "Sofía", familyName: "Mora Vidal", lifeStatus: "living", whereaboutsStatus: "known", biography: [
        "Sofía nació el 12 de abril de 1992. De pequeña pedía a Elena que le enseñara las fotografías antiguas y quería saber quién había escrito cada carta. Esa curiosidad se convirtió en el hábito de preguntar a sus familiares cómo recuerdan un mismo acontecimiento, incluso cuando sus versiones no coinciden.",
        "Es hermana de Gabriel y Tomás. Junto a Lucía está organizando las historias que aún pueden contar las personas mayores de la familia, con cuidado de separar los hechos documentados de las anécdotas transmitidas de palabra.",
      ].join("\n\n") },
      { id: peopleIds.gabriel, treeId, displayName: "Gabriel Mora Vidal", givenName: "Gabriel", familyName: "Mora Vidal", lifeStatus: "unknown", whereaboutsStatus: "missing", biography: [
        "Gabriel nació en 1995, hijo de Lucía y Daniel y hermano de Sofía y Tomás. En los recuerdos de la familia aparece como alguien que prefería los paseos largos a las reuniones numerosas. Elena guardó también algunas de las notas que él le dejó cuando era pequeño.",
        "La última noticia que conserva la familia se sitúa aproximadamente en junio de 2018, en Valle Claro. Desde 2019 su paradero se considera desconocido. No hay constancia de su fallecimiento: la familia mantiene separadas las fechas aproximadas, los recuerdos personales y aquello que todavía no se sabe.",
      ].join("\n\n") },
      { id: peopleIds.tomas, treeId, displayName: "Tomás Mora Vidal", givenName: "Tomás", familyName: "Mora Vidal", lifeStatus: "living", whereaboutsStatus: "known", biography: [
        "Tomás nació alrededor del año 2000 y forma parte de la familia de Lucía y Daniel por adopción. Creció junto a Sofía y Gabriel, con quienes compartió las sobremesas en las que Elena sacaba su caja de fotografías. Le gusta escuchar esas historias, aunque suele preguntar también por las personas que no aparecen en las imágenes.",
        "Al revisar el árbol familiar, Tomás ayuda a distinguir los vínculos adoptivos sin reducirlos a una nota al margen: son parte de su historia y de la de sus hermanos. Algunas fechas de sus primeros años son aproximadas, y la familia prefiere dejarlas así antes que inventar detalles.",
      ].join("\n\n") },
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
      title?: string,
    ): EventInsert => ({ id: id(`event:${key}`), treeId, personId: peopleIds[personKey], type, title: title ?? ({ birth: "Nacimiento", death: "Fallecimiento", last_contact: "Último contacto", disappearance: "Desaparición" } as Record<string, string>)[type] ?? "Acontecimiento", ...details });

    const events = [
      event("elena-birth", "elena", "birth", { year: 1936, qualifier: "approximate" }),
      event("elena-marriage", "elena", "marriage", { year: 1959, qualifier: "exact", description: "Elena y Marcos celebraron su matrimonio y comenzaron a reunir fotografías de la nueva familia." }, "Matrimonio con Marcos"),
      event("elena-lucia", "elena", "other", { year: 1963, qualifier: "exact", description: "Nació Lucía. Elena empezó a guardar cartas y recuerdos para que su hija pudiera conocer las historias familiares." }, "Nacimiento de Lucía"),
      event("elena-sewing", "elena", "work", { year: 1970, qualifier: "approximate", description: "Comenzó a realizar encargos de costura. Entre telas y patrones encontraba tiempo para escribir a los familiares que vivían lejos." }, "Encargos de costura"),
      event("elena-photos", "elena", "other", { year: 1996, qualifier: "approximate", description: "Organizó una caja de fotografías y anotó detrás de cada imagen los nombres que conocía. Años después, Sofía le pediría que le contara esas historias." }, "El archivo de fotografías"),
      event("elena-death", "elena", "death", { year: 2018, qualifier: "exact" }),
      event("marcos-birth", "marcos", "birth", { year: 1934, qualifier: "approximate" }),
      event("marcos-work", "marcos", "work", { year: 1954, qualifier: "approximate", description: "Aprendió a reparar muebles y objetos cotidianos. Con el tiempo transmitiría a Lucía su paciencia para arreglar lo que parecía perdido." }, "Primeros trabajos de reparación"),
      event("marcos-marriage", "marcos", "marriage", { year: 1959, qualifier: "exact", description: "Se casó con Elena. Las reuniones en casa se convirtieron en una tradición para familiares y amigos." }, "Matrimonio con Elena"),
      event("marcos-lucia", "marcos", "other", { year: 1963, qualifier: "exact", description: "Nació su hija Lucía, con quien años después compartiría conversaciones mientras trabajaban juntos en casa." }, "Nacimiento de Lucía"),
      event("marcos-death", "marcos", "death", { year: 2004, qualifier: "exact" }),
      event("lucia-birth", "lucia", "birth", { year: 1963, qualifier: "exact" }),
      event("lucia-education", "lucia", "education", { year: 1982, qualifier: "approximate", description: "Terminó sus estudios y comenzó a interesarse por conservar los testimonios de las personas mayores de la familia." }, "Fin de sus estudios"),
      event("lucia-daniel", "lucia", "other", { year: 1987, qualifier: "approximate", description: "Lucía y Daniel comenzaron a compartir su vida. La fecha se conserva como aproximada porque sus recuerdos no coinciden del todo." }, "Vida en común con Daniel"),
      event("lucia-sofia", "lucia", "other", { year: 1992, month: 4, day: 12, qualifier: "exact", description: "Nació Sofía. Elena comenzó a guardar nuevas fotografías junto a las cartas de generaciones anteriores." }, "Nacimiento de Sofía"),
      event("lucia-tomas", "lucia", "other", { year: 2005, qualifier: "approximate", description: "Tomás se incorporó a la familia por adopción. Lucía y Daniel conservan la fecha como aproximada para no atribuir exactitud a un recuerdo." }, "Adopción de Tomás"),
      event("lucia-archive", "lucia", "other", { year: 2020, qualifier: "approximate", description: "Comenzó a ordenar las cartas de Elena y a separar las fechas documentadas de las historias transmitidas de palabra." }, "Organización del archivo familiar"),
      event("daniel-birth", "daniel", "birth", { year: 1961, qualifier: "exact" }),
      event("daniel-work", "daniel", "work", { year: 1984, qualifier: "approximate", description: "Empezó un trabajo estable y aprendió a compaginar los horarios con su afición por cocinar para familiares y amigos." }, "Primer empleo estable"),
      event("daniel-lucia", "daniel", "other", { year: 1987, qualifier: "approximate", description: "Daniel y Lucía iniciaron su vida en común. Sus recuerdos sitúan esta etapa a finales de los años ochenta." }, "Vida en común con Lucía"),
      event("daniel-sofia", "daniel", "other", { year: 1992, month: 4, day: 12, qualifier: "exact", description: "Nació Sofía, su primera hija. Daniel recuerda las sobremesas familiares en las que Elena enseñaba las fotos antiguas." }, "Nacimiento de Sofía"),
      event("daniel-tomas", "daniel", "other", { year: 2005, qualifier: "approximate", description: "Daniel y Lucía adoptaron a Tomás. Su vínculo con él forma parte de la historia familiar igual que los demás parentescos." }, "Adopción de Tomás"),
      event("sofia-birth", "sofia", "birth", { year: 1992, month: 4, day: 12, qualifier: "exact" }),
      event("sofia-education", "sofia", "education", { year: 2010, qualifier: "approximate", description: "Terminó la enseñanza secundaria. Ya preguntaba a Elena por los nombres escritos detrás de las fotografías familiares." }, "Fin de la enseñanza secundaria"),
      event("sofia-letters", "sofia", "other", { year: 2018, qualifier: "approximate", description: "Tras el fallecimiento de Elena, Sofía y Lucía revisaron sus cartas y empezaron a identificar a las personas mencionadas en ellas." }, "Las cartas de Elena"),
      event("sofia-catalog", "sofia", "work", { year: 2021, qualifier: "approximate", description: "Comenzó a catalogar fotografías y documentos. Anotó cuándo una fecha procedía de una carta y cuándo de un recuerdo oral." }, "Catalogación del archivo familiar"),
      event("sofia-interviews", "sofia", "other", { year: 2024, qualifier: "approximate", description: "Entrevistó a familiares de distintas generaciones para conservar sus versiones de las mismas historias sin borrar las diferencias." }, "Conversaciones entre generaciones"),
      event("gabriel-birth", "gabriel", "birth", { year: 1995, qualifier: "exact" }),
      event("gabriel-education", "gabriel", "education", { year: 2013, qualifier: "approximate", description: "Terminó sus estudios secundarios. Su familia recuerda que prefería los paseos largos a las reuniones numerosas." }, "Fin de la enseñanza secundaria"),
      event("gabriel-move", "gabriel", "move", { year: 2017, qualifier: "approximate", place: "Valle Claro", description: "Se trasladó a Valle Claro. La fecha procede de recuerdos familiares y no de un documento conservado." }, "Traslado a Valle Claro"),
      event("gabriel-last-contact", "gabriel", "last_contact", { year: 2018, month: 6, qualifier: "approximate", place: "Valle Claro", description: "Última noticia recibida por la familia." }),
      event("gabriel-disappearance", "gabriel", "disappearance", { year: 2019, qualifier: "approximate", description: "Se desconoce su paradero; no hay constancia de fallecimiento." }),
      event("tomas-birth", "tomas", "birth", { year: 2000, qualifier: "approximate" }),
      event("tomas-adoption", "tomas", "other", { year: 2005, qualifier: "approximate", description: "Tomás pasó a formar parte de la familia de Lucía y Daniel por adopción y creció junto a Sofía y Gabriel." }, "Llegada a la familia por adopción"),
      event("tomas-education", "tomas", "education", { year: 2018, qualifier: "approximate", description: "Terminó la enseñanza secundaria. Durante esos años le gustaba preguntar por las personas ausentes de las fotografías de Elena." }, "Fin de la enseñanza secundaria"),
      event("tomas-photos", "tomas", "other", { year: 2023, qualifier: "approximate", description: "Ayudó a revisar el árbol familiar y a identificar los vínculos adoptivos como parte de la historia compartida, no como una nota al margen." }, "Revisión del árbol familiar"),
    ];

    await db.transaction(async (tx) => {
      await tx.insert(familyTree).values({
        id: treeId,
        ownerId: owner.id,
        name: "Árbol de demostración",
        description: "Familia ficticia de tres generaciones para desarrollo.",
      }).onConflictDoNothing();

      // Only replace untouched biographies from the original demo seed. Other
      // fields and biographies written by users stay intact on subsequent runs.
      for (const member of people) {
        await tx.insert(person).values(member).onConflictDoUpdate({
          target: person.id,
          set: { biography: member.biography },
          setWhere: sql`${person.treeId} = ${treeId} and (
            ${person.biography} is null or ${person.biography} in (
              'Guardaba las cartas y relatos de la familia.',
              'La familia no tiene noticias recientes sobre su paradero.'
            )
          )`,
        });
      }
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
        { id: id("story:gabriel"), treeId, authorId: owner.id, title: "Últimas noticias de Gabriel", body: "El paradero de Gabriel sigue sin confirmarse. La familia conserva las fechas como aproximadas." },
      ]).onConflictDoNothing();
      await tx.insert(storyPerson).values({ treeId, storyId: id("story:gabriel"), personId: peopleIds.gabriel }).onConflictDoNothing();
    });

    console.log(`Seed listo: 1 árbol ficticio, ${people.length} personas, ${links.length} vínculos padre-hijo, 2 parejas, ${events.length} eventos y 2 historias.`);
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
