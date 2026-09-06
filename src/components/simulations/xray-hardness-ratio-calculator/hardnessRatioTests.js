// Test cases for the "Tests" popup on the X-ray Hardness Ratio Calculator.
// These run the calculator's real hardnessRatio.js functions against exact,
// formula-derived reference values and edge cases, so this table is a
// genuine live check — not a hardcoded, unverified table — and would
// visibly show failures on this page if the underlying math ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<slug>Tests.js" per calculator, computing rows from that calculator's
// own math module — to add the Tests popup to another calculator.

import { computeHardnessRatio, LOW_COUNT_THRESHOLD } from "./hardnessRatio";

export const HARDNESS_RATIO_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes above the reference cases below —
// rendered at the bottom of the Tests popup by CalculatorTests. Keep these
// two in sync when either changes.
export const HARDNESS_RATIO_TEST_SOURCES = [
  {
    title: "Definitional checks (HR = 0, +1, −1)",
    text: "HR = (H − S) / (H + S) forces exact values at three limits — an even split (HR = 0), all counts in the hard band (HR = +1), and all counts in the soft band (HR = −1) — derived directly from the formula, not measured against any external source.",
  },
  {
    title: "Band-swap antisymmetry",
    text: "Swapping which band is called \"soft\" and which is \"hard\" must exactly flip the sign of HR, since the denominator H + S is symmetric under that swap while the numerator H − S negates. A genuine algebraic property of the formula, not an empirical claim.",
  },
  {
    title: "What these rows actually prove",
    text: "These checks confirm computeHardnessRatio() correctly implements HR = (H − S)/(H + S) and its documented Poisson-uncertainty default and input-rejection rules — not that any particular source's real soft/hard counts were independently verified.",
  },
];

function fmt(n, digits = 4) {
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-3)) return n.toExponential(3);
  const rounded = Number(n.toFixed(digits));
  return String(rounded);
}

// Definitional reference cases: exact values that follow directly from
// HR = (H - S) / (H + S), not external measurements.
const DEFINITIONAL_CASES = [
  { label: "Even split (balanced)", S: 100, H: 100, expectedHR: 0 },
  { label: "All-hard counts", S: 0, H: 100, expectedHR: 1 },
  { label: "All-soft counts", S: 100, H: 0, expectedHR: -1 },
];

function definitionalRows() {
  return DEFINITIONAL_CASES.map((ref) => {
    const out = computeHardnessRatio(ref.S, ref.H);
    return {
      test: `${ref.label} — HR`,
      inputs: `S = ${fmt(ref.S)}, H = ${fmt(ref.H)}`,
      expected: `HR = ${fmt(ref.expectedHR)}`,
      computed: out.valid ? `HR = ${fmt(out.HR)}` : "rejected",
      pass: out.valid && out.HR === ref.expectedHR,
    };
  });
}

// Internal-consistency checks: these don't depend on any externally
// published figure, just on the formula and its uncertainty propagation
// responding to each input exactly as the algebra predicts.
function consistencyRows() {
  const rows = [];

  const S = 37, H = 963;
  const forward = computeHardnessRatio(S, H);
  const swapped = computeHardnessRatio(H, S);
  rows.push({
    test: "Band-swap antisymmetry: HR(H,S) = -HR(S,H)",
    inputs: `S = ${fmt(S)}, H = ${fmt(H)}`,
    expected: `HR(H,S) = ${fmt(-forward.HR)}`,
    computed: `HR(S,H) = ${fmt(forward.HR)}, HR(H,S) = ${fmt(swapped.HR)}`,
    pass: forward.valid && swapped.valid && swapped.HR === -forward.HR,
  });

  // Default (no custom uncertainty supplied) uses Poisson counting
  // statistics: sigma = sqrt(N) for each band, per this module's own
  // documented default parameters.
  const poisson = computeHardnessRatio(100, 400);
  rows.push({
    test: "Default uncertainty is Poisson (sigma = sqrt(N))",
    inputs: "S = 100, H = 400, no custom sigma supplied",
    expected: "sigma(S) = 10, sigma(H) = 20",
    computed: `sigma(S) = ${fmt(poisson.sigmaS)}, sigma(H) = ${fmt(poisson.sigmaH)}`,
    pass: poisson.valid && poisson.sigmaS === 10 && poisson.sigmaH === 20,
  });

  // The documented sigma_HR propagation formula, computed independently
  // here and compared against what the module actually returns.
  const S2 = 100, H2 = 100, sigmaS2 = 10, sigmaH2 = 10;
  const denom = H2 + S2;
  const expectedSigmaHR = (2 / (denom * denom)) * Math.sqrt(S2 * S2 * sigmaH2 * sigmaH2 + H2 * H2 * sigmaS2 * sigmaS2);
  const propagated = computeHardnessRatio(S2, H2, sigmaS2, sigmaH2);
  rows.push({
    test: "Custom uncertainty propagates via the documented formula",
    inputs: `S = ${fmt(S2)} ± ${fmt(sigmaS2)}, H = ${fmt(H2)} ± ${fmt(sigmaH2)}`,
    expected: `sigma(HR) = ${fmt(expectedSigmaHR, 6)}`,
    computed: propagated.valid ? `sigma(HR) = ${fmt(propagated.sigmaHR, 6)}` : "rejected",
    pass: propagated.valid && Math.abs(propagated.sigmaHR - expectedSigmaHR) < 1e-12,
  });

  return rows;
}

// Edge cases: confirm the real, actual behavior of computeHardnessRatio()
// on invalid and boundary counts, per its own
// `S < 0 || H < 0 || S + H <= 0` rejection guard — rather than inventing
// behavior it doesn't have.
function edgeCaseRows() {
  const rows = [];

  const negative = computeHardnessRatio(-5, 100);
  rows.push({
    test: "Negative soft count is rejected",
    inputs: "S = −5, H = 100",
    expected: "rejected as invalid",
    computed: negative.valid ? "accepted (bug — should have been rejected)" : "rejected",
    pass: negative.valid === false,
  });

  const allZero = computeHardnessRatio(0, 0);
  rows.push({
    test: "All-zero counts are rejected (undefined HR)",
    inputs: "S = 0, H = 0",
    expected: "rejected as invalid",
    computed: allZero.valid ? "accepted (bug — should have been rejected)" : "rejected",
    pass: allZero.valid === false,
  });

  // Low-count flag: confirms lowCounts responds to the module's own
  // LOW_COUNT_THRESHOLD exactly as documented, on both sides of the
  // boundary.
  const belowThreshold = computeHardnessRatio(LOW_COUNT_THRESHOLD - 1, 500);
  const atOrAboveThreshold = computeHardnessRatio(LOW_COUNT_THRESHOLD, 500);
  rows.push({
    test: `Low-count flag trips below LOW_COUNT_THRESHOLD (${LOW_COUNT_THRESHOLD})`,
    inputs: `S = ${LOW_COUNT_THRESHOLD - 1} vs. S = ${LOW_COUNT_THRESHOLD}, H = 500 fixed`,
    expected: "flagged below the threshold, not flagged at or above it",
    computed: `lowCounts = ${belowThreshold.lowCounts} vs. ${atOrAboveThreshold.lowCounts}`,
    pass: belowThreshold.valid && atOrAboveThreshold.valid && belowThreshold.lowCounts === true && atOrAboveThreshold.lowCounts === false,
  });

  return rows;
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getHardnessRatioTestRows() {
  return [...definitionalRows(), ...consistencyRows(), ...edgeCaseRows()];
}
