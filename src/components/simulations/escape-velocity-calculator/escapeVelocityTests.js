// Test cases for the "Tests" popup on the Escape Velocity Calculator.
// These run the calculator's real escapeVelocity.js functions — not a
// hardcoded, unverified table — so this would visibly show failures here
// if the underlying math ever broke. See angular-size-calculator's
// angularSizeTests.js for the pattern this follows.
//
// Three kinds of rows, on purpose (same discipline as this site's other
// Tests tables):
//   - "Identity" rows need no external reference data — round-tripping
//     M,r -> v -> M (or -> r) is unconditionally correct if the algebra
//     is, and the v_esc-at-r_s-equals-c check directly verifies this
//     page's own stated differentiator against the Schwarzschild radius.
//   - "Reference" rows cross-check against NASA's independently
//     published escape-velocity figures (not derived from this
//     codebase's own mass/radius numbers) — see
//     ESCAPE_VELOCITY_TEST_SOURCES for citations.
//   - Edge-case rows document the real (correctly guarded) behavior at
//     and beyond the v -> c boundary.

import {
  escapeVelocityFromMassRadius,
  massFromVelocityRadius,
  radiusFromVelocityMass,
  schwarzschildRadiusM,
  massToKg,
  distanceToMeters,
  PRESETS,
  C,
} from "./escapeVelocity";

export const ESCAPE_VELOCITY_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

export const ESCAPE_VELOCITY_TEST_SOURCES = [
  {
    title: "Earth, the Moon, Mars, the Sun",
    text: "Mass and radius from NASA's planetary fact sheets; each fact sheet also directly tabulates an escape velocity, used below as an independently published figure to cross-check against — not re-derived from this codebase's own numbers.",
    url: "https://nssdc.gsfc.nasa.gov/planetary/planetfact.html",
    urlLabel: "NASA Planetary Fact Sheets",
  },
  {
    title: "A white dwarf (Sirius B)",
    text: "Mass ≈ 1.018 M☉, radius ≈ 5,850 km — commonly cited modern measurements for Sirius B, the first white dwarf identified.",
  },
  {
    title: "A neutron star (typical)",
    text: "Illustrative, not a precise constant: 1.4 M☉ and 11 km are commonly cited representative figures. Real neutron star radii vary with mass and the (still not fully settled) equation of state; modern (NICER-era) measurements broadly cluster around 11–13 km for a 1.4 M☉ neutron star.",
  },
  {
    title: "What the identity rows prove vs. the reference rows",
    text: "The round-trip and Schwarzschild-identity rows are pure algebra — unconditionally correct if the arithmetic is, no citation needed. Only the reference rows (NASA-tabulated escape velocities) test this calculator's output against data published independently of this codebase.",
  },
];

const IDENTITY_TOLERANCE_PCT = 0.001; // pure floating-point round-trips and algebraic identities: should be near-exact
const REFERENCE_TOLERANCE_PCT = 0.3; // cross-checks against independently-rounded published figures

function fmt(n, digits = 4) {
  if (!Number.isFinite(n)) return String(n);
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e6 || abs < 1e-3) return n.toExponential(3);
  const rounded = Number(n.toFixed(digits));
  return String(rounded);
}

function percentDiff(a, b) {
  if (b === 0) return a === 0 ? 0 : Infinity;
  return Math.abs((a - b) / b) * 100;
}

