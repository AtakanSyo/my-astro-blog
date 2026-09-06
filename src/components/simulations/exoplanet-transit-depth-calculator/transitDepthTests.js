// Test cases for the "Tests" popup on the Exoplanet Transit Depth
// Calculator. These run the calculator's real transitDepth.js functions
// against a real, well-known transiting planet, this calculator's own
// self-consistent presets, scaling/round-trip checks, and edge cases, so
// this table is a genuine live check — not a hardcoded, unverified table
// — and would visibly show failures on this page if the underlying math
// ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<slug>Tests.js" per calculator, computing rows from that calculator's
// own math module — to add the Tests popup to another calculator.

import {
  PLANET_RADIUS_UNITS,
  STAR_RADIUS_UNITS,
  planetRadiusToMeters,
  planetRadiusFromMeters,
  starRadiusToMeters,
  depthToFraction,
  depthFromFraction,
  transitDepth,
  planetRadiusFromDepth,
  depthToMillimag,
} from "./transitDepth";

export const TRANSIT_DEPTH_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes above the reference figures
// below — rendered at the bottom of the Tests popup by CalculatorTests.
// Keep these two in sync when either changes.
export const TRANSIT_DEPTH_TEST_SOURCES = [
  {
    title: "HD 209458 b — the first exoplanet transit ever observed",
    text: "Radius ≈1.38 Jupiter radii, host star radius ≈1.148 solar radii (commonly cited literature figures, e.g. from the NASA Exoplanet Archive), giving a transit depth of roughly 1.5% — consistent with the ≈1.5% depth reported in the original discovery, Charbonneau et al. (2000), \"Detection of Planetary Transits Across a Sun-Like Star.\"",
    url: "https://ui.adsabs.harvard.edu/abs/2000ApJ...529L..45C/abstract",
    urlLabel: "Charbonneau et al. 2000, ApJ 529, L45",
  },
  {
    title: "This calculator's own presets",
    text: "The Jupiter-Sun, Earth-Sun, TRAPPIST-1-like, sub-Neptune, and reverse-solve presets are all self-consistent by construction (radii and depth really do satisfy δ = (Rp/R★)² for the figures shown) — used below to confirm transitDepth and planetRadiusFromDepth reproduce each preset's advertised depth or radius exactly, using the exact real Earth/Jupiter/Sun radii this module's own constants define.",
  },
  {
    title: "What these rows actually prove",
    text: "The HD 209458 b row confirms the exact formula reproduces a real, published transit depth given commonly cited radii for that system — not that those radii are independently, precisely verified. The preset rows and the scaling/round-trip rows below don't depend on any external citation — they confirm the formula responds to Rp and R★ exactly as the algebra predicts.",
  },
];

function fmt(n, digits = 4) {
  if (Number.isNaN(n)) return "NaN";
  if (n === Infinity) return "∞";
  if (n === -Infinity) return "−∞";
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-4)) return n.toExponential(3);
  const rounded = Number(n.toFixed(digits));
  return String(rounded);
}

function percentDiff(a, b) {
  if (b === 0) return a === 0 ? 0 : Infinity;
  return Math.abs((a - b) / b) * 100;
}

// Real, well-known transiting planet — see source note above.
function realReferenceRows() {
  const rpM = planetRadiusToMeters(1.38, "rjup");
  const rsM = starRadiusToMeters(1.148, "rsun");
  const depthFrac = transitDepth(rpM, rsM);
  const depthPct = depthFromFraction(depthFrac, "percent");
  const expectedPct = 1.5;
  return [
    {
      test: "HD 209458 b — transit depth",
      inputs: "Rp = 1.38 R♃, R★ = 1.148 R☉",
      expected: `≈ ${fmt(expectedPct)}%`,
      computed: `${fmt(depthPct)}%`,
      pass: percentDiff(depthPct, expectedPct) < 5,
    },
  ];
}

