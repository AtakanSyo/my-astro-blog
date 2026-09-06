// Test cases for the "Tests" popup on the Stellar Mass-Luminosity Relation
// Calculator. These run the calculator's real massLuminosity.js functions
// against the formula's own calibration point, a real star it's expected
// to fit reasonably well, internal scaling/consistency checks, and edge
// cases — so this table is a genuine live check, not a hardcoded,
// unverified table, and would visibly show failures on this page if the
// underlying math ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<slug>Tests.js" per calculator, computing rows from that calculator's
// own math module — to add the Tests popup to another calculator.

import {
  luminosityFromMass,
  massFromLuminosity,
  localExponent,
} from "./massLuminosity";

export const STELLAR_MASS_LUMINOSITY_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes used below — rendered at the
// bottom of the Tests popup by CalculatorTests. Keep these two in sync
// when either changes.
export const STELLAR_MASS_LUMINOSITY_TEST_SOURCES = [
  {
    title: "The Sun (M = 1 M☉, L = 1 L☉)",
    text: "Not an independent measurement to check against — the 0.43 ≤ M < 2 M☉ branch (L = M⁴) is calibrated to pass through the Sun exactly, by construction. This confirms that calibration holds, both forward and in reverse.",
    url: "https://www.iau.org/static/resolutions/IAU2015_English.pdf",
    urlLabel: "IAU 2015 Resolution B3 (nominal solar values)",
  },
  {
    title: "Proxima Centauri",
    text: "Commonly cited figures — mass ≈ 0.122 M☉, bolometric luminosity ≈ 0.0017 L☉ (the same figures this calculator uses as its own preset and diagram landmark). Real M-dwarfs scatter around the idealized fit by a real amount that isn't rounding error, so this check uses a generous tolerance rather than a tight one — a double-digit-percent gap here is expected star-to-star variation, not a formula bug.",
  },
  {
    title: "Sirius A and Rigel — deliberately not used as reproduction checks",
    text: "This calculator's own diagram and explainer text note that these two real stars visibly diverge from the idealized fit (Sirius A has its own evolutionary history off the exact curve, and Rigel is an evolved blue supergiant, not a strict zero-age main-sequence star). Testing the formula against their measured luminosities would legitimately fail for reasons that have nothing to do with a bug in the math, so they aren't used as \"the formula should reproduce this\" checks here.",
  },
  {
    title: "What these rows actually prove",
    text: "The Sun row confirms the piecewise relation's own calibration point holds exactly, in both directions. The Proxima row confirms the low-mass branch is in the right ballpark for a real star, within real stellar scatter. The scaling and round-trip rows confirm the formula's algebra — a single branch's power law, its claimed local exponent, and mass→luminosity→mass consistency — behaves exactly as the piecewise definition promises. None of this independently re-derives the piecewise fit's coefficients from first principles.",
  },
];

function fmt(n, digits = 4) {
  if (Number.isNaN(n)) return "NaN";
  if (n === Infinity) return "∞";
  if (n === -Infinity) return "−∞";
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-3)) return n.toExponential(3);
  const rounded = Number(n.toFixed(digits));
  return String(rounded);
}

function percentDiff(a, b) {
  if (b === 0) return a === 0 ? 0 : Infinity;
  return Math.abs((a - b) / b) * 100;
}

// The Sun is the relation's own calibration point (M=1 -> L=1 exactly, by
// construction of the 0.43 <= M < 2 branch), so both directions should
// round-trip with essentially zero error.
function calibrationRows() {
  const lFromSun = luminosityFromMass(1);
  const mFromSun = massFromLuminosity(1);
  return [
    {
      test: "The Sun — mass to luminosity",
      inputs: "M = 1 M☉",
      expected: "L = 1 L☉ (exact, by calibration)",
      computed: `L = ${fmt(lFromSun)} L☉`,
      pass: percentDiff(lFromSun, 1) < 1e-9,
    },
    {
      test: "The Sun — luminosity to mass",
      inputs: "L = 1 L☉",
      expected: "M = 1 M☉ (exact, by calibration)",
      computed: `M = ${fmt(mFromSun)} M☉`,
      pass: percentDiff(mFromSun, 1) < 1e-9,
    },
  ];
}

// Proxima Centauri: a real M-dwarf, low-mass branch. Real stars scatter
// around the idealized fit, so this uses a generous tolerance rather than
// a tight one — see the source note above.
const PROXIMA_M = 0.122;
const PROXIMA_L = 0.0017;
const PROXIMA_TOLERANCE_PCT = 25;

function realStarRows() {
  const lComputed = luminosityFromMass(PROXIMA_M);
  return [
    {
      test: "Proxima Centauri — mass to luminosity",
      inputs: `M = ${fmt(PROXIMA_M)} M☉`,
      expected: `≈ ${fmt(PROXIMA_L)} L☉ (within ${PROXIMA_TOLERANCE_PCT}%, real-star scatter expected)`,
      computed: `L = ${fmt(lComputed)} L☉`,
      pass: percentDiff(lComputed, PROXIMA_L) < PROXIMA_TOLERANCE_PCT,
    },
  ];
}

