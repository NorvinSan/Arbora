import type { parentChild, partnership, person, personEvent } from "@/db/app-schema";

// FamilySearch GEDCOM 7.0: https://gedcom.io/specifications/FamilySearchGEDCOMv7.html
type Member = typeof person.$inferSelect;
type Link = typeof parentChild.$inferSelect;
type Couple = typeof partnership.$inferSelect;
type Event = typeof personEvent.$inferSelect;
type DateParts = { year: number | null; month: number | null; day: number | null; qualifier: string | null };
export type GedcomData = {
  treeId: string;
  people: Member[];
  parents: Link[];
  partners: Couple[];
  events: Event[];
  storyCount: number;
  mediaCount: number;
};

const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const clean = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\ud800-\udfff\ufffe\uffff]/g, "");
const namePart = (value: string) => clean(value).replace(/\s+/g, " ").trim().replaceAll("/", " ");
const text = (value: string) => {
  const safe = clean(value).replace(/\r\n?|\n/g, "\n");
  return safe.startsWith("@") ? `@${safe}` : safe;
};

function date({ year, month, day, qualifier }: DateParts) {
  if (year === null) return null;
  if (!Number.isInteger(year) || year < 1 || year > 9999 || (month !== null && (!Number.isInteger(month) || month < 1 || month > 12)) ||
    (day !== null && (month === null || !Number.isInteger(day) || day < 1 || day > 31))) throw new Error("Fecha histórica inválida.");
  const parts = [day === null ? null : String(day), month === null ? null : months[month - 1], String(year)].filter(Boolean).join(" ");
  const prefix: Record<string, string> = { exact: "", approximate: "ABT ", before: "BEF ", after: "AFT " };
  if (!qualifier || !(qualifier in prefix)) throw new Error("Calificador de fecha inválido.");
  return prefix[qualifier] + parts;
}

function write(lines: string[], level: number, tag: string, value?: string | null) {
  if (value === undefined || value === null || value === "") { lines.push(`${level} ${tag}`); return; }
  const [first, ...rest] = text(value).split("\n");
  lines.push(`${level} ${tag}${first ? ` ${first}` : ""}`);
  for (const continuation of rest) lines.push(`${level + 1} CONT${continuation ? ` ${continuation.startsWith("@") ? "@" : ""}${continuation}` : ""}`);
}

function pointer(lines: string[], level: number, tag: string, id: string | undefined) {
  if (!id) throw new Error("Referencia GEDCOM sin identificador.");
  lines.push(`${level} ${tag} ${id}`);
}

type Family = { id: string; adults: string[]; children: Map<string, Link[]>; partnership?: Couple };

