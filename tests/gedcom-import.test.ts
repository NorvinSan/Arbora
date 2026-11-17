import assert from "node:assert/strict";
import { test } from "node:test";
import { parseGedcom, readGedcomFile, MAX_GEDCOM_BYTES } from "../src/lib/gedcom-import";
import { generateGedcom, type GedcomData } from "../src/lib/gedcom";

const header = "0 HEAD\n1 GEDC\n2 VERS 7.0\n";
const parse = (body: string) => parseGedcom(`${header}${body}0 TRLR\n`);

test("imports Unicode names, dates, events, adoption, marriages and family references", () => {
  const result = parse(`0 @I1@ INDI
1 NAME Ána /Núñez/
2 GIVN Ána
2 SURN Núñez
1 BIRT
2 DATE 29 FEB 1904
2 PLAC Córdoba
1 NOTE Primera línea
2 CONT Segunda línea
1 FAMS @F1@
0 @I2@ INDI
1 NAME José /Pérez/
0 @I3@ INDI
1 NAME Hija /Pérez/
1 FAMC @F1@
2 PEDI ADOPTED
1 DEAT Y
1 EVEN Graduación
2 DATE ABT 1930
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
1 MARR Y
`);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.counts, { people: 3, relations: 3, events: 3 });
  assert.equal(result.people[0].displayName, "Ána Núñez");
  assert.equal(result.people[0].biography, "Primera línea\nSegunda línea");
  assert.equal(result.people[0].events[0].day, 29);
  assert.equal(result.people[2].lifeStatus, "deceased");
  assert.equal(result.people[2].events[1].qualifier, "approximate");
  assert.deepEqual(result.parents.map((p) => p.relationType), ["adoptive", "adoptive"]);
  assert.equal(result.partners[0].kind, "marriage");
});

test("reports broken references, duplicate links and cycles before import", () => {
  const result = parse(`0 @I1@ INDI
1 NAME A
1 FAMC @F2@
0 @I2@ INDI
1 NAME B
0 @F1@ FAM
1 HUSB @I1@
1 CHIL @I2@
1 CHIL @I2@
0 @F3@ FAM
1 HUSB @I2@
1 CHIL @I1@
1 WIFE @missing@
`);
  assert.match(result.errors.join(" "), /familia inexistente/);
  assert.match(result.errors.join(" "), /persona inexistente/);
  assert.match(result.errors.join(" "), /ciclo genealógico/);
  assert.equal(result.parents.length, 2);
  assert.match(result.warnings.join(" "), /duplicado/);
});

test("rejects malformed structure, invalid dates and contradictory chronology", () => {
  assert.throws(() => parseGedcom("0 HEAD\n1 GEDC\n2 VERS 5.5.1\n0 TRLR\n"), /GEDCOM 7.0/);
  assert.throws(() => parse("0 @I1@ INDI\n2 NAME X\n"), /Estructura/);
  assert.throws(() => parse("0 @I1@ INDI\n1 BIRT\n2 DATE 30 FEB 1900\n"), /fecha inválida/);
  const result = parse("0 @I1@ INDI\n1 NAME A\n1 BIRT\n2 DATE 2000\n1 DEAT\n2 DATE 1999\n");
  assert.match(result.errors.join(" "), /fallecimiento anterior/);
});

test("unsupported GEDCOM information is reported and unsupported dates are not invented", () => {
  const result = parse("0 @I1@ INDI\n1 NAME X\n1 SEX F\n1 OBJE @O1@\n1 BIRT\n2 DATE BET 1900 AND 1905\n1 BAPM\n2 DATE 1905\n0 @O1@ OBJE\n");
  assert.deepEqual(result.errors, []);
  assert.equal(result.people[0].events[0].year, null);
  assert.equal(result.people[0].events[1].title, "Bautismo");
  assert.match(result.warnings.join(" "), /OBJE.*SEX.*fecha no compatible/);
});

test("validates file extension, size and UTF-8 encoding", async () => {
  await assert.rejects(readGedcomFile(new File([header], "tree.txt")), /\.ged/);
  await assert.rejects(readGedcomFile(new File([new Uint8Array([0xff, 0xfe])], "tree.ged")), /UTF-8/);
  await assert.rejects(readGedcomFile(new File([new Uint8Array(MAX_GEDCOM_BYTES + 1)], "tree.ged")), /5 MB/);
});

test("reads an Arbora GEDCOM export without losing its family links", () => {
  const now = new Date(), treeId = "tree";
  const people: GedcomData["people"] = ["a", "b", "c"].map((id) => ({
    id, treeId, displayName: id, givenName: null, familyName: null, preferredName: null, biography: null,
    lifeStatus: "unknown", whereaboutsStatus: "unknown", createdAt: now, updatedAt: now,
  }));
  const content = generateGedcom({ treeId, people, parents: [{ treeId, parentId: "a", childId: "c", relationType: "biological", notes: null, createdAt: now }, { treeId, parentId: "b", childId: "c", relationType: "biological", notes: null, createdAt: now }],
    partners: [{ id: "p", treeId, personAId: "a", personBId: "b", kind: "union", startYear: null, startMonth: null, startDay: null, startQualifier: null, endYear: null, endMonth: null, endDay: null, endQualifier: null, notes: null, createdAt: now }], events: [], storyCount: 0, mediaCount: 0 });
  const imported = parseGedcom(content);
  assert.deepEqual(imported.errors, []);
  assert.deepEqual(imported.counts, { people: 3, relations: 3, events: 0 });
  assert.equal(imported.partners[0].kind, "union");
});
