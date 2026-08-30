// Test cases for the "Tests" popup on the Distance Modulus Calculator.
// These run the calculator's real distanceModulus.js functions, including
// its own LANDMARKS reference distances. See angular-size-calculator's
// angularSizeTests.js for the pattern this follows.

import { distanceModulus, apparentFromAbsolute, absoluteFromApparent, distanceFromMagnitudes, LANDMARKS } from "./distanceModulus";

export const DISTANCE_MODULUS_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

export const DISTANCE_MODULUS_TEST_SOURCES = [
  {
    title: "What these rows check",
    text: "Absolute magnitude is defined as the apparent magnitude an object would have at exactly 10 pc — so \"modulus is exactly 0 at 10 pc\" isn't an approximation to check, it's the definition itself. The other rows round-trip through this module's own forward and inverse functions, using the same real reference distances (Proxima Centauri, Andromeda) shown on the calculator's own distance-ladder chart.",
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

function definitionRow() {
  const modAt10pc = distanceModulus(10);
  return {
    test: "Distance modulus at exactly 10 pc",
    inputs: "d = 10 pc",
    expected: "exactly 0 — this is the definition of absolute magnitude, not an approximation",
    computed: `${fmt(modAt10pc)}`,
    pass: modAt10pc === 0,
  };
}

function roundTripRows() {
  const M = 4.83; // roughly the Sun's own absolute magnitude, used only as a representative value
  const d = 100;
  const A = 0.5;
  const m = apparentFromAbsolute(M, d, A);
  const dBack = distanceFromMagnitudes(m, M, A);
  const MBack = absoluteFromApparent(m, d, A);
  return [
    {
      test: "Round-trip: M, d, A → m → d",
      inputs: `M=${M}, d=${d} pc, A=${A} mag`,
      expected: `distanceFromMagnitudes(m, M, A) = ${d}`,
      computed: `${fmt(dBack)} pc`,
      pass: percentDiff(dBack, d) < TOLERANCE_PCT,
    },
    {
      test: "Round-trip: M, d, A → m → M",
      inputs: `m=${fmt(m)}, d=${d} pc, A=${A} mag`,
      expected: `absoluteFromApparent(m, d, A) = ${M}`,
      computed: `${fmt(MBack)}`,
      pass: percentDiff(MBack, M) < TOLERANCE_PCT,
    },
  ];
}

function landmarkRows() {
  const proxima = LANDMARKS.find((l) => l.label.includes("Proxima"));
  const andromeda = LANDMARKS.find((l) => l.label.includes("Andromeda"));
  const proximaMod = distanceModulus(proxima.pc);
  const andromedaMod = distanceModulus(andromeda.pc);
  return [
    {
      test: `${proxima.label}: sign of the modulus`,
      inputs: `d = ${proxima.pc} pc (closer than the 10 pc reference)`,
      expected: "negative (closer than 10 pc → appears brighter than its own absolute magnitude)",
      computed: fmt(proximaMod, 3),
      pass: proximaMod < 0,
    },
    {
      test: `${andromeda.label}: sign and rough scale of the modulus`,
      inputs: `d = ${fmt(andromeda.pc, 0)} pc`,
      expected: "large and positive (far past the 10 pc reference)",
      computed: fmt(andromedaMod, 2),
      pass: andromedaMod > 20,
    },
  ];
}

function edgeCaseRows() {
  const dim1 = apparentFromAbsolute(1, 10, 0);
  const dim2 = apparentFromAbsolute(1, 10, 1);
  return [
    {
      test: "Extinction always dims (never brightens)",
      inputs: "M=1, d=10 pc, A=0 vs. A=1",
      expected: "apparent magnitude with A=1 is larger (fainter) than with A=0",
      computed: `${fmt(dim1)} → ${fmt(dim2)}`,
      pass: dim2 > dim1,
    },
  ];
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getDistanceModulusTestRows() {
  return [definitionRow(), ...roundTripRows(), ...landmarkRows(), ...edgeCaseRows()];
}
