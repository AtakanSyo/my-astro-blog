// Test cases for the "Tests" popup on the Exoplanet Equilibrium
// Temperature Calculator. These run the calculator's real
// equilibriumTemp.js functions against real solar-system planets, the
// redistribution-model scaling relationship, an inverse-square flux
// check, and edge cases, so this table is a genuine live check — not a
// hardcoded, unverified table — and would visibly show failures on this
// page if the underlying math ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<slug>Tests.js" per calculator, computing rows from that calculator's
// own math module — to add the Tests popup to another calculator.

import {
  R_SUN_M,
  starRadiusToMeters,
  distanceToMeters,
  stellarFlux,
  equilibriumTemperature,
} from "./equilibriumTemp";

export const EQUILIBRIUM_TEMP_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes above the reference planets
// below — rendered at the bottom of the Tests popup by CalculatorTests.
// Keep these two in sync when either changes.
export const EQUILIBRIUM_TEMP_TEST_SOURCES = [
  {
    title: "Earth, Venus, Mars equilibrium temperatures",
    text: "≈255 K (Earth), ≈232 K (Venus), ≈210 K (Mars) are the commonly cited full-redistribution equilibrium temperatures for these three planets around the real Sun — the same figures this calculator's own SOLAR_SYSTEM_LANDMARKS constant and its Earth/Venus/Mars presets already use. Orbital distances are each planet's real semi-major axis; Bond albedo values (0.3, 0.75, 0.25) are commonly cited textbook approximations, not high-precision measurements — real estimates vary by a few percent across sources.",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/",
    urlLabel: "NASA Planetary Fact Sheets",
  },
  {
    title: "Solar effective temperature and radius",
    text: "T_sun = 5772 K (IAU nominal effective temperature) and R_sun = 696,000 km (IAU 2015 nominal solar radius) — this module's own constants, used as the star for all three reference planets above.",
  },
  {
    title: "What these rows actually prove",
    text: "The reference rows confirm the exact formula reproduces the commonly cited equilibrium temperature for Earth, Venus, and Mars given their real orbital distances and commonly cited Bond albedos — not that those albedo figures are independently, precisely verified (real Bond albedo estimates vary by source). The scaling and edge-case rows below don't depend on any external citation — they confirm the formula responds to the redistribution assumption and to distance exactly as the algebra predicts.",
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

// Real planets, real orbital distances, commonly cited Bond albedos —
// same figures as this calculator's own PRESETS array and
// SOLAR_SYSTEM_LANDMARKS constant (see source note above).
const REFERENCE_PLANETS = [
  { label: "Earth", tStar: 5772, a: 1, aUnit: "au", albedo: 0.3, expectedK: 255 },
  { label: "Venus", tStar: 5772, a: 0.723, aUnit: "au", albedo: 0.75, expectedK: 232 },
  { label: "Mars", tStar: 5772, a: 1.524, aUnit: "au", albedo: 0.25, expectedK: 210 },
];

// Reference values are published/commonly cited to a handful of
// significant figures, so a fraction-of-a-percent-to-low-percent gap is
// expected rounding, not a bug.
const TOLERANCE_PCT = 1;

function referenceRows() {
  return REFERENCE_PLANETS.map((ref) => {
    const rStarM = R_SUN_M;
    const aM = distanceToMeters(ref.a, ref.aUnit);
    const tEq = equilibriumTemperature(ref.tStar, rStarM, aM, ref.albedo, "full");
    return {
      test: `${ref.label} — equilibrium temperature (full redistribution)`,
      inputs: `T★ = ${fmt(ref.tStar)} K, R★ = 1 R☉, a = ${fmt(ref.a)} ${ref.aUnit}, A = ${fmt(ref.albedo)}`,
      expected: `≈ ${fmt(ref.expectedK)} K`,
      computed: `${fmt(tEq, 1)} K`,
      pass: percentDiff(tEq, ref.expectedK) < TOLERANCE_PCT,
    };
  });
}

// Redistribution-model scaling: the dayside-only estimate should be
// exactly 2^(1/4) times the full-redistribution estimate for the same
// inputs — this is the exact relationship the module's own comment (and
// this calculator's post) states, derived directly from the formula's
// emitting-area assumption, not from any external citation.
function redistributionScalingRows() {
  const tStar = 6065;
  const rStarM = starRadiusToMeters(1.2, "rsun");
  const aM = distanceToMeters(0.047, "au");
  const albedo = 0.1;
  const tFull = equilibriumTemperature(tStar, rStarM, aM, albedo, "full");
  const tDayside = equilibriumTemperature(tStar, rStarM, aM, albedo, "dayside");
  const expectedRatio = Math.pow(2, 0.25);
  return [
    {
      test: "Dayside-only estimate is exactly 2^(1/4) × the full-redistribution estimate",
      inputs: "Hot Jupiter preset: T★ = 6065 K, R★ = 1.2 R☉, a = 0.047 AU, A = 0.1",
      expected: `ratio ≈ ${fmt(expectedRatio)}`,
      computed: `full = ${fmt(tFull, 1)} K, dayside = ${fmt(tDayside, 1)} K, ratio = ${fmt(tDayside / tFull)}`,
      pass: percentDiff(tDayside / tFull, expectedRatio) < 1e-6,
    },
  ];
}

// Inverse-square flux check: stellarFlux depends only on (R★/a)², so
// doubling the distance should cut the flux to exactly 1/4 — a pure
// consistency check independent of any external citation.
function fluxScalingRows() {
  const rStarM = R_SUN_M;
  const a1 = distanceToMeters(1, "au");
  const a2 = distanceToMeters(2, "au");
  const flux1 = stellarFlux(5772, rStarM, a1);
  const flux2 = stellarFlux(5772, rStarM, a2);
  return [
    {
      test: "Stellar flux falls off as the inverse square of distance",
      inputs: "T★ = 5772 K, R★ = 1 R☉, a = 1 AU vs. a = 2 AU",
      expected: "ratio ≈ 0.2500 (= 1/4)",
      computed: `ratio = ${fmt(flux2 / flux1)}`,
      pass: percentDiff(flux2 / flux1, 0.25) < 1e-6,
    },
  ];
}

// Edge cases: equilibriumTemp.js is pure algebra with no input
// validation of its own (that guard lives in
// ExoplanetEquilibriumTemperatureCalculator.jsx's `result` useMemo,
// which requires positive T★/R★/a and an albedo in [0, 1)) — these rows
// document the actual, unguarded behavior of stellarFlux and
// equilibriumTemperature on zero, negative, and degenerate inputs.
function edgeCaseRows() {
  const rows = [];

  const rStarM = R_SUN_M;
  const aM = distanceToMeters(1, "au");

  const tEqAtFullAlbedo = equilibriumTemperature(5772, rStarM, aM, 1, "full");
  rows.push({
    test: "Bond albedo = 1 (perfect reflector)",
    inputs: "T★ = 5772 K, R★ = 1 R☉, a = 1 AU, A = 1",
    expected: "not rejected — (1−A) = 0, giving T_eq = 0",
    computed: `${fmt(tEqAtFullAlbedo)} K`,
    pass: tEqAtFullAlbedo === 0,
  });

  const tEqAtZeroDistance = equilibriumTemperature(5772, rStarM, 0, 0.3, "full");
  rows.push({
    test: "Zero orbital distance",
    inputs: "T★ = 5772 K, R★ = 1 R☉, a = 0 m, A = 0.3",
    expected: "not rejected — division by zero, giving Infinity",
    computed: fmt(tEqAtZeroDistance),
    pass: tEqAtZeroDistance === Infinity,
  });

  const tEqAtZeroTStar = equilibriumTemperature(0, rStarM, aM, 0.3, "full");
  rows.push({
    test: "Zero stellar temperature",
    inputs: "T★ = 0 K, R★ = 1 R☉, a = 1 AU, A = 0.3",
    expected: "not rejected — linear in T★, giving 0",
    computed: `${fmt(tEqAtZeroTStar)} K`,
    pass: tEqAtZeroTStar === 0,
  });

  const tEqAtNegAlbedo = equilibriumTemperature(5772, rStarM, aM, -0.5, "full");
  const tEqAtZeroAlbedo = equilibriumTemperature(5772, rStarM, aM, 0, "full");
  rows.push({
    test: "Negative Bond albedo (unphysical, but not rejected)",
    inputs: "T★ = 5772 K, R★ = 1 R☉, a = 1 AU, A = −0.5",
    expected: "not rejected — (1−A) > 1, giving a higher temperature than A = 0",
    computed: `${fmt(tEqAtNegAlbedo, 1)} K vs. ${fmt(tEqAtZeroAlbedo, 1)} K at A = 0`,
    pass: Number.isFinite(tEqAtNegAlbedo) && tEqAtNegAlbedo > tEqAtZeroAlbedo,
  });

  return rows;
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getEquilibriumTempTestRows() {
  return [
    ...referenceRows(),
    ...redistributionScalingRows(),
    ...fluxScalingRows(),
    ...edgeCaseRows(),
  ];
}
