// Test cases for the "Tests" popup on the Spectral Index Calculator. These
// run the calculator's real spectral.js functions against known reference
// scenarios, internal-consistency checks, and edge cases, so this table is
// a genuine live check — not a hardcoded, unverified table — and would
// visibly show failures on this page if the underlying math ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<slug>Tests.js" per calculator, computing rows from that calculator's
// own math module — to add the Tests popup to another calculator.

import {
  computeAlpha,
  alphaUncertainty,
  extrapolateFlux,
  extrapolatedFluxUncertainty,
  classifySpectrum,
} from "./spectral";

export const SPECTRAL_INDEX_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes above the reference scenarios
// below — rendered at the bottom of the Tests popup by CalculatorTests.
// Keep these two in sync when either changes.
export const SPECTRAL_INDEX_TEST_SOURCES = [
  {
    title: "Steep-spectrum radio galaxy preset (178 MHz / 1400 MHz)",
    text: "Modeled on the classic 178 MHz-to-1.4 GHz flux-scale numbers for Cygnus A (3C 405), one of the best-known steep-spectrum extragalactic radio sources — the literature-standard spectral index quoted for Cygnus A across this range is commonly cited as α ≈ -0.8, matching what this preset's own numbers produce under the formula below.",
  },
  {
    title: "Flat-spectrum blazar core, ultra-steep-spectrum, and inverted/self-absorbed presets",
    text: "Synthetic scenarios built into this calculator, not measurements of a specific named object — chosen so their two flux points land cleanly inside the flat (|α| ≲ 0.1), ultra-steep (α ≲ -1.2), and inverted (α > 0.1) bands this calculator's own classifySpectrum() function distinguishes. Realistic illustrations of each spectral class, not citations of a real source's precise measured flux.",
  },
  {
    title: "What these rows actually prove",
    text: "The preset rows confirm the exact α = ln(S2/S1)/ln(ν2/ν1) formula and classifySpectrum() correctly handle each spectral shape from clean two-point inputs — not that any specific real source's flux was measured to that precision; see each note above. The consistency and uncertainty rows below don't depend on any external reference at all — they confirm the extrapolation formula and its error propagation behave exactly as the algebra predicts.",
  },
];

// Reference values are rounded to a handful of significant figures in the
// calculator's own presets, so a fraction-of-a-percent round-trip gap is
// expected rounding, not a bug — a real formula error would be off by many
// percent, not hundredths.
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

// Each scenario's two flux points are the calculator's own PRESETS values
// (SpectralIndexCalculator.jsx) — see source notes above for what they're
// modeled on. expectedAlpha and expectedClass are the values those numbers
// are designed to land on under this exact formula.
const REFERENCE_SCENARIOS = [
  {
    label: "Steep-spectrum radio galaxy (Cygnus A-like)",
    nu1: 178e6, S1: 10500,
    nu2: 1400e6, S2: 2016.61,
    expectedAlpha: -0.8,
    expectedClass: "Steep spectrum",
  },
  {
    label: "Flat-spectrum blazar core",
    nu1: 1.4e9, S1: 1,
    nu2: 5e9, S2: 0.8805,
    expectedAlpha: -0.1,
    expectedClass: "Flat spectrum",
  },
  {
    label: "Ultra-steep-spectrum source",
    nu1: 150e6, S1: 1,
    nu2: 1400e6, S2: 0.05482,
    expectedAlpha: -1.3,
    expectedClass: "Ultra-steep spectrum",
  },
  {
    label: "Inverted / self-absorbed source",
    nu1: 1e9, S1: 0.1,
    nu2: 5e9, S2: 0.2236,
    expectedAlpha: 0.5,
    expectedClass: "Inverted / self-absorbed",
  },
];

function referenceRows() {
  const rows = [];

  for (const ref of REFERENCE_SCENARIOS) {
    const alphaResult = computeAlpha(ref.S1, ref.nu1, ref.S2, ref.nu2);
    rows.push({
      test: `${ref.label} — spectral index`,
      inputs: `S1 = ${fmt(ref.S1)} Jy @ ν1 = ${fmt(ref.nu1 / 1e6)} MHz, S2 = ${fmt(ref.S2)} Jy @ ν2 = ${fmt(ref.nu2 / 1e6)} MHz`,
      expected: `α ≈ ${fmt(ref.expectedAlpha)}`,
      computed: alphaResult.valid ? `α = ${fmt(alphaResult.alpha)}` : "rejected",
      pass: alphaResult.valid && percentDiff(alphaResult.alpha, ref.expectedAlpha) < TOLERANCE_PCT,
    });

    const classification = alphaResult.valid ? classifySpectrum(alphaResult.alpha) : null;
    rows.push({
      test: `${ref.label} — classification`,
      inputs: `α = ${alphaResult.valid ? fmt(alphaResult.alpha) : "—"}`,
      expected: `"${ref.expectedClass}"`,
      computed: classification ? `"${classification.label}"` : "—",
      pass: Boolean(classification && classification.label === ref.expectedClass),
    });
  }

  return rows;
}

