// Test cases for the "Tests" popup on the Doppler Shift / Radial
// Velocity Calculator. These run the calculator's real doppler.js
// functions against known reference wavelengths and velocities, and
// internal-consistency checks, so this table is a genuine live check —
// not a hardcoded, unverified table — and would visibly show failures
// on this page if the underlying math ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<slug>Tests.js" per calculator, computing rows from that calculator's
// own math module — to add the Tests popup to another calculator.

import {
  C,
  wavelengthToMeters,
  msToVelocity,
  velocityClassical,
  velocityRelativistic,
  observedWavelengthClassical,
  observedWavelengthRelativistic,
  ratioClassical,
  ratioRelativistic,
} from "./doppler";

export const DOPPLER_RADIAL_VELOCITY_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes above the reference cases
// below — rendered at the bottom of the Tests popup by CalculatorTests.
// Keep these two in sync when either changes.
export const DOPPLER_RADIAL_VELOCITY_TEST_SOURCES = [
  {
    title: "Hα rest wavelength (656.28 nm)",
    text: "The Balmer-series Hα line's laboratory rest wavelength — a standard, widely tabulated spectroscopic constant. The 656.50 nm observed value is this calculator's own worked example (a receding source at ≈+100.5 km/s under the classical formula).",
  },
  {
    title: "Andromeda Galaxy (M31) — real heliocentric radial velocity",
    text: "M31 is one of the few galaxies blueshifted rather than redshifted, approaching at a commonly cited heliocentric radial velocity of about −300 km/s (catalog figures typically fall in the −295 to −301 km/s range, e.g. NED/RC3-derived values). The 655.621 nm observed wavelength used here is back-computed from the Hα rest line at a round −301 km/s for a self-consistent test case.",
  },
  {
    title: "Relativistic jet clump (0.3c, illustrative)",
    text: "A synthetic example, not a specific published measurement — chosen to exercise a real fraction-of-light-speed velocity, in the regime relativistic jets and some supernova ejecta actually reach, where the classical approximation visibly fails.",
  },
  {
    title: "What these rows actually prove",
    text: "The reference rows confirm the exact formula correctly relates λ0, λ_obs, and v_r for the case listed, to the stated tolerance. The scaling and edge-case rows below don't depend on any external citation at all — they confirm the classical and relativistic formulas behave exactly as the algebra predicts, including at and beyond the speed of light where the relativistic formula must reject the input.",
  },
];

// Reference wavelengths are published/derived to a handful of significant
// figures, so a small round-trip gap is expected rounding, not a bug — a
// real formula error would be off by many percent, not a fraction of a
// percent.
const TOLERANCE_PCT = 0.5;

function fmt(n, digits = 4) {
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-3)) return n.toExponential(3);
  const rounded = Number(n.toFixed(digits));
  return String(rounded);
}

function percentDiff(a, b) {
  if (b === 0) return a === 0 ? 0 : Infinity;
  return Math.abs((a - b) / b) * 100;
}

const REFERENCE_CASES = [
  { label: "Hα worked example (classical)", lamRestNm: 656.28, lamObsNm: 656.5, mode: "classical", expectedKms: 100.5 },
  { label: "Andromeda Galaxy (M31), classical", lamRestNm: 656.28, lamObsNm: 655.621, mode: "classical", expectedKms: -301 },
  { label: "Andromeda Galaxy (M31), relativistic", lamRestNm: 656.28, lamObsNm: 655.621, mode: "relativistic", expectedKms: -301 },
  { label: "Relativistic jet clump (0.3c, illustrative)", lamRestNm: 656.28, lamObsNm: 894.359, mode: "relativistic", expectedKms: 89937.7 },
];

function referenceRows() {
  return REFERENCE_CASES.map((ref) => {
    const lamRestM = wavelengthToMeters(ref.lamRestNm, "nm");
    const lamObsM = wavelengthToMeters(ref.lamObsNm, "nm");
    const vMs = ref.mode === "relativistic" ? velocityRelativistic(lamRestM, lamObsM) : velocityClassical(lamRestM, lamObsM);
    const vKms = msToVelocity(vMs, "kms");
    return {
      test: `${ref.label} — radial velocity`,
      inputs: `λ0 = ${fmt(ref.lamRestNm)} nm, λ_obs = ${fmt(ref.lamObsNm)} nm (${ref.mode})`,
      expected: `≈ ${fmt(ref.expectedKms)} km/s`,
      computed: `${fmt(vKms)} km/s`,
      pass: percentDiff(vKms, ref.expectedKms) < TOLERANCE_PCT,
    };
  });
}

