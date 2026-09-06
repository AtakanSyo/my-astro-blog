// Test cases for the "Tests" popup on the Hill Sphere Calculator. These
// run the calculator's real hillSphere.js functions against known
// reference bodies and internal-consistency checks, so this table is a
// genuine live check — not a hardcoded, unverified table — and would
// visibly show failures on this page if the underlying math ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<slug>Tests.js" per calculator, computing rows from that calculator's
// own math module — to add the Tests popup to another calculator.

import {
  M_EARTH,
  hillRadius,
  hillRadiusPeriapsis,
  massToKg,
  distanceToMeters,
  distanceFromMeters,
} from "./hillSphere";

export const HILL_SPHERE_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes above the reference bodies
// below — rendered at the bottom of the Tests popup by CalculatorTests.
// Keep these two in sync when either changes.
export const HILL_SPHERE_TEST_SOURCES = [
  {
    title: "Earth around the Sun",
    text: "Mass 5.9722×10²⁴ kg orbiting the Sun (1.98847×10³⁰ kg) at 1 AU gives a commonly cited Hill radius of ≈1.5 million km (≈0.01 AU).",
    url: "https://en.wikipedia.org/wiki/Hill_sphere#Formula_and_examples",
    urlLabel: "Wikipedia — Hill sphere, Formula and examples",
  },
  {
    title: "Jupiter around the Sun",
    text: "Mass 1.89813×10²⁷ kg at 5.2044 AU gives a commonly cited Hill radius of ≈0.355 AU (≈53.1 million km).",
    url: "https://en.wikipedia.org/wiki/Hill_sphere#Formula_and_examples",
    urlLabel: "Wikipedia — Hill sphere, Formula and examples",
  },
  {
    title: "Mars around the Sun",
    text: "Mass 6.4171×10²³ kg at 1.5237 AU gives a commonly cited Hill radius of ≈1.08 million km.",
    url: "https://en.wikipedia.org/wiki/Hill_sphere#Formula_and_examples",
    urlLabel: "Wikipedia — Hill sphere, Formula and examples",
  },
  {
    title: "The Moon around Earth",
    text: "Mass 7.342×10²² kg at 384,400 km from Earth gives a Hill radius of ≈61,500 km — a derived check (no single frequently-published headline figure) at a much smaller mass ratio than the other three rows, included to exercise that regime.",
  },
  {
    title: "What these rows actually prove",
    text: "The reference rows confirm the exact formula reproduces commonly cited Hill radii for real bodies to a fraction of a percent. The comparison rows below them confirm the formula responds to mass, distance, and eccentricity in the physically correct direction. Neither proves the masses or distances typed in here are themselves independently correct — see each source above.",
  },
];

// Reference values are published to a handful of significant figures, so
// a fraction-of-a-percent round-trip gap is expected rounding, not a bug —
// a real formula error would be off by many percent, not tenths.
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

// Each body's mass, host mass, and semi-major axis are the real,
// independently published figures for that pair (see sources above), and
// expectedKm is the commonly cited Hill radius computed from them under
// the circular-orbit formula — so this validates the formula itself, not
// just that the numbers round-trip against each other.
const REFERENCE_BODIES = [
  { label: "Earth around the Sun", m: 1, mUnit: "mearth", M: 1, MUnit: "msun", a: 1, aUnit: "au", expectedKm: 1.496e6 },
  { label: "Jupiter around the Sun", m: 1, mUnit: "mjupiter", M: 1, MUnit: "msun", a: 5.2044, aUnit: "au", expectedKm: 53.15e6 },
  { label: "Mars around the Sun", m: 6.4171e23, mUnit: "kg", M: 1, MUnit: "msun", a: 1.5237, aUnit: "au", expectedKm: 1.084e6 },
  { label: "The Moon around Earth", m: 1, mUnit: "mmoon", M: 1, MUnit: "mearth", a: 384400, aUnit: "km", expectedKm: 61513 },
];

