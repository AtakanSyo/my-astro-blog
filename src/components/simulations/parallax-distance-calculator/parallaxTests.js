// Test cases for the "Tests" popup on the Parallax / Distance Calculator.
// These run the calculator's real parallax.js functions against known
// reference stars, unit-conversion definitions, and edge cases, so this
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
  M_PER_AU,
  M_PER_PC,
  M_PER_LY,
  distancePcFromParallaxArcsec,
  parallaxArcsecFromDistancePc,
  parallaxToArcsec,
  arcsecToParallax,
  distanceToMeters,
  metersToDistance,
  parallaxReliability,
} from "./parallax";

export const PARALLAX_DISTANCE_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes used by the checks below —
// rendered at the bottom of the Tests popup by CalculatorTests. Keep
// these two in sync when either changes.
export const PARALLAX_DISTANCE_TEST_SOURCES = [
  {
    title: "The parsec, by definition",
    text: "1 parsec is defined as the distance at which 1 AU subtends exactly 1 arcsecond of parallax — d(pc) = 1/p(″) is exact, not approximate, and 1 pc works out to ≈206,264.8 AU and ≈3.2616 light-years given the exact IAU 2012/2015 AU and light-year definitions this module itself uses (M_PER_AU, M_PER_PC).",
    url: "https://www.iau.org/static/resolutions/IAU2015_English.pdf",
    urlLabel: "IAU 2015 Resolution B2 (parsec definition)",
  },
  {
    title: "Proxima Centauri",
    text: "Parallax ≈768.5 mas, the closest known star to the Sun, with a well-established distance of ≈1.3 pc (≈4.24 ly).",
    url: "https://www.esa.int/Science_Exploration/Space_Science/Gaia",
    urlLabel: "ESA Gaia mission (astrometric parallax measurements)",
  },
  {
    title: "Barnard's Star",
    text: "Parallax ≈546.98 mas — the star with the largest known proper motion, and the second-closest stellar system to the Sun, with a well-established distance of ≈1.83 pc.",
  },
  {
    title: "What these rows actually prove",
    text: "The reference rows confirm the exact d = 1/p formula reproduces each star's well-established distance from its real, published parallax. The conversion and round-trip rows confirm the unit constants and inverse relationship are internally consistent with each other, not independently re-derived. The edge-case rows document parallax.js's actual, unguarded behavior on zero/negative input — validity guarding (e.g. the 'consistent with zero' warning) lives in the calculator component, not in this module.",
  },
];