// Internal-consistency checks: these don't depend on any externally
// published figure, just on the formulas responding to each input
// exactly as the algebra predicts.
function consistencyRows() {
  const rows = [];
  const lamRestM = wavelengthToMeters(656.28, "nm");

  const vTestMs = 12345; // an arbitrary radial velocity, m/s
  const lamObsClassical = observedWavelengthClassical(lamRestM, vTestMs);
  const vBackClassical = velocityClassical(lamRestM, lamObsClassical);
  rows.push({
    test: "Classical round trip: v → λ_obs → v recovers the original velocity",
    inputs: `λ0 = 656.28 nm, v = ${fmt(vTestMs)} m/s`,
    expected: `v ≈ ${fmt(vTestMs)} m/s recovered`,
    computed: `${fmt(vBackClassical)} m/s`,
    pass: percentDiff(vBackClassical, vTestMs) < 1e-6,
  });

  const lamObsRel = observedWavelengthRelativistic(lamRestM, vTestMs);
  const vBackRel = velocityRelativistic(lamRestM, lamObsRel);
  rows.push({
    test: "Relativistic round trip: v → λ_obs → v recovers the original velocity",
    inputs: `λ0 = 656.28 nm, v = ${fmt(vTestMs)} m/s`,
    expected: `v ≈ ${fmt(vTestMs)} m/s recovered`,
    computed: `${fmt(vBackRel)} m/s`,
    pass: percentDiff(vBackRel, vTestMs) < 1e-6,
  });

  rows.push({
    test: "Both formulas agree exactly at zero velocity (β = 0)",
    inputs: "β = 0",
    expected: "ratio = 1 for both",
    computed: `classical = ${fmt(ratioClassical(0))}, relativistic = ${fmt(ratioRelativistic(0))}`,
    pass: ratioClassical(0) === 1 && ratioRelativistic(0) === 1,
  });

  const classicalHigh = ratioClassical(0.3);
  const relHigh = ratioRelativistic(0.3);
  rows.push({
    test: "Classical and relativistic formulas visibly diverge at a real fraction of c",
    inputs: "β = 0.3",
    expected: "relativistic ratio noticeably larger than classical",
    computed: `classical = ${fmt(classicalHigh)}, relativistic = ${fmt(relHigh)} (Δ = ${fmt(relHigh - classicalHigh)})`,
    pass: relHigh > classicalHigh && relHigh - classicalHigh > 0.05,
  });

  return rows;
}

// Edge cases: confirm the real, actual behavior of the relativistic
// functions at and beyond the speed of light, and of the classical
// formula on a degenerate rest wavelength — rather than inventing
// rejection logic the module doesn't have. (Input validation such as
// "velocity must be less than c" lives in the calculator component's own
// `result` useMemo, not in doppler.js itself.)
function edgeCaseRows() {
  const lamRestM = wavelengthToMeters(656.28, "nm");
  const cases = [
    {
      test: "Relativistic observed wavelength at exactly v = c",
      inputs: "λ0 = 656.28 nm, v = c",
      expected: "rejected (null) — |β| ≥ 1",
      run: () => observedWavelengthRelativistic(lamRestM, C),
      check: (v) => v === null,
    },
    {
      test: "Relativistic observed wavelength beyond c (v = 1.5c)",
      inputs: "λ0 = 656.28 nm, v = 1.5c",
      expected: "rejected (null) — |β| ≥ 1",
      run: () => observedWavelengthRelativistic(lamRestM, 1.5 * C),
      check: (v) => v === null,
    },
    {
      test: "Relativistic ratio at |β| = 1",
      inputs: "β = 1 and β = −1",
      expected: "rejected (null) for both",
      run: () => [ratioRelativistic(1), ratioRelativistic(-1)],
      check: (v) => v[0] === null && v[1] === null,
    },
    {
      test: "Classical velocity with a zero rest wavelength (degenerate input)",
      inputs: "λ0 = 0, λ_obs = 500 nm",
      expected: "not rejected — division by zero, giving +Infinity",
      run: () => velocityClassical(0, wavelengthToMeters(500, "nm")),
      check: (v) => v === Infinity,
    },
    {
      test: "Relativistic velocity as λ_obs → 0 (extreme blueshift limit)",
      inputs: "λ0 = 656.28 nm, λ_obs = 0",
      expected: "not rejected — formula's limiting case gives exactly −c",
      run: () => velocityRelativistic(lamRestM, 0),
      check: (v) => v === -C,
    },
  ];

  return cases.map((c) => {
    const computed = c.run();
    return {
      test: c.test,
      inputs: c.inputs,
      expected: c.expected,
      computed: Array.isArray(computed) ? computed.map((x) => (x === null ? "null" : fmt(x))).join(", ") : computed === null ? "null" : fmt(computed),
      pass: c.check(computed),
    };
  });
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getDopplerRadialVelocityTestRows() {
  return [...referenceRows(), ...consistencyRows(), ...edgeCaseRows()];
}
