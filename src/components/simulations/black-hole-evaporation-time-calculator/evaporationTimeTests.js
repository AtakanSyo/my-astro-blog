// Test cases for the "Tests" popup on the Black Hole Evaporation Time
// Calculator. These run the calculator's real evaporationTime.js functions
// against a widely-quoted literature checkpoint and internal-consistency
// checks, so this table is a genuine live check — not a hardcoded,
// unverified table — and would visibly show failures on this page if the
// underlying math ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<slug>Tests.js" per calculator, computing rows from that calculator's
// own math module — to add the Tests popup to another calculator.

import {
  AGE_OF_UNIVERSE_YEARS,
  massToKg,
  massFromKg,
  evaporationTimeSeconds,
  evaporationTimeYears,
  massFromEvaporationTimeSeconds,
  massFromEvaporationTimeYears,
  massEvaporatingTodayKg,
} from "./evaporationTime";

export const EVAPORATION_TIME_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes above the checkpoint value
// below — rendered at the bottom of the Tests popup by CalculatorTests.
// Keep these two in sync when either changes.
export const EVAPORATION_TIME_TEST_SOURCES = [
  {
    title: "1 solar-mass Schwarzschild black hole",
    text: "A commonly cited estimate for a solar-mass black hole's Hawking-radiation lifetime is ≈2.1×10⁶⁷ years, computed from the same t = 5120 π G² M³ / (ħ c⁴) formula this calculator uses.",
    url: "https://en.wikipedia.org/wiki/Hawking_radiation",
    urlLabel: "Wikipedia — Hawking radiation",
  },
  {
    title: "Age of the universe",
    text: "13.8 billion years — the commonly cited figure from Planck-mission cosmological measurements.",
    url: "https://en.wikipedia.org/wiki/Age_of_the_universe",
    urlLabel: "Wikipedia — Age of the universe",
  },
  {
    title: "What these rows actually prove",
    text: "The reference row confirms the exact formula reproduces a widely-quoted literature checkpoint to within rounding. The scaling, inverse, and self-consistency rows confirm the formula and its inverse agree with each other internally — not that the underlying physics has been independently re-derived here. This is the idealized Schwarzschild/Hawking-radiation-only estimate: no accretion, no evolving emission channels as the hole shrinks, no other physics.",
  },
];

// A literature figure quoted to only 2 significant figures leaves room for
// a fraction-of-a-percent gap against this calculator's own constants —
// that's expected rounding, not a bug; a real formula error (wrong
// exponent, missing factor) would be off by many percent, not tenths.
const LITERATURE_TOLERANCE_PCT = 1;
// Internal round-trips and self-consistency checks use the calculator's
// own functions on both sides, so they should agree to floating-point
// precision, not just "close enough".
const ROUNDTRIP_TOLERANCE_PCT = 1e-6;