function validationRows() {
  return REFERENCE_BODIES.map((ref) => {
    const mKg = massToKg(ref.m, ref.mUnit);
    const MKg = massToKg(ref.M, ref.MUnit);
    const aM = distanceToMeters(ref.a, ref.aUnit);
    const rH = hillRadius(aM, mKg, MKg);
    const rHKm = distanceFromMeters(rH, "km");
    return {
      test: `${ref.label} — Hill radius`,
      inputs: `m = ${fmt(ref.m)} ${ref.mUnit}, M = ${fmt(ref.M)} ${ref.MUnit}, a = ${fmt(ref.a)} ${ref.aUnit}`,
      expected: `≈ ${fmt(ref.expectedKm)} km`,
      computed: `${fmt(rHKm)} km`,
      pass: percentDiff(rHKm, ref.expectedKm) < TOLERANCE_PCT,
    };
  });
}

// Internal-consistency checks: these don't depend on any externally
// published figure, just on the formula responding to each input in the
// physically correct direction — the same properties asserted in this
// component's own unit tests (hillSphere.test.js), reproduced here as
// live, user-visible rows.
function consistencyRows() {
  const a = distanceToMeters(1, "au");

  const baseline = hillRadius(a, M_EARTH, massToKg(1, "msun"));
  const biggerSatellite = hillRadius(a, 10 * M_EARTH, massToKg(1, "msun"));
  const biggerHost = hillRadius(a, M_EARTH, massToKg(10, "msun"));
  const farther = hillRadius(distanceToMeters(2, "au"), M_EARTH, massToKg(1, "msun"));

  const circular = hillRadius(a, M_EARTH, massToKg(1, "msun"));
  const periapsisAtZeroE = hillRadiusPeriapsis(a, M_EARTH, massToKg(1, "msun"), 0);
  const lowE = hillRadiusPeriapsis(a, M_EARTH, massToKg(1, "msun"), 0.1);
  const highE = hillRadiusPeriapsis(a, M_EARTH, massToKg(1, "msun"), 0.5);

  return [
    {
      test: "A more massive satellite has a larger Hill sphere",
      inputs: "m = 1 M⊕ vs. m = 10 M⊕, other inputs fixed (a = 1 AU, M = 1 M☉)",
      expected: "10 M⊕ case > 1 M⊕ case",
      computed: `${fmt(distanceFromMeters(baseline, "km"))} km vs. ${fmt(distanceFromMeters(biggerSatellite, "km"))} km`,
      pass: biggerSatellite > baseline,
    },
    {
      test: "A more massive host shrinks the Hill sphere",
      inputs: "M = 1 M☉ vs. M = 10 M☉, other inputs fixed (a = 1 AU, m = 1 M⊕)",
      expected: "10 M☉ case < 1 M☉ case",
      computed: `${fmt(distanceFromMeters(baseline, "km"))} km vs. ${fmt(distanceFromMeters(biggerHost, "km"))} km`,
      pass: biggerHost < baseline,
    },
    {
      test: "Hill radius scales linearly with semi-major axis",
      inputs: "a = 1 AU vs. a = 2 AU, other inputs fixed (m = 1 M⊕, M = 1 M☉)",
      expected: "ratio ≈ 2.0000",
      computed: `ratio = ${fmt(farther / baseline)}`,
      pass: percentDiff(farther / baseline, 2) < 1e-6,
    },
    {
      test: "Periapsis (eccentric) formula reduces to the circular one at e = 0",
      inputs: "a = 1 AU, m = 1 M⊕, M = 1 M☉, e = 0",
      expected: `≈ ${fmt(distanceFromMeters(circular, "km"))} km (matches circular formula)`,
      computed: `${fmt(distanceFromMeters(periapsisAtZeroE, "km"))} km`,
      pass: percentDiff(periapsisAtZeroE, circular) < 1e-9,
    },
    {
      test: "A more eccentric orbit shrinks the conservative Hill radius",
      inputs: "e = 0.1 vs. e = 0.5, other inputs fixed (a = 1 AU, m = 1 M⊕, M = 1 M☉)",
      expected: "e = 0.5 case < e = 0.1 case",
      computed: `${fmt(distanceFromMeters(lowE, "km"))} km vs. ${fmt(distanceFromMeters(highE, "km"))} km`,
      pass: highE < lowE,
    },
    {
      test: "Mass unit conversion round-trips a known unit",
      inputs: "1 Earth mass, converted to kg",
      expected: `${M_EARTH} kg`,
      computed: `${massToKg(1, "mearth")} kg`,
      pass: massToKg(1, "mearth") === M_EARTH,
    },
  ];
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getHillSphereTestRows() {
  return [...validationRows(), ...consistencyRows()];
}
