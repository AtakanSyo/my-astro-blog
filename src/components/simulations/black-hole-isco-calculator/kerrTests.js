// Test cases for the "Tests" popup on the Black Hole ISCO Calculator.
// These run the calculator's real kerr.js functions against the exact
// closed-form values stated in that module's own header comment — the
// standard textbook (Bardeen, Press & Teukolsky 1972) checkpoints for
// this formula. See angular-size-calculator's angularSizeTests.js for
// the pattern this follows.

import { iscoRadiusRg, horizonRadiusRg, specificEnergyAtISCO, EQUATORIAL_ERGOSPHERE_RG } from "./kerr";

export const KERR_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

export const KERR_TEST_SOURCES = [
  {
    title: "Bardeen, Press & Teukolsky (1972)",
    text: "The ISCO radius formula this module implements, and the exact checkpoint values these rows test against (6 r_g at zero spin, 1 r_g and 9 r_g at maximal prograde/retrograde spin) are the standard closed-form results from this paper, quoted in essentially every general-relativity textbook that covers Kerr black holes.",
  },
];

const TOLERANCE_PCT = 0.01; // a*=1 is a genuine coordinate degeneracy, approached via a*=1-1e-12, not hit exactly

function percentDiff(a, b) {
  if (b === 0) return a === 0 ? 0 : Infinity;
  return Math.abs((a - b) / b) * 100;
}
function fmt(n, digits = 6) {
  if (!Number.isFinite(n)) return String(n);
  return Number(n.toFixed(digits)).toString();
}

function closedFormRows() {
  const rows = [];

  const isco0 = iscoRadiusRg(0);
  rows.push({
    test: "ISCO radius at zero spin (Schwarzschild)",
    inputs: "a* = 0",
    expected: "exactly 6 r_g (the textbook Schwarzschild ISCO)",
    computed: `${fmt(isco0)} r_g`,
    pass: isco0 === 6,
  });

  const iscoProgradeExtremal = iscoRadiusRg(1 - 1e-12);
  rows.push({
    test: "ISCO radius approaching maximal prograde spin",
    inputs: "a* → 1⁻",
    expected: "→ 1 r_g",
    computed: `${fmt(iscoProgradeExtremal)} r_g`,
    pass: percentDiff(iscoProgradeExtremal, 1) < TOLERANCE_PCT,
  });

  const iscoRetrogradeExtremal = iscoRadiusRg(-1);
  rows.push({
    test: "ISCO radius at maximal retrograde spin",
    inputs: "a* = −1",
    expected: "exactly 9 r_g",
    computed: `${fmt(iscoRetrogradeExtremal)} r_g`,
    pass: iscoRetrogradeExtremal === 9,
  });

  const horizon0 = horizonRadiusRg(0);
  rows.push({
    test: "Event horizon at zero spin equals the Schwarzschild radius",
    inputs: "a* = 0",
    expected: "exactly 2 r_g (= r_s, since r_s = 2GM/c² = 2 r_g)",
    computed: `${fmt(horizon0)} r_g`,
    pass: horizon0 === 2,
  });

  const horizon1 = horizonRadiusRg(1);
  rows.push({
    test: "Event horizon at maximal spin",
    inputs: "a* = 1",
    expected: "exactly 1 r_g",
    computed: `${fmt(horizon1)} r_g`,
    pass: horizon1 === 1,
  });

  rows.push({
    test: "Equatorial ergosphere boundary is spin-independent",
    inputs: "any a* ∈ [−1, 1]",
    expected: "exactly 2 r_g, for every spin",
    computed: `${fmt(EQUATORIAL_ERGOSPHERE_RG)} r_g`,
    pass: EQUATORIAL_ERGOSPHERE_RG === 2,
  });

  return rows;
}

function accretionEfficiencyRows() {
  const eta0 = 1 - specificEnergyAtISCO(0);
  const expectedEta0 = 1 - (2 * Math.sqrt(2)) / 3;
  const eta1 = 1 - specificEnergyAtISCO(1);
  const expectedEta1 = 1 - 1 / Math.sqrt(3);

  return [
    {
      test: "Schwarzschild accretion efficiency",
      inputs: "a* = 0",
      expected: `η = 1 − 2√2/3 ≈ ${(expectedEta0 * 100).toFixed(2)}% (the standard textbook figure)`,
      computed: `${(eta0 * 100).toFixed(4)}%`,
      pass: percentDiff(eta0, expectedEta0) < TOLERANCE_PCT,
    },
    {
      test: "Extremal prograde accretion efficiency",
      inputs: "a* = 1",
      expected: `η = 1 − 1/√3 ≈ ${(expectedEta1 * 100).toFixed(2)}% (the standard textbook figure)`,
      computed: `${(eta1 * 100).toFixed(4)}%`,
      pass: percentDiff(eta1, expectedEta1) < TOLERANCE_PCT,
    },
  ];
}

function edgeCaseRows() {
  const clampedHigh = iscoRadiusRg(5); // out of [-1,1] range
  const clampedLow = horizonRadiusRg(-5);
  return [
    {
      test: "Spin clamped above the physical range",
      inputs: "a* = 5 (unphysical — spins are bounded to [−1, 1])",
      expected: "clamped to a* = 1, same as iscoRadiusRg(1)",
      computed: `${fmt(clampedHigh)} r_g`,
      pass: clampedHigh === iscoRadiusRg(1),
    },
    {
      test: "Spin clamped below the physical range",
      inputs: "a* = −5 (unphysical)",
      expected: "clamped to a* = −1, same as horizonRadiusRg(−1)",
      computed: `${fmt(clampedLow)} r_g`,
      pass: clampedLow === horizonRadiusRg(-1),
    },
  ];
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getKerrTestRows() {
  return [...closedFormRows(), ...accretionEfficiencyRows(), ...edgeCaseRows()];
}
