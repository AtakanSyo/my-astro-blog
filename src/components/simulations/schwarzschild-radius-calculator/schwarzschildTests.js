// Test cases for the "Tests" popup on the Schwarzschild Radius Calculator.
// These run the calculator's real schwarzschild.js functions against known
// reference masses and edge cases, so this table is a genuine live check —
// not a hardcoded, unverified table — and would visibly show failures on
// this page if the underlying math ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<slug>Tests.js" per calculator, computing rows from that calculator's
// own math module — to add the Tests popup to another calculator.

import {
  M_SUN,
  M_EARTH,
  schwarzschildRadiusM,
  massFromSchwarzschildRadiusM,
  distanceFromMeters,
} from "./schwarzschild";

export const SCHWARZSCHILD_RADIUS_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes above the reference masses
// below — rendered at the bottom of the Tests popup by CalculatorTests.
// Keep these two in sync when either changes.
export const SCHWARZSCHILD_RADIUS_TEST_SOURCES = [
  {
    title: "Earth",
    text: "Mass 5.9722 × 10²⁴ kg. r_s ≈ 8.87 mm is the commonly cited figure for Earth's Schwarzschild radius under this exact formula.",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html",
    urlLabel: "NASA Earth Fact Sheet",
  },
  {
    title: "The Sun",
    text: "IAU nominal solar mass 1.98847 × 10³⁰ kg. r_s ≈ 2.95 km is the standard, widely cited figure for the Sun's Schwarzschild radius.",
    url: "https://www.iau.org/static/resolutions/IAU2015_English.pdf",
    urlLabel: "IAU 2015 Resolution B3",
  },
  {
    title: "Sagittarius A*",
    text: "Mass 4.297 × 10⁶ M☉, from the GRAVITY Collaboration's stellar-orbit measurement of the Milky Way's central black hole. Implies r_s ≈ 12.7 million km, matching this calculator's own explainer text.",
    url: "https://doi.org/10.1051/0004-6361/201935656",
    urlLabel: "GRAVITY Collaboration (2019), A&A 625, L10",
  },
  {
    title: "M87*",
    text: "Mass 6.5 × 10⁹ M☉, from the Event Horizon Telescope Collaboration's 2019 image of the black hole at the center of M87. Implies r_s ≈ 19.2 billion km (≈128 AU), matching this calculator's own explainer text.",
    url: "https://doi.org/10.3847/2041-8213/ab0ec7",
    urlLabel: "Event Horizon Telescope Collaboration (2019), ApJL 875, L1",
  },
  {
    title: "What these rows actually prove",
    text: "The reference rows confirm the exact formula reproduces the commonly cited r_s for each real mass listed above, to the stated tolerance. The scaling and round-trip rows below don't depend on any external citation at all — they confirm the formula's genuine linearity and that solving for mass from radius exactly inverts solving for radius from mass. None of this independently re-derives the cited masses themselves — see each source note.",
  },
];

// Reference masses are published to 4-5 significant figures, so a
// fraction-of-a-percent round-trip gap is expected rounding, not a bug —
// a real formula error (e.g. a wrong exponent or missing factor of 2)
// would be off by many percent or by an entire order of magnitude, not
// hundredths of a percent.
const TOLERANCE_PCT = 0.5;

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

// Each mass is a real, independently published figure (see sources
// above); the expected r_s is the commonly cited round-trip value under
// this exact formula, in whichever unit is most natural for that scale.
const REFERENCE_MASSES = [
  { label: "Earth", massKg: M_EARTH, expected: 8.87, unit: "m", expectedDisplay: "≈ 8.87 mm", toDisplay: (m) => m * 1000 },
  { label: "The Sun", massKg: M_SUN, expected: 2.9532, unit: "km", expectedDisplay: "≈ 2.95 km", toDisplay: (m) => m },
  { label: "Sagittarius A*", massKg: 4.297e6 * M_SUN, expected: 1.269e7, unit: "km", expectedDisplay: "≈ 12.7 million km", toDisplay: (m) => m },
  { label: "M87*", massKg: 6.5e9 * M_SUN, expected: 1.919e10, unit: "km", expectedDisplay: "≈ 19.2 billion km", toDisplay: (m) => m },
];

