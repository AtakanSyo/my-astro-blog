// Test cases for the "Tests" popup on the Roche Limit Calculator. These
// run the calculator's real roche.js functions against known reference
// bodies and internal-consistency checks, so this table is a genuine
// live check — not a hardcoded, unverified table — and would visibly
// show failures on this page if the underlying math ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<slug>Tests.js" per calculator, computing rows from that calculator's
// own math module — to add the Tests popup to another calculator.

import { FLUID_COEFFICIENT, RIGID_COEFFICIENT, fluidRocheLimit, rigidRocheLimit } from "./roche";

export const ROCHE_LIMIT_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes above the reference bodies
// below — rendered at the bottom of the Tests popup by CalculatorTests.
// Keep these two in sync when either changes.
export const ROCHE_LIMIT_TEST_SOURCES = [
  {
    title: "Saturn + its icy rings",
    text: "Saturn's radius (58,232 km) and mean density (687 kg/m³) from NASA's fact sheet; ring-particle density taken as water ice (920 kg/m³). ≈2.2 Saturn radii for the fluid limit is the same figure this project's own roche.test.js already checks — it is a standard, widely repeated order-of-magnitude statement about Saturn's rings, not a single official NASA number.",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturnfact.html",
    urlLabel: "NASA Saturn Fact Sheet",
  },
  {
    title: "Earth + the Moon",
    text: "Earth's mean radius (6371 km) and mean density (5514 kg/m³), and the Moon's mean density (3344 kg/m³), from NASA fact sheets. ≈2.9 Earth radii for the fluid limit is a commonly repeated approximate figure derived from those densities under this formula, not an independently published exact multiple.",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html",
    urlLabel: "NASA Earth Fact Sheet",
  },
  {
    title: "Jupiter + Europa",
    text: "Jupiter's radius (69,911 km) and mean density (1326 kg/m³) from NASA's fact sheet; Europa's mean density (3013 kg/m³) and semi-major axis (671,034 km) from NASA's Jovian satellite fact sheet — used to confirm Europa's real orbit sits far outside Jupiter's Roche limit, as it must for a stable moon to exist there.",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/jupiterfact.html",
    urlLabel: "NASA Jupiter Fact Sheet",
  },
  {
    title: "Sun + Mercury",
    text: "The Sun's radius (696,000 km) and mean density (1408 kg/m³) from NASA's fact sheet; Mercury's mean density (5427 kg/m³) and semi-major axis (57,909,000 km) from NASA's Mercury fact sheet.",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html",
    urlLabel: "NASA Sun Fact Sheet",
  },
  {
    title: "Comet Shoemaker–Levy 9 at Jupiter (1992)",
    text: "Illustrative, not precise citations — the comet's assumed rubble-pile density (500 kg/m³) and its perijove distance during the 1992 breakup (here ≈96,000 km, roughly the ~1.3–1.4 Jupiter radii commonly cited in post-disruption analyses) both vary across published estimates. Included as a real, well-known event where the encounter distance was inside the computed Roche limit.",
  },
  {
    title: "What these rows actually prove",
    text: "The reference rows confirm the exact formula reproduces the commonly cited scale of these real body pairs' Roche limits (or the correct inside/outside relationship to their real orbital distance) to the stated tolerance. The scaling and edge-case rows below them confirm the formula responds to radius, density, and degenerate inputs exactly as the algebra predicts. None of this independently verifies the masses, radii, densities, or distances typed in above — see each source note.",
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

// Each pair's radius and densities are the real, independently published
// NASA fact-sheet figures for that primary/satellite (see sources above).
// "ratio" rows check the fluid limit, expressed in primary radii, against
// a commonly cited approximate multiple. "outside"/"inside" rows check
// the real orbital or encounter distance against the computed limit in
// the physically expected direction — a much safer claim than pinning an
// exact km figure, since the real distances span orders of magnitude
// either side of the limit.
const REFERENCE_PAIRS = [
  {
    label: "Saturn + icy ring material",
    radius: 58232,
    densityPrimary: 687,
    densitySatellite: 920,
    checkType: "ratio",
    expectedRatio: 2.2,
    tolerancePct: 10,
  },
  {
    label: "Earth + the Moon",
    radius: 6371,
    densityPrimary: 5514,
    densitySatellite: 3344,
    checkType: "ratio",
    expectedRatio: 2.9,
    tolerancePct: 5,
  },
  {
    label: "Jupiter + Europa (real orbit)",
    radius: 69911,
    densityPrimary: 1326,
    densitySatellite: 3013,
    checkType: "outside",
    actualDistance: 671034,
    minSafeRatio: 3,
  },
  {
    label: "Sun + Mercury (real orbit)",
    radius: 696000,
    densityPrimary: 1408,
    densitySatellite: 5427,
    checkType: "outside",
    actualDistance: 57909000,
    minSafeRatio: 3,
  },
  {
    label: "Comet Shoemaker–Levy 9 at Jupiter (1992 breakup, illustrative)",
    radius: 69911,
    densityPrimary: 1326,
    densitySatellite: 500,
    checkType: "inside",
    actualDistance: 96000,
    maxSafeRatio: 1,
  },
];

function referenceRows() {
  return REFERENCE_PAIRS.map((ref) => {
    const limit = fluidRocheLimit(ref.radius, ref.densityPrimary, ref.densitySatellite);

    if (ref.checkType === "ratio") {
      const ratio = limit / ref.radius;
      return {
        test: `${ref.label} — fluid Roche limit`,
        inputs: `R_M = ${fmt(ref.radius)} km, ρ_M = ${fmt(ref.densityPrimary)} kg/m³, ρ_m = ${fmt(ref.densitySatellite)} kg/m³`,
        expected: `≈ ${fmt(ref.expectedRatio)} R_M`,
        computed: `${fmt(ratio)} R_M (${fmt(limit)} km)`,
        pass: percentDiff(ratio, ref.expectedRatio) < ref.tolerancePct,
      };
    }

    const ratio = ref.actualDistance / limit;
    if (ref.checkType === "outside") {
      return {
        test: `${ref.label} — real distance vs. fluid Roche limit`,
        inputs: `R_M = ${fmt(ref.radius)} km, ρ_M = ${fmt(ref.densityPrimary)} kg/m³, ρ_m = ${fmt(ref.densitySatellite)} kg/m³, actual distance = ${fmt(ref.actualDistance)} km`,
        expected: `safely outside the limit (actual ≫ limit)`,
        computed: `limit ≈ ${fmt(limit)} km; actual is ${fmt(ratio)}× the limit`,
        pass: ratio > ref.minSafeRatio,
      };
    }

    // checkType === "inside"
    return {
      test: `${ref.label} — real distance vs. fluid Roche limit`,
      inputs: `R_M = ${fmt(ref.radius)} km, ρ_M = ${fmt(ref.densityPrimary)} kg/m³, ρ_m = ${fmt(ref.densitySatellite)} kg/m³, actual distance = ${fmt(ref.actualDistance)} km`,
      expected: `inside the limit (actual < limit) — tidal disruption expected`,
      computed: `limit ≈ ${fmt(limit)} km; actual is ${fmt(ratio)}× the limit`,
      pass: ratio < ref.maxSafeRatio,
    };
  });
}

// Internal-consistency checks: these don't depend on any externally
// published figure, just on the formula responding to each input exactly
// as the algebra predicts.
function consistencyRows() {
  const R1 = 58232, R2 = 116464; // R2 = 2 × R1
  const limitR1 = fluidRocheLimit(R1, 687, 920);
  const limitR2 = fluidRocheLimit(R2, 687, 920);

  const dsA = 920, dsB = 920 / 8; // density ratio ρ_M/ρ_m scaled ×8
  const limitDsA = fluidRocheLimit(58232, 687, dsA);
  const limitDsB = fluidRocheLimit(58232, 687, dsB);

  const fluidEarthMoon = fluidRocheLimit(6371, 5514, 3344);
  const rigidEarthMoon = rigidRocheLimit(6371, 5514, 3344);

  return [
    {
      test: "Roche limit scales linearly with primary radius",
      inputs: `R_M = ${fmt(R1)} km vs. R_M = ${fmt(R2)} km, densities fixed (ρ_M = 687, ρ_m = 920 kg/m³)`,
      expected: "ratio ≈ 2.0000",
      computed: `ratio = ${fmt(limitR2 / limitR1)}`,
      pass: percentDiff(limitR2 / limitR1, 2) < 1e-6,
    },
    {
      test: "Roche limit scales with the cube root of the density ratio",
      inputs: `ρ_m = ${fmt(dsA)} kg/m³ vs. ρ_m = ${fmt(dsB)} kg/m³ (ρ_M/ρ_m up ×8), R_M and ρ_M fixed`,
      expected: "ratio ≈ 2.0000 (= 8^(1/3))",
      computed: `ratio = ${fmt(limitDsB / limitDsA)}`,
      pass: percentDiff(limitDsB / limitDsA, 2) < 1e-6,
    },
    {
      test: "Fluid limit is always farther out than the rigid limit, same bodies",
      inputs: "Earth + Moon densities (ρ_M = 5514, ρ_m = 3344 kg/m³), R_M = 6371 km",
      expected: "fluid > rigid",
      computed: `fluid ≈ ${fmt(fluidEarthMoon)} km vs. rigid ≈ ${fmt(rigidEarthMoon)} km`,
      pass: fluidEarthMoon > rigidEarthMoon,
    },
    {
      test: "Fluid-to-rigid ratio matches the coefficient ratio exactly",
      inputs: "Any body pair — coefficients alone should set the ratio",
      expected: `≈ ${fmt(FLUID_COEFFICIENT / RIGID_COEFFICIENT)} (= 2.44 / 2^(1/3))`,
      computed: `${fmt(fluidEarthMoon / rigidEarthMoon)}`,
      pass: percentDiff(fluidEarthMoon / rigidEarthMoon, FLUID_COEFFICIENT / RIGID_COEFFICIENT) < 1e-6,
    },
  ];
}

// Edge cases: roche.js is pure algebra with no input validation of its
// own (that guard lives in RocheLimitCalculator.jsx's `result` useMemo,
// which rejects non-positive inputs before ever calling these
// functions) — so these rows confirm what fluidRocheLimit/rigidRocheLimit
// actually do when handed zero, negative, or degenerate inputs, rather
// than asserting a rejection behavior the module doesn't implement.
function edgeCaseRows() {
  const cases = [
    {
      test: "Zero satellite density",
      inputs: "R_M = 58232 km, ρ_M = 687 kg/m³, ρ_m = 0 kg/m³",
      expected: "not rejected — density ratio divides by zero, giving +Infinity",
      run: () => fluidRocheLimit(58232, 687, 0),
      check: (v) => v === Infinity,
    },
    {
      test: "Zero primary density",
      inputs: "R_M = 58232 km, ρ_M = 0 kg/m³, ρ_m = 920 kg/m³",
      expected: "not rejected — density ratio is 0, giving a Roche limit of 0",
      run: () => fluidRocheLimit(58232, 0, 920),
      check: (v) => v === 0,
    },
    {
      test: "Zero primary radius",
      inputs: "R_M = 0 km, ρ_M = 687 kg/m³, ρ_m = 920 kg/m³",
      expected: "not rejected — R_M multiplies the result, giving 0",
      run: () => fluidRocheLimit(0, 687, 920),
      check: (v) => v === 0,
    },
    {
      test: "Both densities zero",
      inputs: "R_M = 58232 km, ρ_M = 0 kg/m³, ρ_m = 0 kg/m³",
      expected: "not rejected — 0/0 density ratio, giving NaN",
      run: () => fluidRocheLimit(58232, 0, 0),
      check: (v) => Number.isNaN(v),
    },
    {
      test: "Negative satellite density",
      inputs: "R_M = 58232 km, ρ_M = 687 kg/m³, ρ_m = −920 kg/m³",
      expected: "not rejected — cube root of a negative ratio is a real negative number, giving an unphysical negative distance",
      run: () => fluidRocheLimit(58232, 687, -920),
      check: (v) => Number.isFinite(v) && v < 0,
    },
  ];

  return cases.map((c) => {
    const computed = c.run();
    return {
      test: c.test,
      inputs: c.inputs,
      expected: c.expected,
      computed: fmt(computed),
      pass: c.check(computed),
    };
  });
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getRocheLimitTestRows() {
  return [...referenceRows(), ...consistencyRows(), ...edgeCaseRows()];
}
