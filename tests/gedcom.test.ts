import assert from "node:assert/strict";
import { test } from "node:test";
import { generateGedcom, type GedcomData } from "../src/lib/gedcom";

const treeId = "tree";
const person = (id: string, displayName = id, extra: Partial<GedcomData["people"][number]> = {}): GedcomData["people"][number] => ({
  id, treeId, displayName, givenName: null, familyName: null, preferredName: null, biography: null,
  lifeStatus: "unknown", whereaboutsStatus: "unknown", createdAt: new Date(), updatedAt: new Date(), ...extra,
});
const link = (parentId: string, childId: string, relationType: "biological" | "adoptive" | "other" = "biological"): GedcomData["parents"][number] =>
  ({ treeId, parentId, childId, relationType, notes: null, createdAt: new Date() });
const couple = (id: string, personAId: string, personBId: string, kind: "marriage" | "union" | "partnership" = "marriage"): GedcomData["partners"][number] => ({
  id, treeId, personAId, personBId, kind, startYear: null, startMonth: null, startDay: null, startQualifier: null,
  endYear: null, endMonth: null, endDay: null, endQualifier: null, notes: null, createdAt: new Date(),
});
const event = (id: string, personId: string, type: GedcomData["events"][number]["type"], year: number | null): GedcomData["events"][number] => ({
  id, treeId, personId, type, title: type === "birth" ? "Nacimiento" : "Fallecimiento", description: null, place: null,
  year, month: null, day: null, qualifier: year === null ? null : "exact", createdAt: new Date(), updatedAt: new Date(),
});
const input = (overrides: Partial<GedcomData> = {}): GedcomData => ({ treeId, people: [], parents: [], partners: [], events: [], storyCount: 0, mediaCount: 0, ...overrides });

test("three generations, multiple couples, adoption and reciprocal GEDCOM references", () => {
  const result = generateGedcom(input({
    people: [person("grand"), person("parent"), person("partner"), person("new-partner"), person("child"), person("adopted")],
    parents: [link("grand", "parent"), link("parent", "child"), link("partner", "child"), link("parent", "adopted", "adoptive"), link("new-partner", "adopted", "adoptive")],
    partners: [couple("m1", "parent", "partner"), couple("u1", "parent", "new-partner", "union")],
  }));
  assert.match(result, /^\uFEFF0 HEAD\n1 GEDC\n2 VERS 7\.0\n/);
  assert.ok(result.endsWith("0 TRLR\n"));
  const records = [...result.matchAll(/^0 (@[IF]\d+@) (INDI|FAM)$/gm)];
  assert.equal(records.filter(([, , kind]) => kind === "INDI").length, 6);
  assert.equal(new Set(records.map(([, id]) => id)).size, records.length);
  const ids = new Set(records.map(([, id]) => id));
  for (const [, id] of result.matchAll(/^[12] (?:FAMC|FAMS|HUSB|WIFE|CHIL) (@[IF]\d+@)$/gm)) assert.ok(ids.has(id), `Dangling ${id}`);
  assert.match(result, /1 FAMC @F\d+@\n2 PEDI ADOPTED/);
  assert.match(result, /1 MARR Y/);
  assert.match(result, /1 EVEN Unión\n2 TYPE Unión/);
  assert.equal([...result.matchAll(/^1 CHIL /gm)].length, 3);
  assert.equal([...result.matchAll(/^1 FAMS /gm)].length, 5);
});

test("year-only dates, missing dates, Unicode and escaped text survive without fabricated precision", () => {
  const result = generateGedcom(input({
    people: [person("one", "@Ána / Ñúñez", { givenName: "Ána", familyName: "Ñúñez", biography: "@Primera línea\nSegunda línea" }), person("two", "Sin fecha")],
    events: [event("birth", "one", "birth", 1890), event("death", "two", "death", null)],
    storyCount: 1, mediaCount: 2,
  }));
  assert.match(result, /1 NAME Ána \/Ñúñez\//);
  assert.match(result, /2 DATE 1890\n/);
  assert.doesNotMatch(result, /DATE (?:1 JAN|01 JAN) 1890/);
  assert.match(result, /1 DEAT Y/);
  assert.match(result, /1 NOTE @@Primera línea\n2 CONT Segunda línea/);
  assert.match(result, /historias familiares no incluidas/);
  assert.match(result, /fotografías o documentos no incluidos/);
  assert.doesNotMatch(result, /1 DATE (?:null|undefined)/);
});

test("unknown relation and ambiguous partnership do not invent a marriage or duplicate a child", () => {
  const result = generateGedcom(input({ people: [person("a"), person("b"), person("c")],
    parents: [link("a", "c", "other"), link("b", "c", "other")],
    partners: [couple("m1", "a", "b"), couple("m2", "a", "b")],
  }));
  assert.match(result, /2 PEDI OTHER/);
  assert.equal([...result.matchAll(/^1 CHIL /gm)].length, 1);
  assert.equal([...result.matchAll(/^1 MARR Y/gm)].length, 2);
  assert.equal([...result.matchAll(/^0 @F\d+@ FAM/gm)].length, 3);
});

test("partial date qualifiers and relationship endings retain their meaning", () => {
  const marriage = couple("m", "a", "b");
  marriage.startYear = 1902; marriage.startQualifier = "approximate";
  marriage.endYear = 1915; marriage.endQualifier = "before";
  const birth = event("b", "a", "birth", 1880);
  birth.qualifier = "after";
  const result = generateGedcom(input({ people: [person("a"), person("b")], partners: [marriage], events: [birth] }));
  assert.match(result, /2 DATE AFT 1880/);
  assert.match(result, /1 MARR\n2 DATE ABT 1902/);
  assert.match(result, /2 TYPE Fin de relación \(motivo desconocido\)\n2 DATE BEF 1915/);
  assert.doesNotMatch(result, /1 DIV\b/);
});

test("reject foreign, duplicate and broken relations before producing a file", () => {
  const people = [person("a"), person("b")];
  assert.throws(() => generateGedcom(input({ people: [person("a", "x", { treeId: "foreign" })] })), /ajenas/);
  assert.throws(() => generateGedcom(input({ people: [people[0], people[0]] })), /duplicadas/);
  assert.throws(() => generateGedcom(input({ people, parents: [link("a", "b"), link("a", "b")] })), /duplicado/);
  assert.throws(() => generateGedcom(input({ people, parents: [link("a", "outside")] })), /ajena/);
  assert.throws(() => generateGedcom(input({ people, events: [event("e", "outside", "birth", 2000)] })), /ajena/);
});