function identityRows() {
  const rows = [];

  // Round-trip: M,r -> v -> (v,r) -> M and (v,M) -> r, for every preset.
  for (const p of PRESETS) {
    const M = massToKg(p.mass, p.massUnit);
    const r = distanceToMeters(p.radius, p.radiusUnit);
    const vOut = escapeVelocityFromMassRadius(M, r);
    const v = vOut.v;

    const mBack = massFromVelocityRadius(v, r);
    rows.push({
      test: `${p.label} — v_esc → mass round-trip`,
      inputs: `M = ${fmt(M)} kg, r = ${fmt(r)} m`,
      expected: "massFromVelocityRadius(v, r) = M",
      computed: mBack.valid ? `${fmt(mBack.massKg)} kg` : "rejected",
      pass: mBack.valid && percentDiff(mBack.massKg, M) < IDENTITY_TOLERANCE_PCT,
    });

    const rBack = radiusFromVelocityMass(v, M);
    rows.push({
      test: `${p.label} — v_esc → radius round-trip`,
      inputs: `v = ${fmt(v)} m/s, M = ${fmt(M)} kg`,
      expected: "radiusFromVelocityMass(v, M) = r",
      computed: rBack.valid ? `${fmt(rBack.radiusM)} m` : "rejected",
      pass: rBack.valid && percentDiff(rBack.radiusM, r) < IDENTITY_TOLERANCE_PCT,
    });
  }

  // The page's own differentiator: v_esc at r = r_s should equal c exactly.
  for (const [label, massKg] of [["1 M☉", massToKg(1, "msun")], ["Earth's mass", 5.9722e24]]) {
    const rs = schwarzschildRadiusM(massKg);
    const out = escapeVelocityFromMassRadius(massKg, rs);
    rows.push({
      test: `v_esc at r = r_s equals c (M = ${label})`,
      inputs: `M = ${fmt(massKg)} kg, r = r_s = ${fmt(rs)} m`,
      expected: `v_esc = c = ${fmt(C)} m/s`,
      computed: out.valid ? `${fmt(out.v)} m/s` : "rejected",
      pass: out.valid && percentDiff(out.v, C) < IDENTITY_TOLERANCE_PCT,
    });
  }

  return rows;
}

function referenceRows() {
  const refs = [
    { label: "Earth", massKg: 5.9722e24, radiusM: 6371000, publishedKms: 11.19 },
    { label: "The Moon", massKg: 7.342e22, radiusM: 1737400, publishedKms: 2.38 },
    { label: "Mars", massKg: 6.4171e23, radiusM: 3389500, publishedKms: 5.03 },
    { label: "The Sun", massKg: 1.98847e30, radiusM: 696000000, publishedKms: 617.6 },
  ];

  return refs.map((ref) => {
    const out = escapeVelocityFromMassRadius(ref.massKg, ref.radiusM);
    const computedKms = out.valid ? out.v / 1000 : NaN;
    return {
      test: `${ref.label}: computed v_esc vs. NASA-published figure`,
      inputs: `M = ${fmt(ref.massKg)} kg, r = ${fmt(ref.radiusM)} m`,
      expected: `≈ ${ref.publishedKms} km/s (NASA fact sheet)`,
      computed: out.valid ? `${fmt(computedKms, 3)} km/s` : "rejected",
      pass: out.valid && percentDiff(computedKms, ref.publishedKms) < REFERENCE_TOLERANCE_PCT,
    };
  });
}

function edgeCaseRows() {
  const cases = [
    {
      test: "Escape velocity input at c (solving for mass)",
      inputs: "v = c, r = 1000 m",
      run: () => massFromVelocityRadius(C, 1000),
    },
    {
      test: "Escape velocity input at c (solving for radius)",
      inputs: "v = c, M = 1e30 kg",
      run: () => radiusFromVelocityMass(C, 1e30),
    },
    {
      test: "Negative mass",
      inputs: "M = −5 kg, r = 100 m",
      run: () => escapeVelocityFromMassRadius(-5, 100),
    },
    {
      test: "Zero radius",
      inputs: "M = 100 kg, r = 0 m",
      run: () => escapeVelocityFromMassRadius(100, 0),
    },
    {
      test: "Zero escape velocity (solving for mass)",
      inputs: "v = 0, r = 100 m",
      run: () => massFromVelocityRadius(0, 100),
    },
    {
      test: "Negative radius (solving for radius)",
      inputs: "v = 100 m/s, M = −5 kg",
      run: () => radiusFromVelocityMass(100, -5),
    },
  ];

  return cases.map((c) => {
    const out = c.run();
    return {
      test: c.test,
      inputs: c.inputs,
      expected: "rejected as invalid",
      computed: out.valid ? "accepted (bug — should have been rejected)" : `rejected — ${out.reason}`,
      pass: out.valid === false,
    };
  });
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getEscapeVelocityTestRows() {
  return [...identityRows(), ...referenceRows(), ...edgeCaseRows()];
}
