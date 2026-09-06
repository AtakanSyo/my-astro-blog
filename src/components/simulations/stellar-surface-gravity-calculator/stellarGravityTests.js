// Test cases for the "Tests" popup on the Stellar Surface Gravity / log g
// Calculator. These run the calculator's real stellarGravity.js functions
// against known reference bodies and internal-consistency checks, so this
// table is a genuine live check — not a hardcoded, unverified table — and
// would visibly show failures on this page if the underlying math ever
// broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<slug>Tests.js" per calculator, computing rows from that calculator's
// own math module — to add the Tests popup to another calculator.

import {
  M_SUN,
  R_SUN,
  massToKg,
  radiusToMeters,
  surfaceGravitySI,
  surfaceGravityCGS,
  logG,
  classifyLogG,
} from "./stellarGravity";

export const STELLAR_SURFACE_GRAVITY_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes used below — rendered at the
// bottom of the Tests popup by CalculatorTests. Keep these two in sync
// when either changes.
export const STELLAR_SURFACE_GRAVITY_TEST_SOURCES = [
  {
    title: "The Sun",
    text: "Mass 1.98847 × 10³⁰ kg and radius 696,000 km are the IAU nominal solar values this module's own M_SUN/R_SUN constants use. log g ≈ 4.44 is the standard, widely cited value for the Sun (g ≈ 2.74 × 10⁴ cm/s²) — this calculator's own explainer text states the same figure.",
    url: "https://www.iau.org/static/resolutions/IAU2015_English.pdf",
    urlLabel: "IAU 2015 Resolution B3 (nominal solar values)",
  },
  {
    title: "Earth",
    text: "Mass 5.972 × 10²⁴ kg and mean radius 6,371 km from NASA's Earth fact sheet — used to confirm this calculator's own \"× Earth's surface gravity\" comparison (g ≈ 9.8 m/s²) checks out against g = GM/R² computed independently, not against a hardcoded 9.80665 constant.",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html",
    urlLabel: "NASA Earth Fact Sheet",
  },
  {
    title: "Neutron star preset (illustrative)",
    text: "1.4 M☉ compressed into a 10 km radius — the same figures used as this calculator's own preset — is a commonly cited representative neutron star, not a measurement of any specific named object. Used here only to confirm log g reaches the expected extreme scale (order 10¹⁴ × Earth's gravity) without breaking down numerically.",
  },
  {
    title: "What these rows actually prove",
    text: "The Sun and Earth rows confirm g = GM/R² and the log g conversion reproduce well-known, independently citable figures for two real, precisely known bodies. The scaling rows below confirm g responds to mass and radius exactly as the inverse-square algebra predicts — a doubling of radius should quarter g, not just \"get smaller.\" None of this independently re-measures any star's actual mass or radius; a wrong figure typed elsewhere would still round-trip through this formula and pass.",
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

// Reference values are published to a handful of significant figures, so a
// fraction-of-a-percent gap is expected rounding, not a bug — a real
// formula error would be off by many percent, not hundredths.
const TOLERANCE_PCT = 0.5;

function referenceRows() {
  const rows = [];

  // The Sun — M_SUN/R_SUN are this module's own constants, so this mainly
  // confirms the g and log g conversions themselves are correct.
  const sunGSI = surfaceGravitySI(M_SUN, R_SUN);
  const sunGCGS = surfaceGravityCGS(sunGSI);
  const sunLogG = logG(sunGCGS);
  rows.push({
    test: "The Sun — surface gravity",
    inputs: `M = ${fmt(M_SUN, 3)} kg, R = ${fmt(R_SUN, 3)} m`,
    expected: "g ≈ 2.74 × 10⁴ cm/s²",
    computed: `g = ${fmt(sunGCGS, 3)} cm/s²`,
    pass: percentDiff(sunGCGS, 2.74e4) < TOLERANCE_PCT,
  });
  rows.push({
    test: "The Sun — log g",
    inputs: `M = ${fmt(M_SUN, 3)} kg, R = ${fmt(R_SUN, 3)} m`,
    expected: "log g ≈ 4.44",
    computed: `log g = ${fmt(sunLogG)}`,
    pass: percentDiff(sunLogG, 4.44) < TOLERANCE_PCT,
  });

  // Earth — independent NASA figures, converted through the same g = GM/R^2.
  const EARTH_MASS_KG = 5.972e24;
  const EARTH_RADIUS_M = 6371000;
  const earthGSI = surfaceGravitySI(EARTH_MASS_KG, EARTH_RADIUS_M);
  rows.push({
    test: "Earth — surface gravity",
    inputs: `M = ${fmt(EARTH_MASS_KG, 3)} kg, R = ${fmt(EARTH_RADIUS_M, 3)} m`,
    expected: "g ≈ 9.8 m/s²",
    computed: `g = ${fmt(earthGSI, 3)} m/s²`,
    pass: percentDiff(earthGSI, 9.8) < 2,
  });

  return rows;
}

// Internal-consistency checks: these don't depend on any externally
// published figure, just on g = GM/R^2 responding to each input exactly
// as the algebra predicts.
function consistencyRows() {
  const rows = [];

  // g doubles when mass doubles, radius fixed.
  const gAtM = surfaceGravitySI(M_SUN, R_SUN);
  const gAt2M = surfaceGravitySI(2 * M_SUN, R_SUN);
  rows.push({
    test: "g scales linearly with mass",
    inputs: "M = 1 M☉ vs. M = 2 M☉, R fixed at 1 R☉",
    expected: "ratio ≈ 2.0000",
    computed: `ratio = ${fmt(gAt2M / gAtM)}`,
    pass: percentDiff(gAt2M / gAtM, 2) < 1e-9,
  });

  // g quarters when radius doubles, mass fixed (inverse-square).
  const gAtR = surfaceGravitySI(M_SUN, R_SUN);
  const gAt2R = surfaceGravitySI(M_SUN, 2 * R_SUN);
  rows.push({
    test: "g scales with the inverse square of radius",
    inputs: "R = 1 R☉ vs. R = 2 R☉, M fixed at 1 M☉",
    expected: "ratio ≈ 0.2500 (= 1/2²)",
    computed: `ratio = ${fmt(gAt2R / gAtR)}`,
    pass: percentDiff(gAt2R / gAtR, 0.25) < 1e-9,
  });

  // A solar-mass, Earth-radius white dwarf and a 1.4-solar-mass,
  // 10-km-radius neutron star should land in the expected extreme log g
  // ranges this calculator's own classifyLogG bins describe.
  const wdMassKg = massToKg(1, "msun");
  const wdRadiusM = 6371000; // roughly Earth-sized, illustrative white dwarf
  const wdLogG = logG(surfaceGravityCGS(surfaceGravitySI(wdMassKg, wdRadiusM)));
  rows.push({
    test: "Earth-sized, solar-mass object ⇒ white-dwarf-range log g",
    inputs: "M = 1 M☉, R = 6371 km (illustrative, Earth-sized)",
    expected: 'classifyLogG ⇒ "White dwarf"',
    computed: `log g ≈ ${fmt(wdLogG)} — "${classifyLogG(wdLogG)?.label}"`,
    pass: classifyLogG(wdLogG)?.label === "White dwarf",
  });

  const nsMassKg = massToKg(1.4, "msun");
  const nsRadiusM = radiusToMeters(10, "km");
  const nsLogG = logG(surfaceGravityCGS(surfaceGravitySI(nsMassKg, nsRadiusM)));
  rows.push({
    test: "Neutron star preset ⇒ neutron-star-range log g",
    inputs: "M = 1.4 M☉, R = 10 km",
    expected: 'classifyLogG ⇒ "Neutron star (or denser)"',
    computed: `log g ≈ ${fmt(nsLogG)} — "${classifyLogG(nsLogG)?.label}"`,
    pass: classifyLogG(nsLogG)?.label === "Neutron star (or denser)",
  });

  return rows;
}

// Edge cases: stellarGravity.js's g functions are plain algebra with no
// input guarding of their own (the calculator component's `result`
// useMemo requires a positive mass and radius before ever calling these)
// — these rows document the pure functions' actual, unguarded behavior
// rather than inventing rejection logic they don't have.
function edgeCaseRows() {
  const rows = [];

  const gAtZeroRadius = surfaceGravitySI(M_SUN, 0);
  rows.push({
    test: "Zero radius ⇒ surface gravity is not finite (division by zero)",
    inputs: "M = 1 M☉, R = 0 m",
    expected: "not finite (Infinity)",
    computed: Number.isFinite(gAtZeroRadius) ? `${fmt(gAtZeroRadius)} m/s² (bug — should be non-finite)` : "Infinity",
    pass: !Number.isFinite(gAtZeroRadius),
  });

  const gAtZeroMass = surfaceGravitySI(0, R_SUN);
  rows.push({
    test: "Zero mass ⇒ zero surface gravity (not rejected)",
    inputs: "M = 0 kg, R = 1 R☉",
    expected: "0 m/s²",
    computed: `${fmt(gAtZeroMass)} m/s²`,
    pass: gAtZeroMass === 0,
  });

  const gAtNegMass = surfaceGravitySI(-M_SUN, R_SUN);
  rows.push({
    test: "Negative mass ⇒ negative surface gravity (formula has no sign guard)",
    inputs: "M = −1 M☉, R = 1 R☉",
    expected: "negative g (unphysical, not rejected by this pure function)",
    computed: `${fmt(gAtNegMass, 3)} m/s²`,
    pass: gAtNegMass < 0,
  });

  const logGAtNegative = logG(surfaceGravityCGS(gAtNegMass));
  rows.push({
    test: "log g of a negative surface gravity ⇒ NaN",
    inputs: "g = negative value from the case above",
    expected: "NaN — log10 of a negative number is not a real number in JS",
    computed: fmt(logGAtNegative),
    pass: Number.isNaN(logGAtNegative),
  });

  return rows;
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getStellarSurfaceGravityTestRows() {
  return [...referenceRows(), ...consistencyRows(), ...edgeCaseRows()];
}