// Internal-consistency checks: these don't depend on any externally
// published figure, just on the formula responding to each input exactly
// as the piecewise algebra predicts.
function consistencyRows() {
  const rows = [];

  // Within the 0.43 <= M < 2 branch (L = M^4), a factor-of-3 mass increase
  // should give exactly a factor of 3^4 = 81 in luminosity.
  const M1 = 0.5, M2 = 1.5;
  const L1 = luminosityFromMass(M1);
  const L2 = luminosityFromMass(M2);
  const ratio = L2 / L1;
  const expectedRatio = (M2 / M1) ** 4;
  rows.push({
    test: "L ∝ M⁴ within the 0.43–2 M☉ branch",
    inputs: `M = ${fmt(M1)} M☉ vs. M = ${fmt(M2)} M☉ (both in the same branch)`,
    expected: `ratio ≈ ${fmt(expectedRatio)} (= 3⁴)`,
    computed: `ratio = ${fmt(ratio)}`,
    pass: percentDiff(ratio, expectedRatio) < 1e-6,
  });

  // localExponent() claims a slope for each branch — confirm the formula's
  // actual numerical derivative (d ln L / d ln M) matches it, well inside
  // the 2 <= M < 20 branch where the claimed exponent is 3.5.
  const M0 = 5;
  const delta = 1e-4;
  const lnL_plus = Math.log(luminosityFromMass(M0 * (1 + delta)));
  const lnL_minus = Math.log(luminosityFromMass(M0 * (1 - delta)));
  const lnM_plus = Math.log(M0 * (1 + delta));
  const lnM_minus = Math.log(M0 * (1 - delta));
  const numericSlope = (lnL_plus - lnL_minus) / (lnM_plus - lnM_minus);
  const claimedSlope = localExponent(M0);
  rows.push({
    test: "localExponent() matches the formula's actual numerical slope",
    inputs: `d(ln L)/d(ln M) near M = ${fmt(M0)} M☉ (2–20 M☉ branch)`,
    expected: `≈ ${fmt(claimedSlope)}`,
    computed: `numerical slope ≈ ${fmt(numericSlope)}`,
    pass: percentDiff(numericSlope, claimedSlope) < 0.1,
  });

  // Round trip through all four branches: mass -> luminosity -> mass
  // should recover the original mass, since massFromLuminosity inverts
  // whichever branch luminosityFromMass used.
  const roundTripMasses = [0.2, 1.5, 10, 50];
  for (const M of roundTripMasses) {
    const L = luminosityFromMass(M);
    const Mback = massFromLuminosity(L);
    rows.push({
      test: `Round trip: mass → luminosity → mass (M = ${fmt(M)} M☉)`,
      inputs: `M = ${fmt(M)} M☉ → L = ${fmt(L)} L☉ → M`,
      expected: `≈ ${fmt(M)} M☉ recovered`,
      computed: `${fmt(Mback)} M☉`,
      pass: percentDiff(Mback, M) < 1e-6,
    });
  }

  return rows;
}

// Edge cases: massLuminosity.js's forward/reverse functions have no input
// guarding of their own (that's the calculator component's job, requiring
// a positive mass/luminosity before ever calling these) — these rows
// document what the pure functions actually do on zero and negative
// inputs, rather than inventing a rejection behavior they don't have.
function edgeCaseRows() {
  const lAtZero = luminosityFromMass(0);
  const lAtNeg = luminosityFromMass(-5);
  const mAtZero = massFromLuminosity(0);
  const mAtNeg = massFromLuminosity(-5);

  return [
    {
      test: "Zero mass ⇒ zero luminosity (not rejected)",
      inputs: "M = 0 M☉",
      expected: "0 L☉",
      computed: `${fmt(lAtZero)} L☉`,
      pass: lAtZero === 0,
    },
    {
      test: "Negative mass ⇒ NaN (fractional power of a negative base)",
      inputs: "M = −5 M☉",
      expected: "NaN — 0.23 × (−5)^2.3 is not a real number in JS",
      computed: fmt(lAtNeg),
      pass: Number.isNaN(lAtNeg),
    },
    {
      test: "Zero luminosity ⇒ zero mass (not rejected)",
      inputs: "L = 0 L☉",
      expected: "0 M☉",
      computed: `${fmt(mAtZero)} M☉`,
      pass: mAtZero === 0,
    },
    {
      test: "Negative luminosity ⇒ NaN (fractional power of a negative base)",
      inputs: "L = −5 L☉",
      expected: "NaN — (−5/0.23)^(1/2.3) is not a real number in JS",
      computed: fmt(mAtNeg),
      pass: Number.isNaN(mAtNeg),
    },
  ];
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getStellarMassLuminosityTestRows() {
  return [...calibrationRows(), ...realStarRows(), ...consistencyRows(), ...edgeCaseRows()];
}
