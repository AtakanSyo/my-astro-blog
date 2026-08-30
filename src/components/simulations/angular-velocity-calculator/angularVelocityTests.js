// Test cases for the "Tests" popup on the Angular Velocity Calculator.
// These run the calculator's real angularVelocity.js functions — not a
// hardcoded, unverified table — so this would visibly show failures here
// if the underlying math ever broke. See angular-size-calculator's
// angularSizeTests.js for the pattern this follows.
//
// Two kinds of rows, on purpose:
//   - "Identity" rows need no external reference data at all — they check
//     that period ↔ ω ↔ frequency ↔ rotations-and-time are true inverses
//     of each other, and are unconditionally correct if the arithmetic is.
//   - "Reference" rows cross-check the formula against a real physical
//     constant published independently of this codebase (see
//     ANGULAR_VELOCITY_TEST_SOURCES for citations) — a stronger claim
//     than internal consistency, but only as strong as those citations.

import {
  omegaFromPeriod,
  omegaFromFrequency,
  omegaFromRotationsAndTime,
  periodFromOmega,
  tangentialVelocity,
} from "./angularVelocity";

export const ANGULAR_VELOCITY_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

export const ANGULAR_VELOCITY_TEST_SOURCES = [
  {
    title: "Earth's rotation rate",
    text: "Sidereal rotation period 86,164.0905 s (IERS / standard astronomical constant) cross-checked against ω = 7.292115 × 10⁻⁵ rad/s, the WGS84 ellipsoid's defining angular velocity constant — two independently published figures, not derived from each other.",
  },
  {
    title: "Earth's equatorial rotational speed",
    text: "Computed from the cross-checked ω above and the WGS84 equatorial radius (6,378,137 m); compared against the commonly cited ≈ 465.1 m/s (≈ 1674 km/h) figure for Earth's surface speed at the equator.",
  },
  {
    title: "Crab Pulsar (PSR B0531+21)",
    text: "Commonly cited current values (period ≈ 33.4 ms, frequency ≈ 29.9 Hz). Pulsars spin down gradually over time, so this is an approximate present-day figure, not a fixed constant.",
  },
  {
    title: "Fastest known pulsar (PSR J1748-2446ad)",
    text: "Commonly cited record spin rate (≈ 716 Hz, period ≈ 1.396 ms), discovered 2004–2005.",
  },
  {
    title: "What the edge-case rows show",
    text: "omegaFromPeriod / omegaFromFrequency don't validate their input themselves — the calculator's form does that separately, before calling them. The edge-case rows below document the raw functions' actual (unguarded) behavior rather than claiming they reject bad input.",
  },
];

const IDENTITY_TOLERANCE_PCT = 0.001; // pure floating-point round-trips: should be near-exact
const REFERENCE_TOLERANCE_PCT = 0.2; // cross-checks between two independently-rounded published figures

function fmt(n, digits = 4) {
  if (!Number.isFinite(n)) return String(n);
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e5 || abs < 1e-3) return n.toExponential(3);
  const rounded = Number(n.toFixed(digits));
  return String(rounded);
}

function percentDiff(a, b) {
  if (b === 0) return a === 0 ? 0 : Infinity;
  return Math.abs((a - b) / b) * 100;
}

function identityRows() {
  const rows = [];

  // Period -> omega -> period, across a wide magnitude range.
  for (const [label, T] of [
    ["1 millisecond", 0.001],
    ["1 hour", 3600],
    ["1 Julian year", 365.25 * 86400],
  ]) {
    const omega = omegaFromPeriod(T);
    const roundTripT = periodFromOmega(omega);
    rows.push({
      test: `Period → ω → period round-trip (T = ${label})`,
      inputs: `T = ${fmt(T)} s`,
      expected: `periodFromOmega(omegaFromPeriod(T)) = T`,
      computed: `${fmt(roundTripT)} s (ω = ${fmt(omega)} rad/s)`,
      pass: percentDiff(roundTripT, T) < IDENTITY_TOLERANCE_PCT,
    });
  }

  // Frequency <-> omega, and agreement with the period-based formula.
  {
    const f = 60;
    const omegaFromF = omegaFromFrequency(f);
    const omegaFromT = omegaFromPeriod(1 / f);
    rows.push({
      test: "Frequency → ω agrees with period → ω (f = 60 Hz)",
      inputs: "f = 60 Hz  (equivalently T = 1/60 s)",
      expected: "omegaFromFrequency(f) = omegaFromPeriod(1/f)",
      computed: `${fmt(omegaFromF)} rad/s vs ${fmt(omegaFromT)} rad/s`,
      pass: percentDiff(omegaFromF, omegaFromT) < IDENTITY_TOLERANCE_PCT,
    });
  }

  // Rotations-and-time <-> omega, and agreement with the period-based formula.
  {
    const n = 120;
    const t = 1;
    const omegaFromNT = omegaFromRotationsAndTime(n, t);
    const omegaFromT = omegaFromPeriod(t / n);
    rows.push({
      test: "Rotations+time → ω agrees with period → ω (N = 120, Δt = 1 s)",
      inputs: "N = 120 rotations, Δt = 1 s  (equivalently T = 1/120 s)",
      expected: "omegaFromRotationsAndTime(N, t) = omegaFromPeriod(t/N)",
      computed: `${fmt(omegaFromNT)} rad/s vs ${fmt(omegaFromT)} rad/s`,
      pass: percentDiff(omegaFromNT, omegaFromT) < IDENTITY_TOLERANCE_PCT,
    });
  }

  // Tangential velocity is its own inverse: v/r should recover omega.
  {
    const omega = 12.34;
    const r = 5.6;
    const v = tangentialVelocity(omega, r);
    const omegaBack = v / r;
    rows.push({
      test: "Tangential velocity inverts cleanly (v = ωr ⇒ v/r = ω)",
      inputs: `ω = ${fmt(omega)} rad/s, r = ${fmt(r)} m`,
      expected: "v / r = ω",
      computed: `v = ${fmt(v)} m/s, v/r = ${fmt(omegaBack)} rad/s`,
      pass: percentDiff(omegaBack, omega) < IDENTITY_TOLERANCE_PCT,
    });
  }

  return rows;
}

