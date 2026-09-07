// Test cases for the "Tests" popup on the Tidal Disruption Radius
// Calculator. These run the calculator's real tidalDisruption.js functions
// against known reference figures and internal-consistency checks, so this
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
  R_SUN_M,
  tidalDisruptionRadiusM,
  schwarzschildRadiusM,
  crossoverMassKg,
  massToKg,
  radiusFromMeters,
} from "./tidalDisruption";

export const TIDAL_DISRUPTION_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes above — rendered at the bottom
// of the Tests popup by CalculatorTests. Keep these two in sync when
// either changes.
export const TIDAL_DISRUPTION_TEST_SOURCES = [
  {
    title: "The Sun",
    text: "Nominal solar mass 1.98847 × 10³⁰ kg and nominal solar radius 696,000 km, IAU 2015 constants — used as the default Sun-like star in every reference row below.",
    url: "https://www.iau.org/static/resolutions/IAU2015_English.pdf",
    urlLabel: "IAU 2015 Resolution B3",
  },
  {
    title: "Sagittarius A*",
    text: "Mass 4.297 × 10⁶ M☉, from the GRAVITY Collaboration's stellar-orbit measurement of the Milky Way's central black hole — the same figure this site's Schwarzschild Radius calculator uses. A Sun-like star disrupted at this mass gives r_t ≈ 162 R☉ (≈0.76 AU), safely outside this black hole's own event horizon — a real, observable tidal-disruption regime.",
    url: "https://doi.org/10.1051/0004-6361/201935656",
    urlLabel: "GRAVITY Collaboration (2019), A&A 625, L10",
  },
  {
    title: "The \"swallowed whole\" threshold",
    text: "The commonly cited approximate mass above which a Sun-like star is swallowed whole (r_t < r_s) rather than tidally disrupted is roughly 10^8 M☉ — see general tidal-disruption-event review discussions of the detectability limit. This calculator's crossoverMassKg derives that threshold from the algebra itself (solving r_t(M) = r_s(M) exactly) rather than hard-coding the commonly cited figure — the row below confirms the derived value lands in the same order-of-magnitude neighborhood.",
    url: "https://arxiv.org/abs/1204.4643",
    urlLabel: "Kesden (2012), Phys. Rev. D 85, 024037",
  },
  {
    title: "What these rows actually prove",
    text: "The reference rows confirm the formula reproduces the expected order of magnitude for a real black hole mass (Sgr A*) and the expected order of magnitude for the swallowed-whole crossover mass. The scaling and crossover-consistency rows below don't depend on any external citation — they confirm the formula responds to black hole mass, star mass, and star radius exactly as the algebra predicts, and that the derived crossover mass is genuinely the point where r_t = r_s. None of this independently re-derives the cited masses or radii themselves — see each source note.",
  },
];

const TOLERANCE_PCT = 5;

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

// A Sun-like star disrupted by Sgr A*'s real, published mass — the one
// reference figure in this calculator with an independently measured
// black hole mass behind it.
function referenceRows() {
  const bhMassKg = massToKg(4.297e6, "msun");
  const rtM = tidalDisruptionRadiusM(R_SUN_M, bhMassKg, M_SUN);
  const rsM = schwarzschildRadiusM(bhMassKg);
  const rtAu = radiusFromMeters(rtM, "m") / 149597870700;
  const rtRsun = radiusFromMeters(rtM, "m") / R_SUN_M;

  return [
    {
      test: "Sun-like star near Sgr A* — tidal disruption radius",
      inputs: "M_BH = 4.297 × 10⁶ M☉ (GRAVITY Collaboration), M★ = 1 M☉, R★ = 1 R☉",
      expected: "≈ 0.3–2 AU (order of magnitude commonly quoted for a solar-type TDE around a black hole of this mass)",
      computed: `r_t ≈ ${fmt(rtRsun, 1)} R☉ ≈ ${fmt(rtAu, 3)} AU`,
      pass: rtAu > 0.3 && rtAu < 2,
    },
    {
      test: "Sun-like star near Sgr A* — a real, observable TDE regime (r_t outside r_s)",
      inputs: "Same as above",
      expected: "r_t > r_s (disruption happens outside the event horizon, so a flare is observable)",
      computed: `r_t/r_s ≈ ${fmt(rtM / rsM, 2)}`,
      pass: rtM > rsM,
    },
  ];
}

