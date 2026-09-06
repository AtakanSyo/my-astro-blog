// Test cases for the "Tests" popup on the Hubble Law Calculator. These
// run the calculator's real hubbleLaw.js functions against known
// reference clusters, H0-sensitivity round trips, edge cases, and the
// validity-scope helper, so this table is a genuine live check — not a
// hardcoded, unverified table — and would visibly show failures on this
// page if the underlying math ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<slug>Tests.js" per calculator, computing rows from that calculator's
// own math module — to add the Tests popup to another calculator.

import {
  velocityFromDistance,
  distanceFromVelocity,
  velocityFractionOfC,
  getValidityLevel,
  C_KM_S,
} from "./hubbleLaw";

export const HUBBLE_LAW_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes above the reference clusters
// below — rendered at the bottom of the Tests popup by CalculatorTests.
// Keep these two in sync when either changes.
export const HUBBLE_LAW_TEST_SOURCES = [
  {
    title: "Virgo Cluster",
    text: "Commonly cited literature figures rather than a single precise citation — distance estimates cluster around ≈16.5 Mpc (e.g. the ACS Virgo Cluster Survey) and mean recession velocity is cited in the roughly 1,100–1,300 km/s range depending on source and how Local Group infall is corrected for. Used here as a round, mutually consistent pair (16.5 Mpc, 1,155 km/s) implying H0 ≈ 70 km/s/Mpc, near the middle of the current measurement range.",
  },
  {
    title: "Coma Cluster",
    text: "Also commonly cited literature figures, not a single precise citation — distance estimates cluster around ≈100 Mpc and mean heliocentric recession velocity is cited in the roughly 6,900–7,200 km/s range. Used here as a round, mutually consistent pair (100 Mpc, 7,000 km/s) implying H0 ≈ 70 km/s/Mpc.",
  },
  {
    title: "H0 = 67 and H0 = 73 km/s/Mpc",
    text: "Roughly the early-universe (Planck CMB-type, ≈67) and local (Cepheid/supernova-type, ≈73) ends of the current “Hubble tension” range this calculator's own explainer text discusses — used below to check the formula round-trips consistently across that whole range, not just at one H0.",
  },
  {
    title: "What these rows actually prove",
    text: "The cluster rows confirm the exact formula correctly relates v, d, and H0 for the distance/velocity pair listed — not that those two numbers are independently, precisely verified; see each cluster's own note above. A mistaken figure above would still round-trip internally and pass. The H0-sensitivity, edge-case, and validity-scope rows below don't depend on any external citation at all — they confirm the formula and the validity-threshold helper behave correctly on their own terms.",
  },
];

// Reference values are round, commonly cited literature figures (a
// handful of significant figures), so a fraction-of-a-percent round-trip
// gap is expected rounding, not a bug — a real formula error would be off
// by many percent, not hundredths.
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

// Each cluster's d, v, and implied H0 are mutually consistent (see source
// notes above), so one reference pair can validate both "solve for"
// directions against each other rather than against a separately-typed-in
// literature value.
const REFERENCE_CLUSTERS = [
  { label: "Virgo Cluster", d: 16.5, v: 1155, H0: 70 },
  { label: "Coma Cluster", d: 100, v: 7000, H0: 70 },
];

function referenceRows() {
  const rows = [];

  for (const ref of REFERENCE_CLUSTERS) {
    const vComputed = velocityFromDistance(ref.d, ref.H0);
    rows.push({
      test: `${ref.label} — velocity from distance`,
      inputs: `d = ${fmt(ref.d)} Mpc, H0 = ${fmt(ref.H0)} km/s/Mpc`,
      expected: `≈ ${fmt(ref.v)} km/s`,
      computed: `${fmt(vComputed)} km/s`,
      pass: percentDiff(vComputed, ref.v) < TOLERANCE_PCT,
    });

    const dComputed = distanceFromVelocity(ref.v, ref.H0);
    rows.push({
      test: `${ref.label} — distance from velocity`,
      inputs: `v = ${fmt(ref.v)} km/s, H0 = ${fmt(ref.H0)} km/s/Mpc`,
      expected: `≈ ${fmt(ref.d)} Mpc`,
      computed: `${fmt(dComputed)} Mpc`,
      pass: percentDiff(dComputed, ref.d) < TOLERANCE_PCT,
    });
  }

  return rows;
}

