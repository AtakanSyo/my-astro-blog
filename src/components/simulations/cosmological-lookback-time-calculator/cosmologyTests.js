// Test cases for the "Tests" popup on the Cosmological Lookback Time
// Calculator. These run the calculator's real cosmology.js functions
// against the reference figures already stated in this calculator's own
// post text (themselves checked against Astropy's FlatLambdaCDM before
// publication), plus internal scaling and edge-case checks — so this
// table is a genuine live check, not a hardcoded, unverified table, and
// would visibly show failures on this page if the underlying math ever
// broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<slug>Tests.js" per calculator, computing rows from that calculator's
// own math module — to add the Tests popup to another calculator.

import {
  lookbackTimeGyr,
  ageOfUniverseTodayGyr,
  ageAtScaleFactorGyr,
  simpson,
} from "./cosmology";

export const COSMOLOGICAL_LOOKBACK_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes above the reference cases
// below — rendered at the bottom of the Tests popup by CalculatorTests.
// Keep these two in sync when either changes.
export const COSMOLOGICAL_LOOKBACK_TEST_SOURCES = [
  {
    title: "Planck 2018 cosmology (H0 = 67.4, Ωm = 0.315, flat)",
    text: "Standard flat ΛCDM parameters from the Planck 2018 final data release — this calculator's own default preset.",
  },
  {
    title: "WMAP9 cosmology (H0 = 69.32, Ωm = 0.2865, flat)",
    text: "The nine-year WMAP final cosmological parameters — this calculator's second preset.",
  },
  {
    title: "z = 1 reference lookback times (~7.95 Gyr Planck 2018, ~6.0 Gyr Einstein–de Sitter)",
    text: "These round figures are stated in this calculator's own post text, and — per the validation note shown above the calculator — were checked directly against Astropy's FlatLambdaCDM (radiation off, matching this module's matter+Λ-only model) across a range of redshifts and cosmologies, agreeing to better than 1 part in 10⁶. They are not an independent third-party citation beyond that Astropy cross-check.",
  },
  {
    title: "What these rows actually prove",
    text: "The reference rows confirm the exact numerical integration reproduces the calculator's own previously-Astropy-validated lookback times for these cosmologies to the stated tolerance. The scaling and consistency rows confirm the integral responds to H0 and to the age/lookback-time relationship exactly as the algebra predicts, independent of any external citation. The edge-case rows confirm the real, unguarded behavior of lookbackTimeGyr on invalid or unphysical input.",
  },
];

// Reference values are stated to 3-4 significant figures in the
// calculator's own post text, so a fraction-of-a-percent round-trip gap
// is expected rounding, not a bug — a real formula error would be off by
// many percent, not tenths of a percent.
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

// Each case's z + cosmology and its expected lookback time, per the
// "Why the cosmology matters" section of this calculator's own post
// (see COSMOLOGICAL_LOOKBACK_TEST_SOURCES above for how those figures
// were themselves validated).
const REFERENCE_CASES = [
  { label: "z = 1, Planck 2018", z: 1, Om: 0.315, OL: 0.685, H0: 67.4, expectedGyr: 7.95 },
  { label: "Same z = 1, Einstein–de Sitter (Ωm = 1, no dark energy)", z: 1, Om: 1.0, OL: 0, H0: 70, expectedGyr: 6.0 },
];

function referenceRows() {
  return REFERENCE_CASES.map((ref) => {
    const Ok = 1 - ref.Om - ref.OL;
    const lookback = lookbackTimeGyr(ref.z, ref.Om, ref.OL, Ok, ref.H0);
    return {
      test: `${ref.label} — lookback time`,
      inputs: `z = ${fmt(ref.z)}, Ωm = ${fmt(ref.Om)}, ΩΛ = ${fmt(ref.OL)}, H0 = ${fmt(ref.H0)} km/s/Mpc`,
      expected: `≈ ${fmt(ref.expectedGyr)} Gyr`,
      computed: lookback !== null ? `${fmt(lookback)} Gyr` : "rejected",
      pass: lookback !== null && percentDiff(lookback, ref.expectedGyr) < TOLERANCE_PCT,
    };
  });
}

