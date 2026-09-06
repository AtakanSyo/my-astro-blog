// Test cases for the "Tests" popup on the Eddington Luminosity / Eddington
// Ratio Calculator. These run the calculator's real eddington.js functions
// against the well-known Eddington-luminosity coefficient, this
// calculator's own self-consistent presets, scaling checks, and edge
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
  M_SUN,
  massToKg,
  eddingtonLuminosityWatts,
  eddingtonRatio,
  luminosityFromSI,
  classifyRatio,
} from "./eddington";

export const EDDINGTON_LUMINOSITY_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes above the reference figures
// below — rendered at the bottom of the Tests popup by CalculatorTests.
// Keep these two in sync when either changes.
export const EDDINGTON_LUMINOSITY_TEST_SOURCES = [
  {
    title: "L_Edd ≈ 1.26 × 10³⁸ (M/M_sun) erg/s",
    text: "The standard, widely repeated coefficient for the Eddington luminosity of fully ionized hydrogen, derived from G, the proton mass, c, and the Thomson cross-section (all CODATA 2018 values, as this module's own constants) — see e.g. Rybicki & Lightman, Radiative Processes in Astrophysics, or Frank, King & Raine, Accretion Power in Astrophysics.",
  },
  {
    title: "1.4 M☉ neutron star, L_Edd ≈ 1.8 × 10³⁸ erg/s",
    text: "A commonly cited canonical figure for a 1.4 solar-mass neutron star's Eddington luminosity in the X-ray binary literature — consistent with the 1.26×10³⁸ coefficient times 1.4.",
  },
  {
    title: "This calculator's own presets",
    text: "The 10 M☉ at 50% Eddington, 10⁸ M☉ SMBH at 10% Eddington, and 20 M☉ ULX candidate at 5× Eddington presets are self-consistent by construction (the listed luminosity really is that fraction of L_Edd for that mass) — used below to confirm the full mass → L_Edd → ratio → classification pipeline reproduces the label each preset advertises.",
  },
  {
    title: "What these rows actually prove",
    text: "The reference rows confirm eddingtonLuminosityWatts reproduces the standard 1.26×10³⁸ erg/s per solar mass coefficient, and that the ratio/classification pipeline correctly reproduces this calculator's own curated preset labels. The scaling and edge-case rows don't depend on any external citation — they confirm the formula responds to mass and luminosity exactly as the algebra (and classifyRatio's own thresholds) predict.",
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

// Coefficient check: L_Edd(1 M☉), in erg/s, should reproduce the
// commonly cited ≈1.26×10^38 figure to well within a fraction of a
// percent (the module's constants are CODATA-precision; 1.26 is the
// figure rounded to 3 significant digits).
function coefficientRow() {
  const eddWatts = eddingtonLuminosityWatts(M_SUN);
  const eddErgS = luminosityFromSI(eddWatts, "ergs");
  const expected = 1.26e38;
  return {
    test: "Eddington coefficient for 1 M☉",
    inputs: "M = 1 M☉",
    expected: `≈ ${fmt(expected)} erg/s`,
    computed: `${fmt(eddErgS)} erg/s`,
    pass: percentDiff(eddErgS, expected) < 0.5,
  };
}

// Neutron-star canonical figure.
function neutronStarRow() {
  const eddWatts = eddingtonLuminosityWatts(massToKg(1.4, "msun"));
  const eddErgS = luminosityFromSI(eddWatts, "ergs");
  const expected = 1.8e38;
  return {
    test: "1.4 M☉ neutron star Eddington luminosity",
    inputs: "M = 1.4 M☉",
    expected: `≈ ${fmt(expected)} erg/s`,
    computed: `${fmt(eddErgS)} erg/s`,
    pass: percentDiff(eddErgS, expected) < 5,
  };
}

// This calculator's own self-consistent presets: mass -> L_Edd -> ratio
// -> classification should reproduce each preset's advertised label.
const PRESET_CHECKS = [
  { label: "10 M☉ black hole at 50% Eddington", mass: 10, L: 6.3e38, expectedRatio: 0.5, expectedTone: "warn" },
  { label: "10⁸ M☉ SMBH at 10% Eddington", mass: 1e8, L: 1.26e45, expectedRatio: 0.1, expectedTone: "good" },
  { label: "20 M☉ ULX candidate at 5× Eddington", mass: 20, L: 1.26e40, expectedRatio: 5, expectedTone: "bad" },
];

function presetRows() {
  return PRESET_CHECKS.map((p) => {
    const eddWatts = eddingtonLuminosityWatts(massToKg(p.mass, "msun"));
    const LWatts = p.L * 1e-7; // erg/s -> W
    const lambda = eddingtonRatio(LWatts, eddWatts);
    const classification = classifyRatio(lambda);
    return {
      test: `${p.label} — ratio & classification`,
      inputs: `M = ${fmt(p.mass)} M☉, L = ${fmt(p.L)} erg/s`,
      expected: `λ ≈ ${fmt(p.expectedRatio)}, tone "${p.expectedTone}"`,
      computed: `λ = ${fmt(lambda)}, "${classification?.label ?? "—"}" (${classification?.tone ?? "—"})`,
      pass: percentDiff(lambda, p.expectedRatio) < 1 && classification?.tone === p.expectedTone,
    };
  });
}

// Internal-consistency check: L_Edd is exactly linear in mass — no
// external citation needed, just the formula responding to mass as the
// algebra predicts.
function scalingRows() {
  const m1 = massToKg(5, "msun");
  const m2 = massToKg(50, "msun"); // 10x
  const edd1 = eddingtonLuminosityWatts(m1);
  const edd2 = eddingtonLuminosityWatts(m2);
  return [
    {
      test: "Eddington luminosity scales linearly with mass",
      inputs: "M = 5 M☉ vs. M = 50 M☉ (10× mass)",
      expected: "ratio ≈ 10.0000",
      computed: `ratio = ${fmt(edd2 / edd1)}`,
      pass: percentDiff(edd2 / edd1, 10) < 1e-6,
    },
  ];
}

// Edge cases: eddington.js is pure algebra with no input validation of
// its own (that guard lives in EddingtonLuminosityCalculator.jsx's
// `result` useMemo, which requires a positive mass before calling these)
// — except classifyRatio, which does guard non-positive/non-finite
// ratios itself. These rows document each function's actual, real
// behavior on zero, negative, and degenerate inputs.
function edgeCaseRows() {
  const rows = [];

  const eddAtZeroMass = eddingtonLuminosityWatts(0);
  rows.push({
    test: "Zero mass",
    inputs: "M = 0 kg",
    expected: "not rejected — linear in mass, giving 0",
    computed: `${fmt(eddAtZeroMass)} W`,
    pass: eddAtZeroMass === 0,
  });

  const eddAtNegMass = eddingtonLuminosityWatts(massToKg(-10, "msun"));
  rows.push({
    test: "Negative mass",
    inputs: "M = −10 M☉",
    expected: "not rejected — linear in mass, giving a negative (unphysical) luminosity",
    computed: `${fmt(eddAtNegMass)} W`,
    pass: Number.isFinite(eddAtNegMass) && eddAtNegMass < 0,
  });

  const ratioAtZeroEdd = eddingtonRatio(1e30, 0);
  rows.push({
    test: "Eddington ratio with zero Eddington luminosity",
    inputs: "L = 1e30 W, L_Edd = 0 W",
    expected: "not finite (division by zero, Infinity)",
    computed: fmt(ratioAtZeroEdd),
    pass: ratioAtZeroEdd === Infinity,
  });

  const classifyZero = classifyRatio(0);
  rows.push({
    test: "classifyRatio at λ = 0",
    inputs: "λ = 0",
    expected: "null — guarded as non-physical",
    computed: classifyZero === null ? "null" : JSON.stringify(classifyZero),
    pass: classifyZero === null,
  });

  const classifyNaN = classifyRatio(NaN);
  rows.push({
    test: "classifyRatio at λ = NaN",
    inputs: "λ = NaN",
    expected: "null — guarded as non-finite",
    computed: classifyNaN === null ? "null" : JSON.stringify(classifyNaN),
    pass: classifyNaN === null,
  });

  return rows;
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getEddingtonLuminosityTestRows() {
  return [coefficientRow(), neutronStarRow(), ...presetRows(), ...scalingRows(), ...edgeCaseRows()];
}
