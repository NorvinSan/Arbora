import assert from "node:assert/strict";
import { test } from "node:test";
import { eventSchema, eventDateParts, formatEventDate } from "../src/lib/event-form-schemas";

const input = { treeId: "60a4c118-cf3e-48cb-b18f-77f53bb50fc6", personId: "b38a6471-c383-4265-abdc-e17e5c3a228a", type: "move", title: "Mudanza", description: "", place: "", qualifier: "exact" };

test("fechas completas, parciales y desconocidas se validan y representan", () => {
  for (const [date, expected] of [["1980", "1980"], ["1980-04", "04/1980"], ["1980-04-12", "12/04/1980"], ["", "Fecha desconocida"]]) {
    assert.equal(eventSchema.safeParse({ ...input, date }).success, true, date);
    const parts = eventDateParts(date, "exact");
    assert.equal(formatEventDate(parts.year, parts.month, parts.day, parts.qualifier), expected);
  }
  assert.equal(formatEventDate(1980, null, null, "approximate"), "Aprox. 1980");
});

test("rechaza fechas imposibles, títulos vacíos y granularidad incompleta", () => {
  for (const date of ["0000", "1980-00", "1980-13", "1980-02-30", "1900-02-29", "1980-04-00", "1980-4", "1980-04-1", "1980-04-12T00:00"])
    assert.equal(eventSchema.safeParse({ ...input, date }).success, false, date);
  assert.equal(eventSchema.safeParse({ ...input, date: "2000-02-29" }).success, true);
  assert.equal(eventSchema.safeParse({ ...input, title: "  ", date: "" }).success, false);
});
