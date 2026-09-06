// Test cases for the "Tests" popup on the Hawking Temperature Calculator.
// These run the calculator's real hawkingTemperature.js functions against
// known reference figures and internal-consistency checks, so this table
// is a genuine live check — not a hardcoded, unverified table — and would
// visibly show failures on this page if the underlying math ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<slug>Tests.js" per calculator, computing rows from that calculator's
// own math module — to add the Tests popup to another calculator.

import {
  massToKg,
  massFromKg,
  hawkingTemperature,
  massAtHawkingTemperature,
  CMB_TEMPERATURE_K,
} from "./hawkingTemperature";

export const HAWKING_TEMPERATURE_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes referenced below — rendered at
// the bottom of the Tests popup by CalculatorTests. Keep these two in
// sync when either changes.
export const HAWKING_TEMPERATURE_TEST_SOURCES = [
  {
    title: "1 solar-mass Schwarzschild black hole",
    text: "T_H = ħc³/(8π G M k_B) evaluated at M = 1 M☉ gives a commonly cited Hawking temperature of ≈6.17×10⁻⁸ K — a standard textbook/review figure following from Hawking's 1974/1975 result.",
    url: "https://en.wikipedia.org/wiki/Hawking_radiation",
    urlLabel: "Wikipedia — Hawking radiation",
  },
  {
    title: "Cosmic Microwave Background temperature",
    text: "2.725 K, the present-day CMB temperature used as this calculator's own cold/hot dividing line.",
    url: "https://en.wikipedia.org/wiki/Cosmic_microwave_background",
    urlLabel: "Wikipedia — Cosmic microwave background",
  },
  {
    title: "Sgr A* and the hypothetical asteroid-mass black hole",
    text: "Sgr A* (~4.3×10⁶ M☉) and a ~1×10¹² kg hypothetical black hole are the same reference masses used elsewhere on this page — included here to confirm each lands on the correct side of the CMB line, not as independently sourced temperature figures.",
  },
  {
    title: "What these rows actually prove",
    text: "The reference row confirms the exact formula reproduces the commonly cited Hawking temperature for a solar-mass black hole to a fraction of a percent. The other rows confirm the formula's inverse, its 1/M scaling, and its handling of invalid masses are all internally consistent. None of this proves Hawking radiation itself — a theoretical prediction, never directly observed — is correct; it only proves this calculator computes the standard formula correctly.",
  },
];

// Reference value is published to a handful of significant figures, so a
// fraction-of-a-percent round-trip gap is expected rounding, not a bug —
// a real formula error would be off by many percent, not hundredths.
const TOLERANCE_PCT = 0.5;

function fmt(n, digits = 4) {
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

// Source: commonly cited figure for a 1 solar-mass Schwarzschild black
// hole's Hawking temperature (see HAWKING_TEMPERATURE_TEST_SOURCES above).
function validationRows() {
  const oneSolarMassKg = massToKg(1, "msun");
  const expectedK = 6.17e-8;
  const computedK = hawkingTemperature(oneSolarMassKg);

  return [
    {
      test: "1 M☉ Schwarzschild black hole — Hawking temperature",
      inputs: "M = 1 M☉",
      expected: `≈ ${fmt(expectedK)} K`,
      computed: `${fmt(computedK)} K`,
      pass: percentDiff(computedK, expectedK) < TOLERANCE_PCT,
    },
  ];
}

// Ties to this calculator's own cold/hot-vs-CMB framing: confirms a
// supermassive black hole reads as colder than the CMB and a tiny
// hypothetical one reads as hotter, matching the badges the calculator
// itself shows for these same reference masses.
function cmbComparisonRows() {
  const sgrAMassKg = massToKg(4.3e6, "msun");
  const sgrATempK = hawkingTemperature(sgrAMassKg);

  const smallMassKg = 1e12;
  const smallTempK = hawkingTemperature(smallMassKg);

  return [
    {
      test: "Sgr A* (~4.3×10⁶ M☉) — colder than the CMB",
      inputs: "M = 4.3×10⁶ M☉",
      expected: `< ${CMB_TEMPERATURE_K} K`,
      computed: `${fmt(sgrATempK)} K`,
      pass: Number.isFinite(sgrATempK) && sgrATempK < CMB_TEMPERATURE_K,
    },
    {
      test: "Hypothetical 1×10¹² kg black hole — hotter than the CMB",
      inputs: "M = 1×10¹² kg",
      expected: `> ${CMB_TEMPERATURE_K} K`,
      computed: `${fmt(smallTempK)} K`,
      pass: Number.isFinite(smallTempK) && smallTempK > CMB_TEMPERATURE_K,
    },
  ];
}

// Internal-consistency checks: these don't depend on any externally
// published figure, just on the formula and its inverse agreeing with
// each other and responding to mass in the physically correct direction —
// the same properties asserted in this component's own unit tests
// (hawkingTemperature.test.js), reproduced here as live, user-visible rows.
function consistencyRows() {
  const originalMassKg = massToKg(10, "msun");
  const tempK = hawkingTemperature(originalMassKg);
  const recoveredMassKg = massAtHawkingTemperature(tempK);

  const baseMassKg = massToKg(1, "msun");
  const halfMassKg = baseMassKg / 2;
  const baseTempK = hawkingTemperature(baseMassKg);
  const halfMassTempK = hawkingTemperature(halfMassKg);
  const scalingRatio = halfMassTempK / baseTempK;

  return [
    {
      test: "Inverse function round-trips mass → temperature → mass",
      inputs: "M = 10 M☉",
      expected: `≈ ${fmt(massFromKg(originalMassKg, "msun"), 6)} M☉`,
      computed: `${fmt(massFromKg(recoveredMassKg, "msun"), 6)} M☉`,
      pass: percentDiff(recoveredMassKg, originalMassKg) < 1e-6,
    },
    {
      test: "Halving mass doubles temperature (T ∝ 1/M)",
      inputs: "M = 1 M☉ vs. M = 0.5 M☉",
      expected: "ratio ≈ 2.0000",
      computed: `ratio = ${fmt(scalingRatio)}`,
      pass: percentDiff(scalingRatio, 2) < 1e-6,
    },
  ];
}

// Edge cases: confirms the calculator's own real behavior for invalid
// masses/temperatures (both functions guard with `!(x > 0)` and return
// NaN) rather than asserting behavior the module doesn't actually have.
function edgeCaseRows() {
  const cases = [
    { test: "Zero mass", inputs: "M = 0 kg", run: () => hawkingTemperature(0) },
    { test: "Negative mass", inputs: "M = −5 kg", run: () => hawkingTemperature(-5) },
    { test: "Zero temperature (inverse)", inputs: "T = 0 K", run: () => massAtHawkingTemperature(0) },
    { test: "Negative temperature (inverse)", inputs: "T = −1 K", run: () => massAtHawkingTemperature(-1) },
  ];

  return cases.map((c) => {
    const out = c.run();
    return {
      test: c.test,
      inputs: c.inputs,
      expected: "NaN",
      computed: Number.isNaN(out) ? "NaN" : fmt(out),
      pass: Number.isNaN(out),
    };
  });
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getHawkingTemperatureTestRows() {
  return [...validationRows(), ...cmbComparisonRows(), ...consistencyRows(), ...edgeCaseRows()];
}
