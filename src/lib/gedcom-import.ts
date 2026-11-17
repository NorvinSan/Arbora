import { isValidHistoricalDate, type DateQualifier } from "@/lib/historical-date";

export const MAX_GEDCOM_BYTES = 5 * 1024 * 1024;
export const MAX_GEDCOM_PEOPLE = 5000;
const MAX_RECORDS = 10000;
const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
type DateParts = { year: number | null; month: number | null; day: number | null; qualifier: DateQualifier | null };
const emptyDate = (): DateParts => ({ year: null, month: null, day: null, qualifier: null });
export type ImportedPerson = { id: string; displayName: string; givenName: string | null; familyName: string | null; biography: string | null; lifeStatus: "unknown" | "deceased"; events: ImportedEvent[] };
export type ImportedEvent = { type: "birth" | "death" | "marriage" | "move" | "education" | "work" | "other"; title: string; place: string | null; description: string | null } & DateParts;
export type ImportedParent = { parentId: string; childId: string; relationType: "biological" | "adoptive" | "other" };
export type ImportedPartner = { personAId: string; personBId: string; kind: "marriage" | "union" | "partnership"; start: DateParts; end: DateParts; notes: string | null };
export type GedcomImport = { people: ImportedPerson[]; parents: ImportedParent[]; partners: ImportedPartner[]; warnings: string[]; errors: string[]; counts: { people: number; relations: number; events: number } };
type Node = { level: number; tag: string; value: string; id?: string; children: Node[] };
const child = (node: Node, tag: string) => node.children.find((entry) => entry.tag === tag);
const children = (node: Node, tag: string) => node.children.filter((entry) => entry.tag === tag);
const value = (node: Node, tag: string) => child(node, tag)?.value.trim() ?? "";
const unescape = (text: string) => text.replace(/^@@/, "@");
function text(node: Node | undefined): string {
  if (!node) return "";
  let result = unescape(node.value);
  for (const line of node.children) {
    if (line.tag === "CONT") result += `\n${unescape(line.value)}`;
    if (line.tag === "CONC") result += unescape(line.value);
  }
  return result.trim();
}

function parseDate(raw: string, warnings: string[], context: string): DateParts {
  if (!raw) return emptyDate();
  const match = /^(?:(ABT|BEF|AFT) )?(?:(\d{1,2}) )?(?:(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC) )?(\d{1,4})$/.exec(raw);
  if (!match) { warnings.push(`${context}: fecha no compatible (${raw.slice(0, 80)}); se omite.`); return emptyDate(); }
  const year = Number(match[4]);
  const month = match[3] ? months.indexOf(match[3]) + 1 : null;
  const day = match[2] ? Number(match[2]) : null;
  if ((day !== null && month === null) || !isValidHistoricalDate([String(year).padStart(4, "0"), month && String(month).padStart(2, "0"), day && String(day).padStart(2, "0")].filter(Boolean).join("-"))) {
    throw new Error(`${context}: fecha inválida (${raw}).`);
  }
  return { year, month, day, qualifier: ({ ABT: "approximate", BEF: "before", AFT: "after" } as const)[match[1] as "ABT" | "BEF" | "AFT"] ?? "exact" };
}

function eventDate(node: Node, warnings: string[], context: string) { return parseDate(value(node, "DATE"), warnings, context); }
function dateOrder(first: DateParts, last: DateParts) {
  return first.year !== null && last.year !== null &&
    (first.year > last.year || (first.year === last.year &&
      ((first.month ?? 1) > (last.month ?? 12) ||
        ((first.month ?? 1) === (last.month ?? 12) && (first.day ?? 1) > (last.day ?? 31)))));
}