// Internal-consistency checks: these don't depend on any externally
// published figure, just on the formula responding to each input exactly
// as the algebra predicts.
function consistencyRows() {
  const rows = [];

  const rt1 = tidalDisruptionRadiusM(R_SUN_M, M_SUN, M_SUN);
  const rt2 = tidalDisruptionRadiusM(R_SUN_M, 2 * M_SUN, M_SUN);
  rows.push({
    test: "Doubling black hole mass multiplies r_t by exactly 2^(1/3)",
    inputs: "M_BH = 1 M☉ vs. M_BH = 2 M☉, M★ = 1 M☉, R★ = 1 R☉",
    expected: `ratio ≈ ${fmt(Math.cbrt(2))} (= 2^(1/3))`,
    computed: `ratio = ${fmt(rt2 / rt1)}`,
    pass: percentDiff(rt2 / rt1, Math.cbrt(2)) < 1e-6,
  });

  const rtSmallR = tidalDisruptionRadiusM(R_SUN_M, 1e6 * M_SUN, M_SUN);
  const rtBigR = tidalDisruptionRadiusM(3 * R_SUN_M, 1e6 * M_SUN, M_SUN);
  rows.push({
    test: "r_t scales linearly with star radius at fixed masses",
    inputs: "R★ = 1 R☉ vs. R★ = 3 R☉, M_BH = 10⁶ M☉, M★ = 1 M☉ fixed",
    expected: "ratio ≈ 3.0000",
    computed: `ratio = ${fmt(rtBigR / rtSmallR)}`,
    pass: percentDiff(rtBigR / rtSmallR, 3) < 1e-6,
  });

  const ratioAt = (bhMassSolar) => {
    const bhMassKg = bhMassSolar * M_SUN;
    return tidalDisruptionRadiusM(R_SUN_M, bhMassKg, M_SUN) / schwarzschildRadiusM(bhMassKg);
  };
  const ratioLow = ratioAt(10);
  const ratioMid = ratioAt(1e6);
  const ratioHigh = ratioAt(1e10);
  rows.push({
    test: "r_t/r_s decreases monotonically as black hole mass increases",
    inputs: "M_BH = 10 M☉, 10⁶ M☉, 10¹⁰ M☉ (Sun-like star fixed)",
    expected: "ratio decreases at each step",
    computed: `${fmt(ratioLow)} → ${fmt(ratioMid)} → ${fmt(ratioHigh, 6)}`,
    pass: ratioLow > ratioMid && ratioMid > ratioHigh,
  });
  rows.push({
    test: "r_t/r_s eventually drops below 1 (swallowed-whole regime exists)",
    inputs: "M_BH = 10¹⁰ M☉, Sun-like star",
    expected: "ratio < 1",
    computed: `ratio = ${fmt(ratioHigh, 6)}`,
    pass: ratioHigh < 1,
  });

  const mCross = crossoverMassKg(R_SUN_M, M_SUN);
  const rtCross = tidalDisruptionRadiusM(R_SUN_M, mCross, M_SUN);
  const rsCross = schwarzschildRadiusM(mCross);
  rows.push({
    test: "crossoverMassKg genuinely solves r_t(M) = r_s(M)",
    inputs: "Sun-like star (M★ = 1 M☉, R★ = 1 R☉)",
    expected: "r_t / r_s ≈ 1.0000 at the derived crossover mass",
    computed: `M_cross ≈ ${fmt(mCross / M_SUN, 3)} M☉; r_t/r_s = ${fmt(rtCross / rsCross)}`,
    pass: percentDiff(rtCross / rsCross, 1) < 1e-4,
  });
  rows.push({
    test: "Derived crossover mass lands near the commonly cited ~10⁸ M☉ order of magnitude",
    inputs: "Sun-like star",
    expected: "between 10⁷ and 10⁹ M☉",
    computed: `M_cross ≈ ${fmt(mCross / M_SUN, 0)} M☉`,
    pass: mCross / M_SUN > 1e7 && mCross / M_SUN < 1e9,
  });

  return rows;
}

// Edge cases: tidalDisruption.js's core functions are plain algebra with
// no input validation of their own (that guard lives in the calculator
// component's `result` useMemo, which rejects non-positive inputs before
// ever calling these functions) — so these rows confirm what the real
// functions actually do when handed zero, negative, or degenerate inputs,
// rather than asserting a rejection behavior the module doesn't implement.
function edgeCaseRows() {
  const cases = [
    {
      test: "Zero star mass",
      inputs: "R★ = 1 R☉, M_BH = 1 M☉, M★ = 0 M☉",
      expected: "not rejected — mass ratio divides by zero, giving +Infinity",
      run: () => tidalDisruptionRadiusM(R_SUN_M, M_SUN, 0),
      check: (v) => v === Infinity,
    },
    {
      test: "Zero black hole mass",
      inputs: "R★ = 1 R☉, M_BH = 0 M☉, M★ = 1 M☉",
      expected: "not rejected — mass ratio is 0, giving a tidal radius of 0",
      run: () => tidalDisruptionRadiusM(R_SUN_M, 0, M_SUN),
      check: (v) => v === 0,
    },
    {
      test: "Zero star radius",
      inputs: "R★ = 0, M_BH = 10⁶ M☉, M★ = 1 M☉",
      expected: "not rejected — R★ multiplies the result, giving 0 regardless of masses",
      run: () => tidalDisruptionRadiusM(0, 1e6 * M_SUN, M_SUN),
      check: (v) => v === 0,
    },
    {
      test: "Negative black hole mass",
      inputs: "R★ = 1 R☉, M_BH = −1 M☉, M★ = 1 M☉",
      expected: "not rejected — cube root of a negative ratio is a real negative number, giving an unphysical negative radius",
      run: () => tidalDisruptionRadiusM(R_SUN_M, -M_SUN, M_SUN),
      check: (v) => Number.isFinite(v) && v < 0,
    },
    {
      test: "crossoverMassKg with zero star radius",
      inputs: "R★ = 0, M★ = 1 M☉",
      expected: "explicitly guarded — returns NaN rather than a meaningless zero crossover",
      run: () => crossoverMassKg(0, M_SUN),
      check: (v) => Number.isNaN(v),
    },
    {
      test: "crossoverMassKg with negative star mass",
      inputs: "R★ = 1 R☉, M★ = −1 M☉",
      expected: "explicitly guarded — returns NaN rather than a complex or meaningless result",
      run: () => crossoverMassKg(R_SUN_M, -M_SUN),
      check: (v) => Number.isNaN(v),
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
export function getTidalDisruptionTestRows() {
  return [...referenceRows(), ...consistencyRows(), ...edgeCaseRows()];
}
