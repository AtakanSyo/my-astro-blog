// Test cases for the "Tests" popup on the Gravitational Wave Chirp Mass
// Calculator. These run the calculator's real chirpMass.js functions
// against well-known reference events and internal-consistency checks,
// so this table is a genuine live check — not a hardcoded, unverified
// table — and would visibly show failures on this page if the
// underlying math ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow the same split used by
// roche-limit-calculator/rocheLimitTests.js — a "<slug>Tests.js" per
// calculator, computing rows from that calculator's own math module.

import {
  SOLAR_MASS_KG,
  chirpMass,
  totalMass,
  massRatio,
  symmetricMassRatio,
  reducedMass,
  iscoFrequency,
  gwFrequency,
  massToKg,
} from "./chirpMass";

export const CHIRP_MASS_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes above the reference events
// below — rendered at the bottom of the Tests popup by CalculatorTests.
// Keep these two in sync when either changes.
export const CHIRP_MASS_TEST_SOURCES = [
  {
    title: "GW150914 — the first direct detection (2015)",
    text: "The commonly cited illustrative pairing of two 30 M☉ black holes reproduces the widely repeated ≈26.1 M☉ chirp-mass figure exactly from the formula. The real reported source-frame component masses were closer to 36 M☉ and 29 M☉ (giving a chirp mass around 28 M☉) — the 30+30 pairing is a simplified, commonly used stand-in for the same event, not the exact reported masses.",
    url: "https://doi.org/10.1103/PhysRevLett.116.061102",
    urlLabel: "Abbott et al. 2016, PRL 116, 061102 (LIGO/Virgo discovery paper)",
  },
  {
    title: "GW170817 — the first neutron star merger (2017)",
    text: "Component masses of 1.46 M☉ and 1.27 M☉ (representative values within the paper's reported low-spin-prior 90% credible intervals) reproduce a chirp mass within about 0.01 M☉ of the paper's own reported 1.188 (+0.004/-0.002) M☉ — one of the most precisely measured chirp masses of any gravitational-wave event to date.",
    url: "https://doi.org/10.1103/PhysRevLett.119.161101",
    urlLabel: "Abbott et al. 2017, PRL 119, 161101 (LIGO/Virgo discovery paper)",
  },
  {
    title: "What these rows actually prove",
    text: "The reference rows confirm chirpMass() reproduces the commonly cited chirp-mass figures for these two real, famous events to the stated tolerance. The scaling and edge-case rows below them confirm every function in chirpMass.js responds to its inputs exactly as the algebra predicts — including at degenerate inputs like zero or negative mass. None of this independently re-derives the masses themselves from raw strain data; it only checks the mass-combination arithmetic downstream of them.",
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

// Each event's component masses are either the commonly cited
// illustrative pairing (GW150914) or representative values within the
// discovery paper's own published credible interval (GW170817) — see
// sources above. "closeTo" rows check the computed chirp mass against
// the cited figure to a stated tolerance.
const REFERENCE_EVENTS = [
  {
    label: "GW150914-like (30 + 30 M☉ black holes)",
    m1: 30,
    m2: 30,
    expectedMc: 26.1,
    tolerancePct: 2,
  },
  {
    label: "GW170817-like (1.46 + 1.27 M☉ neutron stars)",
    m1: 1.46,
    m2: 1.27,
    expectedMc: 1.188,
    tolerancePct: 2,
  },
];

function referenceRows() {
  return REFERENCE_EVENTS.map((ref) => {
    const mc = chirpMass(ref.m1, ref.m2);
    return {
      test: `${ref.label} — chirp mass`,
      inputs: `M1 = ${fmt(ref.m1)} M☉, M2 = ${fmt(ref.m2)} M☉`,
      expected: `≈ ${fmt(ref.expectedMc)} M☉`,
      computed: `${fmt(mc)} M☉`,
      pass: percentDiff(mc, ref.expectedMc) < ref.tolerancePct,
    };
  });
}

// Internal-consistency checks: these don't depend on any externally
// published figure, just on the formulas responding to each input
// exactly as the algebra predicts.
function consistencyRows() {
  const mcSwapped1 = chirpMass(30, 8);
  const mcSwapped2 = chirpMass(8, 30);

  const M = 42;
  const mcEqual = chirpMass(M, M);
  const expectedEqual = M / Math.pow(2, 1 / 5);

  const etaEqual = symmetricMassRatio(30, 30);
  const etaAsymmetric = symmetricMassRatio(5, 50);

  const qAsymmetric = massRatio(50, 5);

  const totalLight = 10 * SOLAR_MASS_KG;
  const totalHeavy = 100 * SOLAR_MASS_KG;
  const fIscoLight = iscoFrequency(totalLight);
  const fIscoHeavy = iscoFrequency(totalHeavy);

  const mcKg = massToKg(chirpMass(30, 30), "msun");
  const fEarly = gwFrequency(1, mcKg);
  const fLate = gwFrequency(0.01, mcKg);

  return [
    {
      test: "Chirp mass is invariant under swapping M1 ↔ M2 (symmetry)",
      inputs: "M1 = 30 M☉, M2 = 8 M☉, computed both orderings",
      expected: "identical",
      computed: `${fmt(mcSwapped1, 8)} vs. ${fmt(mcSwapped2, 8)} M☉`,
      pass: percentDiff(mcSwapped1, mcSwapped2) < 1e-9,
    },
    {
      test: "Equal masses give the maximum chirp-mass fraction of total mass, M_c = M / 2^(1/5)",
      inputs: `M1 = M2 = ${fmt(M)} M☉`,
      expected: `≈ ${fmt(expectedEqual)} M☉ (= ${fmt(M)} / 2^(1/5))`,
      computed: `${fmt(mcEqual)} M☉`,
      pass: percentDiff(mcEqual, expectedEqual) < 1e-9,
    },
    {
      test: "Symmetric mass ratio η peaks at exactly 0.25 for equal masses",
      inputs: "M1 = M2 = 30 M☉",
      expected: "η = 0.25",
      computed: `η = ${fmt(etaEqual)}`,
      pass: percentDiff(etaEqual, 0.25) < 1e-9,
    },
    {
      test: "An asymmetric pair has a smaller η than an equal pair",
      inputs: "M1 = 5 M☉, M2 = 50 M☉ vs. M1 = M2 = 30 M☉",
      expected: "η(asymmetric) < 0.25",
      computed: `η = ${fmt(etaAsymmetric)}`,
      pass: etaAsymmetric < 0.25,
    },
    {
      test: "Mass ratio q = M2/M1 matches the plain division",
      inputs: "M1 = 50 M☉, M2 = 5 M☉",
      expected: "q = 0.1",
      computed: `q = ${fmt(qAsymmetric)}`,
      pass: percentDiff(qAsymmetric, 0.1) < 1e-9,
    },
    {
      test: "ISCO frequency estimate scales as 1/M_total (10× the mass → 1/10 the frequency)",
      inputs: "M_total = 10 M☉ vs. M_total = 100 M☉",
      expected: "ratio ≈ 10.0000",
      computed: `ratio = ${fmt(fIscoLight / fIscoHeavy)}`,
      pass: percentDiff(fIscoLight / fIscoHeavy, 10) < 1e-6,
    },
    {
      test: "GW frequency rises as merger approaches — the actual 'chirp'",
      inputs: "GW150914-like chirp mass, 1 s before merger vs. 10 ms before merger",
      expected: "frequency(10 ms) > frequency(1 s)",
      computed: `${fmt(fEarly)} Hz → ${fmt(fLate)} Hz`,
      pass: fLate > fEarly,
    },
  ];
}

// Edge cases: chirpMass.js is pure algebra with no input validation of
// its own (that guard lives in GravitationalWaveChirpMassCalculator.jsx's
// `result` useMemo, which rejects non-positive inputs before ever
// calling these functions) — so these rows confirm what the functions
// actually do when handed zero, negative, or degenerate inputs, rather
// than asserting a rejection behavior the module doesn't implement.
function edgeCaseRows() {
  const cases = [
    {
      test: "Zero primary mass",
      inputs: "M1 = 0 M☉, M2 = 30 M☉",
      expected: "not rejected — the (M1·M2)^(3/5) term is 0, giving a chirp mass of 0",
      run: () => chirpMass(0, 30),
      check: (v) => v === 0,
    },
    {
      test: "Negative mass",
      inputs: "M1 = −30 M☉, M2 = 30 M☉",
      expected: "not rejected — fractional power of a negative product, giving NaN",
      run: () => chirpMass(-30, 30),
      check: (v) => Number.isNaN(v),
    },
    {
      test: "Zero primary mass sends the mass ratio to Infinity",
      inputs: "M1 = 0 M☉, M2 = 30 M☉",
      expected: "not rejected — division by zero, giving +Infinity",
      run: () => massRatio(0, 30),
      check: (v) => v === Infinity,
    },
    {
      test: "Both masses zero sends η to NaN (0/0)",
      inputs: "M1 = 0 M☉, M2 = 0 M☉",
      expected: "not rejected — 0/0, giving NaN",
      run: () => symmetricMassRatio(0, 0),
      check: (v) => Number.isNaN(v),
    },
    {
      test: "GW frequency diverges exactly at merger (τ = 0)",
      inputs: "GW150914-like chirp mass, τ = 0 s remaining",
      expected: "not rejected — division by zero inside the formula, giving +Infinity",
      run: () => gwFrequency(0, massToKg(26.1, "msun")),
      check: (v) => v === Infinity,
    },
    {
      test: "Zero total mass sends the ISCO frequency estimate to Infinity",
      inputs: "M_total = 0 kg",
      expected: "not rejected — division by zero, giving +Infinity",
      run: () => iscoFrequency(0),
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
export function getChirpMassTestRows() {
  return [...referenceRows(), ...consistencyRows(), ...edgeCaseRows()];
}