function referenceRows() {
  return REFERENCE_MASSES.map((ref) => {
    const rsM = schwarzschildRadiusM(ref.massKg);
    const rsInUnit = distanceFromMeters(rsM, ref.unit);
    const computed = ref.toDisplay(rsInUnit);
    return {
      test: `${ref.label} — Schwarzschild radius from mass`,
      inputs: `M = ${fmt(ref.massKg)} kg`,
      expected: ref.expectedDisplay,
      computed: `${fmt(computed)} ${ref.unit === "m" ? "mm" : ref.unit}`,
      pass: percentDiff(computed, ref.expected) < TOLERANCE_PCT,
    };
  });
}

// Internal-consistency checks: these don't depend on any externally
// published figure, just on the formula responding to each input exactly
// as the algebra predicts — r_s = 2GM/c² is a pure, exponent-1 power law.
function consistencyRows() {
  const rows = [];

  const rs1 = schwarzschildRadiusM(M_SUN);
  const rs10 = schwarzschildRadiusM(10 * M_SUN);
  rows.push({
    test: "Doubling mass exactly doubles the radius (genuine linearity, not merely a power law)",
    inputs: "M = 1 M☉ vs. M = 2 M☉",
    expected: "ratio ≈ 2.0000",
    computed: `ratio = ${fmt(schwarzschildRadiusM(2 * M_SUN) / rs1)}`,
    pass: percentDiff(schwarzschildRadiusM(2 * M_SUN) / rs1, 2) < 1e-9,
  });

  rows.push({
    test: "10× the mass gives exactly 10× the radius",
    inputs: "M = 1 M☉ vs. M = 10 M☉",
    expected: "ratio ≈ 10.0000",
    computed: `ratio = ${fmt(rs10 / rs1)}`,
    pass: percentDiff(rs10 / rs1, 10) < 1e-9,
  });

  const massBack = massFromSchwarzschildRadiusM(schwarzschildRadiusM(4.297e6 * M_SUN));
  rows.push({
    test: "Round trip: mass → radius → mass recovers the original mass (Sagittarius A*)",
    inputs: "M = 4.297 × 10⁶ M☉ → r_s → M",
    expected: "≈ 4.297 × 10⁶ M☉ recovered",
    computed: `${fmt(massBack / M_SUN)} M☉`,
    pass: percentDiff(massBack, 4.297e6 * M_SUN) < 1e-9,
  });

  return rows;
}

// Edge cases: schwarzschild.js's two core functions are plain linear
// algebra with no input guarding of their own — rejecting zero/negative
// mass or radius is the calculator component's job (its `result` useMemo
// requires a positive mass or radius before calling these). These rows
// document the pure functions' actual, unguarded behavior rather than
// inventing rejection logic they don't have.
function edgeCaseRows() {
  const cases = [
    {
      test: "Zero mass",
      inputs: "M = 0 kg",
      expected: "not rejected — r_s scales linearly with M, giving exactly 0",
      run: () => schwarzschildRadiusM(0),
      check: (v) => v === 0,
    },
    {
      test: "Negative mass (formula has no sign guard)",
      inputs: "M = −1 M☉",
      expected: "not rejected — a negative, unphysical radius, exactly −1× the positive-mass result",
      run: () => schwarzschildRadiusM(-M_SUN),
      check: (v) => Number.isFinite(v) && v < 0 && Math.abs(v - -schwarzschildRadiusM(M_SUN)) < 1e-6,
    },
    {
      test: "Zero radius",
      inputs: "r_s = 0 m",
      expected: "not rejected — mass scales linearly with r_s, giving exactly 0",
      run: () => massFromSchwarzschildRadiusM(0),
      check: (v) => v === 0,
    },
    {
      test: "Negative radius (formula has no sign guard)",
      inputs: "r_s = −1000 m",
      expected: "not rejected — a negative, unphysical mass, exactly −1× the positive-radius result",
      run: () => massFromSchwarzschildRadiusM(-1000),
      check: (v) => Number.isFinite(v) && v < 0 && Math.abs(v - -massFromSchwarzschildRadiusM(1000)) < 1e-6,
    },
  ];

  return cases.map((c) => {
    const computed = c.run();
    return {
      test: c.test,
      inputs: c.inputs,
      expected: c.expected,
      computed: fmt(computed, 6),
      pass: c.check(computed),
    };
  });
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getSchwarzschildRadiusTestRows() {
  return [...referenceRows(), ...consistencyRows(), ...edgeCaseRows()];
}
