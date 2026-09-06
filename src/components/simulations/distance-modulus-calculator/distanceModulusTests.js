// Test cases for the "Tests" popup on the Distance Modulus Calculator.
// These run the calculator's real distanceModulus.js functions against
// known reference objects and internal-consistency checks, so this
// table is a genuine live check — not a hardcoded, unverified table —
// and would visibly show failures on this page if the underlying math
// ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<slug>Tests.js" per calculator, computing rows from that calculator's
// own math module — to add the Tests popup to another calculator.

import {
  distanceModulus,
  apparentFromAbsolute,
  absoluteFromApparent,
  distanceFromMagnitudes,
} from "./distanceModulus";

export const DISTANCE_MODULUS_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes above the reference objects
// below — rendered at the bottom of the Tests popup by CalculatorTests.
// Keep these two in sync when either changes.
export const DISTANCE_MODULUS_TEST_SOURCES = [
  {
    title: "Textbook example (μ = 5 at d = 100 pc)",
    text: "Exact by definition of the distance modulus relation — not an external citation, just the algebra: 5·log10(100/10) = 5.",
  },
  {
    title: "Proxima Centauri",
    text: "Distance ≈1.30 pc (Gaia-era parallax) and absolute magnitude M_V ≈ 15.60 are commonly cited catalog figures for the nearest star; the apparent magnitude this formula predicts from them (≈11.17) is close to, though not pixel-identical with, its directly observed V ≈ 11.13 — a small, expected gap given real catalog uncertainty in M_V and distance, not a formula error.",
  },
  {
    title: "Betelgeuse (with extinction)",
    text: "Illustrative, not a tight citation — Betelgeuse's distance is genuinely uncertain in the literature (commonly cited estimates span roughly 130–200 pc); ≈163.7 pc, M ≈ −5.85, and A ≈ 0.2 mag are a self-consistent, roughly literature-scale triple used to exercise the extinction term, not a single precise published measurement.",
  },
  {
    title: "Andromeda Galaxy (M31)",
    text: "Distance ≈765,000 pc (≈2.5 million ly) is a commonly cited figure (e.g. Cepheid-based distance work such as McConnachie et al. 2005); M ≈ −21.5 and A ≈ 0.2 mag are illustrative integrated-light figures, not a single precise citation.",
  },
  {
    title: "What these rows actually prove",
    text: "The reference rows confirm the exact formula correctly relates m, M, and d for the object listed, to the stated tolerance — not that those catalog figures are themselves perfectly precise; see each object's own note. The scaling and edge-case rows below don't depend on any external citation at all — they confirm the formula behaves exactly as the algebra predicts on its own terms.",
  },
];

// Catalog figures are published to a handful of significant figures, so a
// small round-trip gap is expected imprecision in the cited numbers, not
// a bug — a real formula error would be off by many percent, not a
// fraction of a magnitude.
const TOLERANCE_MAG = 0.3;

function fmt(n, digits = 4) {
  if (!Number.isFinite(n)) return String(n);
  const rounded = Number(n.toFixed(digits));
  return String(rounded);
}

const REFERENCE_OBJECTS = [
  { label: "Proxima Centauri", M: 15.6, d: 1.3, A: 0, expectedM: 11.13 },
  { label: "Betelgeuse (illustrative, with extinction)", M: -5.85, d: 163.68, A: 0.2, expectedM: 0.42 },
  { label: "Andromeda Galaxy (M31, illustrative, with extinction)", M: -21.5, d: 765000, A: 0.2, expectedM: 3.12 },
];

function referenceRows() {
  return REFERENCE_OBJECTS.map((ref) => {
    const mComputed = apparentFromAbsolute(ref.M, ref.d, ref.A);
    return {
      test: `${ref.label} — apparent magnitude from M, d, A`,
      inputs: `M = ${fmt(ref.M)}, d = ${fmt(ref.d)} pc, A = ${fmt(ref.A)} mag`,
      expected: `≈ ${fmt(ref.expectedM, 2)}`,
      computed: fmt(mComputed, 2),
      pass: Math.abs(mComputed - ref.expectedM) < TOLERANCE_MAG,
    };
  });
}