// Internal-consistency checks: these don't depend on any externally
// published figure, just on the integral responding to each input
// exactly as the algebra predicts.
function consistencyRows() {
  const rows = [];

  // Lookback time is exactly proportional to 1/H0 at fixed z, Om, OL —
  // the integral itself doesn't depend on H0 at all, only the Hubble-time
  // prefactor does. So t_L * H0 should be the same constant at any H0.
  const H0a = 67.4, H0b = 100;
  const lookbackA = lookbackTimeGyr(1, 0.315, 0.685, 0, H0a);
  const lookbackB = lookbackTimeGyr(1, 0.315, 0.685, 0, H0b);
  rows.push({
    test: "Lookback time scales as 1/H0 (z, Ωm, ΩΛ fixed)",
    inputs: `z = 1, Ωm = 0.315, ΩΛ = 0.685, H0 = ${fmt(H0a)} vs. ${fmt(H0b)} km/s/Mpc`,
    expected: `t_L × H0 constant`,
    computed: `${fmt(lookbackA * H0a)} vs. ${fmt(lookbackB * H0b)}`,
    pass: lookbackA !== null && lookbackB !== null && percentDiff(lookbackA * H0a, lookbackB * H0b) < 1e-6,
  });

  // Age of the universe today, minus the lookback time to z, should equal
  // the age of the universe computed directly at scale factor a = 1/(1+z)
  // via the independent scale-factor integral — two different paths
  // through the same physics that must agree.
  const Om = 0.315, OL = 0.685, H0 = 67.4, z = 1;
  const age0 = ageOfUniverseTodayGyr(Om, OL, 0, H0);
  const lookback = lookbackTimeGyr(z, Om, OL, 0, H0);
  const ageAtZViaLookback = age0 - lookback;
  const ageAtZDirect = ageAtScaleFactorGyr(1 / (1 + z), Om, OL, 0, H0);
  rows.push({
    test: "Age at emission = age today − lookback time (cross-checked against the direct scale-factor integral)",
    inputs: `z = 1, Ωm = 0.315, ΩΛ = 0.685, H0 = 67.4 km/s/Mpc`,
    expected: "the two independent paths agree",
    computed: `age0 − t_L = ${fmt(ageAtZViaLookback)} Gyr vs. direct = ${fmt(ageAtZDirect)} Gyr`,
    pass: percentDiff(ageAtZViaLookback, ageAtZDirect) < 0.01,
  });

  // Simpson's rule itself, independent of any cosmology: ∫[0,1] x² dx = 1/3
  // exactly, a check on the numerical integrator this whole calculator
  // depends on.
  const simpsonResult = simpson((x) => x * x, 0, 1, 100);
  rows.push({
    test: "Simpson's-rule integrator — ∫₀¹ x² dx (exact analytic result 1/3)",
    inputs: "f(x) = x², [0,1], n = 100 subintervals",
    expected: "≈ 0.3333333",
    computed: fmt(simpsonResult, 7),
    pass: percentDiff(simpsonResult, 1 / 3) < 1e-4,
  });

  // Lookback time to z = 0 is trivially zero — no time has passed looking
  // at redshift zero.
  const lookbackZ0 = lookbackTimeGyr(0, 0.315, 0.685, 0, 67.4);
  rows.push({
    test: "Lookback time at z = 0",
    inputs: "z = 0, Ωm = 0.315, ΩΛ = 0.685, H0 = 67.4 km/s/Mpc",
    expected: "0 Gyr",
    computed: `${fmt(lookbackZ0)} Gyr`,
    pass: lookbackZ0 === 0,
  });

  return rows;
}

// Edge cases: confirm the real, actual behavior of lookbackTimeGyr and
// ageOfUniverseTodayGyr on invalid or unphysical input, rather than
// inventing a rejection behavior the module doesn't have.
function edgeCaseRows() {
  const cases = [
    {
      test: "Negative redshift",
      inputs: "z = −1, Ωm = 0.315, ΩΛ = 0.685, H0 = 67.4",
      expected: "rejected (null)",
      run: () => lookbackTimeGyr(-1, 0.315, 0.685, 0, 67.4),
    },
    {
      test: "Zero H0",
      inputs: "z = 1, Ωm = 0.315, ΩΛ = 0.685, H0 = 0",
      expected: "rejected (null)",
      run: () => lookbackTimeGyr(1, 0.315, 0.685, 0, 0),
    },
    {
      test: "Negative H0",
      inputs: "z = 1, Ωm = 0.315, ΩΛ = 0.685, H0 = −70",
      expected: "rejected (null)",
      run: () => lookbackTimeGyr(1, 0.315, 0.685, 0, -70),
    },
    {
      test: "Unphysical model — E(z)² goes negative before z = 1 (Ωm = 0.01, ΩΛ = 2)",
      inputs: "z = 1, Ωm = 0.01, ΩΛ = 2, Ωk = 1 − 0.01 − 2 = −1.99, H0 = 70",
      expected: "rejected (null) — imaginary E(z) over part of [0, z]",
      run: () => lookbackTimeGyr(1, 0.01, 2, 1 - 0.01 - 2, 70),
    },
    {
      test: "Age of the universe with H0 = 0",
      inputs: "Ωm = 0.315, ΩΛ = 0.685, H0 = 0",
      expected: "rejected (null)",
      run: () => ageOfUniverseTodayGyr(0.315, 0.685, 0, 0),
    },
  ];

  return cases.map((c) => {
    const out = c.run();
    return {
      test: c.test,
      inputs: c.inputs,
      expected: c.expected,
      computed: out === null ? "null" : `${fmt(out)} Gyr (bug — should have been rejected)`,
      pass: out === null,
    };
  });
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getCosmologicalLookbackTestRows() {
  return [...referenceRows(), ...consistencyRows(), ...edgeCaseRows()];
}
