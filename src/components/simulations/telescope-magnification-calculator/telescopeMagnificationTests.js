// Test cases for the "Tests" popup on the Telescope Magnification &
// Eyepiece Calculator. These run the calculator's real
// telescopeMagnification.js functions. See angular-size-calculator's
// angularSizeTests.js for the pattern this follows.

import {
  magnification,
  exitPupilMm,
  trueFieldDeg,
  maxUsefulMagnification,
  minUsefulMagnification,
  classifyMagnification,
} from "./telescopeMagnification";

export const TELESCOPE_MAGNIFICATION_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

export const TELESCOPE_MAGNIFICATION_TEST_SOURCES = [
  {
    title: "Where the numbers come from",
    text: "The Celestron AstroMaster 114EQ (114 mm aperture, 1000 mm focal length) is a real, widely-sold beginner Newtonian, and its bundled 4mm eyepiece producing 250× — well past most guides' ~2×-aperture(mm) useful ceiling — is a commonly cited real-world example of empty magnification. The \"max ≈ 2×D(mm)\" and \"min ≈ D(mm)/7\" rules are the standard amateur-astronomy guidance repeated across eyepiece manufacturers' and observing guides, not a strict physical law — see this module's header comment for what each is actually grounded in.",
  },
];

const TOLERANCE_PCT = 0.001;

function percentDiff(a, b) {
  if (b === 0) return a === 0 ? 0 : Infinity;
  return Math.abs((a - b) / b) * 100;
}
function fmt(n, digits = 4) {
  if (!Number.isFinite(n)) return String(n);
  return Number(n.toFixed(digits)).toString();
}

function realScopeRows() {
  // Celestron AstroMaster 114EQ: 114mm aperture, 1000mm focal length.
  const D = 114;
  const F = 1000;
  const M4 = magnification(F, 4);
  const M25 = magnification(F, 25);
  return [
    {
      test: "AstroMaster 114EQ + 4mm eyepiece: magnification",
      inputs: `F=${F} mm, f=4 mm`,
      expected: "250×",
      computed: `${fmt(M4, 1)}×`,
      pass: percentDiff(M4, 250) < TOLERANCE_PCT,
    },
    {
      test: "AstroMaster 114EQ + 4mm eyepiece: classified as empty magnification",
      inputs: `M=${fmt(M4, 1)}×, D=${D} mm (max useful ≈ ${D * 2}×)`,
      expected: "empty",
      computed: classifyMagnification(M4, D)?.level ?? "null",
      pass: classifyMagnification(M4, D)?.level === "empty",
    },
    {
      test: "AstroMaster 114EQ + 25mm eyepiece: exit pupil",
      inputs: `D=${D} mm, M=${fmt(M25, 2)}×`,
      expected: `${fmt(D / M25, 3)} mm`,
      computed: fmt(exitPupilMm(D, M25), 3),
      pass: percentDiff(exitPupilMm(D, M25), D / M25) < TOLERANCE_PCT,
    },
    {
      test: "AstroMaster 114EQ + 25mm eyepiece: classified as good",
      inputs: `M=${fmt(M25, 2)}×, D=${D} mm`,
      expected: "good",
      computed: classifyMagnification(M25, D)?.level ?? "null",
      pass: classifyMagnification(M25, D)?.level === "good",
    },
  ];
}

function limitRows() {
  return [
    {
      test: "Max useful magnification ≈ 2× aperture(mm)",
      inputs: "D=200 mm",
      expected: "400×",
      computed: `${fmt(maxUsefulMagnification(200), 1)}×`,
      pass: percentDiff(maxUsefulMagnification(200), 400) < TOLERANCE_PCT,
    },
    {
      test: "Min useful magnification ≈ aperture(mm) / 7 (7mm exit pupil)",
      inputs: "D=140 mm",
      expected: "20×",
      computed: `${fmt(minUsefulMagnification(140), 1)}×`,
      pass: percentDiff(minUsefulMagnification(140), 20) < TOLERANCE_PCT,
    },
    {
      test: "Exit pupil at the min-useful boundary is exactly 7mm",
      inputs: "D=140 mm, M=minUsefulMagnification(140)",
      expected: "7 mm",
      computed: fmt(exitPupilMm(140, minUsefulMagnification(140)), 3),
      pass: percentDiff(exitPupilMm(140, minUsefulMagnification(140)), 7) < TOLERANCE_PCT,
    },
    {
      test: "Wide-exit-pupil case: 80mm f/5 refractor + 40mm eyepiece",
      inputs: "F=400 mm, f=40 mm, D=80 mm",
      expected: "M=10×, exit pupil=8mm, classified wide-pupil",
      computed: `M=${fmt(magnification(400, 40), 1)}×, pupil=${fmt(exitPupilMm(80, magnification(400, 40)), 2)}mm, ${classifyMagnification(magnification(400, 40), 80)?.level}`,
      pass: classifyMagnification(magnification(400, 40), 80)?.level === "wide-pupil",
    },
  ];
}

function trueFieldRow() {
  const M = magnification(1000, 25);
  return [
    {
      test: "True field = apparent field / magnification",
      inputs: `AFOV=52°, F=1000 mm, f=25 mm (M=${fmt(M, 1)}×)`,
      expected: `${fmt(52 / M, 3)}°`,
      computed: fmt(trueFieldDeg(52, M), 3),
      pass: percentDiff(trueFieldDeg(52, M), 52 / M) < TOLERANCE_PCT,
    },
  ];
}

function edgeCaseRows() {
  return [
    {
      test: "Zero eyepiece focal length",
      inputs: "F=1000 mm, f=0",
      expected: "null (undefined magnification)",
      computed: String(magnification(1000, 0)),
      pass: magnification(1000, 0) === null,
    },
    {
      test: "Negative aperture",
      inputs: "D=-100 mm, M=50",
      expected: "null (an aperture can't be negative)",
      computed: String(exitPupilMm(-100, 50)),
      pass: exitPupilMm(-100, 50) === null,
    },
    {
      test: "classifyMagnification with invalid aperture",
      inputs: "M=50, D=0",
      expected: "null",
      computed: String(classifyMagnification(50, 0)),
      pass: classifyMagnification(50, 0) === null,
    },
  ];
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getTelescopeMagnificationTestRows() {
  return [...realScopeRows(), ...limitRows(), ...trueFieldRow(), ...edgeCaseRows()];
}
