// Test cases for the "Tests" popup on the Kepler's Third Law Calculator.
// These run the calculator's real keplerThirdLaw.js functions. See
// angular-size-calculator's angularSizeTests.js for the pattern this
// follows.

import {
  G,
  M_SUN,
  AU_M,
  R_SUN_M,
  periodFromAxisMass,
  axisFromPeriodMass,
  massFromPeriodAxis,
  periodYearsFromAxisAuMass,
  simplifiedPeriodYears,
} from "./keplerThirdLaw";

export const KEPLER_THIRD_LAW_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

export const KEPLER_THIRD_LAW_TEST_SOURCES = [
  {
    title: "Where the reference numbers come from",
    text: "Earth's orbit is the defining case for AU/year units, so it round-trips to ~1.0000 by construction. The Hulse–Taylor binary pulsar (PSR B1913+16) figures — Pb ≈ 7.751939 hr, a ≈ 1.9501×10⁹ m, total mass ≈ 2.828 M☉ — are the well-established values from decades of pulsar timing (Weisberg & Huang 2016, ApJ 829, 55) and are a standard textbook check on Kepler's third law applied to a compact binary. The rest are round-trips and consistency checks against the module's own SI and AU/year/M☉ formulations, and against the plain public shortcut P²=a³.",
  },
];

const TOLERANCE_PCT = 0.001;
const AU_YR_IDENTITY_TOLERANCE_PCT = 0.05; // AU is a fixed modern length, not exactly Earth's 365.25-day orbit — ~0.01–0.02% real mismatch expected

function percentDiff(a, b) {
  if (b === 0) return a === 0 ? 0 : Infinity;
  return Math.abs((a - b) / b) * 100;
}
function fmt(n, digits = 4) {
  if (!Number.isFinite(n)) return String(n);
  return Number(n.toExponential(digits)).toExponential(digits);
}
function fmtPlain(n, digits = 4) {
  if (!Number.isFinite(n)) return String(n);
  return Number(n.toFixed(digits)).toString();
}

const YEAR_S = 365.25 * 86400;

function roundTripRows() {
  const cases = [
    { label: "Earth-ish", a_m: AU_M, M_kg: M_SUN },
    { label: "Close binary", a_m: 0.05 * AU_M, M_kg: 2 * M_SUN },
    { label: "Wide, low-mass", a_m: 40 * AU_M, M_kg: 0.3 * M_SUN },
  ];
  const rows = [];
  for (const { label, a_m, M_kg } of cases) {
    const P_s = periodFromAxisMass(a_m, M_kg);
    const aBack = axisFromPeriodMass(P_s, M_kg);
    const mBack = massFromPeriodAxis(P_s, a_m);
    rows.push({
      test: `Round-trip axis: ${label} → P → a`,
      inputs: `a=${fmt(a_m)} m, M=${fmt(M_kg)} kg`,
      expected: `axisFromPeriodMass(P, M) = ${fmt(a_m)} m`,
      computed: fmt(aBack),
      pass: aBack !== null && percentDiff(aBack, a_m) < TOLERANCE_PCT,
    });
    rows.push({
      test: `Round-trip mass: ${label} → P → M`,
      inputs: `P=${fmt(P_s)} s`,
      expected: `massFromPeriodAxis(P, a) = ${fmt(M_kg)} kg`,
      computed: fmt(mBack),
      pass: mBack !== null && percentDiff(mBack, M_kg) < TOLERANCE_PCT,
    });
  }
  return rows;
}

function earthRow() {
  const P_s = periodFromAxisMass(AU_M, M_SUN);
  const P_yr = P_s / YEAR_S;
  return [
    {
      test: "Earth around the Sun: a = 1 AU, M = 1 M☉ → P ≈ 1 year",
      inputs: "a=1 AU, M=1 M☉",
      expected: "P ≈ 1.0000 yr (AU and the year are both anchored to Earth's real orbit)",
      computed: `${fmtPlain(P_yr, 4)} yr`,
      pass: percentDiff(P_yr, 1) < AU_YR_IDENTITY_TOLERANCE_PCT,
    },
  ];
}

