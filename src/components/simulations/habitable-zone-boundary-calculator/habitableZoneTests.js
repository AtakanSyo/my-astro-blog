// Test cases for the "Tests" popup on the Habitable Zone Boundary
// Calculator. These run the calculator's real habitableZone.js functions
// against published reference figures and internal-consistency checks,
// so this table is a genuine live check — not a hardcoded, unverified
// table — and would visibly show failures on this page if the underlying
// math ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follows the same "<slug>Tests.js"
// pattern as roche-limit-calculator/rocheLimitTests.js.

import {
  conservativeHZ,
  optimisticHZ,
  hzDistanceAU,
  effectiveSolarFlux,
  classifyOrbit,
  isWithinCalibratedRange,
  luminosityFromRadiusTeff,
  KOPPARAPU_TEFF_MIN,
  KOPPARAPU_TEFF_MAX,
} from "./habitableZone";

export const HABITABLE_ZONE_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes for the reference checks below
// — rendered at the bottom of the Tests popup by CalculatorTests. Keep
// these two in sync when either changes.
export const HABITABLE_ZONE_TEST_SOURCES = [
  {
    title: "Kopparapu et al. (2013), the source of this calculator's formula",
    text: "\"Habitable Zones Around Main-Sequence Stars: New Estimates\", ApJ, 765, 131. All five boundary coefficient sets (Recent Venus, Runaway Greenhouse, Moist Greenhouse, Maximum Greenhouse, Early Mars) are reproduced from the paper's Table 3, to its full published precision. The paper's own worked example for the Sun — a moist-greenhouse inner edge at 0.99 AU and a maximum-greenhouse outer edge at 1.70 AU — is checked directly below.",
    url: "https://doi.org/10.1088/0004-637X/765/2/131",
    urlLabel: "Kopparapu et al. 2013, ApJ 765, 131",
  },
  {
    title: "TRAPPIST-1's stellar parameters and habitable zone",
    text: "Teff ≈ 2559-2566 K and L ≈ 0.000524-0.000553 L☉ are the commonly cited TRAPPIST-1 parameters from the discovery paper and its follow-ups; the resulting conservative HZ of roughly 0.024-0.049 AU (computed with this same Kopparapu formula) is widely reproduced in discussion of the system's potentially habitable planets (e, f, g). TRAPPIST-1's real Teff sits just below the paper's own 2600 K calibrated floor — a small, commonly-accepted extrapolation, flagged explicitly in the row below.",
    url: "https://www.nature.com/articles/nature21360",
    urlLabel: "Gillon et al. 2017, Nature 542",
  },
  {
    title: "What these rows actually prove",
    text: "The reference rows confirm this calculator's exact formula reproduces the paper's own worked example and the widely-cited TRAPPIST-1 HZ scale. The scaling and edge-case rows below them confirm the formula responds to luminosity, temperature, and degenerate inputs exactly as the algebra predicts. None of this independently re-derives the underlying climate models Kopparapu et al. built the fit from — see the paper itself for that.",
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

// Reference checks against published figures.
function referenceRows() {
  const rows = [];

  // The single most important sanity check on this whole page: the Sun's
  // conservative HZ must bracket Earth's real 1 AU orbit.
  const sunCons = conservativeHZ(5778, 1);
  rows.push({
    test: "Sun — Earth's 1 AU orbit falls inside the conservative habitable zone",
    inputs: "Teff = 5778 K, L = 1 L☉, candidate orbit = 1 AU",
    expected: "conservative HZ brackets 1 AU (inner < 1 AU < outer)",
    computed: `HZ ≈ ${fmt(sunCons.inner, 3)}-${fmt(sunCons.outer, 3)} AU`,
    pass: sunCons.inner < 1 && sunCons.outer > 1,
  });

  // The paper's own worked example (see module header comment in
  // habitableZone.js): moist-greenhouse inner edge 0.99 AU, maximum-
  // greenhouse outer edge 1.70 AU, for the Sun.
  const moist = hzDistanceAU(5780, 1, "moistGreenhouse");
  const maxGH = hzDistanceAU(5780, 1, "maximumGreenhouse");
  rows.push({
    test: "Sun — reproduces Kopparapu et al. (2013)'s own worked example",
    inputs: "Teff = 5780 K, L = 1 L☉",
    expected: "moist greenhouse ≈ 0.99 AU, maximum greenhouse ≈ 1.70 AU",
    computed: `moist ≈ ${fmt(moist, 3)} AU, maximum greenhouse ≈ ${fmt(maxGH, 3)} AU`,
    pass: percentDiff(moist, 0.99) < 2 && percentDiff(maxGH, 1.70) < 2,
  });

  // TRAPPIST-1: real, published Teff and luminosity, compared against the
  // widely-cited conservative HZ scale for the system.
  const trappist = conservativeHZ(2566, 0.000553);
  rows.push({
    test: "TRAPPIST-1 — conservative HZ matches the widely-cited ~0.024-0.049 AU scale",
    inputs: "Teff = 2566 K, L = 0.000553 L☉ (real published TRAPPIST-1 parameters)",
    expected: "inner ≈ 0.02-0.03 AU, outer ≈ 0.04-0.06 AU",
    computed: `HZ ≈ ${fmt(trappist.inner, 4)}-${fmt(trappist.outer, 4)} AU`,
    pass: trappist.inner > 0.02 && trappist.inner < 0.03 && trappist.outer > 0.04 && trappist.outer < 0.06,
  });

  rows.push({
    test: "TRAPPIST-1's real Teff is flagged as (slightly) below the paper's calibrated range",
    inputs: `Teff = 2566 K vs. calibrated range ${KOPPARAPU_TEFF_MIN}-${KOPPARAPU_TEFF_MAX} K`,
    expected: "outside the calibrated range (a small, commonly-accepted extrapolation)",
    computed: isWithinCalibratedRange(2566) ? "within range" : "outside range (extrapolated)",
    pass: isWithinCalibratedRange(2566) === false,
  });

  // Hot F-type star: real Stefan-Boltzmann-derived luminosity, HZ pushed
  // well outward compared to the Sun.
  const fStarL = luminosityFromRadiusTeff(1.4, 7000);
  const fStarHz = conservativeHZ(7000, fStarL);
  rows.push({
    test: "Hot F-type star (Teff 7000 K) — conservative HZ sits farther out than the Sun's",
    inputs: `Teff = 7000 K, R = 1.4 R☉ → L ≈ ${fmt(fStarL, 3)} L☉ (Stefan-Boltzmann)`,
    expected: `both edges farther out than the Sun's (${fmt(sunCons.inner, 3)}-${fmt(sunCons.outer, 3)} AU)`,
    computed: `HZ ≈ ${fmt(fStarHz.inner, 3)}-${fmt(fStarHz.outer, 3)} AU`,
    pass: fStarHz.inner > sunCons.inner && fStarHz.outer > sunCons.outer,
  });

  return rows;
}

// Internal-consistency checks: these don't depend on any externally
// published figure, just on the formula responding to each input exactly
// as the algebra (and the paper's own definitions) predict.
function consistencyRows() {
  const rows = [];

  // d = sqrt(L / Seff) is an exact power law in L at fixed Teff.
  const d1 = hzDistanceAU(5778, 1, "runawayGreenhouse");
  const d4 = hzDistanceAU(5778, 4, "runawayGreenhouse");
  rows.push({
    test: "HZ distance scales with the square root of luminosity, at fixed Teff",
    inputs: "Teff = 5778 K, L = 1 L☉ vs. L = 4 L☉ (runaway-greenhouse boundary)",
    expected: "ratio ≈ 2.0000 (= sqrt(4))",
    computed: `ratio = ${fmt(d4 / d1, 4)}`,
    pass: percentDiff(d4 / d1, 2) < 1e-4,
  });

  // Conservative HZ must always nest strictly inside the optimistic HZ,
  // by the boundaries' own physical definitions, for any valid input.
  const cons = conservativeHZ(5778, 1);
  const opt = optimisticHZ(5778, 1);
  rows.push({
    test: "Conservative HZ nests inside the optimistic HZ (Sun)",
    inputs: "Teff = 5778 K, L = 1 L☉",
    expected: "optimistic.inner < conservative.inner and conservative.outer < optimistic.outer",
    computed: `optimistic ${fmt(opt.inner, 3)}-${fmt(opt.outer, 3)} AU vs. conservative ${fmt(cons.inner, 3)}-${fmt(cons.outer, 3)} AU`,
    pass: opt.inner < cons.inner && cons.outer < opt.outer,
  });

  // Stefan-Boltzmann luminosity derivation: a Sun-like star (R=1 R☉,
  // Teff=5772 K, this module's own T_SUN constant) must give L=1 exactly.
  const lSun = luminosityFromRadiusTeff(1, 5772);
  rows.push({
    test: "Stefan-Boltzmann luminosity derivation gives L = 1 L☉ for a Sun-like star",
    inputs: "R = 1 R☉, Teff = 5772 K",
    expected: "L ≈ 1.0000 L☉",
    computed: `L = ${fmt(lSun, 4)} L☉`,
    pass: percentDiff(lSun, 1) < 1e-6,
  });

  // Orbit classification: Earth's 1 AU must land in the conservative
  // band, both by radius comparison and by the classifyOrbit() function.
  rows.push({
    test: "classifyOrbit() places Earth's 1 AU orbit in the conservative band",
    inputs: "Teff = 5778 K, L = 1 L☉, candidate orbit = 1 AU",
    expected: `"in-conservative"`,
    computed: `"${classifyOrbit(1, cons, opt)}"`,
    pass: classifyOrbit(1, cons, opt) === "in-conservative",
  });

  return rows;
}

// Edge cases: habitableZone.js is pure algebra with no input validation
// of its own (that guard lives in HabitableZoneBoundaryCalculator.jsx's
// `result` useMemo, which rejects non-positive inputs before ever calling
// these functions) — so these rows confirm what the real functions
// actually do when handed zero, negative, or degenerate inputs, rather
// than asserting a rejection behavior the module doesn't implement.
function edgeCaseRows() {
  const cons = conservativeHZ(5778, 1);
  const opt = optimisticHZ(5778, 1);

  const cases = [
    {
      test: "Zero luminosity",
      inputs: "Teff = 5778 K, L = 0 L☉ (runaway-greenhouse boundary)",
      expected: "not rejected — sqrt(0 / S_eff) = 0",
      run: () => hzDistanceAU(5778, 0, "runawayGreenhouse"),
      check: (v) => v === 0,
    },
    {
      test: "Negative luminosity",
      inputs: "Teff = 5778 K, L = −1 L☉ (runaway-greenhouse boundary)",
      expected: "not rejected — sqrt of a negative ratio, giving NaN",
      run: () => hzDistanceAU(5778, -1, "runawayGreenhouse"),
      check: (v) => Number.isNaN(v),
    },
    {
      test: "Unknown boundary key",
      inputs: 'Teff = 5778 K, boundaryKey = "notARealBoundary"',
      expected: "not rejected — no matching coefficients, giving NaN rather than throwing",
      run: () => effectiveSolarFlux(5778, "notARealBoundary"),
      check: (v) => Number.isNaN(v),
    },
    {
      test: "classifyOrbit() with a non-positive orbital distance",
      inputs: "candidate orbit = 0 AU, against the Sun's own conservative/optimistic HZ",
      expected: '"invalid" — not classified into any zone band',
      run: () => classifyOrbit(0, cons, opt),
      check: (v) => v === "invalid",
    },
    {
      test: "Very cool, very dim red dwarf (Teff = 2600 K, L = 0.0001 L☉)",
      inputs: "Teff = 2600 K (paper's calibrated floor), L = 0.0001 L☉",
      expected: "not rejected — finite, positive HZ distances, well under 0.1 AU",
      run: () => {
        const hz = conservativeHZ(2600, 0.0001);
        return hz.inner;
      },
      check: (v) => Number.isFinite(v) && v > 0 && v < 0.1,
    },
  ];

  return cases.map((c) => {
    const computed = c.run();
    return {
      test: c.test,
      inputs: c.inputs,
      expected: c.expected,
      computed: typeof computed === "string" ? `"${computed}"` : fmt(computed),
      pass: c.check(computed),
    };
  });
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getHabitableZoneTestRows() {
  return [...referenceRows(), ...consistencyRows(), ...edgeCaseRows()];
}
