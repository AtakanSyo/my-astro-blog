// Test cases for the "Tests" popup on the Angular Size & Physical Size
// Calculator. These run the calculator's real geometry.js functions
// against known reference objects and edge cases, so this table is a
// genuine live check — not a hardcoded, unverified table — and would
// visibly show failures on this page if the underlying math ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<slug>Tests.js" per calculator, computing rows from that calculator's
// own math module — to add the Tests popup to another calculator.

import {
  exactThetaFromSizeDistance,
  exactDiameterFromAngleDistance,
  exactDistanceFromAngleSize,
  smallAngleTheta,
  angleToRad,
  radToAngle,
  lengthToMeters,
  metersToLength,
  approxQuality,
} from "./geometry";

export const ANGULAR_SIZE_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes above the reference objects
// below — rendered at the bottom of the Tests popup by CalculatorTests.
// Keep these two in sync when either changes.
export const ANGULAR_SIZE_TEST_SOURCES = [
  {
    title: "The Moon",
    text: "Mean diameter 3474.8 km, mean Earth–Moon distance 384,400 km.",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html",
    urlLabel: "NASA Moon Fact Sheet",
  },
  {
    title: "The Sun",
    text: "Diameter 1,392,700 km, mean Earth–Sun distance 1 AU (exact, by definition).",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html",
    urlLabel: "NASA Sun Fact Sheet",
  },
  {
    title: "Andromeda Galaxy (M31)",
    text: "Illustrative, not a citation-grade figure — M31's angular size is definition-dependent: the bright visible core spans roughly 3°, while deep imaging of the full low-surface-brightness outer disk has put its extent at roughly 5–6°.",
  },
  {
    title: "“Distant spiral galaxy” and “Very close object”",
    text: "Synthetic examples, not real bodies — included only to exercise a very small and a very large angle.",
  },
  {
    title: "What these rows actually prove",
    text: "Each check confirms the exact formula correctly relates θ, physical size, and distance for the object listed — not that those three numbers are independently verified. A mistaken figure above would still round-trip internally and pass.",
  },
];

// Each object's θ, diameter, and distance are mutually consistent to the
// precision shown (same numbers as the calculator's own PRESETS), so one
// reference triple can validate all three "solve for" directions against
// each other rather than against a separately-typed-in literature value.
//
// IMPORTANT — what this actually validates: these rows confirm the exact
// formula correctly relates θ, D, and d for each object below. That is
// NOT the same claim as "these three numbers are independently verified
// real-world figures" — see each object's own source note. A wrong D or d
// entered here would still round-trip and pass, since all three checks
// are internally consistent with whichever numbers are listed.
const REFERENCE_OBJECTS = [
  // Source: NASA Moon Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html)
  // — mean diameter 3474.8 km, mean Earth-Moon distance 384,400 km.
  // 31.08′ is the commonly cited mean angular size, consistent with
  // those two figures under the exact formula.
  { label: "The Moon", theta: 31.08, thetaUnit: "arcmin", diameter: 3474.8, diameterUnit: "km", distance: 384400, distanceUnit: "km" },
  // Source: NASA Sun Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html)
  // — diameter 1,392,700 km, mean Earth-Sun distance 1 AU (exact, by
  // definition). 32.0′ is the commonly cited mean angular size.
  { label: "The Sun", theta: 32.0, thetaUnit: "arcmin", diameter: 1392700, diameterUnit: "km", distance: 1, distanceUnit: "au" },
  // Illustrative, not a citation-grade figure: M31's angular size is
  // definition-dependent — the bright visible core spans roughly 3°,
  // while deep imaging of the full low-surface-brightness outer disk
  // (the basis for a ~220,000 ly diameter at ~2.5 million ly distance)
  // has put its full extent at roughly 5–6°. Used here as a real,
  // large-and-far object test case, not a precise textbook constant.
  { label: "Andromeda Galaxy (M31)", theta: 5.04, thetaUnit: "deg", diameter: 220000, diameterUnit: "ly", distance: 2.5e6, distanceUnit: "ly" },
  // Synthetic example — not a real named object. Chosen only to exercise
  // a very small angle (arcsecond scale) where the small-angle
  // approximation should be essentially exact.
  { label: "Distant spiral galaxy", theta: 61.9, thetaUnit: "arcsec", diameter: 30, diameterUnit: "kpc", distance: 100, distanceUnit: "mpc" },
  // Synthetic example — not a real object. Chosen only to exercise a
  // very large angle where the small-angle approximation should
  // visibly break down.
  { label: "Very close object (large angle)", theta: 79.6111, thetaUnit: "deg", diameter: 0.5, diameterUnit: "m", distance: 0.3, distanceUnit: "m" },
  // Synthetic example — not a real object. Physical size is 500x the
  // distance (a flat object, not a sphere the observer could stand
  // inside of), pushing θ to the edge of the valid range without
  // making the geometry impossible.
  { label: "Extreme size-to-distance ratio", theta: 179.7708, thetaUnit: "deg", diameter: 1000, diameterUnit: "m", distance: 1, distanceUnit: "m" },
];

