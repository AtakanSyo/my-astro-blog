// Test cases for the "Tests" popup on the Exoplanet Transit Probability
// Calculator. These run the calculator's real transitProbability.js
// functions against known reference systems and edge cases, so this
// table is a genuine live check — not a hardcoded, unverified table —
// and would visibly show failures on this page if the underlying math
// ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<slug>Tests.js" per calculator, computing rows from that calculator's
// own math module — to add the Tests popup to another calculator.

import {
  transitProbability,
  starRadiusToMeters,
  planetRadiusToMeters,
  distanceToMeters,
} from "./transitProbability";

export const TRANSIT_PROBABILITY_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes above the reference systems
// below — rendered at the bottom of the Tests popup by CalculatorTests.
// Keep these two in sync when either changes.
export const TRANSIT_PROBABILITY_TEST_SOURCES = [
  {
    title: "Earth around the Sun",
    text: "IAU 2015 nominal solar radius (696,000 km) and 1 AU (exact, by definition) give P ≈ R☉/a ≈ 0.465% — the commonly cited “roughly 1-in-215” figure for Earth's own geometric transit probability quoted in exoplanet-transit literature (e.g. Winn 2010, “Transits and Occultations”).",
  },
  {
    title: "TRAPPIST-1 + TRAPPIST-1e",
    text: "Real system: stellar radius ≈0.121 R☉ and TRAPPIST-1e's semi-major axis ≈0.02925 AU, from Gillon et al. 2017, Nature 542, 456–460 (the same figures this calculator's own preset uses). Checked here only as a relational claim — a small, close-in system's probability is several times Earth's — not a precise cited percentage.",
  },
  {
    title: "HD 80606 b",
    text: "A real, well-known hot Jupiter with semi-major axis ≈0.455 AU and eccentricity ≈0.93 (Naef et al. 2001; the same values this calculator's own preset uses) — a textbook example of a highly eccentric transiting planet. The argument of periapsis used here (ω = 90°, “favorable”) is illustrative, chosen only to demonstrate the boost a favorable orientation gives, not the planet's precisely measured ω.",
  },
  {
    title: "What these rows actually prove",
    text: "The reference rows confirm the exact formula reproduces the commonly cited scale (or the correct relational direction) for these real systems' transit probabilities. The scaling and edge-case rows below don't depend on any external citation at all — they confirm the formula responds to distance, radius, eccentricity, and degenerate inputs exactly as the algebra predicts. None of this independently verifies the radii or orbital elements typed in above.",
  },
];

// Published figures are quoted to a handful of significant figures, so a
// fraction-of-a-percent round-trip gap is expected rounding, not a bug —
// a real formula error would be off by many percent, not hundredths.
const TOLERANCE_PCT = 0.5;

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

function referenceRows() {
  const rows = [];

  // Earth around the Sun — circular orbit, planet radius negligible next
  // to the star, matching the site's own explainer text (~0.47%).
  {
    const rStarM = starRadiusToMeters(1, "rsun");
    const aM = distanceToMeters(1, "au");
    const P = transitProbability(rStarM, 0, aM);
    const expectedPct = 0.465;
    rows.push({
      test: "Earth around the Sun — geometric transit probability",
      inputs: "R★ = 1 R☉, Rp ≈ 0 (negligible), a = 1 AU",
      expected: `≈ ${fmt(expectedPct)}%`,
      computed: `${fmt(P * 100)}%`,
      pass: percentDiff(P * 100, expectedPct) < TOLERANCE_PCT,
    });
  }

  // TRAPPIST-1e — real, small, close-in system: relational check only
  // (several times Earth's own probability), not a precise cited percent.
  {
    const rStarEarthSunM = starRadiusToMeters(1, "rsun");
    const aEarthSunM = distanceToMeters(1, "au");
    const pEarthSun = transitProbability(rStarEarthSunM, 0, aEarthSunM);

    const rStarM = starRadiusToMeters(0.121, "rsun");
    const aM = distanceToMeters(0.02925, "au");
    const P = transitProbability(rStarM, 0, aM);
    rows.push({
      test: "TRAPPIST-1e — small star + close orbit raise probability well above Earth's",
      inputs: "R★ = 0.121 R☉, Rp ≈ 0 (negligible), a = 0.02925 AU",
      expected: "> 3× Earth–Sun probability",
      computed: `${fmt(P * 100)}% (Earth–Sun: ${fmt(pEarthSun * 100)}%, ratio ${fmt(P / pEarthSun)}×)`,
      pass: P > 3 * pEarthSun,
    });
  }

  // HD 80606 b — real semi-major axis and eccentricity; the eccentric,
  // favorably-oriented estimate should exceed the circular-orbit estimate
  // for the same bodies (relational check, avoids citing a precise ω).
  {
    const rStarM = starRadiusToMeters(1, "rsun");
    const rPlanetM = planetRadiusToMeters(1, "rjup");
    const aM = distanceToMeters(0.455, "au");
    const e = 0.93;
    const omega = Math.PI / 2;
    const Pecc = transitProbability(rStarM, rPlanetM, aM, e, omega);
    const Pcirc = transitProbability(rStarM, rPlanetM, aM);
    rows.push({
      test: "HD 80606 b — eccentric, favorable orbit boosts probability above the circular estimate",
      inputs: "R★ = 1 R☉, Rp = 1 R♃, a = 0.455 AU, e = 0.93, ω = 90°",
      expected: "> circular-orbit estimate",
      computed: `${fmt(Pecc * 100)}% vs. circular ${fmt(Pcirc * 100)}%`,
      pass: Pecc > Pcirc,
    });
  }

  return rows;
}

