// Test cases for the "Tests" popup on the Telescope Angular Resolution
// Calculator. These run the calculator's real angularResolution.js
// functions against known reference figures and internal-consistency
// checks, so this table is a genuine live check — not a hardcoded,
// unverified table — and would visibly show failures on this page if the
// underlying math ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<slug>Tests.js" per calculator, computing rows from that calculator's
// own math module — to add the Tests popup to another calculator.

import {
  apertureToMeters,
  wavelengthToMeters,
  radiansToAngle,
  angleToRadians,
  rayleighLimitRad,
  dawesLimitRad,
} from "./angularResolution";

export const ANGULAR_RESOLUTION_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes above the reference cases
// below — rendered at the bottom of the Tests popup by CalculatorTests.
// Keep these two in sync when either changes.
export const ANGULAR_RESOLUTION_TEST_SOURCES = [
  {
    title: "Hubble Space Telescope diffraction limit",
    text: "Widely quoted as roughly 0.05 arcsec in visible light (HubbleSite's own explainer material). Reproduced here using Hubble's real 2.4 m aperture and a round 500 nm visible wavelength — a commonly used reference figure for this kind of order-of-magnitude statement, not a single precise citation tied to one exact wavelength.",
    url: "https://hubblesite.org/mission-and-telescope/hubble-101/hubble-facts",
    urlLabel: "HubbleSite — Hubble Facts",
  },
  {
    title: "Dawes limit rule of thumb (4-inch aperture)",
    text: "William Dawes' 19th-century empirical formula for resolving double stars in visible light, 4.56″ / D(inches), is widely reproduced in amateur-astronomy references. A 4-inch (101.6 mm) telescope's commonly cited Dawes limit is 4.56 / 4 = 1.14 arcsec.",
  },
  {
    title: "100 mm aperture at 550 nm",
    text: "θ ≈ 1.38 arcsec is the same worked example this calculator's own explainer text opens with — a direct application of the Rayleigh formula rather than an independently sourced citation.",
  },
  {
    title: "What these rows actually prove",
    text: "The reference rows confirm the exact Rayleigh and Dawes formulas reproduce commonly cited resolution figures for the aperture/wavelength combinations listed, to the stated tolerance — not that those combinations are independently, precisely verified beyond the round figures noted above. The scaling and edge-case rows below don't depend on any external citation at all — they confirm the formulas respond to aperture, wavelength, and degenerate inputs exactly as the algebra predicts.",
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

// Reference figures are rounded, commonly cited numbers (see source notes
// above), so a several-percent round-trip gap is expected rounding, not a
// bug — a real formula error would be off by many tens of percent, not a
// few.
const REFERENCE_CASES = [
  {
    label: "Hubble Space Telescope — Rayleigh limit",
    D: 2.4,
    DUnit: "m",
    wavelength: 500,
    wavelengthUnit: "nm",
    expectedArcsec: 0.05,
    tolerancePct: 12,
  },
  {
    label: "4-inch amateur scope — Dawes limit",
    D: 101.6,
    DUnit: "mm",
    dawes: true,
    expectedArcsec: 1.14,
    tolerancePct: 1,
  },
  {
    label: "100 mm scope at 550 nm — Rayleigh limit",
    D: 100,
    DUnit: "mm",
    wavelength: 550,
    wavelengthUnit: "nm",
    expectedArcsec: 1.38,
    tolerancePct: 1,
  },
];

function referenceRows() {
  return REFERENCE_CASES.map((ref) => {
    const DM = apertureToMeters(ref.D, ref.DUnit);

    if (ref.dawes) {
      const rad = dawesLimitRad(DM);
      const arcsec = radiansToAngle(rad, "arcsec");
      return {
        test: `${ref.label}`,
        inputs: `D = ${fmt(ref.D)} ${ref.DUnit}`,
        expected: `≈ ${fmt(ref.expectedArcsec)}″`,
        computed: `${fmt(arcsec)}″`,
        pass: percentDiff(arcsec, ref.expectedArcsec) < ref.tolerancePct,
      };
    }

    const wM = wavelengthToMeters(ref.wavelength, ref.wavelengthUnit);
    const rad = rayleighLimitRad(DM, wM);
    const arcsec = radiansToAngle(rad, "arcsec");
    return {
      test: `${ref.label}`,
      inputs: `D = ${fmt(ref.D)} ${ref.DUnit}, λ = ${fmt(ref.wavelength)} ${ref.wavelengthUnit}`,
      expected: `≈ ${fmt(ref.expectedArcsec)}″`,
      computed: `${fmt(arcsec)}″`,
      pass: percentDiff(arcsec, ref.expectedArcsec) < ref.tolerancePct,
    };
  });
}

// Internal-consistency checks: these don't depend on any externally
// published figure, just on the formulas responding to each input exactly
// as the algebra predicts.
function consistencyRows() {
  const wMFixed = wavelengthToMeters(550, "nm");
  const D1 = apertureToMeters(100, "mm");
  const D2 = apertureToMeters(200, "mm"); // double aperture
  const theta1 = rayleighLimitRad(D1, wMFixed);
  const theta2 = rayleighLimitRad(D2, wMFixed);

  const DFixed = apertureToMeters(150, "mm");
  const w1 = wavelengthToMeters(500, "nm");
  const w2 = wavelengthToMeters(1000, "nm"); // double wavelength
  const thetaW1 = rayleighLimitRad(DFixed, w1);
  const thetaW2 = rayleighLimitRad(DFixed, w2);

  const rayleigh100mm = rayleighLimitRad(D1, wMFixed);
  const dawes100mm = dawesLimitRad(D1);

  const roundTripArcsec = 42.7;
  const roundTripRad = angleToRadians(roundTripArcsec, "arcsec");
  const roundTripBack = radiansToAngle(roundTripRad, "arcsec");

  return [
    {
      test: "Rayleigh limit is inversely proportional to aperture",
      inputs: "D = 100 mm vs. D = 200 mm, λ = 550 nm fixed",
      expected: "ratio ≈ 0.5000",
      computed: `ratio = ${fmt(theta2 / theta1)}`,
      pass: percentDiff(theta2 / theta1, 0.5) < 1e-6,
    },
    {
      test: "Rayleigh limit is directly proportional to wavelength",
      inputs: "λ = 500 nm vs. λ = 1000 nm, D = 150 mm fixed",
      expected: "ratio ≈ 2.0000",
      computed: `ratio = ${fmt(thetaW2 / thetaW1)}`,
      pass: percentDiff(thetaW2 / thetaW1, 2) < 1e-6,
    },
    {
      test: "Dawes limit is smaller (more optimistic) than Rayleigh limit, same aperture and visible wavelength",
      inputs: "D = 100 mm, λ = 550 nm",
      expected: "Dawes < Rayleigh",
      computed: `Dawes = ${fmt(radiansToAngle(dawes100mm, "arcsec"))}″, Rayleigh = ${fmt(radiansToAngle(rayleigh100mm, "arcsec"))}″`,
      pass: dawes100mm < rayleigh100mm,
    },
    {
      test: "Angle unit round trip (arcsec → rad → arcsec)",
      inputs: `θ = ${fmt(roundTripArcsec)}″`,
      expected: `≈ ${fmt(roundTripArcsec)}″ recovered`,
      computed: `${fmt(roundTripBack)}″`,
      pass: percentDiff(roundTripBack, roundTripArcsec) < 1e-6,
    },
  ];
}

// Edge cases: angularResolution.js is pure algebra with no input
// validation of its own (that guard lives in
// TelescopeAngularResolutionCalculator.jsx's `result` useMemo, which
// requires a positive aperture and wavelength before ever calling these
// functions) — so these rows confirm what rayleighLimitRad/dawesLimitRad
// actually do when handed zero or negative inputs, rather than asserting
// a rejection behavior the module doesn't implement.
function edgeCaseRows() {
  const wM = wavelengthToMeters(550, "nm");
  const cases = [
    {
      test: "Zero aperture (Rayleigh)",
      inputs: "D = 0 m, λ = 550 nm",
      expected: "not rejected — division by zero gives +Infinity",
      run: () => rayleighLimitRad(0, wM),
      check: (v) => v === Infinity,
    },
    {
      test: "Negative aperture (Rayleigh)",
      inputs: "D = −0.1 m, λ = 550 nm",
      expected: "not rejected — gives an unphysical negative angle",
      run: () => rayleighLimitRad(-0.1, wM),
      check: (v) => Number.isFinite(v) && v < 0,
    },
    {
      test: "Zero wavelength (Rayleigh)",
      inputs: "D = 0.1 m, λ = 0 m",
      expected: "not rejected — gives an angle of exactly 0",
      run: () => rayleighLimitRad(0.1, 0),
      check: (v) => v === 0,
    },
    {
      test: "Zero aperture (Dawes)",
      inputs: "D = 0 m",
      expected: "not rejected — division by zero gives +Infinity",
      run: () => dawesLimitRad(0),
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
export function getAngularResolutionTestRows() {
  return [...referenceRows(), ...consistencyRows(), ...edgeCaseRows()];
}