// Reference values are published to a handful of significant figures, so
// a fraction-of-a-percent round-trip gap is expected rounding, not a bug —
// a real formula error would be off by many percent, not hundredths.
const TOLERANCE_PCT = 0.2;

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

function validationRows() {
  const rows = [];

  for (const ref of REFERENCE_OBJECTS) {
    const Dm = lengthToMeters(ref.diameter, ref.diameterUnit);
    const dm = lengthToMeters(ref.distance, ref.distanceUnit);
    const thetaRad = angleToRad(ref.theta, ref.thetaUnit);

    const thetaOut = exactThetaFromSizeDistance(Dm, dm);
    const thetaComputed = thetaOut.valid ? radToAngle(thetaOut.theta, ref.thetaUnit) : NaN;
    rows.push({
      test: `${ref.label} — solve angular size`,
      inputs: `D = ${fmt(ref.diameter)} ${ref.diameterUnit}, d = ${fmt(ref.distance)} ${ref.distanceUnit}`,
      expected: `≈ ${fmt(ref.theta)} ${ref.thetaUnit}`,
      computed: thetaOut.valid ? `${fmt(thetaComputed)} ${ref.thetaUnit}` : "rejected",
      pass: thetaOut.valid && percentDiff(thetaComputed, ref.theta) < TOLERANCE_PCT,
    });

    const diameterOut = exactDiameterFromAngleDistance(thetaRad, dm);
    const diameterComputed = diameterOut.valid ? metersToLength(diameterOut.D, ref.diameterUnit) : NaN;
    rows.push({
      test: `${ref.label} — solve physical size`,
      inputs: `θ = ${fmt(ref.theta)} ${ref.thetaUnit}, d = ${fmt(ref.distance)} ${ref.distanceUnit}`,
      expected: `≈ ${fmt(ref.diameter)} ${ref.diameterUnit}`,
      computed: diameterOut.valid ? `${fmt(diameterComputed)} ${ref.diameterUnit}` : "rejected",
      pass: diameterOut.valid && percentDiff(diameterComputed, ref.diameter) < TOLERANCE_PCT,
    });

    const distanceOut = exactDistanceFromAngleSize(thetaRad, Dm);
    const distanceComputed = distanceOut.valid ? metersToLength(distanceOut.d, ref.distanceUnit) : NaN;
    rows.push({
      test: `${ref.label} — solve distance`,
      inputs: `θ = ${fmt(ref.theta)} ${ref.thetaUnit}, D = ${fmt(ref.diameter)} ${ref.diameterUnit}`,
      expected: `≈ ${fmt(ref.distance)} ${ref.distanceUnit}`,
      computed: distanceOut.valid ? `${fmt(distanceComputed)} ${ref.distanceUnit}` : "rejected",
      pass: distanceOut.valid && percentDiff(distanceComputed, ref.distance) < TOLERANCE_PCT,
    });
  }

  return rows;
}

function edgeCaseRows() {
  const cases = [
    {
      test: "Zero distance",
      inputs: "D = 1 m, d = 0 m",
      run: () => exactThetaFromSizeDistance(1, 0),
    },
    {
      test: "Negative physical size",
      inputs: "D = −5 m, d = 100 m",
      run: () => exactThetaFromSizeDistance(-5, 100),
    },
    {
      test: "Angular size at exactly 180°",
      inputs: "θ = 180°, d = 100 m",
      run: () => exactDiameterFromAngleDistance(Math.PI, 100),
    },
    {
      test: "Angular size beyond 180°",
      inputs: "θ = 200°, d = 100 m",
      run: () => exactDiameterFromAngleDistance((200 * Math.PI) / 180, 100),
    },
    {
      test: "Zero angular size",
      inputs: "θ = 0°, D = 1 m",
      run: () => exactDistanceFromAngleSize(0, 1),
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

function approxQualityRows() {
  const cases = [
    { ref: REFERENCE_OBJECTS[3], expectTone: "good", note: "small angle — approximation should track the exact value closely" },
    { ref: REFERENCE_OBJECTS[4], expectTone: "bad", note: "large angle — approximation should visibly diverge" },
  ];

  return cases.map(({ ref, expectTone, note }) => {
    const Dm = lengthToMeters(ref.diameter, ref.diameterUnit);
    const dm = lengthToMeters(ref.distance, ref.distanceUnit);
    const exact = exactThetaFromSizeDistance(Dm, dm);
    const approx = smallAngleTheta(Dm, dm);
    const percentError = exact.valid ? ((approx - exact.theta) / exact.theta) * 100 : NaN;
    const quality = exact.valid ? approxQuality(percentError) : null;

    return {
      test: `${ref.label} — small-angle approximation quality`,
      inputs: `D = ${fmt(ref.diameter)} ${ref.diameterUnit}, d = ${fmt(ref.distance)} ${ref.distanceUnit} (${note})`,
      expected: expectTone === "good" ? "flagged as a good approximation" : "flagged as not valid here",
      computed: quality ? `${Math.abs(percentError).toFixed(2)}% error — ${quality.label}` : "—",
      pass: Boolean(quality && quality.tone === expectTone),
    };
  });
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getAngularSizeTestRows() {
  return [...validationRows(), ...edgeCaseRows(), ...approxQualityRows()];
}