function referenceRows() {
  const rows = [];

  // Earth: cross-check computed omega against the independently published
  // WGS84 defining constant.
  const earthPeriodS = 86164.0905; // IERS sidereal rotation period
  const earthOmegaComputed = omegaFromPeriod(earthPeriodS);
  const earthOmegaPublished = 7.292115e-5; // WGS84 defining angular velocity, rad/s
  rows.push({
    test: "Earth's angular velocity vs. the WGS84 constant",
    inputs: `T = ${fmt(earthPeriodS)} s (sidereal day)`,
    expected: `≈ ${fmt(earthOmegaPublished)} rad/s (WGS84)`,
    computed: `${fmt(earthOmegaComputed)} rad/s`,
    pass: percentDiff(earthOmegaComputed, earthOmegaPublished) < REFERENCE_TOLERANCE_PCT,
  });

  // Earth's equatorial rotational speed.
  const earthEquatorialRadiusM = 6378137; // WGS84 equatorial radius
  const earthSurfaceSpeed = tangentialVelocity(earthOmegaComputed, earthEquatorialRadiusM);
  const earthSurfaceSpeedPublished = 465.1;
  rows.push({
    test: "Earth's equatorial rotational speed",
    inputs: `ω = ${fmt(earthOmegaComputed)} rad/s, r = ${fmt(earthEquatorialRadiusM)} m`,
    expected: `≈ ${fmt(earthSurfaceSpeedPublished)} m/s`,
    computed: `${fmt(earthSurfaceSpeed)} m/s`,
    pass: percentDiff(earthSurfaceSpeed, earthSurfaceSpeedPublished) < REFERENCE_TOLERANCE_PCT,
  });

  // Crab Pulsar: cross-check period-derived omega against the
  // independently published frequency figure.
  const crabPeriodS = 0.0334;
  const crabFreqPublished = 29.9;
  const crabOmegaFromPeriod = omegaFromPeriod(crabPeriodS);
  const crabOmegaFromFreq = omegaFromFrequency(crabFreqPublished);
  rows.push({
    test: "Crab Pulsar: period-derived ω vs. published frequency",
    inputs: `T ≈ ${fmt(crabPeriodS)} s`,
    expected: `≈ ${fmt(crabOmegaFromFreq)} rad/s (from f ≈ ${crabFreqPublished} Hz)`,
    computed: `${fmt(crabOmegaFromPeriod)} rad/s`,
    pass: percentDiff(crabOmegaFromPeriod, crabOmegaFromFreq) < REFERENCE_TOLERANCE_PCT,
  });

  // Fastest known pulsar: cross-check frequency-derived omega against the
  // independently published period figure.
  const fastFreq = 716;
  const fastPeriodPublished = 1.39631e-3;
  const fastOmegaFromFreq = omegaFromFrequency(fastFreq);
  const fastOmegaFromPeriod = omegaFromPeriod(fastPeriodPublished);
  rows.push({
    test: "Fastest known pulsar: frequency-derived ω vs. published period",
    inputs: `f = ${fastFreq} Hz`,
    expected: `≈ ${fmt(fastOmegaFromPeriod)} rad/s (from T ≈ ${fastPeriodPublished * 1000} ms)`,
    computed: `${fmt(fastOmegaFromFreq)} rad/s`,
    pass: percentDiff(fastOmegaFromFreq, fastOmegaFromPeriod) < REFERENCE_TOLERANCE_PCT,
  });

  return rows;
}

function edgeCaseRows() {
  const zeroPeriodOmega = omegaFromPeriod(0);
  const negativePeriodOmega = omegaFromPeriod(-10);
  const zeroFrequencyOmega = omegaFromFrequency(0);

  return [
    {
      test: "Zero period",
      inputs: "T = 0 s",
      expected: "→ +∞ (division by zero; not guarded at this layer)",
      computed: `${zeroPeriodOmega}`,
      pass: zeroPeriodOmega === Infinity,
    },
    {
      test: "Negative period",
      inputs: "T = −10 s",
      expected: "→ −0.6283 rad/s (formula doesn't itself forbid a negative period)",
      computed: `${fmt(negativePeriodOmega)} rad/s`,
      pass: percentDiff(negativePeriodOmega, -2 * Math.PI / 10) < IDENTITY_TOLERANCE_PCT,
    },
    {
      test: "Zero frequency",
      inputs: "f = 0 Hz",
      expected: "→ 0 rad/s (no rotation; well-defined, not an error)",
      computed: `${fmt(zeroFrequencyOmega)} rad/s`,
      pass: zeroFrequencyOmega === 0,
    },
  ];
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getAngularVelocityTestRows() {
  return [...identityRows(), ...referenceRows(), ...edgeCaseRows()];
}