function binaryPulsarRow() {
  const P_s = 7.751939106 * 3600;
  const a_m = 1.9501e9;
  const M_kg = massFromPeriodAxis(P_s, a_m);
  const M_solar = M_kg / M_SUN;
  return [
    {
      test: "Hulse–Taylor binary pulsar: solve total mass from Pb and a",
      inputs: `Pb=7.751939 hr, a=1.9501×10⁹ m`,
      expected: "M1+M2 ≈ 2.828 M☉ (published timing solution)",
      computed: `${fmtPlain(M_solar, 3)} M☉`,
      pass: percentDiff(M_solar, 2.828) < 0.5,
    },
  ];
}

function shortcutDivergenceRows() {
  return [
    {
      test: "Shortcut matches general law at exactly M = 1 M☉",
      inputs: "a=4 AU, M=1 M☉",
      expected: "periodYearsFromAxisAuMass(4, 1) = simplifiedPeriodYears(4)",
      computed: `${fmt(periodYearsFromAxisAuMass(4, 1))} vs ${fmt(simplifiedPeriodYears(4))}`,
      pass: percentDiff(periodYearsFromAxisAuMass(4, 1), simplifiedPeriodYears(4)) < TOLERANCE_PCT,
    },
    {
      test: "Shortcut is wrong by exactly 1/√M when mass ≠ 1 M☉ (Earth-scale mass mismatch)",
      inputs: "a=0.0001 AU, M=3.003×10⁻⁶ M☉ (≈ Earth)",
      expected: "general/simplified ratio = 1/√M ≈ 577",
      computed: fmtPlain(periodYearsFromAxisAuMass(0.0001, 3.003e-6) / simplifiedPeriodYears(0.0001), 0),
      pass: percentDiff(periodYearsFromAxisAuMass(0.0001, 3.003e-6) / simplifiedPeriodYears(0.0001), 1 / Math.sqrt(3.003e-6)) < 1,
    },
  ];
}

function edgeCaseRows() {
  return [
    {
      test: "Zero semi-major axis",
      inputs: "a=0, M=1 M☉",
      expected: "null (no valid period for a degenerate orbit)",
      computed: String(periodFromAxisMass(0, M_SUN)),
      pass: periodFromAxisMass(0, M_SUN) === null,
    },
    {
      test: "Negative mass",
      inputs: "P=1 yr, a=1 AU (via massFromPeriodAxis, but mass itself negative elsewhere)",
      expected: "null (period undefined for non-positive mass)",
      computed: String(periodFromAxisMass(AU_M, -M_SUN)),
      pass: periodFromAxisMass(AU_M, -M_SUN) === null,
    },
  ];
}

function constantsSanityRow() {
  // G*M_SUN should reproduce the well-known heliocentric gravitational
  // parameter GM_sun ≈ 1.32712440018e20 m^3/s^2 to a handful of digits.
  const GM_sun = G * M_SUN;
  const published = 1.32712440018e20;
  return [
    {
      test: "G · M_SUN reproduces the standard heliocentric gravitational parameter",
      inputs: `G=${G}, M_SUN=${M_SUN}`,
      expected: `GM☉ ≈ ${fmt(published)} m³/s²`,
      computed: fmt(GM_sun),
      pass: percentDiff(GM_sun, published) < 0.01,
    },
    {
      test: "R_SUN_M is consistent with the nominal solar radius (~6.957×10⁸ m)",
      inputs: "R_SUN_M constant",
      expected: "6.957×10⁸ m",
      computed: fmt(R_SUN_M),
      pass: percentDiff(R_SUN_M, 6.957e8) < 0.01,
    },
  ];
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getKeplerThirdLawTestRows() {
  return [
    ...earthRow(),
    ...binaryPulsarRow(),
    ...roundTripRows(),
    ...shortcutDivergenceRows(),
    ...edgeCaseRows(),
    ...constantsSanityRow(),
  ];
}