// H0-sensitivity round trip: the same distance, run at both ends of the
// current Hubble-tension range, confirming velocityFromDistance and
// distanceFromVelocity invert each other at each H0 independently — not
// just at the ~70 the reference clusters above happen to imply.
function h0SensitivityRows() {
  const TEST_D_MPC = 100;
  const H0_VALUES = [67, 73];

  return H0_VALUES.map((H0) => {
    const v = velocityFromDistance(TEST_D_MPC, H0);
    const dBack = distanceFromVelocity(v, H0);
    return {
      test: `Round trip at H0 = ${H0} km/s/Mpc`,
      inputs: `d = ${fmt(TEST_D_MPC)} Mpc → v (@ H0) → d`,
      expected: `≈ ${fmt(TEST_D_MPC)} Mpc recovered`,
      computed: `v = ${fmt(v)} km/s, back to d = ${fmt(dBack)} Mpc`,
      pass: percentDiff(dBack, TEST_D_MPC) < 1e-6,
    };
  });
}

// hubbleLaw.js's velocityFromDistance/distanceFromVelocity are plain
// linear formulas with no input guarding of their own — rejecting
// zero/negative/invalid inputs is the calculator component's job (see its
// `result` useMemo, which requires H0 > 0 and a positive distance or
// velocity before calling these). These rows document the pure functions'
// actual, unguarded behavior rather than inventing rejection logic they
// don't have.
function edgeCaseRows() {
  const rows = [];

  const vAtZeroD = velocityFromDistance(0, 70);
  rows.push({
    test: "Zero distance ⇒ zero velocity",
    inputs: "d = 0 Mpc, H0 = 70 km/s/Mpc",
    expected: "0 km/s",
    computed: `${fmt(vAtZeroD)} km/s`,
    pass: vAtZeroD === 0,
  });

  const vAtNegD = velocityFromDistance(-10, 70);
  rows.push({
    test: "Negative distance ⇒ negative velocity (formula has no sign guard)",
    inputs: "d = −10 Mpc, H0 = 70 km/s/Mpc",
    expected: "−700 km/s",
    computed: `${fmt(vAtNegD)} km/s`,
    pass: vAtNegD === -700,
  });

  const dAtZeroV = distanceFromVelocity(0, 70);
  rows.push({
    test: "Zero velocity ⇒ zero distance",
    inputs: "v = 0 km/s, H0 = 70 km/s/Mpc",
    expected: "0 Mpc",
    computed: `${fmt(dAtZeroV)} Mpc`,
    pass: dAtZeroV === 0,
  });

  const dAtZeroH0 = distanceFromVelocity(1000, 0);
  rows.push({
    test: "Zero H0 ⇒ distance is not finite (division by zero, not a silently wrong number)",
    inputs: "v = 1000 km/s, H0 = 0 km/s/Mpc",
    expected: "not finite (Infinity)",
    computed: Number.isFinite(dAtZeroH0) ? `${fmt(dAtZeroH0)} Mpc (bug — should be non-finite)` : "Infinity",
    pass: !Number.isFinite(dAtZeroH0),
  });

  const vAtNegH0 = velocityFromDistance(10, -70);
  rows.push({
    test: "Negative H0 ⇒ negative velocity (formula has no sign guard)",
    inputs: "d = 10 Mpc, H0 = −70 km/s/Mpc",
    expected: "−700 km/s",
    computed: `${fmt(vAtNegH0)} km/s`,
    pass: vAtNegH0 === -700,
  });

  return rows;
}

// Validity-scope check: confirms getValidityLevel doesn't flag a velocity
// comfortably below its own ~10%/20% of c thresholds, and does flag one
// comfortably above them.
function validityScopeRows() {
  const cases = [
    { label: "5% of c (comfortably below the 10% warning threshold)", frac: 0.05, expected: "ok" },
    { label: "15% of c (between the 10% and 20% thresholds)", frac: 0.15, expected: "warn" },
    { label: "30% of c (comfortably above the 20% threshold)", frac: 0.3, expected: "bad" },
  ];

  return cases.map(({ label, frac, expected }) => {
    const vKms = frac * C_KM_S;
    const level = getValidityLevel(vKms);
    return {
      test: `Validity check — ${label}`,
      inputs: `v = ${fmt(vKms, 1)} km/s (${fmt(velocityFractionOfC(vKms) * 100, 1)}% c)`,
      expected: `getValidityLevel ⇒ "${expected}"`,
      computed: `"${level}"`,
      pass: level === expected,
    };
  });
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getHubbleLawTestRows() {
  return [...referenceRows(), ...h0SensitivityRows(), ...edgeCaseRows(), ...validityScopeRows()];
}