// This calculator's own self-consistent presets: radii -> depth should
// reproduce each preset's advertised depth exactly (they were computed
// with this exact formula and these exact real-body constants).
const PRESET_CHECKS = [
  { label: "Hot Jupiter, Sun-like star", rp: 1, rpUnit: "rjup", rs: 1, rsUnit: "rsun", expectedPct: 1.0551 },
  { label: "Earth, Sun-like star", rp: 1, rpUnit: "rearth", rs: 1, rsUnit: "rsun", expectedPpm: 83.79 },
  { label: "TRAPPIST-1-like, red-dwarf star", rp: 1, rpUnit: "rearth", rs: 0.121, rsUnit: "rsun", expectedPpm: 5723 },
  { label: "Sub-Neptune, Sun-like star", rp: 3.88, rpUnit: "rearth", rs: 1, rsUnit: "rsun", expectedPpm: 1261 },
];

function presetRows() {
  return PRESET_CHECKS.map((p) => {
    const rpM = planetRadiusToMeters(p.rp, p.rpUnit);
    const rsM = starRadiusToMeters(p.rs, p.rsUnit);
    const depthFrac = transitDepth(rpM, rsM);
    if (p.expectedPct !== undefined) {
      const depthPct = depthFromFraction(depthFrac, "percent");
      return {
        test: `${p.label} — depth`,
        inputs: `Rp = ${fmt(p.rp)} ${PLANET_RADIUS_UNITS[p.rpUnit].short}, R★ = ${fmt(p.rs)} ${STAR_RADIUS_UNITS[p.rsUnit].short}`,
        expected: `≈ ${fmt(p.expectedPct)}%`,
        computed: `${fmt(depthPct)}%`,
        pass: percentDiff(depthPct, p.expectedPct) < 0.5,
      };
    }
    const depthPpm = depthFromFraction(depthFrac, "ppm");
    return {
      test: `${p.label} — depth`,
      inputs: `Rp = ${fmt(p.rp)} ${PLANET_RADIUS_UNITS[p.rpUnit].short}, R★ = ${fmt(p.rs)} ${STAR_RADIUS_UNITS[p.rsUnit].short}`,
      expected: `≈ ${fmt(p.expectedPpm)} ppm`,
      computed: `${fmt(depthPpm)} ppm`,
      pass: percentDiff(depthPpm, p.expectedPpm) < 0.5,
    };
  });
}

// Reverse-solve preset: given a depth, planetRadiusFromDepth should
// recover the advertised planet radius.
function reverseSolveRow() {
  const rsM = starRadiusToMeters(1, "rsun");
  const depthFrac = depthToFraction(500, "ppm");
  const rpM = planetRadiusFromDepth(depthFrac, rsM);
  const rpEarth = planetRadiusFromMeters(rpM, "rearth");
  const expected = 2.44;
  return {
    test: "Reverse: 500 ppm signal — planet radius",
    inputs: "δ = 500 ppm, R★ = 1 R☉",
    expected: `≈ ${fmt(expected)} R⊕`,
    computed: `${fmt(rpEarth)} R⊕`,
    pass: percentDiff(rpEarth, expected) < 1,
  };
}

