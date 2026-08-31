import { describe, it, expect } from "vitest";
import { getDistancesTestRows } from "./distancesTests";

// Thin vitest wrapper around this calculator's existing reference-value
// test rows (the same data that powers its in-app "Tests" table) — see
// distancesTests.js for the row definitions, sources, and tolerances.
describe("astronomical-distance-converter reference test rows", () => {
  const rows = getDistancesTestRows();

  it("has reference test rows", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it.each(rows)("$test", (row) => {
    expect(row.pass, `expected ${row.expected}, computed ${row.computed}`).toBe(true);
  });
});