function fmt(n, digits = 6) {
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

// Real, published parallaxes for well-known nearby stars, checked against
// their commonly cited distances via the calculator's own exact formula.
// Published figures are quoted to a handful of significant figures, so a
// fraction-of-a-percent gap is expected rounding, not a bug.
const TOLERANCE_PCT = 0.5;
const REFERENCE_STARS = [
  { label: "Proxima Centauri", parallaxMas: 768.5, distancePc: 1.301 },
  { label: "Barnard's Star", parallaxMas: 546.98, distancePc: 1.828 },
];

function referenceRows() {
  return REFERENCE_STARS.map((ref) => {
    const pArcsec = parallaxToArcsec(ref.parallaxMas, "mas");
    const dPc = distancePcFromParallaxArcsec(pArcsec);
    return {
      test: `${ref.label} — parallax to distance`,
      inputs: `p = ${fmt(ref.parallaxMas, 2)} mas`,
      expected: `≈ ${fmt(ref.distancePc, 3)} pc`,
      computed: `${fmt(dPc, 3)} pc`,
      pass: percentDiff(dPc, ref.distancePc) < TOLERANCE_PCT,
    };
  });
}

// Definitional / internal-consistency checks: these confirm the exact
// unit constants and the parallax<->distance inverse relationship, not
// any externally cited star data.
function consistencyRows() {
  const pcInAu = M_PER_PC / M_PER_AU;
  const pcInLy = M_PER_PC / M_PER_LY;

  const testDistancePc = 7.25;
  const pArcsec = parallaxArcsecFromDistancePc(testDistancePc);
  const dBack = distancePcFromParallaxArcsec(pArcsec);

  const oneArcsecDistance = distancePcFromParallaxArcsec(1);

  const auMeters = distanceToMeters(1, "au");
  const auBack = metersToDistance(auMeters, "au");

  return [
    {
      test: "1 parsec ⇒ exactly 1 AU per arcsecond of parallax, in AU",
      inputs: "M_PER_PC / M_PER_AU",
      expected: "≈ 206,264.8 AU",
      computed: `${fmt(pcInAu, 1)} AU`,
      pass: percentDiff(pcInAu, 206264.8) < 0.01,
    },
    {
      test: "1 parsec in light-years",
      inputs: "M_PER_PC / M_PER_LY",
      expected: "≈ 3.2616 ly",
      computed: `${fmt(pcInLy, 4)} ly`,
      pass: percentDiff(pcInLy, 3.2616) < 0.01,
    },
    {
      test: "1 arcsecond of parallax is, by definition, exactly 1 parsec away",
      inputs: "p = 1″",
      expected: "d = 1 pc exactly",
      computed: `${fmt(oneArcsecDistance, 6)} pc`,
      pass: oneArcsecDistance === 1,
    },
    {
      test: "distance -> parallax -> distance round-trips",
      inputs: `d = ${fmt(testDistancePc, 2)} pc`,
      expected: `≈ ${fmt(testDistancePc, 2)} pc recovered`,
      computed: `p = ${fmt(pArcsec, 6)}″, back to d = ${fmt(dBack, 6)} pc`,
      pass: percentDiff(dBack, testDistancePc) < 1e-9,
    },
    {
      test: "AU -> meters -> AU round-trips (unit-conversion helpers)",
      inputs: "1 AU",
      expected: "≈ 1 AU recovered",
      computed: `${fmt(auBack, 9)} AU`,
      pass: percentDiff(auBack, 1) < 1e-9,
    },
  ];
}

// Edge cases: parallax.js's distancePcFromParallaxArcsec/
// parallaxArcsecFromDistancePc are plain 1/x inversions with no input
// guarding of their own — rejecting zero/negative parallax (the
// "consistent with zero" warning) is the calculator component's job, not
// this module's. These rows document the pure functions' actual,
// unguarded behavior rather than inventing rejection logic they don't
// have.
function edgeCaseRows() {
  const cases = [
    {
      test: "Zero parallax ⇒ distance diverges",
      inputs: "p = 0″",
      expected: "not rejected — 1/0 diverges, giving +Infinity",
      run: () => distancePcFromParallaxArcsec(0),
      check: (v) => v === Infinity,
    },
    {
      test: "Negative parallax ⇒ negative \"distance\" (no sign guard)",
      inputs: "p = −0.5″",
      expected: "not rejected — 1/(−0.5) = −2, an unphysical negative distance",
      run: () => distancePcFromParallaxArcsec(-0.5),
      check: (v) => v === -2,
    },
    {
      test: "Zero distance ⇒ parallax diverges",
      inputs: "d = 0 pc",
      expected: "not rejected — 1/0 diverges, giving +Infinity",
      run: () => parallaxArcsecFromDistancePc(0),
      check: (v) => v === Infinity,
    },
    {
      test: "reliability at exactly the 10% boundary is already \"caution\", not \"reliable\"",
      inputs: "fractional parallax uncertainty = 0.1",
      expected: `"${parallaxReliability(0.1).label}"`,
      run: () => parallaxReliability(0.1).label,
      check: (v) => v === "Use with caution",
    },
  ];

  return cases.map((c) => {
    const computed = c.run();
    return {
      test: c.test,
      inputs: c.inputs,
      expected: c.expected,
      computed: typeof computed === "string" ? computed : fmt(computed),
      pass: c.check(computed),
    };
  });
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getParallaxDistanceTestRows() {
  return [...referenceRows(), ...consistencyRows(), ...edgeCaseRows()];
}
