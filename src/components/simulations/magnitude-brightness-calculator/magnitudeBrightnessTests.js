// Test cases for the "Tests" popup on the Magnitude & Brightness
// Calculator. These run the calculator's real magnitude.js functions
// against known reference figures, internal-consistency checks, and edge
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
  POGSON_RATIO,
  ratioFromMagDiff,
  magDiffFromRatio,
  ratioForMagnitudeStep,
  describeRatio,
  niceStep,
} from "./magnitude";

export const MAGNITUDE_BRIGHTNESS_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes below — rendered at the bottom
// of the Tests popup by CalculatorTests. Keep these two in sync when
// either changes.
export const MAGNITUDE_BRIGHTNESS_TEST_SOURCES = [
  {
    title: "The Pogson ratio (exact, by definition)",
    text: "Norman Pogson's 1856 proposal fixed 5 magnitudes to be exactly a factor of 100 in flux, which makes 1 magnitude exactly 100^(1/5) ≈ 2.51189× — this isn't a measured figure, it's the scale's own definition.",
    url: "https://en.wikipedia.org/wiki/Magnitude_(astronomy)#History",
    urlLabel: "Magnitude (astronomy) — Pogson's ratio",
  },
  {
    title: "Sirius vs. Polaris",
    text: "Standard catalog apparent magnitudes: Sirius ≈ −1.46, Polaris ≈ +1.98 (this calculator's own preset values), implying Sirius is about 24× brighter — the same figure this project's post text cites.",
  },
  {
    title: "The Sun vs. the full Moon",
    text: "Standard apparent magnitudes: Sun ≈ −26.74, full Moon ≈ −12.7 — commonly cited figures (e.g. NASA/IAU reference tables) implying the Sun looks roughly 400,000× brighter than the full Moon.",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html",
    urlLabel: "NASA Sun Fact Sheet",
  },
  {
    title: "Full Moon vs. the faintest naked-eye star",
    text: "Full Moon ≈ −12.7, faintest naked-eye star ≈ +6.5 (both this calculator's own preset values, and the same figures this project's post text uses) — implying a ratio of about 48 million.",
  },
  {
    title: "What these rows actually prove",
    text: "The reference rows confirm the exact formula reproduces the commonly cited brightness ratio for each magnitude pair listed — not that those catalog magnitudes are independently re-measured here. The scaling, round-trip, and edge-case rows below don't depend on any external citation at all — they confirm the formula behaves exactly as the algebra predicts, including on invalid input.",
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

// Reference magnitude pairs: real (or preset-matching) catalog figures,
// checked against a commonly cited brightness ratio for each — see the
// source notes above for where each figure comes from.
const REFERENCE_PAIRS = [
  { label: "Sirius vs. Polaris", mA: -1.46, mB: 1.98, expectedRatio: 24, tolerancePct: 5 },
  { label: "Sun vs. full Moon", mA: -26.74, mB: -12.7, expectedRatio: 400000, tolerancePct: 5 },
  { label: "Full Moon vs. faintest naked-eye star", mA: -12.7, mB: 6.5, expectedRatio: 4.79e7, tolerancePct: 2 },
];

function referenceRows() {
  const rows = [];

  // Pogson's ratio itself — exact by definition, not just "close to" 100.
  {
    const ratio = ratioFromMagDiff(-5);
    rows.push({
      test: "5 magnitudes = exactly a factor of 100 (Pogson's definition)",
      inputs: "Δm = m1 − m2 = −5",
      expected: "100 exactly",
      computed: fmt(ratio, 8),
      pass: percentDiff(ratio, 100) < 1e-6,
    });
  }

  for (const ref of REFERENCE_PAIRS) {
    const ratio = ratioFromMagDiff(ref.mA - ref.mB);
    rows.push({
      test: `${ref.label} — brightness ratio`,
      inputs: `mA = ${fmt(ref.mA)}, mB = ${fmt(ref.mB)}`,
      expected: `≈ ${fmt(ref.expectedRatio)}×`,
      computed: `${fmt(ratio)}×`,
      pass: percentDiff(ratio, ref.expectedRatio) < ref.tolerancePct,
    });
  }

  return rows;
}

// Internal-consistency checks: these don't depend on any externally
// published figure, just on the formula responding to each input exactly
// as the algebra predicts.
function consistencyRows() {
  const rows = [];

  // Round trip: magnitude difference -> ratio -> magnitude difference.
  {
    const deltaM = 3.7;
    const ratio = ratioFromMagDiff(deltaM);
    const back = magDiffFromRatio(ratio);
    rows.push({
      test: "Round trip: Δm → ratio → Δm",
      inputs: `Δm = ${fmt(deltaM)}`,
      expected: `≈ ${fmt(deltaM)} recovered`,
      computed: `ratio = ${fmt(ratio)}, back to Δm = ${fmt(back)}`,
      pass: percentDiff(back, deltaM) < 1e-9,
    });
  }

  // Doubling Δm squares the ratio — a direct consequence of the log scale.
  {
    const r5 = ratioForMagnitudeStep(5);
    const r10 = ratioForMagnitudeStep(10);
    rows.push({
      test: "Doubling Δm squares the brightness ratio",
      inputs: "Δm = 5 vs. Δm = 10",
      expected: `ratio(10) ≈ ratio(5)² = ${fmt(r5 * r5)}`,
      computed: `ratio(5) = ${fmt(r5)}, ratio(10) = ${fmt(r10)}`,
      pass: percentDiff(r10, r5 * r5) < 1e-6,
    });
  }

  // describeRatio's "brighter" label flips symmetrically under inversion.
  {
    const ratio = 24;
    const forward = describeRatio(ratio);
    const inverse = describeRatio(1 / ratio);
    rows.push({
      test: "describeRatio flips symmetrically when the ratio is inverted",
      inputs: `ratioAOverB = ${fmt(ratio)} vs. ${fmt(1 / ratio, 6)}`,
      expected: "same factor, brighter object swaps from A to B",
      computed: `${fmt(forward.factor)}× (${forward.brighter}) vs. ${fmt(inverse.factor)}× (${inverse.brighter})`,
      pass: forward.brighter === "A" && inverse.brighter === "B" && percentDiff(forward.factor, inverse.factor) < 1e-9,
    });
  }

  // One magnitude step is exactly the Pogson ratio.
  {
    const r1 = ratioForMagnitudeStep(1);
    rows.push({
      test: "One magnitude step equals the Pogson ratio exactly",
      inputs: "Δm = 1",
      expected: `POGSON_RATIO ≈ ${fmt(POGSON_RATIO, 6)}`,
      computed: fmt(r1, 6),
      pass: percentDiff(r1, POGSON_RATIO) < 1e-9,
    });
  }

  return rows;
}

// Edge cases: magnitude.js is plain algebra with no input validation of
// its own except in describeRatio (which explicitly rejects non-positive
// ratios) — these rows confirm what each function actually does on
// zero, negative, or degenerate input, rather than inventing rejection
// behavior functions like ratioFromMagDiff/magDiffFromRatio don't have.
function edgeCaseRows() {
  const rows = [];

  {
    const ratio = ratioFromMagDiff(0);
    rows.push({
      test: "Zero magnitude difference",
      inputs: "Δm = 0",
      expected: "ratio = 1 (equally bright)",
      computed: fmt(ratio),
      pass: ratio === 1,
    });
  }

  {
    const result = describeRatio(0);
    rows.push({
      test: "describeRatio rejects a zero ratio",
      inputs: "ratioAOverB = 0",
      expected: "rejected (null) — a zero flux ratio isn't physically meaningful here",
      computed: result === null ? "null" : JSON.stringify(result),
      pass: result === null,
    });
  }

  {
    const result = describeRatio(-5);
    rows.push({
      test: "describeRatio rejects a negative ratio",
      inputs: "ratioAOverB = −5",
      expected: "rejected (null)",
      computed: result === null ? "null" : JSON.stringify(result),
      pass: result === null,
    });
  }

  {
    const deltaM = magDiffFromRatio(0);
    rows.push({
      test: "magDiffFromRatio at a zero ratio (no guard in this function)",
      inputs: "ratio = 0",
      expected: "not rejected — log10(0) is −Infinity, giving Δm = +Infinity",
      computed: fmt(deltaM),
      pass: deltaM === Infinity,
    });
  }

  {
    const deltaM = magDiffFromRatio(-1);
    rows.push({
      test: "magDiffFromRatio at a negative ratio (no guard in this function)",
      inputs: "ratio = −1",
      expected: "not rejected — log10 of a negative number is NaN, giving a non-numeric Δm rather than an error",
      computed: fmt(deltaM),
      pass: Number.isNaN(deltaM),
    });
  }

  {
    const step = niceStep(0);
    const stepNeg = niceStep(-5);
    rows.push({
      test: "niceStep on a non-positive span falls back to 1",
      inputs: "span = 0 and span = −5",
      expected: "1 in both cases (documented fallback)",
      computed: `niceStep(0) = ${fmt(step)}, niceStep(−5) = ${fmt(stepNeg)}`,
      pass: step === 1 && stepNeg === 1,
    });
  }

  return rows;
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getMagnitudeBrightnessTestRows() {
  return [...referenceRows(), ...consistencyRows(), ...edgeCaseRows()];
}