export function generateGedcom(data: GedcomData): string {
  const people = new Map<string, Member>();
  for (const member of data.people) {
    if (member.treeId !== data.treeId || people.has(member.id)) throw new Error("Personas duplicadas o ajenas al árbol.");
    people.set(member.id, member);
  }
  const check = (treeId: string, ...ids: string[]) => {
    if (treeId !== data.treeId || ids.some((id) => !people.has(id))) throw new Error("Referencia ajena al árbol seleccionado.");
  };
  const ordered = [...people.values()].sort((a, b) => a.id.localeCompare(b.id));
  const ids = new Map(ordered.map((member, index) => [member.id, `@I${index + 1}@`]));
  const families: Family[] = [];
  const pairFamilies = new Map<string, Family[]>();
  const uniquePartnerships = new Set<string>();
  for (const couple of [...data.partners].sort((a, b) => a.id.localeCompare(b.id))) {
    check(couple.treeId, couple.personAId, couple.personBId);
    if (couple.personAId === couple.personBId || uniquePartnerships.has(couple.id)) throw new Error("Pareja duplicada o inválida.");
    uniquePartnerships.add(couple.id);
    const adults = [couple.personAId, couple.personBId].sort();
    const family: Family = { id: `@F${families.length + 1}@`, adults, children: new Map(), partnership: couple };
    families.push(family);
    const key = adults.join(":");
    pairFamilies.set(key, [...(pairFamilies.get(key) ?? []), family]);
  }

  const linksByChild = new Map<string, Link[]>();
  const uniqueLinks = new Set<string>();
  for (const link of data.parents) {
    check(link.treeId, link.parentId, link.childId);
    if (link.parentId === link.childId) throw new Error("Parentesco inválido.");
    const key = `${link.parentId}:${link.childId}`;
    if (uniqueLinks.has(key)) throw new Error("Parentesco duplicado.");
    uniqueLinks.add(key);
    linksByChild.set(link.childId, [...(linksByChild.get(link.childId) ?? []), link]);
  }
  const standalone = new Map<string, Family>();
  const childFamilies = new Map<string, { family: Family; links: Link[] }[]>();
  for (const child of ordered) {
    const byType = new Map<Link["relationType"], Link[]>();
    for (const link of linksByChild.get(child.id) ?? []) byType.set(link.relationType, [...(byType.get(link.relationType) ?? []), link]);
    for (const [kind, links] of [...byType].sort(([a], [b]) => a.localeCompare(b))) {
      const sorted = links.sort((a, b) => a.parentId.localeCompare(b.parentId));
      // GEDCOM FAM has at most two parent slots. More parents become several FAMC links.
      for (let i = 0; i < sorted.length; i += 2) {
        const group = sorted.slice(i, i + 2);
        const adults = group.map((link) => link.parentId);
        const key = `${kind}:${adults.join(":")}`;
        const matching = adults.length === 2 ? pairFamilies.get(adults.join(":")) : undefined;
        const family = matching?.length === 1 && !matching[0].children.has(child.id) ? matching[0] : (standalone.get(key) ?? (() => {
          const created: Family = { id: `@F${families.length + 1}@`, adults, children: new Map() };
          families.push(created); standalone.set(key, created); return created;
        })());
        family.children.set(child.id, group);
        childFamilies.set(child.id, [...(childFamilies.get(child.id) ?? []), { family, links: group }]);
      }
    }
  }

  const eventIds = new Set<string>();
  const byPerson = new Map<string, Event[]>();
  for (const event of data.events) {
    check(event.treeId, event.personId);
    if (eventIds.has(event.id)) throw new Error("Acontecimiento duplicado.");
    eventIds.add(event.id);
    byPerson.set(event.personId, [...(byPerson.get(event.personId) ?? []), event]);
  }
  const lines = ["0 HEAD", "1 GEDC", "2 VERS 7.0", "1 SOUR Arbora", "2 NAME Arbora"];
  const limitations = ["Exportación GEDCOM 7.0: las parejas sin matrimonio se representan como eventos familiares; el fin de una relación no implica divorcio."];
  if (data.storyCount) limitations.push(`${data.storyCount} historias familiares no incluidas.`);
  if (data.mediaCount) limitations.push(`${data.mediaCount} fotografías o documentos no incluidos (el archivo .ged no empaqueta archivos adjuntos).`);
  if (data.parents.some((link) => link.relationType === "other")) limitations.push("El parentesco 'otro' usa PEDI OTHER; su significado específico no se puede codificar.");
  write(lines, 1, "NOTE", limitations.join("\n"));

  for (const member of ordered) {
    lines.push(`0 ${ids.get(member.id)} INDI`);
    write(lines, 1, "UID", member.id);
    const given = member.givenName?.trim() ?? "";
    const surname = member.familyName?.trim() ?? "";
    const full = [given, surname].filter(Boolean).join(" ");
    const personal = full ? `${namePart(given)}${given ? " " : ""}/${namePart(surname)}/` : namePart(member.displayName);
    write(lines, 1, "NAME", personal);
    if (given) write(lines, 2, "GIVN", namePart(given));
    if (surname) write(lines, 2, "SURN", namePart(surname));
    if (full && member.displayName !== full) write(lines, 1, "NOTE", `Nombre mostrado en Arbora: ${member.displayName}`);
    if ([member.givenName, member.familyName, member.displayName].some((name) => name && name !== namePart(name))) write(lines, 1, "NOTE", `Nombre original en Arbora (normalizado para GEDCOM): ${member.displayName}; ${given}; ${surname}`);
    if (member.preferredName) write(lines, 1, "NOTE", `Nombre preferido en Arbora: ${member.preferredName}`);
    if (member.biography) write(lines, 1, "NOTE", member.biography);
    if (member.whereaboutsStatus !== "unknown") write(lines, 1, "NOTE", `Paradero en Arbora: ${member.whereaboutsStatus}`);
    if (member.lifeStatus === "living") write(lines, 1, "NOTE", "Estado vital en Arbora: vivo/a (GEDCOM no dispone de un estado vital equivalente).");
    const events = byPerson.get(member.id) ?? [];
    for (const event of events) {
      const tag = event.type === "birth" ? "BIRT" : event.type === "death" ? "DEAT" : "EVEN";
      const when = date(event);
      write(lines, 1, tag, tag === "EVEN" ? event.title : !when && !event.place ? "Y" : undefined);
      if (tag === "EVEN") {
        write(lines, 2, "TYPE", event.type === "marriage" ? "Matrimonio (pareja no especificada)" : event.title);
        write(lines, 2, "NOTE", `Tipo original en Arbora: ${event.type}`);
      } else if (event.title !== (event.type === "birth" ? "Nacimiento" : "Fallecimiento")) write(lines, 2, "TYPE", event.title);
      if (when) write(lines, 2, "DATE", when);
      if (event.place) write(lines, 2, "PLAC", event.place);
      if (event.description) write(lines, 2, "NOTE", event.description);
    }
    if (member.lifeStatus === "deceased" && !events.some((event) => event.type === "death")) lines.push("1 DEAT Y");
    for (const { family, links } of childFamilies.get(member.id) ?? []) {
      pointer(lines, 1, "FAMC", family.id);
      write(lines, 2, "PEDI", { biological: "BIRTH", adoptive: "ADOPTED", other: "OTHER" }[links[0].relationType]);
      for (const link of links) if (link.notes) write(lines, 2, "NOTE", `Parentesco con ${people.get(link.parentId)?.displayName}: ${link.notes}`);
    }
    for (const family of families) if (family.adults.includes(member.id)) pointer(lines, 1, "FAMS", family.id);
  }

  for (const family of families) {
    lines.push(`0 ${family.id} FAM`);
    // HUSB/WIFE are gender-neutral partner slots in GEDCOM 7.0.
    if (family.adults[0]) pointer(lines, 1, "HUSB", ids.get(family.adults[0]));
    if (family.adults[1]) pointer(lines, 1, "WIFE", ids.get(family.adults[1]));
    for (const childId of family.children.keys()) pointer(lines, 1, "CHIL", ids.get(childId));
    if (family.partnership) {
      const couple = family.partnership;
      const tag = couple.kind === "marriage" ? "MARR" : "EVEN";
      write(lines, 1, tag, couple.kind === "marriage" ? (!couple.startYear ? "Y" : undefined) : (couple.kind === "union" ? "Unión" : "Relación de pareja"));
      if (tag === "EVEN") write(lines, 2, "TYPE", couple.kind === "union" ? "Unión" : "Relación de pareja");
      const start = date({ year: couple.startYear, month: couple.startMonth, day: couple.startDay, qualifier: couple.startQualifier });
      if (start) write(lines, 2, "DATE", start);
      if (couple.notes) write(lines, 2, "NOTE", couple.notes);
      if (couple.endYear) {
        write(lines, 1, "EVEN", "Fin de relación");
        write(lines, 2, "TYPE", "Fin de relación (motivo desconocido)");
        write(lines, 2, "DATE", date({ year: couple.endYear, month: couple.endMonth, day: couple.endDay, qualifier: couple.endQualifier }));
      }
    }
  }
  lines.push("0 TRLR");
  return `\uFEFF${lines.join("\n")}\n`;
}
