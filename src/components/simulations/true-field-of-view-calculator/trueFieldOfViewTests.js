// Test cases for the "Tests" popup on the True Field of View Calculator.
// These run the calculator's real trueFieldOfView.js functions. See
// angular-size-calculator's angularSizeTests.js for the pattern this
// follows.

import { magnification, tfovSimpleDeg, tfovFieldStopDeg, degToArcmin, RAD_TO_DEG } from "./trueFieldOfView";

export const TRUE_FIELD_OF_VIEW_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

export const TRUE_FIELD_OF_VIEW_TEST_SOURCES = [
  {
    title: "Where the reference numbers come from",
    text: "The Tele Vue Panoptic 24mm's published specs (68° apparent field, 27mm field stop, 24mm focal length) are the manufacturer's own figures, and the roughly 5% gap between its simple-method and field-stop-method true field is a real, commonly-noted example of why the field-stop method is considered the more trustworthy one for wide-angle eyepiece designs. The deep-sky object angular sizes referenced in the overlay are cited in trueFieldOfView.js itself.",
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

function simpleMethodRows() {
  const M = magnification(1000, 25);
  const tfov = tfovSimpleDeg(52, M);
  return [
    {
      test: "Simple method: TFOV = AFOV / M",
      inputs: `F=1000 mm, f=25 mm (M=${fmt(M, 1)}×), AFOV=52°`,
      expected: `${fmt(52 / M, 4)}°`,
      computed: `${fmt(tfov, 4)}°`,
      pass: percentDiff(tfov, 52 / M) < TOLERANCE_PCT,
    },
  ];
}

function fieldStopRows() {
  // Tele Vue Panoptic 24mm, published specs: 68° AFOV, 27mm field stop,
  // 24mm eyepiece focal length. Paired here with a 1200mm scope.
  const F = 1200;
  const f = 24;
  const AFOV = 68;
  const fieldStop = 27;
  const M = magnification(F, f);
  const simple = tfovSimpleDeg(AFOV, M);
  const accurate = tfovFieldStopDeg(fieldStop, F);
  return [
    {
      test: "Field-stop method: TFOV = 57.2958 × field stop / F",
      inputs: `field stop=${fieldStop} mm, F=${F} mm`,
      expected: `${fmt(RAD_TO_DEG * (fieldStop / F), 4)}°`,
      computed: `${fmt(accurate, 4)}°`,
      pass: percentDiff(accurate, RAD_TO_DEG * (fieldStop / F)) < TOLERANCE_PCT,
    },
    {
      test: "Panoptic 24mm: simple and field-stop methods diverge by a few percent",
      inputs: `AFOV=${AFOV}°, field stop=${fieldStop} mm, M=${fmt(M, 1)}×`,
      expected: "simple ≈ 1.36°, field-stop ≈ 1.29°, a genuine few-percent gap",
      computed: `simple=${fmt(simple, 3)}°, field-stop=${fmt(accurate, 3)}° (${fmt(percentDiff(simple, accurate), 1)}% apart)`,
      pass: percentDiff(simple, accurate) > 1 && percentDiff(simple, accurate) < 15,
    },
  ];
}

function unitRow() {
  return [
    {
      test: "degToArcmin converts degrees to arcminutes",
      inputs: "1.5°",
      expected: "90′",
      computed: `${fmt(degToArcmin(1.5), 4)}′`,
      pass: percentDiff(degToArcmin(1.5), 90) < TOLERANCE_PCT,
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
      test: "Negative field stop",
      inputs: "field stop=-10 mm, F=1000 mm",
      expected: "null (a field stop can't be negative)",
      computed: String(tfovFieldStopDeg(-10, 1000)),
      pass: tfovFieldStopDeg(-10, 1000) === null,
    },
    {
      test: "Zero apparent field",
      inputs: "AFOV=0°, M=50",
      expected: "null",
      computed: String(tfovSimpleDeg(0, 50)),
      pass: tfovSimpleDeg(0, 50) === null,
    },
  ];
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getTrueFieldOfViewTestRows() {
  return [...simpleMethodRows(), ...fieldStopRows(), ...unitRow(), ...edgeCaseRows()];
}