// Internal-consistency checks: these don't depend on any externally
// published figure, just on the formula responding to each input exactly
// as the algebra predicts.
function consistencyRows() {
  const rows = [];

  // Round trip: pick an arbitrary S1, nu1, alpha, and nu2; generate S2 via
  // extrapolateFlux (the same formula the calculator uses for its "predict
  // S3" feature), then feed S1/nu1/S2/nu2 back into computeAlpha — the
  // recovered alpha should exactly match the one used to generate S2.
  const S1 = 3.5, nu1 = 200e6, nu2 = 2e9, originalAlpha = -0.65;
  const S2 = extrapolateFlux(S1, nu1, originalAlpha, nu2);
  const roundTrip = computeAlpha(S1, nu1, S2, nu2);
  rows.push({
    test: "Round trip: generate S2 from α via extrapolateFlux, recover α via computeAlpha",
    inputs: `S1 = ${fmt(S1)} Jy @ ν1 = ${fmt(nu1 / 1e6)} MHz, α = ${fmt(originalAlpha)}, ν2 = ${fmt(nu2 / 1e6)} MHz`,
    expected: `α ≈ ${fmt(originalAlpha)} recovered`,
    computed: roundTrip.valid ? `α = ${fmt(roundTrip.alpha)}` : "rejected",
    pass: roundTrip.valid && percentDiff(roundTrip.alpha, originalAlpha) < 1e-6,
  });

  // Flat spectrum (α = 0) predicts identical flux at every frequency —
  // the defining behavior of a flat power law.
  const flatS3Near = extrapolateFlux(1, 1e9, 0, 2e9);
  const flatS3Far = extrapolateFlux(1, 1e9, 0, 5e10);
  rows.push({
    test: "α = 0 predicts the same flux density at any frequency",
    inputs: "S1 = 1 Jy @ ν1 = 1 GHz, α = 0, extrapolated to ν = 2 GHz and ν = 50 GHz",
    expected: "1 Jy at both frequencies",
    computed: `${fmt(flatS3Near)} Jy, ${fmt(flatS3Far)} Jy`,
    pass: flatS3Near === 1 && flatS3Far === 1,
  });

  // Extrapolation uncertainty compounds with distance (in log-frequency)
  // from the anchor point — a real feature of projecting a power law
  // outward, per this calculator's own explainer text.
  const relS1 = 0.05, sigmaAlpha = 0.02, nu1b = 1e9;
  const relS3Near = extrapolatedFluxUncertainty(relS1, sigmaAlpha, nu1b, 1.5e9);
  const relS3Far = extrapolatedFluxUncertainty(relS1, sigmaAlpha, nu1b, 5e10);
  rows.push({
    test: "Extrapolation uncertainty grows with distance from the anchor frequency",
    inputs: `relS1 = ${fmt(relS1)}, σα = ${fmt(sigmaAlpha)}, ν1 = 1 GHz, extrapolated to ν = 1.5 GHz (near) and ν = 50 GHz (far)`,
    expected: "far uncertainty > near uncertainty > relS1 alone",
    computed: `near: ${fmt(relS3Near, 5)}, far: ${fmt(relS3Far, 5)}`,
    pass: relS3Far > relS3Near && relS3Near > relS1,
  });

  return rows;
}

// Edge cases: computeAlpha is the one function here that DOES guard its
// own inputs (unlike the extrapolation helpers below it, which are pure
// algebra) — these rows confirm it actually rejects the invalid inputs its
// own code checks for, per its `!(S1 > 0) || !(S2 > 0) || !(nu1 > 0) ||
// !(nu2 > 0) || nu1 === nu2` guard.
function edgeCaseRows() {
  const cases = [
    {
      test: "Equal frequencies (undefined slope)",
      inputs: "ν1 = ν2 = 1400 MHz, S1 = 1 Jy, S2 = 2 Jy",
      run: () => computeAlpha(1, 1400e6, 2, 1400e6),
    },
    {
      test: "Zero flux density",
      inputs: "S1 = 0 Jy, ν1 = 178 MHz, S2 = 1 Jy, ν2 = 1400 MHz",
      run: () => computeAlpha(0, 178e6, 1, 1400e6),
    },
    {
      test: "Negative flux density",
      inputs: "S1 = −5 Jy, ν1 = 178 MHz, S2 = 1 Jy, ν2 = 1400 MHz",
      run: () => computeAlpha(-5, 178e6, 1, 1400e6),
    },
    {
      test: "Zero frequency",
      inputs: "S1 = 1 Jy, ν1 = 0 Hz, S2 = 1 Jy, ν2 = 1400 MHz",
      run: () => computeAlpha(1, 0, 1, 1400e6),
    },
    {
      test: "Negative frequency",
      inputs: "S1 = 1 Jy, ν1 = 178 MHz, S2 = 1 Jy, ν2 = −1400 MHz",
      run: () => computeAlpha(1, 178e6, 1, -1400e6),
    },
  ];

  const rows = cases.map((c) => {
    const out = c.run();
    return {
      test: c.test,
      inputs: c.inputs,
      expected: "rejected as invalid",
      computed: out.valid ? "accepted (bug — should have been rejected)" : `rejected — ${out.reason ?? "invalid"}`,
      pass: out.valid === false,
    };
  });

  // alphaUncertainty has its own documented degenerate case: with no flux
  // uncertainty supplied on either side, it returns exactly 0 rather than
  // computing 0/|ln(...)| — confirmed directly against its own code path.
  const zeroUncertainty = alphaUncertainty(0, 0, 178e6, 1400e6);
  rows.push({
    test: "alphaUncertainty with no flux uncertainty on either measurement",
    inputs: "relS1 = 0, relS2 = 0, ν1 = 178 MHz, ν2 = 1400 MHz",
    expected: "exactly 0",
    computed: fmt(zeroUncertainty, 6),
    pass: zeroUncertainty === 0,
  });

  return rows;
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getSpectralIndexTestRows() {
  return [...referenceRows(), ...consistencyRows(), ...edgeCaseRows()];
}
