// Test cases for the "Tests" popup on the Blackbody Spectrum Generator.
// These run the calculator's real physics.js functions. See
// angular-size-calculator's angularSizeTests.js for the pattern this
// follows.

import { planckRadiance, wienPeakNm, stefanBoltzmannFlux, rgbToHex, rgbToCss, blackbodyColor } from "./physics";

export const BLACKBODY_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

const R_SUN_M = 696000000; // m, IAU 2015 nominal solar radius
const T_SUN = 5772; // K, IAU nominal solar effective temperature
const L_SUN = 3.828e26; // W, IAU 2015 nominal solar luminosity (exact, by definition)

export const BLACKBODY_TEST_SOURCES = [
  {
    title: "The Sun's effective temperature and radius",
    text: "IAU nominal values (T☉ = 5772 K, R☉ = 696,000 km), used below to cross-check this module's Stefan–Boltzmann output against the independently defined solar luminosity constant (L☉ = 3.828 × 10²⁶ W).",
  },
  {
    title: "Wien's-law cross-check",
    text: "This module computes a temperature's peak wavelength two independent ways: the closed-form Wien's displacement law, and numerically finding where the actual Planck radiance curve peaks. They should agree — a genuine cross-check between two different code paths, not a comparison to external data.",
  },
];

const TOLERANCE_PCT = 0.5;

function percentDiff(a, b) {
  if (b === 0) return a === 0 ? 0 : Infinity;
  return Math.abs((a - b) / b) * 100;
}
function fmt(n, digits = 4) {
  if (!Number.isFinite(n)) return String(n);
  return Number(n.toFixed(digits)).toString();
}

/** Numerically finds the wavelength (nm) that maximizes planckRadiance at tempK, on a coarse grid. */
function numericPeakNm(tempK) {
  let best = 0;
  let bestLambda = 0;
  for (let lam = 50; lam < 5000; lam += 0.5) {
    const r = planckRadiance(lam, tempK);
    if (r > best) {
      best = r;
      bestLambda = lam;
    }
  }
  return bestLambda;
}

function wienCrossCheckRows() {
  return [5772, 3000, 10000].map((T) => {
    const analytic = wienPeakNm(T);
    const numeric = numericPeakNm(T);
    return {
      test: `Wien's law vs. numerically-maximized Planck curve (T = ${T} K)`,
      inputs: `T = ${T} K`,
      expected: `wienPeakNm(${T}) = ${fmt(analytic, 2)} nm`,
      computed: `${numeric} nm (numeric peak, 0.5 nm grid)`,
      pass: percentDiff(numeric, analytic) < TOLERANCE_PCT,
    };
  });
}

function stefanBoltzmannRows() {
  const flux = stefanBoltzmannFlux(T_SUN);
  const L = flux * 4 * Math.PI * R_SUN_M * R_SUN_M;
  return [
    {
      test: "Stefan–Boltzmann luminosity vs. the IAU solar luminosity constant",
      inputs: `T☉ = ${T_SUN} K, R☉ = ${fmt(R_SUN_M)} m`,
      expected: `≈ ${L_SUN.toExponential(3)} W (IAU nominal L☉)`,
      computed: `${L.toExponential(4)} W`,
      pass: percentDiff(L, L_SUN) < TOLERANCE_PCT,
    },
  ];
}

function colorFormatRows() {
  const color = blackbodyColor(6500);
  const hex = rgbToHex(color);
  const css = rgbToCss(color);
  return [
    {
      test: "rgbToHex format",
      inputs: `blackbodyColor(6500) = {r:${color.r}, g:${color.g}, b:${color.b}}`,
      expected: "a 7-character #RRGGBB string",
      computed: hex,
      pass: /^#[0-9A-F]{6}$/.test(hex),
    },
    {
      test: "rgbToCss format",
      inputs: `blackbodyColor(6500) = {r:${color.r}, g:${color.g}, b:${color.b}}`,
      expected: `"rgb(${color.r}, ${color.g}, ${color.b})"`,
      computed: css,
      pass: css === `rgb(${color.r}, ${color.g}, ${color.b})`,
    },
  ];
}

function edgeCaseRows() {
  return [
    {
      test: "Negative wavelength",
      inputs: "planckRadiance(−1, 5000)",
      expected: "0 (guarded explicitly)",
      computed: String(planckRadiance(-1, 5000)),
      pass: planckRadiance(-1, 5000) === 0,
    },
    {
      test: "Negative temperature",
      inputs: "planckRadiance(500, −1)",
      expected: "0 (guarded explicitly)",
      computed: String(planckRadiance(500, -1)),
      pass: planckRadiance(500, -1) === 0,
    },
    {
      test: "Below the Draper point (not yet visibly glowing)",
      inputs: "blackbodyColor(310) — human body temperature",
      expected: "a very dark / near-black color (real but visually negligible emission)",
      computed: rgbToHex(blackbodyColor(310)),
      pass: blackbodyColor(310).r < 10 && blackbodyColor(310).g < 10 && blackbodyColor(310).b < 10,
    },
  ];
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getBlackbodyTestRows() {
  return [...wienCrossCheckRows(), ...stefanBoltzmannRows(), ...colorFormatRows(), ...edgeCaseRows()];
}
