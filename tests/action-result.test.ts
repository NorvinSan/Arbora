import assert from "node:assert/strict";
import { test } from "node:test";
import { postgresErrorCode } from "../src/lib/action-result";

test("identifica errores PostgreSQL envueltos por Drizzle", () => {
  const postgres = Object.assign(new Error("unique violation"), { code: "23505" });
  const drizzle = new Error("Failed query", { cause: postgres });
  assert.equal(postgresErrorCode(drizzle), "23505");
  assert.equal(postgresErrorCode(new Error("unknown")), undefined);
});
