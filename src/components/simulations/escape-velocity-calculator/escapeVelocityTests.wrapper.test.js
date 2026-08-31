import { describe, it, expect } from "vitest";
import { getEscapeVelocityTestRows } from "./escapeVelocityTests";

// Thin vitest wrapper around this calculator's existing reference-value
// test rows (the same data that powers its in-app "Tests" table) — see
// escapeVelocityTests.js for the row definitions, sources, and tolerances.
describe("escape-velocity-calculator reference test rows", () => {
  const rows = getEscapeVelocityTestRows();

  it("has reference test rows", () => {
    expect(rows.length).toBeGreaterThan(0);
  });

  it.each(rows)("$test", (row) => {
    expect(row.pass, `expected ${row.expected}, computed ${row.computed}`).toBe(true);
  });
});
