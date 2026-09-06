// Test cases for the "Tests" popup on the Redshift ↔ Observed Wavelength
// Calculator. These run the calculator's real redshift.js functions
// against known reference spectral-line shifts, internal scaling/round-trip
// checks, and edge cases, so this table is a genuine live check — not a
// hardcoded, unverified table — and would visibly show failures on this
// page if the underlying math ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<slug>Tests.js" per calculator, computing rows from that calculator's
// own math module — to add the Tests popup to another calculator.

import {
  C,
  wavelengthToMeters,
  metersToWavelength,
  computeRedshift,
  computeObservedWavelength,
  computeRestWavelength,
  velocityClassical,
  velocityRelativistic,
} from "./redshift";

export const REDSHIFT_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes above the reference objects
// below — rendered at the bottom of the Tests popup by CalculatorTests.
// Keep these two in sync when either changes.
export const REDSHIFT_TEST_SOURCES = [
  {
    title: "3C 273 quasar (Hβ line)",
    text: "Maarten Schmidt's 1963 discovery that 3C 273's emission lines matched the hydrogen Balmer series shifted to z ≈ 0.158 — the first quasar redshift measurement. Hβ's rest wavelength (486.1 nm) is a standard atomic-physics figure; 562.904 nm is the observed wavelength this implies under the exact formula, same as this calculator's own preset.",
    url: "https://en.wikipedia.org/wiki/3C_273",
    urlLabel: "3C 273 (Wikipedia)",
  },
  {
    title: "Andromeda Galaxy blueshift (Hα line)",
    text: "Andromeda is one of the few galaxies with a measured blueshift, approaching at roughly 300 km/s. Hα's rest wavelength (656.3 nm) is a standard atomic-physics figure; z ≈ −0.001004 and 655.641 nm observed are the mutually consistent figures this calculator's own preset uses.",
  },
  {
    title: "Illustrative high-z quasar (Lyman-alpha, z = 6)",
    text: "Not a specific named object — a round, illustrative example chosen to exercise a large redshift. Lyman-alpha's rest wavelength (121.6 nm) is a standard atomic-physics figure; real z ≈ 6 quasars exist (e.g. those found in reionization-epoch surveys), but this exact pairing is synthetic.",
  },
  {
    title: "What these rows actually prove",
    text: "The reference rows confirm the exact formula correctly relates z, rest wavelength, and observed wavelength for the figures listed — not that those figures are independently, precisely verified beyond the citations above. The scaling, round-trip, and velocity rows below don't depend on any external citation at all — they confirm the formula behaves exactly as the algebra predicts on its own terms.",
  },
];

function fmt(n, digits = 6) {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-4)) return n.toExponential(3);
  const rounded = Number(n.toFixed(digits));
  return String(rounded);
}

function percentDiff(a, b) {
  if (b === 0) return a === 0 ? 0 : Infinity;
  return Math.abs((a - b) / b) * 100;
}

// Each object's z, rest wavelength, and observed wavelength are mutually
// consistent under the exact formula (see source notes above), so one
// reference triple can validate all three "solve for" directions against
// each other rather than against a separately-typed-in literature value.
const REFERENCE_OBJECTS = [
  { label: "3C 273 quasar (Hβ, Schmidt 1963)", z: 0.158, lamRest: 486.1, lamObs: 562.904 },
  { label: "Andromeda Galaxy blueshift (Hα)", z: -0.001004, lamRest: 656.3, lamObs: 655.641 },
  { label: "Illustrative high-z quasar (Lyman-alpha)", z: 6, lamRest: 121.6, lamObs: 851.2 },
];

// z can sit arbitrarily close to zero (as Andromeda's does), where a
// percent-based tolerance blows up on tiny denominators — an absolute
// tolerance is the honest check there. Wavelengths are always comfortably
// positive, so a percent tolerance works fine for those.
const Z_ABS_TOL = 1e-3;
const WAVELENGTH_TOLERANCE_PCT = 0.05;

