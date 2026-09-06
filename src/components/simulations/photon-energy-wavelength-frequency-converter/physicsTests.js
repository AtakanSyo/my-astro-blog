// Test cases for the "Tests" popup on the Photon Energy ↔ Wavelength ↔
// Frequency Converter. These run the calculator's real physics.js
// functions against known reference lines/transitions, internal
// scaling/round-trip checks, and edge cases, so this table is a genuine
// live check — not a hardcoded, unverified table — and would visibly
// show failures on this page if the underlying math ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<mathModule>Tests.js" per calculator, computing rows from that
// calculator's own math module — to add the Tests popup to another
// calculator.

import {
  H,
  C,
  ENERGY_UNITS,
  wavelengthToFrequency,
  wavelengthToEnergyJ,
  frequencyToWavelength,
  frequencyToEnergyJ,
  energyJToWavelength,
  energyJToFrequency,
  fromBase,
  classifyBand,
} from "./physics";

export const PHOTON_CONVERTER_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes above the reference figures
// below — rendered at the bottom of the Tests popup by CalculatorTests.
// Keep these two in sync when either changes.
export const PHOTON_CONVERTER_TEST_SOURCES = [
  {
    title: "Caesium-133 ground-state hyperfine transition",
    text: "The frequency, 9,192,631,770 Hz, is exact by definition — it's how the SI second itself is defined. The ~3.26 cm wavelength that follows from c = λf is a commonly cited figure for this microwave transition, not a separately measured number.",
    url: "https://www.bipm.org/en/publications/si-brochure",
    urlLabel: "BIPM SI Brochure",
  },
  {
    title: "21 cm hydrogen line",
    text: "Frequency 1420.405751 MHz is the standard, highly precise figure for this fundamental radio-astronomy transition (neutral hydrogen's spin-flip line), commonly quoted to six or more significant figures.",
    url: "https://www.cv.nrao.edu/course/astr534/HILine.html",
    urlLabel: "NRAO — Essential Radio Astronomy, the HI Line",
  },
  {
    title: "Sodium D2 line",
    text: "Wavelength 589.0 nm and the ~2.105 eV photon energy it implies are the standard, widely tabulated figures for this well-known atomic transition (the D2 line of the sodium doublet).",
    url: "https://physics.nist.gov/PhysRefData/ASD/lines_form.html",
    urlLabel: "NIST Atomic Spectra Database",
  },
  {
    title: "What these rows actually prove",
    text: "The reference rows confirm the exact c = λf and E = hf = hc/λ formulas reproduce the commonly cited scale of these real transitions/lines — not that those cited figures are themselves independently re-derived here. The scaling, round-trip, and edge-case rows below don't depend on any external citation at all — they confirm the conversion functions behave exactly as the algebra predicts on their own terms.",
  },
];

function fmt(n, digits = 6) {
  if (Number.isNaN(n)) return "NaN";
  if (n === Infinity) return "∞";
  if (n === -Infinity) return "−∞";
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-3)) return n.toExponential(4);
  const rounded = Number(n.toFixed(digits));
  return String(rounded);
}

function percentDiff(a, b) {
  if (b === 0) return a === 0 ? 0 : Infinity;
  return Math.abs((a - b) / b) * 100;
}

// Reference values are published/commonly cited to a handful of
// significant figures, so a fraction-of-a-percent round-trip gap is
// expected rounding, not a bug — a real formula error would be off by
// many percent, not hundredths.
function referenceRows() {
  const rows = [];

  // Caesium-133 hyperfine transition — SI-defining frequency, exact.
  const fCs = 9192631770;
  const lambdaCsExpectedCm = 3.2612; // commonly cited figure for this line
  const lambdaCsComputed = frequencyToWavelength(fCs);
  rows.push({
    test: "Caesium-133 hyperfine transition — frequency to wavelength",
    inputs: `f = ${fmt(fCs, 0)} Hz (exact, SI second definition)`,
    expected: `≈ ${fmt(lambdaCsExpectedCm)} cm`,
    computed: `${fmt(lambdaCsComputed * 100)} cm`,
    pass: percentDiff(lambdaCsComputed * 100, lambdaCsExpectedCm) < 0.5,
  });

  // 21 cm hydrogen line.
  const f21 = 1420.405751e6;
  const lambda21ExpectedCm = 21.10611;
  const lambda21Computed = frequencyToWavelength(f21);
  rows.push({
    test: "21 cm hydrogen line — frequency to wavelength",
    inputs: `f = ${fmt(f21)} Hz`,
    expected: `≈ ${fmt(lambda21ExpectedCm)} cm`,
    computed: `${fmt(lambda21Computed * 100)} cm`,
    pass: percentDiff(lambda21Computed * 100, lambda21ExpectedCm) < 0.05,
  });

  // Sodium D2 line.
  const lambdaNa = 589.0e-9;
  const ENaExpectedEv = 2.105;
  const ENaComputed = fromBase(wavelengthToEnergyJ(lambdaNa), ENERGY_UNITS, "eV");
  rows.push({
    test: "Sodium D2 line — wavelength to photon energy",
    inputs: `λ = ${fmt(lambdaNa * 1e9, 1)} nm`,
    expected: `≈ ${fmt(ENaExpectedEv)} eV`,
    computed: `${fmt(ENaComputed)} eV`,
    pass: percentDiff(ENaComputed, ENaExpectedEv) < 0.1,
  });

  return rows;
}

