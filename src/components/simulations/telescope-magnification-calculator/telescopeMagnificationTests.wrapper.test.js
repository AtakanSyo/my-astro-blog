import { describe, it, expect } from "vitest";
import { getTelescopeMagnificationTestRows } from "./telescopeMagnificationTests";

// Thin vitest wrapper around this calculator's existing reference-value
// test rows (the same data that powers its in-app "Tests" table) — see
// telescopeMagnificationTests.js for the row definitions, sources, and tolerances.
describe("telescope-magnification-calculator reference test rows", () => {
  const rows = getTelescopeMagnificationTestRows();

  it("has reference test rows", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it.each(rows)("$test", (row) => {
    expect(row.pass, `expected ${row.expected}, computed ${row.computed}`).toBe(true);
  });
});