function referenceRows() {
  const rows = [];

  for (const ref of REFERENCE_OBJECTS) {
    const restM = wavelengthToMeters(ref.lamRest, "nm");
    const obsM = wavelengthToMeters(ref.lamObs, "nm");

    const zOut = computeRedshift(restM, obsM);
    rows.push({
      test: `${ref.label} — solve redshift`,
      inputs: `λ_rest = ${fmt(ref.lamRest)} nm, λ_obs = ${fmt(ref.lamObs)} nm`,
      expected: `≈ ${fmt(ref.z)}`,
      computed: zOut.valid ? fmt(zOut.z) : "rejected",
      pass: zOut.valid && Math.abs(zOut.z - ref.z) < Z_ABS_TOL,
    });

    const obsOut = computeObservedWavelength(ref.z, restM);
    const obsComputedNm = obsOut.valid ? metersToWavelength(obsOut.lamObsM, "nm") : NaN;
    rows.push({
      test: `${ref.label} — solve observed wavelength`,
      inputs: `z = ${fmt(ref.z)}, λ_rest = ${fmt(ref.lamRest)} nm`,
      expected: `≈ ${fmt(ref.lamObs)} nm`,
      computed: obsOut.valid ? `${fmt(obsComputedNm)} nm` : "rejected",
      pass: obsOut.valid && percentDiff(obsComputedNm, ref.lamObs) < WAVELENGTH_TOLERANCE_PCT,
    });

    const restOut = computeRestWavelength(ref.z, obsM);
    const restComputedNm = restOut.valid ? metersToWavelength(restOut.lamRestM, "nm") : NaN;
    rows.push({
      test: `${ref.label} — solve rest wavelength`,
      inputs: `z = ${fmt(ref.z)}, λ_obs = ${fmt(ref.lamObs)} nm`,
      expected: `≈ ${fmt(ref.lamRest)} nm`,
      computed: restOut.valid ? `${fmt(restComputedNm)} nm` : "rejected",
      pass: restOut.valid && percentDiff(restComputedNm, ref.lamRest) < WAVELENGTH_TOLERANCE_PCT,
    });
  }

  return rows;
}

// Internal-consistency checks: these don't depend on any externally
// published figure, just on the formula responding to each input exactly
// as the algebra predicts.
function consistencyRows() {
  const rows = [];

  // Observed wavelength is linear in rest wavelength at fixed z.
  const zFixed = 0.5;
  const restA = wavelengthToMeters(100, "nm");
  const restB = wavelengthToMeters(200, "nm"); // 2x restA
  const obsA = computeObservedWavelength(zFixed, restA).lamObsM;
  const obsB = computeObservedWavelength(zFixed, restB).lamObsM;
  rows.push({
    test: "Observed wavelength scales linearly with rest wavelength (fixed z)",
    inputs: `z = ${fmt(zFixed)}, λ_rest = 100 nm vs. λ_rest = 200 nm`,
    expected: "ratio ≈ 2.000000",
    computed: `ratio = ${fmt(obsB / obsA)}`,
    pass: percentDiff(obsB / obsA, 2) < 1e-6,
  });

  // Round trip: z → observed wavelength → z, across a wide range of z
  // (blueshift, near-zero, and high-z), all at a fixed rest wavelength.
  const restM = wavelengthToMeters(500, "nm");
  const zValues = [-0.5, -0.001, 0, 0.5, 2, 6];
  for (const z of zValues) {
    const obsM = computeObservedWavelength(z, restM).lamObsM;
    const zBack = computeRedshift(restM, obsM).z;
    rows.push({
      test: `Round trip at z = ${fmt(z)}`,
      inputs: `λ_rest = 500 nm → λ_obs (@ z) → z`,
      expected: `≈ ${fmt(z)} recovered`,
      computed: `λ_obs = ${fmt(metersToWavelength(obsM, "nm"))} nm, back to z = ${fmt(zBack)}`,
      pass: Math.abs(zBack - z) < 1e-9,
    });
  }

  return rows;
}

