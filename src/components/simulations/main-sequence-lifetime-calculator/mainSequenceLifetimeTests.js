// Test cases for the "Tests" popup on the Main-Sequence Lifetime
// Calculator. These run the calculator's real mainSequenceLifetime.js
// functions against citable astrophysics facts, scaling checks, and edge
// cases, so this table is a genuine live check — not a hardcoded,
// unverified table — and would visibly show failures on this page if the
// underlying math ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<slug>Tests.js" per calculator, computing rows from that calculator's
// own math module — to add the Tests popup to another calculator.

import {
  T_SUN_YR,
  UNIVERSE_AGE_YR,
  lifetimeFromMass,
  massFromLifetime,
} from "./mainSequenceLifetime";

export const MAIN_SEQUENCE_LIFETIME_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes used by the checks below —
// rendered at the bottom of the Tests popup by CalculatorTests. Keep
// these two in sync when either changes.
export const MAIN_SEQUENCE_LIFETIME_TEST_SOURCES = [
  {
    title: "The Sun's main-sequence lifetime (~10 billion years)",
    text: "A widely cited, standard figure in stellar-astrophysics texts for the Sun's total time spent fusing hydrogen on the main sequence — and exactly the calibration constant (T_SUN_YR = 10¹⁰ yr) this calculator's own formula is built from, so the 1 M☉ case round-trips essentially exactly rather than approximately.",
  },
  {
    title: "O-type stars live only a few million years",
    text: "A standard, widely repeated fact in stellar-evolution texts: the most massive main-sequence stars (spectral type O, tens of solar masses) exhaust their fuel in only a few million years, in stark contrast to the Sun's ~10 billion. Checked here as an order-of-magnitude range, not a precise citation — real O-star lifetimes vary star to star.",
  },
  {
    title: "Red dwarfs will outlive the current universe",
    text: "A well-known consequence of how shallow low-mass stars' fuel consumption is: the lowest-mass red dwarfs are calculated to have main-sequence lifetimes of many hundreds of billions of years or more — far longer than the universe's current age of ~13.8 billion years (Planck 2018), which is exactly why no red dwarf has ever been observed to die of old age.",
  },
  {
    title: "What these rows actually prove",
    text: "The reference rows confirm the exact formula reproduces the correct order of magnitude and direction for these well-known real astrophysical comparisons. The scaling rows confirm the formula's M^-2.5 power law and its own inverse behave exactly as the algebra predicts. None of this independently verifies that -2.5 is the right exponent for real stars — this calculator's own explainer text is upfront that it's an order-of-magnitude approximation, not a stellar-evolution model.",
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

// Real, citable comparisons run through the calculator's own formula.
// Tolerances differ by how precisely each figure is actually cited: the
// Sun's case is exact by construction (it's the calibration point
// itself), while the O-type and red-dwarf comparisons are checked as
// order-of-magnitude ranges/directions, matching how loosely those facts
// are actually stated in the literature.
function referenceRows() {
  const rows = [];

  const sunLifetime = lifetimeFromMass(1);
  rows.push({
    test: "The Sun (1 M☉) — main-sequence lifetime",
    inputs: "M = 1 M☉",
    expected: `≈ ${fmt(T_SUN_YR)} yr (10 Gyr)`,
    computed: `${fmt(sunLifetime)} yr`,
    pass: percentDiff(sunLifetime, T_SUN_YR) < 1e-6,
  });

  const oTypeLifetime = lifetimeFromMass(40);
  const oTypeInRange = oTypeLifetime >= 1e5 && oTypeLifetime <= 2e7;
  rows.push({
    test: "Massive O-type star (40 M☉) — main-sequence lifetime",
    inputs: "M = 40 M☉",
    expected: "a few million years (order of magnitude)",
    computed: `${fmt(oTypeLifetime)} yr`,
    pass: oTypeInRange,
  });

  const redDwarfLifetime = lifetimeFromMass(0.2);
  rows.push({
    test: "Low-mass red dwarf (0.2 M☉) — outlives the current universe",
    inputs: `M = 0.2 M☉ vs. universe age = ${fmt(UNIVERSE_AGE_YR)} yr`,
    expected: "lifetime ≫ age of the universe",
    computed: `${fmt(redDwarfLifetime)} yr (${fmt(redDwarfLifetime / UNIVERSE_AGE_YR)}× the universe's age)`,
    pass: redDwarfLifetime > UNIVERSE_AGE_YR,
  });

  return rows;
}

// Internal-consistency checks: these don't depend on any externally cited
// figure, just on the formula (and its inverse) responding to mass
// exactly as the M^-2.5 algebra predicts.
function scalingRows() {
  const t1 = lifetimeFromMass(1);
  const t10 = lifetimeFromMass(10);
  const expectedRatio = Math.pow(10, 2.5);

  const roundTripMass = 3.7;
  const roundTripLifetime = lifetimeFromMass(roundTripMass);
  const roundTripBack = massFromLifetime(roundTripLifetime);

  return [
    {
      test: "Lifetime scales with M^-2.5 — a 10x mass star lives ~316x shorter",
      inputs: "M = 1 M☉ vs. M = 10 M☉",
      expected: `ratio ≈ ${fmt(expectedRatio)} (= 10^2.5)`,
      computed: `ratio = ${fmt(t1 / t10)}`,
      pass: percentDiff(t1 / t10, expectedRatio) < 1e-6,
    },
    {
      test: "massFromLifetime inverts lifetimeFromMass",
      inputs: `M = ${fmt(roundTripMass)} M☉ → t → M`,
      expected: `≈ ${fmt(roundTripMass)} M☉ recovered`,
      computed: `t = ${fmt(roundTripLifetime)} yr, back to M = ${fmt(roundTripBack)} M☉`,
      pass: percentDiff(roundTripBack, roundTripMass) < 1e-6,
    },
  ];
}

// Edge cases: mainSequenceLifetime.js's forward/reverse functions are
// plain power-law algebra with no input validation of their own (that
// guard lives in MainSequenceLifetimeCalculator.jsx's `result` useMemo,
// which requires a positive mass or lifetime before calling these) — so
// these rows document what lifetimeFromMass/massFromLifetime actually do
// when handed zero or negative input, rather than inventing a rejection
// behavior they don't have.
function edgeCaseRows() {
  const cases = [
    {
      test: "Zero mass",
      inputs: "M = 0 M☉",
      expected: "not rejected — 0^-2.5 diverges, giving +Infinity",
      run: () => lifetimeFromMass(0),
      check: (v) => v === Infinity,
    },
    {
      test: "Negative mass",
      inputs: "M = −5 M☉",
      expected: "not rejected — a negative base to a fractional power is undefined, giving NaN",
      run: () => lifetimeFromMass(-5),
      check: (v) => Number.isNaN(v),
    },
    {
      test: "Zero lifetime (reverse direction)",
      inputs: "t = 0 yr",
      expected: "not rejected — inverting 0^-0.4 diverges, giving +Infinity",
      run: () => massFromLifetime(0),
      check: (v) => v === Infinity,
    },
    {
      test: "Negative lifetime (reverse direction)",
      inputs: "t = −10 yr",
      expected: "not rejected — a negative base to a fractional power is undefined, giving NaN",
      run: () => massFromLifetime(-10),
      check: (v) => Number.isNaN(v),
    },
  ];

  return cases.map((c) => {
    const computed = c.run();
    return {
      test: c.test,
      inputs: c.inputs,
      expected: c.expected,
      computed: fmt(computed),
      pass: c.check(computed),
    };
  });
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getMainSequenceLifetimeTestRows() {
  return [...referenceRows(), ...scalingRows(), ...edgeCaseRows()];
}