// Internal-consistency checks: don't depend on any externally published
// figure, just on the formula responding to each input exactly as the
// algebra predicts.
function consistencyRows() {
  const rsM = starRadiusToMeters(1, "rsun");
  const rp1 = planetRadiusToMeters(1, "rearth");
  const rp2 = planetRadiusToMeters(2, "rearth"); // 2x
  const depth1 = transitDepth(rp1, rsM);
  const depth2 = transitDepth(rp2, rsM);

  const rpFixed = planetRadiusToMeters(1, "rjup");
  const rsA = starRadiusToMeters(1, "rsun");
  const rsB = starRadiusToMeters(2, "rsun"); // 2x
  const depthA = transitDepth(rpFixed, rsA);
  const depthB = transitDepth(rpFixed, rsB);

  const rpRoundTrip = planetRadiusToMeters(2.44, "rearth");
  const depthRoundTrip = transitDepth(rpRoundTrip, rsM);
  const rpRecovered = planetRadiusFromDepth(depthRoundTrip, rsM);

  return [
    {
      test: "Depth scales with the square of planet radius",
      inputs: "Rp = 1 R⊕ vs. Rp = 2 R⊕, R★ fixed at 1 R☉",
      expected: "ratio ≈ 4.0000",
      computed: `ratio = ${fmt(depth2 / depth1)}`,
      pass: percentDiff(depth2 / depth1, 4) < 1e-6,
    },
    {
      test: "Depth scales with the inverse square of stellar radius",
      inputs: "R★ = 1 R☉ vs. R★ = 2 R☉, Rp fixed at 1 R♃",
      expected: "ratio ≈ 0.2500",
      computed: `ratio = ${fmt(depthB / depthA)}`,
      pass: percentDiff(depthB / depthA, 0.25) < 1e-6,
    },
    {
      test: "planetRadiusFromDepth inverts transitDepth",
      inputs: "Rp = 2.44 R⊕, R★ = 1 R☉ → δ → Rp",
      expected: "≈ 2.4400 R⊕ recovered",
      computed: `${fmt(planetRadiusFromMeters(rpRecovered, "rearth"))} R⊕`,
      pass: percentDiff(rpRecovered, rpRoundTrip) < 1e-6,
    },
  ];
}

// Edge cases: transitDepth.js is pure algebra with no input validation
// of its own (that guard lives in
// ExoplanetTransitDepthCalculator.jsx's `result` useMemo, which requires
// positive radii/depth and rejects depth >= 1) — these rows document the
// actual, unguarded behavior of transitDepth, planetRadiusFromDepth, and
// depthToMillimag on zero, out-of-domain, and boundary inputs.
function edgeCaseRows() {
  const rows = [];

  const depthAtZeroRp = transitDepth(0, starRadiusToMeters(1, "rsun"));
  rows.push({
    test: "Zero planet radius",
    inputs: "Rp = 0 m, R★ = 1 R☉",
    expected: "not rejected — gives a depth of exactly 0",
    computed: fmt(depthAtZeroRp),
    pass: depthAtZeroRp === 0,
  });

  const depthAtZeroRs = transitDepth(planetRadiusToMeters(1, "rearth"), 0);
  rows.push({
    test: "Zero stellar radius",
    inputs: "Rp = 1 R⊕, R★ = 0 m",
    expected: "not rejected — division by zero, giving Infinity",
    computed: fmt(depthAtZeroRs),
    pass: depthAtZeroRs === Infinity,
  });

  const rsM1 = starRadiusToMeters(1, "rsun");
  const rpAtFullDepth = planetRadiusFromDepth(1, rsM1);
  rows.push({
    test: "planetRadiusFromDepth at δ = 1 (100% — out of physical domain)",
    inputs: "δ = 1, R★ = 1 R☉",
    expected: "not rejected — gives Rp = R★ exactly, though the component's own UI rejects δ ≥ 1 before calling this",
    computed: `${fmt(planetRadiusFromMeters(rpAtFullDepth, "km"))} km`,
    pass: rpAtFullDepth === rsM1,
  });

  const mmagAtFullDepth = depthToMillimag(1);
  rows.push({
    test: "depthToMillimag at δ = 1 (100% dimming)",
    inputs: "δ = 1",
    expected: "Infinity — explicitly guarded in the function itself",
    computed: fmt(mmagAtFullDepth),
    pass: mmagAtFullDepth === Infinity,
  });

  const mmagAtZeroDepth = depthToMillimag(0);
  rows.push({
    test: "depthToMillimag at δ = 0 (no dimming)",
    inputs: "δ = 0",
    expected: "0 mmag",
    computed: `${fmt(mmagAtZeroDepth)} mmag`,
    pass: mmagAtZeroDepth === 0,
  });

  return rows;
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getTransitDepthTestRows() {
  return [
    ...realReferenceRows(),
    ...presetRows(),
    reverseSolveRow(),
    ...consistencyRows(),
    ...edgeCaseRows(),
  ];
}
