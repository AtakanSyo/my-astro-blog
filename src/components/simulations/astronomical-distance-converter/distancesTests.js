// Test cases for the "Tests" popup on the Astronomical Distance
// Converter. These run the calculator's real distances.js functions —
// not a hardcoded, unverified table. See angular-size-calculator's
// angularSizeTests.js for the pattern this follows.

import { toMeters, fromMeters, formatLightTime, UNIT_ORDER, UNITS, M_PER_AU, M_PER_LY } from "./distances";

export const DISTANCES_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

export const DISTANCES_TEST_SOURCES = [
  {
    title: "What these rows check",
    text: "Every unit's conversion factor is a fixed physical definition (the SI speed of light, the IAU-defined AU and parsec) — not measured data — so every row here is a pure algebraic identity, correct or not by construction, with no external citation needed.",
  },
];

const TOLERANCE_PCT = 0.0001;

function percentDiff(a, b) {
  if (b === 0) return a === 0 ? 0 : Infinity;
  return Math.abs((a - b) / b) * 100;
}
function fmt(n, digits = 5) {
  if (!Number.isFinite(n)) return String(n);
  return Number(n.toFixed(digits)).toString();
}
function simpleFormatNumber(n) {
  return fmt(n, 4);
}

function roundTripRows() {
  return UNIT_ORDER.map((unit) => {
    const meters = toMeters(1, unit);
    const back = fromMeters(meters, unit);
    return {
      test: `Round-trip: 1 ${UNITS[unit].short} → meters → ${UNITS[unit].short}`,
      inputs: `1 ${UNITS[unit].short}`,
      expected: `fromMeters(toMeters(1, "${unit}"), "${unit}") = 1`,
      computed: fmt(back, 10),
      pass: percentDiff(back, 1) < TOLERANCE_PCT,
    };
  });
}

function lightTimeRows() {
  const rows = [];

  // A light-year is *defined* as C × one Julian year, so its own light
  // travel time is exactly 1 year by construction — a clean identity.
  const lyLightTime = formatLightTime(M_PER_LY, simpleFormatNumber);
  rows.push({
    test: "Light-travel time across 1 light-year",
    inputs: `${fmt(M_PER_LY)} m (defined as 1 ly)`,
    expected: "1 yr (a light-year is defined as the distance light travels in 1 year)",
    computed: lyLightTime,
    pass: lyLightTime.startsWith("1 yr"),
  });

  // 1 AU's light-travel time is the famous "~8 minutes from the Sun" figure.
  const auSeconds = M_PER_AU / 299792458;
  rows.push({
    test: "Light-travel time across 1 AU",
    inputs: `${fmt(M_PER_AU)} m (1 AU)`,
    expected: "≈ 499 s (≈ 8 min 19 s) — the well-known Sun-to-Earth light time",
    computed: `${fmt(auSeconds, 2)} s`,
    pass: percentDiff(auSeconds, 499.005) < 0.1,
  });

  return rows;
}

function edgeCaseRows() {
  return [
    {
      test: "Zero distance",
      inputs: 'toMeters(0, "km")',
      expected: "0 (no guard needed — multiplication by zero)",
      computed: fmt(toMeters(0, "km")),
      pass: toMeters(0, "km") === 0,
    },
    {
      test: "Negative distance",
      inputs: 'toMeters(-5, "km")',
      expected: "−5000 (this module doesn't validate sign — it's a pure unit conversion, not a physical-quantity guard)",
      computed: `${fmt(toMeters(-5, "km"))} m`,
      pass: toMeters(-5, "km") === -5000,
    },
  ];
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getDistancesTestRows() {
  return [...roundTripRows(), ...lightTimeRows(), ...edgeCaseRows()];
}