// Classical (v = cz) vs. relativistic Doppler velocity: they should agree
// closely for z ≪ 1, and diverge sharply at large z, where the classical
// formula is known to break down (and can exceed c).
function velocityRows() {
  const rows = [];

  const zSmall = 0.001;
  const vClassicalSmall = velocityClassical(zSmall);
  const vRelSmall = velocityRelativistic(zSmall);
  rows.push({
    test: "Classical and relativistic velocity agree closely at small z",
    inputs: `z = ${fmt(zSmall)}`,
    expected: "agreement within 1%",
    computed: `v_classical = ${fmt(vClassicalSmall / 1000)} km/s, v_rel = ${fmt(vRelSmall / 1000)} km/s (${fmt(percentDiff(vClassicalSmall, vRelSmall), 3)}% diff)`,
    pass: percentDiff(vClassicalSmall, vRelSmall) < 1,
  });

  const zLarge = 6;
  const vClassicalLarge = velocityClassical(zLarge);
  const vRelLarge = velocityRelativistic(zLarge);
  rows.push({
    test: "Classical velocity exceeds c at large z; relativistic never does",
    inputs: `z = ${fmt(zLarge)}`,
    expected: "v_classical > c, v_relativistic < c",
    computed: `v_classical = ${fmt(vClassicalLarge / C, 3)} c, v_relativistic = ${fmt(vRelLarge / C, 3)} c`,
    pass: vClassicalLarge > C && Math.abs(vRelLarge) < C,
  });

  // Relativistic Doppler velocity should approach (but never reach) c as
  // z grows arbitrarily large — a direct check of the formula's own
  // limiting behavior, R = 1+z → ∞ ⇒ (R²-1)/(R²+1) → 1.
  const zHuge = 1000;
  const vRelHuge = velocityRelativistic(zHuge);
  rows.push({
    test: "Relativistic velocity approaches (but stays under) c as z → large",
    inputs: `z = ${fmt(zHuge)}`,
    expected: "v/c very close to 1, but < 1",
    computed: `v_relativistic = ${fmt(vRelHuge / C, 6)} c`,
    pass: vRelHuge / C < 1 && vRelHuge / C > 0.999,
  });

  return rows;
}

// redshift.js's compute* functions do their own input validation (unlike
// some of this site's other pure-algebra modules) — these rows confirm
// that real, documented rejection behavior rather than inventing it.
function edgeCaseRows() {
  const cases = [
    {
      test: "Zero rest wavelength",
      inputs: "λ_rest = 0 m, λ_obs = 500 nm",
      run: () => computeRedshift(0, wavelengthToMeters(500, "nm")),
    },
    {
      test: "Negative observed wavelength",
      inputs: "λ_rest = 500 nm, λ_obs = −100 nm",
      run: () => computeRedshift(wavelengthToMeters(500, "nm"), wavelengthToMeters(-100, "nm")),
    },
    {
      test: "z = −1 exactly (1+z = 0)",
      inputs: "z = −1, λ_rest = 500 nm",
      run: () => computeObservedWavelength(-1, wavelengthToMeters(500, "nm")),
    },
    {
      test: "z below −1 (1+z negative)",
      inputs: "z = −2, λ_rest = 500 nm",
      run: () => computeObservedWavelength(-2, wavelengthToMeters(500, "nm")),
    },
    {
      test: "Zero observed wavelength (solving for rest)",
      inputs: "z = 5, λ_obs = 0 m",
      run: () => computeRestWavelength(5, 0),
    },
  ];

  return cases.map((c) => {
    const out = c.run();
    return {
      test: c.test,
      inputs: c.inputs,
      expected: "rejected as invalid",
      computed: out.valid ? "accepted (bug — should have been rejected)" : `rejected — ${out.reason ?? "invalid"}`,
      pass: out.valid === false,
    };
  });
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getRedshiftTestRows() {
  return [...referenceRows(), ...consistencyRows(), ...velocityRows(), ...edgeCaseRows()];
}
