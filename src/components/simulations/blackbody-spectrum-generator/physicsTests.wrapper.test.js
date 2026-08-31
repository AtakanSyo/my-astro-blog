import { describe, it, expect } from "vitest";
import { getBlackbodyTestRows } from "./physicsTests";

// Thin vitest wrapper around this calculator's existing reference-value
// test rows (the same data that powers its in-app "Tests" table) — see
// physicsTests.js for the row definitions, sources, and tolerances.
describe("blackbody-spectrum-generator reference test rows", () => {
  const rows = getBlackbodyTestRows();

  it("has reference test rows", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it.each(rows)("$test", (row) => {
    expect(row.pass, `expected ${row.expected}, computed ${row.computed}`).toBe(true);
  });
});