export function parseGedcom(content: string): GedcomImport {
  const warnings: string[] = [], errors: string[] = [];
  const result: GedcomImport = { people: [], parents: [], partners: [], warnings, errors, counts: { people: 0, relations: 0, events: 0 } };
  const lines = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  const roots: Node[] = [], stack: Node[] = [];
  if (lines.length > 200000) throw new Error("El archivo supera el límite de líneas.");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line && i === lines.length - 1) continue;
    const match = /^(\d{1,2}) (?:(@[^@\s]+@) )?([A-Z][A-Z0-9_]*)(?: (.*))?$/.exec(line);
    if (!match || Number(match[1]) > 20) throw new Error(`Formato GEDCOM inválido en la línea ${i + 1}.`);
    const level = Number(match[1]);
    if (level > stack.length || (level === 0 && match[2] && !/^(INDI|FAM|SOUR|NOTE|OBJE|REPO|SUBM)$/.test(match[3]))) throw new Error(`Estructura GEDCOM inválida en la línea ${i + 1}.`);
    const node: Node = { level, id: match[2], tag: match[3], value: match[4] ?? "", children: [] };
    if (level === 0) {
      if (roots.length >= MAX_RECORDS) throw new Error("El archivo supera el límite de registros (10 000).");
      roots.push(node);
    } else stack[level - 1].children.push(node);
    stack.length = level; stack.push(node);
  }
  if (roots[0]?.tag !== "HEAD" || roots.at(-1)?.tag !== "TRLR" || roots.filter((r) => r.tag === "HEAD" || r.tag === "TRLR").length !== 2 ||
    value(child(roots[0], "GEDC") ?? roots[0], "VERS") !== "7.0") throw new Error("Se requiere un archivo GEDCOM 7.0 con cabecera y cierre válidos.");
  const individuals = roots.filter((r) => r.tag === "INDI"), families = roots.filter((r) => r.tag === "FAM");
  if (individuals.length > MAX_GEDCOM_PEOPLE) throw new Error("El archivo supera el límite de 5 000 personas.");
  if (!individuals.length) errors.push("El archivo no contiene personas para importar.");
  const ids = new Set<string>();
  for (const record of roots.filter((r) => r.id)) {
    if (ids.has(record.id!)) errors.push(`Identificador GEDCOM duplicado: ${record.id}.`);
    ids.add(record.id!);
  }
  const peopleIds = new Set(individuals.map((r) => r.id));
  const familyIds = new Set(families.map((r) => r.id));
  for (const record of [...individuals, ...families]) if (!record.id) errors.push(`Registro ${record.tag} sin identificador.`);
  if (individuals.some((record) => !record.id) || families.some((record) => !record.id)) return result;
  const eventTitles: Record<string, string> = {
    BIRT: "Nacimiento", DEAT: "Fallecimiento", MARR: "Matrimonio", RESI: "Residencia", EDUC: "Educación", OCCU: "Trabajo",
    BAPM: "Bautismo", CHR: "Bautizo", BURI: "Sepultura", CREM: "Cremación", CENS: "Censo",
    GRAD: "Graduación", RETI: "Jubilación", IMMI: "Inmigración", EMIG: "Emigración", NATU: "Naturalización",
    EVEN: "Acontecimiento",
  };
  const unsupported = new Set<string>();
  for (const record of [...individuals, ...families]) for (const tag of record.children) {
    if (!(record.tag === "INDI" ? ["NAME", "NOTE", "FAMC", "FAMS", "UID", ...Object.keys(eventTitles)] : ["HUSB", "WIFE", "CHIL", "MARR", "EVEN", "DIV", "NOTE"]).includes(tag.tag)) unsupported.add(tag.tag);
  }
  if (unsupported.size) warnings.push(`Datos no compatibles omitidos: ${[...unsupported].sort().join(", ")}.`);
  const famc = new Map<string, Map<string, ImportedParent["relationType"]>>();
  for (const record of individuals) {
    for (const link of children(record, "FAMC")) {
      if (!familyIds.has(link.value)) errors.push(`${record.id}: familia inexistente ${link.value}.`);
      const pedi = value(link, "PEDI").toUpperCase();
      if (pedi && !["BIRTH", "ADOPTED", "OTHER"].includes(pedi)) warnings.push(`${record.id}: parentesco ${pedi} no compatible; se registra como otro.`);
      const type = pedi === "ADOPTED" ? "adoptive" : pedi && pedi !== "BIRTH" ? "other" : "biological";
      const kinds = famc.get(record.id!) ?? new Map();
      kinds.set(link.value, type); famc.set(record.id!, kinds);
    }
    for (const link of children(record, "FAMS")) if (!familyIds.has(link.value)) errors.push(`${record.id}: familia inexistente ${link.value}.`);
    const name = child(record, "NAME");
    const raw = text(name);
    const surname = text(child(name ?? record, "SURN")) || (raw.match(/\/([^/]*)\//)?.[1] ?? "").trim();
    const given = text(child(name ?? record, "GIVN")) || raw.replace(/\/[^/]*\//g, " ").replace(/\s+/g, " ").trim();
    const displayName = [given, surname].filter(Boolean).join(" ").trim() || raw.replaceAll("/", "").trim();
    if (!displayName) { warnings.push(`${record.id}: nombre ausente; se utilizará el identificador GEDCOM.`); }
    const person: ImportedPerson = { id: record.id!, displayName: displayName || record.id!, givenName: given || null, familyName: surname || null, biography: children(record, "NOTE").map(text).filter(Boolean).join("\n\n") || null, lifeStatus: "unknown", events: [] };
    const eventTypes: Partial<Record<string, ImportedEvent["type"]>> = { BIRT: "birth", DEAT: "death", MARR: "marriage", RESI: "move", EDUC: "education", OCCU: "work" };
    for (const item of record.children.filter((node) => node.tag in eventTitles)) {
      const type = eventTypes[item.tag] ?? "other";
      if ((type === "birth" || type === "death") && person.events.some((event) => event.type === type)) { errors.push(`${record.id}: múltiples acontecimientos de ${type === "birth" ? "nacimiento" : "fallecimiento"}.`); continue; }
      const title = text(child(item, "TYPE")) || (item.tag === "EVEN" ? text(item) : "") || eventTitles[item.tag];
      person.events.push({ type, title, ...eventDate(item, warnings, `${record.id} ${item.tag}`), place: text(child(item, "PLAC")) || null, description: text(child(item, "NOTE")) || null });
      if (type === "death") person.lifeStatus = "deceased";
    }
    const birth = person.events.find((event) => event.type === "birth"), death = person.events.find((event) => event.type === "death");
    if (birth && death && dateOrder(birth, death)) errors.push(`${record.id}: fallecimiento anterior al nacimiento.`);
    result.people.push(person);
  }
  const links = new Set<string>(), couples = new Set<string>();
  for (const family of families) {
    if (children(family, "HUSB").length > 1 || children(family, "WIFE").length > 1) errors.push(`${family.id}: múltiples personas en un mismo puesto de pareja.`);
    const adults = [value(family, "HUSB"), value(family, "WIFE")].filter(Boolean);
    if (new Set(adults).size !== adults.length) errors.push(`${family.id}: pareja formada por la misma persona.`);
    for (const id of adults) if (!peopleIds.has(id)) errors.push(`${family.id}: persona inexistente ${id}.`);
    for (const member of individuals) if (famc.get(member.id!)?.has(family.id!) && !children(family, "CHIL").some((node) => node.value === member.id)) warnings.push(`${family.id}: FAMC sin CHIL para ${member.id}; se recupera el parentesco.`);
    const declaredChildren = children(family, "CHIL").map((node) => node.value);
    if (new Set(declaredChildren).size !== declaredChildren.length) warnings.push(`${family.id}: hijo/a duplicado/a omitido/a.`);
    const childIds = new Set([...declaredChildren, ...[...famc].filter(([, refs]) => refs.has(family.id!)).map(([id]) => id)]);
    for (const id of childIds) {
      if (!peopleIds.has(id)) { errors.push(`${family.id}: hijo/a inexistente ${id}.`); continue; }
      if (!famc.get(id)?.has(family.id!)) warnings.push(`${family.id}: parentesco de ${id} sin PEDI; se supone biológico.`);
      for (const adult of adults.filter((personId) => peopleIds.has(personId))) {
        if (adult === id) { errors.push(`${family.id}: una persona no puede ser su propio progenitor.`); continue; }
        const key = `${adult}:${id}`;
        if (links.has(key)) { warnings.push(`${family.id}: parentesco duplicado ${key} omitido.`); continue; }
        links.add(key); result.parents.push({ parentId: adult, childId: id, relationType: famc.get(id)?.get(family.id!) ?? "biological" });
      }
    }
    const startEvent = child(family, "MARR") ?? children(family, "EVEN").find((node) => /^(Unión|Relación de pareja)$/i.test(value(node, "TYPE") || node.value));
    const endEvent = children(family, "EVEN").find((node) => /^Fin de relación/i.test(value(node, "TYPE") || node.value));
    if (child(family, "DIV")) warnings.push(`${family.id}: divorcio no importado como motivo de fin de relación.`);
    if (adults.length === 2 && adults[0] !== adults[1]) {
      const kind = !startEvent ? "partnership" : startEvent.tag === "MARR" ? "marriage" : /^Unión$/i.test(value(startEvent, "TYPE") || startEvent.value) ? "union" : "partnership";
      const start = startEvent ? eventDate(startEvent, warnings, `${family.id} pareja`) : emptyDate(), end = endEvent ? eventDate(endEvent, warnings, `${family.id} fin`) : emptyDate();
      if (dateOrder(start, end)) errors.push(`${family.id}: fin de pareja anterior al inicio.`);
      const [personAId, personBId] = adults.sort();
      const key = `${personAId}:${personBId}:${kind}:${start.year}:${start.month}:${start.day}`;
      if (couples.has(key)) warnings.push(`${family.id}: pareja duplicada omitida.`);
      else { couples.add(key); result.partners.push({ personAId, personBId, kind, start, end, notes: [text(startEvent && child(startEvent, "NOTE")), text(child(family, "NOTE"))].filter(Boolean).join("\n\n") || null }); }
    } else if (startEvent) warnings.push(`${family.id}: pareja incompleta; no se importa la relación de pareja.`);
  }
  const descendants = new Map<string, string[]>();
  for (const link of result.parents) descendants.set(link.parentId, [...(descendants.get(link.parentId) ?? []), link.childId]);
  const visited = new Set<string>(), active = new Set<string>();
  function visit(id: string): boolean {
    if (active.has(id)) return true;
    if (visited.has(id)) return false;
    active.add(id);
    for (const descendant of descendants.get(id) ?? []) if (visit(descendant)) return true;
    active.delete(id); visited.add(id); return false;
  }
  if (result.people.some((person) => visit(person.id))) errors.push("El archivo contiene un ciclo genealógico.");
  result.counts = { people: result.people.length, relations: result.parents.length + result.partners.length, events: result.people.reduce((sum, person) => sum + person.events.length, 0) };
  return result;
}

export async function readGedcomFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".ged")) throw new Error("Selecciona un archivo con extensión .ged.");
  if (file.size === 0 || file.size > MAX_GEDCOM_BYTES) throw new Error("El archivo debe tener entre 1 byte y 5 MB.");
  let content: string;
  try { content = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()); }
  catch { throw new Error("El archivo debe estar codificado en UTF-8 válido."); }
  if (content.includes("\0")) throw new Error("El archivo contiene caracteres no válidos.");
  return parseGedcom(content);
}
