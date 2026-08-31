// Test cases for the "Tests" popup on the Drake Equation Calculator.
// These run the calculator's real drakeEquation.js functions. See
// angular-size-calculator's angularSizeTests.js for the pattern this
// follows.

import { DRAKE_FACTORS, computeN, decadeSpan, plausibleRangeN } from "./drakeEquation";

export const DRAKE_EQUATION_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

export const DRAKE_EQUATION_TEST_SOURCES = [
  {
    title: "Where the reference numbers come from",
    text: "The \"Drake 1961\" preset reproduces the specific values Frank Drake used at the 1961 Green Bank meeting (R*=10, fp=0.5, ne=2, fl=1, fi=0.01, fc=0.01, L=10000), which is the well-known historical result of N≈10 — see Drake's own account and standard SETI references. The plausible min/max bounds for each factor are this module's own stated assumptions (see drakeEquation.js's per-factor notes), not a claimed consensus figure — the whole point of the equation is that several of them cannot currently be measured at all.",
  },
];

const TOLERANCE_PCT = 0.001;

function percentDiff(a, b) {
  if (b === 0) return a === 0 ? 0 : Infinity;
  return Math.abs((a - b) / b) * 100;
}
function fmt(n, digits = 6) {
  if (!Number.isFinite(n)) return String(n);
  return n.toExponential(digits);
}

function drake1961Row() {
  const values = { rStar: 10, fp: 0.5, ne: 2, fl: 1, fi: 0.01, fc: 0.01, L: 10000 };
  const N = computeN(values);
  return [
    {
      test: "Drake's 1961 Green Bank estimate reproduces N ≈ 10",
      inputs: "R*=10, fp=0.5, ne=2, fl=1, fi=0.01, fc=0.01, L=10000",
      expected: "N = 10",
      computed: `N = ${N}`,
      pass: percentDiff(N, 10) < TOLERANCE_PCT,
    },
  ];
}

function computeNRows() {
  return [
    {
      test: "computeN multiplies all seven factors",
      inputs: "all factors = 1 except rStar=2, L=5",
      expected: "10",
      computed: String(computeN({ rStar: 2, fp: 1, ne: 1, fl: 1, fi: 1, fc: 1, L: 5 })),
      pass: percentDiff(computeN({ rStar: 2, fp: 1, ne: 1, fl: 1, fi: 1, fc: 1, L: 5 }), 10) < TOLERANCE_PCT,
    },
    {
      test: "computeN falls back to each factor's own default when a value is missing",
      inputs: "empty values object",
      expected: `N = ${fmt(DRAKE_FACTORS.reduce((a, f) => a * f.default, 1), 4)}`,
      computed: `N = ${fmt(computeN({}), 4)}`,
      pass: percentDiff(computeN({}), DRAKE_FACTORS.reduce((a, f) => a * f.default, 1)) < TOLERANCE_PCT,
    },
  ];
}

function decadeSpanRows() {
  const flFactor = DRAKE_FACTORS.find((f) => f.key === "fl");
  const rStarFactor = DRAKE_FACTORS.find((f) => f.key === "rStar");
  return [
    {
      test: "fl's own plausible range spans far more orders of magnitude than R*'s",
      inputs: `fl: [${flFactor.min}, ${flFactor.max}], R*: [${rStarFactor.min}, ${rStarFactor.max}]`,
      expected: "decadeSpan(fl) ≫ decadeSpan(R*)",
      computed: `fl: ${fmt(decadeSpan(flFactor), 2)} decades, R*: ${fmt(decadeSpan(rStarFactor), 2)} decades`,
      pass: decadeSpan(flFactor) > decadeSpan(rStarFactor) * 5,
    },
  ];
}

function plausibleRangeRows() {
  const { min, max } = plausibleRangeN();
  const expectedMin = DRAKE_FACTORS.reduce((a, f) => a * f.min, 1);
  const expectedMax = DRAKE_FACTORS.reduce((a, f) => a * f.max, 1);
  return [
    {
      test: "plausibleRangeN's min is the product of every factor's own minimum",
      inputs: "every factor at its stated minimum",
      expected: fmt(expectedMin, 4),
      computed: fmt(min, 4),
      pass: percentDiff(min, expectedMin) < TOLERANCE_PCT,
    },
    {
      test: "plausibleRangeN's max is the product of every factor's own maximum",
      inputs: "every factor at its stated maximum",
      expected: fmt(expectedMax, 4),
      computed: fmt(max, 4),
      pass: percentDiff(max, expectedMax) < TOLERANCE_PCT,
    },
    {
      test: "The plausible range for N spans dozens of orders of magnitude",
      inputs: `min=${fmt(min, 2)}, max=${fmt(max, 2)}`,
      expected: "log10(max) - log10(min) > 20",
      computed: `${fmt(Math.log10(max) - Math.log10(min), 2)} decades`,
      pass: Math.log10(max) - Math.log10(min) > 20,
    },
  ];
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getDrakeEquationTestRows() {
  return [...drake1961Row(), ...computeNRows(), ...decadeSpanRows(), ...plausibleRangeRows()];
}