// Internal-consistency checks: these don't depend on any externally cited
// figure, just on the formulas responding to input exactly as the algebra
// (c = λf, E = hf = hc/λ) predicts.
function consistencyRows() {
  const rows = [];

  // frequencyToEnergyJ (E = hf) must agree with the chained
  // frequency -> wavelength -> energy path (E = hc/λ), for the same input.
  const fTest = 5e14; // ~600 nm, visible light
  const eDirect = frequencyToEnergyJ(fTest);
  const eChained = wavelengthToEnergyJ(frequencyToWavelength(fTest));
  rows.push({
    test: "E = hf agrees with E = hc/λ via λ = c/f, same frequency",
    inputs: `f = ${fmt(fTest)} Hz`,
    expected: "both paths give the same energy",
    computed: `direct = ${fmt(eDirect, 4)} J vs. chained = ${fmt(eChained, 4)} J`,
    pass: percentDiff(eDirect, eChained) < 1e-9,
  });

  // Doubling wavelength must halve both frequency and energy (inverse
  // proportionality intrinsic to c = λf and E = hc/λ).
  const lambdaA = 500e-9;
  const lambdaB = 1000e-9;
  const freqRatio = wavelengthToFrequency(lambdaA) / wavelengthToFrequency(lambdaB);
  const energyRatio = wavelengthToEnergyJ(lambdaA) / wavelengthToEnergyJ(lambdaB);
  rows.push({
    test: "Doubling wavelength halves frequency and energy",
    inputs: `λ = ${fmt(lambdaA * 1e9, 0)} nm vs. λ = ${fmt(lambdaB * 1e9, 0)} nm`,
    expected: "frequency ratio = 2.0, energy ratio = 2.0",
    computed: `frequency ratio = ${fmt(freqRatio)}, energy ratio = ${fmt(energyRatio)}`,
    pass: percentDiff(freqRatio, 2) < 1e-9 && percentDiff(energyRatio, 2) < 1e-9,
  });

  // Round trips: wavelength -> frequency -> wavelength, and
  // wavelength -> energy -> wavelength, must recover the original value.
  const lambdaRT = 700e-9;
  const viaFrequency = frequencyToWavelength(wavelengthToFrequency(lambdaRT));
  const viaEnergy = energyJToWavelength(wavelengthToEnergyJ(lambdaRT));
  rows.push({
    test: "Round trip: wavelength → frequency → wavelength, and via energy",
    inputs: `λ = ${fmt(lambdaRT * 1e9, 0)} nm`,
    expected: `≈ ${fmt(lambdaRT * 1e9, 0)} nm recovered both ways`,
    computed: `via f: ${fmt(viaFrequency * 1e9, 4)} nm, via E: ${fmt(viaEnergy * 1e9, 4)} nm`,
    pass: percentDiff(viaFrequency, lambdaRT) < 1e-9 && percentDiff(viaEnergy, lambdaRT) < 1e-9,
  });

  // energyJToFrequency and frequencyToEnergyJ must invert each other too.
  const fRT = 3e14;
  const eBack = energyJToFrequency(frequencyToEnergyJ(fRT));
  rows.push({
    test: "Round trip: frequency → energy → frequency",
    inputs: `f = ${fmt(fRT)} Hz`,
    expected: `≈ ${fmt(fRT)} Hz recovered`,
    computed: `${fmt(eBack)} Hz`,
    pass: percentDiff(eBack, fRT) < 1e-9,
  });

  return rows;
}

// Edge cases: physics.js is pure algebra with no input validation of its
// own (that guard lives in PhotonConverter.jsx's handleChange, which
// requires a finite, positive number before ever calling these
// functions) — so these rows confirm what the functions actually do when
// handed zero or negative input, rather than asserting a rejection
// behavior the module doesn't implement.
function edgeCaseRows() {
  const rows = [];

  const freqAtZero = wavelengthToFrequency(0);
  const energyAtZero = wavelengthToEnergyJ(0);
  rows.push({
    test: "Zero wavelength",
    inputs: "λ = 0 m",
    expected: "not rejected — division by zero gives +Infinity for both frequency and energy",
    computed: `frequency = ${fmt(freqAtZero)}, energy = ${fmt(energyAtZero)}`,
    pass: freqAtZero === Infinity && energyAtZero === Infinity,
  });

  const negLambda = -500e-9;
  const band = classifyBand(negLambda);
  rows.push({
    test: "Negative wavelength misclassified by classifyBand (no sign guard)",
    inputs: `λ = ${fmt(negLambda * 1e9, 0)} nm`,
    expected: 'not rejected — falls through to the first band boundary and is labeled "Gamma ray"',
    computed: `classifyBand ⇒ "${band.name}"`,
    pass: band.name === "Gamma ray",
  });

  return rows;
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getPhotonConverterTestRows() {
  return [...referenceRows(), ...consistencyRows(), ...edgeCaseRows()];
}