function fmt(n, digits = 4) {
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

// Reference checkpoint: a 1 solar-mass Schwarzschild black hole's
// evaporation time is commonly quoted as ≈2.1×10⁶⁷ years (see sources
// above). Checked with a relative-tolerance comparison rather than an
// exact match, since the literature figure is only quoted to 2 sig figs.
function referenceCheckRows() {
  const massKg = massToKg(1, "msun");
  const computedYears = evaporationTimeYears(massKg);
  const expectedYears = 2.1e67;

  return [
    {
      test: "1 solar-mass black hole — evaporation time vs. widely-quoted figure",
      inputs: "M = 1 M☉",
      expected: `≈ ${expectedYears.toExponential(1)} years`,
      computed: `${computedYears.toExponential(4)} years`,
      pass: percentDiff(computedYears, expectedYears) < LITERATURE_TOLERANCE_PCT,
    },
  ];
}

// M³ scaling: doubling the input mass should multiply the evaporation
// time by exactly 2³ = 8, using the calculator's own evaporationTimeYears
// directly (not a hand-typed constant) — this is the one exponent the
// whole tool hinges on.
function scalingRows() {
  const baseMassKg = massToKg(1, "msun");
  const baseYears = evaporationTimeYears(baseMassKg);
  const doubledYears = evaporationTimeYears(2 * baseMassKg);
  const ratio = doubledYears / baseYears;

  return [
    {
      test: "Doubling the mass multiplies evaporation time by 2³",
      inputs: "M = 1 M☉ vs. M = 2 M☉",
      expected: "ratio = 8.0000",
      computed: `ratio = ${fmt(ratio)}`,
      pass: percentDiff(ratio, 8) < ROUNDTRIP_TOLERANCE_PCT,
    },
  ];
}

// Inverse round-trip: mass → evaporation time → mass, through the
// calculator's real inverse functions, both in seconds and in years, for
// an arbitrary mass unrelated to any other checkpoint here.
function inverseRoundTripRows() {
  const massKg = massToKg(5, "msun");

  const years = evaporationTimeYears(massKg);
  const massBackFromYearsKg = massFromEvaporationTimeYears(years);

  const seconds = evaporationTimeSeconds(massKg);
  const massBackFromSecondsKg = massFromEvaporationTimeSeconds(seconds);

  return [
    {
      test: "Mass → evaporation time (years) → mass round-trips",
      inputs: "M = 5 M☉",
      expected: `${fmt(massFromKg(massKg, "msun"))} M☉`,
      computed: `${fmt(massFromKg(massBackFromYearsKg, "msun"))} M☉`,
      pass: percentDiff(massBackFromYearsKg, massKg) < ROUNDTRIP_TOLERANCE_PCT,
    },
    {
      test: "Mass → evaporation time (seconds) → mass round-trips",
      inputs: "M = 5 M☉",
      expected: `${fmt(massFromKg(massKg, "msun"))} M☉`,
      computed: `${fmt(massFromKg(massBackFromSecondsKg, "msun"))} M☉`,
      pass: percentDiff(massBackFromSecondsKg, massKg) < ROUNDTRIP_TOLERANCE_PCT,
    },
  ];
}

// Self-consistency of massEvaporatingTodayKg(): running its output back
// through evaporationTimeYears should land on the age of the universe,
// since that mass is defined as the inverse of exactly that relation —
// this doesn't hand-type an expected mass, it only checks the round-trip.
function evaporatingTodayConsistencyRows() {
  const todayMassKg = massEvaporatingTodayKg();
  const yearsBack = evaporationTimeYears(todayMassKg);

  return [
    {
      test: "Mass \"evaporating today\" is self-consistent with the age of the universe",
      inputs: "M = massEvaporatingTodayKg()",
      expected: `≈ ${fmt(AGE_OF_UNIVERSE_YEARS)} years (13.8 Gyr)`,
      computed: `${fmt(yearsBack)} years`,
      pass: percentDiff(yearsBack, AGE_OF_UNIVERSE_YEARS) < ROUNDTRIP_TOLERANCE_PCT,
    },
  ];
}

// Edge cases: evaporationTime.js applies no validation of its own (the
// component's input field is what rejects non-positive masses before
// ever calling these functions) — these rows confirm the real,
// unguarded behavior of the raw formula rather than inventing a
// rejection path that doesn't exist.
function edgeCaseRows() {
  const zeroSeconds = evaporationTimeSeconds(0);
  const negativeSeconds = evaporationTimeSeconds(-1);

  return [
    {
      test: "Zero mass",
      inputs: "M = 0 kg",
      expected: "0 seconds (formula has no guard clause; cubes to exactly 0)",
      computed: `${fmt(zeroSeconds)} seconds`,
      pass: zeroSeconds === 0,
    },
    {
      test: "Negative mass",
      inputs: "M = −1 kg",
      expected: "a negative (unphysical) time — no rejection at this layer, M³ simply carries the sign through",
      computed: `${negativeSeconds.toExponential(3)} seconds`,
      pass: negativeSeconds < 0,
    },
  ];
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getEvaporationTimeTestRows() {
  return [
    ...referenceCheckRows(),
    ...scalingRows(),
    ...inverseRoundTripRows(),
    ...evaporatingTodayConsistencyRows(),
    ...edgeCaseRows(),
  ];
}
