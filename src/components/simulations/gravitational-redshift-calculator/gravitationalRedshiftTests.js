// Test cases for the "Tests" popup on the Gravitational Redshift
// Calculator. These run the calculator's real gravitationalRedshift.js
// functions against known reference bodies, internal-consistency checks,
// and edge cases, so this table is a genuine live check — not a
// hardcoded, unverified table — and would visibly show failures on this
// page if the underlying math ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<slug>Tests.js" per calculator, computing rows from that calculator's
// own math module — to add the Tests popup to another calculator.

import {
  M_SUN,
  R_SUN_M,
  massToKg,
  radiusToMeters,
  schwarzschildRadiusM,
  gravitationalRedshift,
  redshiftFactorBetween,
  naiveEquivalentVelocity,
} from "./gravitationalRedshift";

export const GRAVITATIONAL_REDSHIFT_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes below — rendered at the bottom
// of the Tests popup by CalculatorTests. Keep these two in sync when
// either changes.
export const GRAVITATIONAL_REDSHIFT_TEST_SOURCES = [
  {
    title: "The Sun's surface redshift (~636 m/s equivalent)",
    text: "IAU nominal solar mass and radius (this module's own M_SUN, R_SUN_M) run through the exact formula give z ≈ 2.12×10⁻⁶ — a naive equivalent velocity of ≈636 m/s, matching the commonly cited size of the Sun's own gravitational redshift measured spectroscopically (e.g. LoPresto, Schrader & Church 1991, using the solar infrared oxygen triplet).",
    url: "https://articles.adsabs.harvard.edu/pdf/1991ApJ...376..757L",
    urlLabel: "LoPresto et al. 1991, ApJ 376, 757",
  },
  {
    title: "Sirius B (white dwarf) redshift",
    text: "Mass ≈1.02 M☉, radius ≈5846 km — the same figures as this calculator's own \"White dwarf (Sirius B-like)\" preset. Run through the exact formula they give a naive equivalent velocity of ≈77 km/s, close to the Hubble Space Telescope measurement of 80.4 ± 4.8 km/s for Sirius B's real gravitational redshift.",
    url: "https://academic.oup.com/mnras/article/362/4/1134/1010577",
    urlLabel: "Barstow et al. 2005, MNRAS 362, 1134",
  },
  {
    title: "Photon sphere identity (R = 1.5 r_s ⇒ z = √3 − 1)",
    text: "A standard, exact result in Schwarzschild geometry — at the photon sphere, plugging R = 1.5 r_s into z = (1 − r_s/R)^(−1/2) − 1 gives exactly √3 − 1 ≈ 0.7320508, independent of mass. Not tied to any specific body.",
  },
  {
    title: "What these rows actually prove",
    text: "The reference rows confirm the exact formula reproduces the commonly cited scale of these real bodies' gravitational redshifts to the stated tolerance — not that the cited mass/radius figures themselves are independently re-verified here. The scaling, round-trip, and edge-case rows below don't depend on any external citation at all — they confirm the formula and its Schwarzschild-radius guard behave exactly as the algebra predicts.",
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

// Reference bodies: real (or preset-matching) mass/radius pairs, checked
// against a commonly cited naive-equivalent-velocity figure for each —
// see the source notes above for where each figure comes from.
function referenceRows() {
  const rows = [];

  // Sun's surface — IAU nominal mass and radius, this module's own constants.
  {
    const z = gravitationalRedshift(M_SUN, R_SUN_M);
    const v = naiveEquivalentVelocity(z);
    rows.push({
      test: "Sun's surface — naive equivalent velocity",
      inputs: `M = 1 M☉, R = 1 R☉ (M_SUN = ${fmt(M_SUN)} kg, R_SUN_M = ${fmt(R_SUN_M)} m)`,
      expected: "≈ 636 m/s",
      computed: `${fmt(v, 1)} m/s (z ≈ ${fmt(z, 8)})`,
      pass: percentDiff(v, 636) < 5,
    });
  }

  // Sirius B — same mass/radius as the calculator's own white-dwarf preset.
  {
    const massKg = massToKg(1.02, "msun");
    const radiusM = radiusToMeters(5846, "km");
    const z = gravitationalRedshift(massKg, radiusM);
    const v = naiveEquivalentVelocity(z) / 1000; // km/s
    rows.push({
      test: "Sirius B — naive equivalent velocity",
      inputs: "M = 1.02 M☉, R = 5846 km",
      expected: "≈ 80 km/s (measured: 80.4 ± 4.8 km/s)",
      computed: `${fmt(v, 2)} km/s (z ≈ ${fmt(z, 6)})`,
      pass: Number.isFinite(v) && percentDiff(v, 80.4) < 15,
    });
  }

  // Photon sphere — exact identity, any mass.
  {
    const massKg = massToKg(10, "msun");
    const rs = schwarzschildRadiusM(massKg);
    const z = gravitationalRedshift(massKg, rs * 1.5);
    const expectedZ = Math.sqrt(3) - 1;
    rows.push({
      test: "Photon sphere (R = 1.5 r_s) — exact identity",
      inputs: "M = 10 M☉, R = 1.5 r_s",
      expected: `z = √3 − 1 ≈ ${fmt(expectedZ, 6)}`,
      computed: `z ≈ ${fmt(z, 6)}`,
      pass: percentDiff(z, expectedZ) < 0.01,
    });
  }

  return rows;
}

// Internal-consistency checks: these don't depend on any externally
// published figure, just on the formula responding to each input exactly
// as the algebra predicts.
function consistencyRows() {
  const rows = [];

  // Schwarzschild radius scales linearly with mass.
  {
    const massKg = massToKg(5, "msun");
    const rs1 = schwarzschildRadiusM(massKg);
    const rs2 = schwarzschildRadiusM(massKg * 2);
    rows.push({
      test: "Schwarzschild radius scales linearly with mass",
      inputs: "M = 5 M☉ vs. M = 10 M☉",
      expected: "ratio ≈ 2.0000",
      computed: `ratio = ${fmt(rs2 / rs1, 6)}`,
      pass: percentDiff(rs2 / rs1, 2) < 1e-6,
    });
  }

  // Unit-independence: the same physical mass and radius, entered in
  // different units, must give the same z.
  {
    const massKgEquivalent = 2 * M_SUN; // 2 M☉ expressed directly in kg via the module's own M_SUN constant
    const zViaMsun = gravitationalRedshift(massToKg(2, "msun"), radiusToMeters(2000, "km"));
    const zViaKg = gravitationalRedshift(massToKg(massKgEquivalent, "kg"), radiusToMeters(2000000, "m"));
    rows.push({
      test: "Unit-independence — solar masses/km vs. kilograms/meters give the same z",
      inputs: "M = 2 M☉ (= 2×M_SUN kg), R = 2000 km (= 2,000,000 m)",
      expected: "identical z regardless of which units carry the same physical values",
      computed: `z_(M☉,km) ≈ ${fmt(zViaMsun, 10)}, z_(kg,m) ≈ ${fmt(zViaKg, 10)}`,
      pass: percentDiff(zViaMsun, zViaKg) < 1e-9,
    });
  }

  // Round trip across two exported functions: redshiftFactorBetween out to
  // a very large radius should match (1+z) from gravitationalRedshift.
  {
    const massKg = massToKg(1.4, "msun");
    const radiusM = radiusToMeters(10, "km");
    const z = gravitationalRedshift(massKg, radiusM);
    const factorFar = redshiftFactorBetween(massKg, radiusM, radiusM * 1e9);
    rows.push({
      test: "redshiftFactorBetween(R, far away) matches 1+z from gravitationalRedshift",
      inputs: "M = 1.4 M☉ (neutron star), R = 10 km, r2 = 10¹⁰ km",
      expected: `1 + z ≈ ${fmt(1 + z, 6)}`,
      computed: `factor ≈ ${fmt(factorFar, 6)}`,
      pass: percentDiff(factorFar, 1 + z) < 0.01,
    });
  }

  // Redshift grows monotonically as R approaches r_s.
  {
    const massKg = massToKg(1, "msun");
    const rs = schwarzschildRadiusM(massKg);
    const zFar = gravitationalRedshift(massKg, rs * 10);
    const zMid = gravitationalRedshift(massKg, rs * 1.5);
    const zNear = gravitationalRedshift(massKg, rs * 1.01);
    rows.push({
      test: "Redshift grows monotonically as R approaches r_s",
      inputs: "M = 1 M☉, R = 10 r_s vs. 1.5 r_s vs. 1.01 r_s",
      expected: "z(10 r_s) < z(1.5 r_s) < z(1.01 r_s)",
      computed: `${fmt(zFar, 6)} < ${fmt(zMid, 6)} < ${fmt(zNear, 6)}`,
      pass: zFar < zMid && zMid < zNear,
    });
  }

  return rows;
}

// Edge cases: gravitationalRedshift.js deliberately refuses to compute z
// at or inside the Schwarzschild radius (see its own comments) — these
// rows confirm that guard actually fires, and document what the other
// functions actually do with zero/negative inputs rather than inventing
// behavior they don't have.
function edgeCaseRows() {
  const rows = [];
  const massKg = massToKg(1, "msun");
  const rs = schwarzschildRadiusM(massKg);

  {
    const z = gravitationalRedshift(massKg, rs);
    rows.push({
      test: "Emission radius exactly at r_s",
      inputs: "M = 1 M☉, R = r_s",
      expected: "rejected (null) — no escaping light at the horizon",
      computed: z === null ? "null" : fmt(z),
      pass: z === null,
    });
  }

  {
    const z = gravitationalRedshift(massKg, rs * 0.5);
    rows.push({
      test: "Emission radius inside the horizon",
      inputs: "M = 1 M☉, R = 0.5 r_s",
      expected: "rejected (null) — inside the horizon",
      computed: z === null ? "null" : fmt(z),
      pass: z === null,
    });
  }

  {
    const z = gravitationalRedshift(0, R_SUN_M);
    rows.push({
      test: "Zero mass",
      inputs: "M = 0 kg, R = 1 R☉",
      expected: "not rejected — r_s = 0, so z = 0 exactly (no gravity, no redshift)",
      computed: fmt(z),
      pass: z === 0,
    });
  }

  {
    const rNeg = schwarzschildRadiusM(-M_SUN);
    const z = gravitationalRedshift(-M_SUN, R_SUN_M);
    rows.push({
      test: "Negative mass (unphysical input, no guard in this module)",
      inputs: "M = −1 M☉, R = 1 R☉",
      expected: "not rejected — negative r_s makes R > r_s trivially true, giving a small positive z instead of a rejection",
      computed: z === null ? "null" : `z ≈ ${fmt(z, 8)} (r_s ≈ ${fmt(rNeg, 2)} m)`,
      pass: z !== null && Number.isFinite(z) && z > 0,
    });
  }

  {
    const v = naiveEquivalentVelocity(0);
    rows.push({
      test: "naiveEquivalentVelocity at z = 0",
      inputs: "z = 0",
      expected: "0 m/s — no shift, no implied velocity",
      computed: `${fmt(v)} m/s`,
      pass: v === 0,
    });
  }

  return rows;
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getGravitationalRedshiftTestRows() {
  return [...referenceRows(), ...consistencyRows(), ...edgeCaseRows()];
}