// Internal-consistency checks: these don't depend on any externally
// published figure, just on the formula responding to each input exactly
// as the algebra predicts.
function consistencyRows() {
  const rStarM = starRadiusToMeters(1, "rsun");

  const aNearM = distanceToMeters(1, "au");
  const aFarM = distanceToMeters(2, "au");
  const pNear = transitProbability(rStarM, 0, aNearM);
  const pFar = transitProbability(rStarM, 0, aFarM);

  const rPlanetM = planetRadiusToMeters(0.1, "rjup");
  const withoutPlanet = transitProbability(rStarM, 0, aNearM);
  const withPlanet = transitProbability(rStarM, rPlanetM, aNearM);

  const eZeroCircular = transitProbability(rStarM, 0, aNearM);
  const eZeroEccentric = transitProbability(rStarM, 0, aNearM, 0, 1.2);

  const e = 0.5;
  const periapsis = transitProbability(rStarM, 0, aNearM, e, Math.PI / 2);
  const apoapsis = transitProbability(rStarM, 0, aNearM, e, -Math.PI / 2);

  return [
    {
      test: "Probability scales as 1/a (circular orbit)",
      inputs: "R★ = 1 R☉, a = 1 AU vs. a = 2 AU",
      expected: "ratio ≈ 2.0000",
      computed: `ratio = ${fmt(pNear / pFar)}`,
      pass: percentDiff(pNear / pFar, 2) < 1e-6,
    },
    {
      test: "Including the planet's own radius raises the probability",
      inputs: "R★ = 1 R☉, a = 1 AU, Rp = 0 vs. Rp = 0.1 R♃",
      expected: "with-planet > without-planet",
      computed: `${fmt(withoutPlanet * 100)}% → ${fmt(withPlanet * 100)}%`,
      pass: withPlanet > withoutPlanet,
    },
    {
      test: "Eccentricity factor reduces to the circular-orbit formula at e = 0",
      inputs: "R★ = 1 R☉, a = 1 AU, e = 0, ω = 1.2 rad (should have no effect)",
      expected: `≈ ${fmt(eZeroCircular * 100)}%`,
      computed: `${fmt(eZeroEccentric * 100)}%`,
      pass: percentDiff(eZeroEccentric, eZeroCircular) < 1e-9,
    },
    {
      test: "A transit near periapsis is more likely than near apoapsis, same e",
      inputs: "R★ = 1 R☉, a = 1 AU, e = 0.5, ω = +90° vs. ω = −90°",
      expected: "periapsis > apoapsis",
      computed: `${fmt(periapsis * 100)}% vs. ${fmt(apoapsis * 100)}%`,
      pass: periapsis > apoapsis,
    },
  ];
}

// Edge cases: transitProbability() is pure algebra with no input
// validation of its own (that guard lives in
// ExoplanetTransitProbabilityCalculator.jsx's `result` useMemo, which
// requires positive radii/distance and 0 ≤ e < 1 before ever calling this
// function) — so these rows confirm what the real function actually does
// when handed zero, negative, or boundary inputs, rather than inventing a
// rejection behavior it doesn't have.
function edgeCaseRows() {
  const rStarM = starRadiusToMeters(1, "rsun");

  const cases = [
    {
      test: "Zero orbital distance",
      inputs: "R★ = 1 R☉, Rp = 0, a = 0 m",
      expected: "not rejected — division by zero gives +Infinity",
      run: () => transitProbability(rStarM, 0, 0),
      check: (v) => v === Infinity,
    },
    {
      test: "Negative orbital distance",
      inputs: "R★ = 1 R☉, Rp = 0, a = −1 AU",
      expected: "not rejected — gives a negative, unphysical probability",
      run: () => transitProbability(rStarM, 0, -distanceToMeters(1, "au")),
      check: (v) => Number.isFinite(v) && v < 0,
    },
    {
      test: "Eccentricity at exactly 1 (parabolic boundary)",
      inputs: "R★ = 1 R☉, a = 1 AU, e = 1, ω = 0",
      expected: "not rejected — (1 − e²) = 0 denominator gives +Infinity",
      run: () => transitProbability(rStarM, 0, distanceToMeters(1, "au"), 1, 0),
      check: (v) => v === Infinity,
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
export function getTransitProbabilityTestRows() {
  return [...referenceRows(), ...consistencyRows(), ...edgeCaseRows()];
}