// Internal-consistency checks: these don't depend on any externally
// published figure, just on the formula responding to each input exactly
// as the algebra predicts.
function consistencyRows() {
  const rows = [];

  rows.push({
    test: "Distance modulus is exactly zero at 10 pc (the definition of M)",
    inputs: "d = 10 pc, A = 0",
    expected: "μ = 0",
    computed: `μ = ${fmt(distanceModulus(10))}`,
    pass: distanceModulus(10) === 0,
  });

  const step1 = distanceModulus(100) - distanceModulus(10);
  const step2 = distanceModulus(1000) - distanceModulus(100);
  rows.push({
    test: "μ grows by exactly 5 mag per factor-of-10 in distance",
    inputs: "μ(100 pc) − μ(10 pc) and μ(1000 pc) − μ(100 pc)",
    expected: "5 and 5",
    computed: `${fmt(step1)} and ${fmt(step2)}`,
    pass: step1 === 5 && step2 === 5,
  });

  const M0 = -5.85, d0 = 163.68, A0 = 0.2;
  const mFromApparent = apparentFromAbsolute(M0, d0, A0);
  const dBack = distanceFromMagnitudes(mFromApparent, M0, A0);
  rows.push({
    test: "Round trip: M, d, A → m → d recovers the original distance",
    inputs: `M = ${fmt(M0)}, d = ${fmt(d0)} pc, A = ${fmt(A0)} mag`,
    expected: `d ≈ ${fmt(d0)} pc recovered`,
    computed: `m = ${fmt(mFromApparent)}, back to d = ${fmt(dBack)} pc`,
    pass: Math.abs(dBack - d0) / d0 < 1e-9,
  });

  const withExt = apparentFromAbsolute(5, 100, 1.0);
  const noExt = apparentFromAbsolute(5, 100, 0);
  rows.push({
    test: "Extinction dims the object by exactly A magnitudes at fixed distance",
    inputs: "M = 5, d = 100 pc, A = 0 vs. A = 1.0 mag",
    expected: "difference = 1.0 mag",
    computed: `${fmt(withExt)} vs. ${fmt(noExt)} (Δ = ${fmt(withExt - noExt)})`,
    pass: Math.abs(withExt - noExt - 1.0) < 1e-9,
  });

  rows.push({
    test: "absoluteFromApparent inverts apparentFromAbsolute",
    inputs: "M = 2.5, d = 1000 pc, A = 1.5 mag",
    expected: "M recovered exactly",
    computed: fmt(absoluteFromApparent(apparentFromAbsolute(2.5, 1000, 1.5), 1000, 1.5)),
    pass: Math.abs(absoluteFromApparent(apparentFromAbsolute(2.5, 1000, 1.5), 1000, 1.5) - 2.5) < 1e-9,
  });

  return rows;
}

// Edge cases: distanceModulus.js is plain algebra with no input guarding
// of its own — rejecting non-positive distances or negative extinction is
// the calculator component's job. These rows document the pure functions'
// actual, unguarded behavior rather than inventing rejection logic they
// don't have.
function edgeCaseRows() {
  const cases = [
    {
      test: "Zero distance",
      inputs: "d = 0 pc",
      expected: "not rejected — log10(0) gives −Infinity",
      run: () => distanceModulus(0),
      check: (v) => v === -Infinity,
    },
    {
      test: "Negative distance",
      inputs: "d = −10 pc",
      expected: "not rejected — log10 of a negative number gives NaN",
      run: () => distanceModulus(-10),
      check: (v) => Number.isNaN(v),
    },
    {
      test: "Negative extinction (unphysical — dust never brightens)",
      inputs: "M = 5, d = 100 pc, A = −1 mag",
      expected: "not rejected — formula has no sign guard on A, object comes out brighter than A = 0",
      run: () => apparentFromAbsolute(5, 100, -1),
      check: (v) => v === apparentFromAbsolute(5, 100, 0) - 1,
    },
  ];

  return cases.map((c) => {
    const computed = c.run();
    return {
      test: c.test,
      inputs: c.inputs,
      expected: c.expected,
      computed: Number.isFinite(computed) ? fmt(computed) : String(computed),
      pass: c.check(computed),
    };
  });
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getDistanceModulusTestRows() {
  return [...referenceRows(), ...consistencyRows(), ...edgeCaseRows()];
}
