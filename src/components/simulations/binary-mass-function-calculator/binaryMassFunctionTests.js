// Test cases for the "Tests" popup on the Binary Mass Function
// Calculator. These run the calculator's real binaryMassFunction.js
// functions. See angular-size-calculator's angularSizeTests.js for the
// pattern this follows.

import { massFunctionFromMasses, massFunctionKg, massFunctionSolar, solveCompanionMass, M_SUN } from "./binaryMassFunction";

export const BINARY_MASS_FUNCTION_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

export const BINARY_MASS_FUNCTION_TEST_SOURCES = [
  {
    title: "What these rows check",
    text: "No external reference data is used here. Every row is either a round-trip through the module's own forward and inverse functions, or a direct test of the mathematical inequality f(M) ≤ M2 stated (and derived) in this module's own header comment — the reasoning historically used to argue Cygnus X-1's compact companion was too massive to be a neutron star.",
  },
];

const TOLERANCE_PCT = 0.0001;

function percentDiff(a, b) {
  if (b === 0) return a === 0 ? 0 : Infinity;
  return Math.abs((a - b) / b) * 100;
}
function fmt(n, digits = 4) {
  if (!Number.isFinite(n)) return String(n);
  return Number(n.toFixed(digits)).toString();
}

function roundTripAndBoundRows() {
  const cases = [
    { M1: 1.5, M2: 10, incl: 90 },
    { M1: 10, M2: 3, incl: 60 },
    { M1: 0.6, M2: 1.4, incl: 30 },
  ];
  const rows = [];
  for (const { M1, M2, incl } of cases) {
    const f = massFunctionFromMasses(M1, M2, incl);
    const back = solveCompanionMass(f, M1, incl);
    rows.push({
      test: `Round-trip: (M1=${M1}, M2=${M2}, i=${incl}°) → f(M) → M2`,
      inputs: `M1=${M1} M☉, M2=${M2} M☉, i=${incl}°`,
      expected: `solveCompanionMass(f(M), M1, i) = ${M2}`,
      computed: fmt(back, 6),
      pass: back !== null && percentDiff(back, M2) < TOLERANCE_PCT,
    });
    rows.push({
      test: `Upper-bound property: f(M) ≤ M2 (M1=${M1}, M2=${M2}, i=${incl}°)`,
      inputs: `f(M) = ${fmt(f, 6)} M☉`,
      expected: `f(M) ≤ M2 = ${M2} — true for any M1 ≥ 0 and any inclination`,
      computed: `${fmt(f, 6)} ${f <= M2 ? "≤" : ">"} ${M2}`,
      pass: f <= M2,
    });
  }
  return rows;
}

function unitConsistencyRows() {
  const P_s = 5 * 86400;
  const K_ms = 200000;
  const e = 0.2;
  const fKg = massFunctionKg(P_s, K_ms, e);
  const fSolar = massFunctionSolar(P_s, K_ms, e);
  return [
    {
      test: "massFunctionSolar = massFunctionKg / M_SUN",
      inputs: `P=${P_s} s, K=${K_ms} m/s, e=${e}`,
      expected: `${fmt(fKg / M_SUN, 8)} M☉`,
      computed: `${fmt(fSolar, 8)} M☉`,
      pass: percentDiff(fSolar, fKg / M_SUN) < TOLERANCE_PCT,
    },
  ];
}

function edgeCaseRows() {
  return [
    {
      test: "Edge-on-impossible inclination (i = 0°)",
      inputs: "f(M)=0.5, M1=1, i=0°",
      expected: "null (sin i = 0 makes the equation have no positive solution)",
      computed: String(solveCompanionMass(0.5, 1, 0)),
      pass: solveCompanionMass(0.5, 1, 0) === null,
    },
    {
      test: "Non-positive mass function",
      inputs: "f(M)=−1, M1=1, i=90°",
      expected: "null (a mass function must be positive)",
      computed: String(solveCompanionMass(-1, 1, 90)),
      pass: solveCompanionMass(-1, 1, 90) === null,
    },
  ];
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getBinaryMassFunctionTestRows() {
  return [...roundTripAndBoundRows(), ...unitConsistencyRows(), ...edgeCaseRows()];
}
