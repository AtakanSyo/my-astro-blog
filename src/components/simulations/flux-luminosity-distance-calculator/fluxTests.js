// Test cases for the "Tests" popup on the Flux, Luminosity & Distance
// Calculator. These run the calculator's real flux.js functions against
// known reference figures, unit-conversion identities, and edge cases,
// so this table is a genuine live check — not a hardcoded, unverified
// table — and would visibly show failures on this page if the underlying
// math ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<slug>Tests.js" per calculator, computing rows from that calculator's
// own math module — to add the Tests popup to another calculator.

import {
  L_SUN,
  fluxFromLuminosityDistance,
  luminosityFromFluxDistance,
  distanceFromFluxLuminosity,
  distanceToMeters,
  fluxToSI,
  fluxFromSI,
  relErrorFlux,
  relErrorLuminosity,
  relErrorDistance,
} from "./flux";

export const FLUX_LUMINOSITY_DISTANCE_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes above the reference figures
// below — rendered at the bottom of the Tests popup by CalculatorTests.
// Keep these two in sync when either changes.
export const FLUX_LUMINOSITY_DISTANCE_TEST_SOURCES = [
  {
    title: "The solar constant",
    text: "The Sun's IAU 2015 nominal luminosity (3.828 × 10²⁶ W) at 1 AU (exact, by definition) reproduces the solar constant — Earth's real, measured top-of-atmosphere solar irradiance, widely cited as ≈1361 W/m² (satellite total-solar-irradiance measurements typically report ≈1360–1362 W/m²).",
  },
  {
    title: "cgs ↔ SI flux unit conversion",
    text: "1 W = 10⁷ erg/s and 1 m² = 10⁴ cm², so 1 W m⁻² = 10³ erg s⁻¹ cm⁻² exactly — a definitional unit identity, not an empirical citation.",
  },
  {
    title: "Type Ia supernova (standard candle), illustrative",
    text: "Peak luminosity of order 10³⁶ W (~10⁴³ erg/s) is the right order of magnitude commonly cited for a Type Ia supernova at peak brightness (absolute magnitude M_B ≈ −19.3). The specific flux value used below is chosen only to land near this calculator's own preset — the resulting distance is an illustrative demonstration of the standard-candle method, not an independently verified real supernova's measured distance.",
  },
  {
    title: "What these rows actually prove",
    text: "The solar-constant and unit-conversion rows confirm the exact formula reproduces real, independently measured/defined figures. The supernova row and the round-trip, scaling, and error-propagation rows below it confirm the formula and its uncertainty propagation respond to luminosity, distance, and degenerate inputs exactly as the algebra predicts — not that any distance typed into the calculator is itself independently verified.",
  },
];

// Published/measured figures are quoted to a handful of significant
// figures, so a fraction-of-a-percent round-trip gap is expected
// rounding, not a bug — a real formula error would be off by many
// percent, not hundredths.
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

  // The solar constant — real IAU nominal solar luminosity at 1 AU.
  {
    const d = distanceToMeters(1, "au");
    const F = fluxFromLuminosityDistance(L_SUN, d);
    const expected = 1361;
    rows.push({
      test: "Solar constant at Earth's distance",
      inputs: `L = L☉ = ${fmt(L_SUN)} W, d = 1 AU`,
      expected: `≈ ${fmt(expected)} W/m²`,
      computed: `${fmt(F)} W/m²`,
      pass: percentDiff(F, expected) < TOLERANCE_PCT,
    });
  }

  // cgs/SI flux unit conversion identity.
  {
    const si = 1361;
    const cgs = fluxFromSI(si, "cgs");
    const expected = si * 1e3;
    rows.push({
      test: "cgs/SI flux unit conversion matches the exact 10³ identity",
      inputs: `${fmt(si)} W/m² → erg s⁻¹ cm⁻²`,
      expected: `= ${fmt(expected)} erg s⁻¹ cm⁻²`,
      computed: `${fmt(cgs)} erg s⁻¹ cm⁻²`,
      pass: percentDiff(cgs, expected) < 1e-6,
    });
  }

  // Type Ia supernova standard candle — illustrative order-of-magnitude
  // luminosity, matching this calculator's own "standard candle" preset.
  {
    const F = 1e-12; // W/m^2
    const L = 1e36; // W — order of magnitude for a Type Ia SN at peak
    const d = distanceFromFluxLuminosity(F, L);
    const dMpc = d / distanceToMeters(1, "mpc");
    rows.push({
      test: "Type Ia supernova — standard-candle distance from flux and luminosity",
      inputs: `F = ${fmt(F)} W/m², L ≈ 10³⁶ W (illustrative peak SN Ia luminosity)`,
      expected: "a few Mpc–tens of Mpc (right order of magnitude for a bright, cosmologically-nearby SN Ia)",
      computed: `d ≈ ${fmt(dMpc)} Mpc`,
      pass: dMpc > 1 && dMpc < 100,
    });
  }

  return rows;
}

// Internal-consistency checks: these don't depend on any externally
// published figure, just on the formula responding to each input exactly
// as the algebra predicts.
function consistencyRows() {
  const L = 3.828e27;
  const dPc10 = distanceToMeters(10, "pc");
  const F1 = fluxFromLuminosityDistance(L, dPc10);
  const Lback = luminosityFromFluxDistance(F1, dPc10);

  const F2 = 1e-12;
  const L2 = 3.828e26;
  const d2 = distanceFromFluxLuminosity(F2, L2);
  const F2back = fluxFromLuminosityDistance(L2, d2);

  const near = fluxFromLuminosityDistance(L_SUN, distanceToMeters(1, "pc"));
  const far = fluxFromLuminosityDistance(L_SUN, distanceToMeters(2, "pc"));

  const relFluxA = relErrorFlux(0.1, 0);
  const relFluxB = relErrorFlux(0, 0.1);
  const relL = 0.05;
  const relD = 0.02;
  const relLumComputed = relErrorLuminosity(relL, relD);
  const relLumExpected = Math.sqrt(relL ** 2 + (2 * relD) ** 2);
  const relDistComputed = relErrorDistance(0.1, 0.1);

  return [
    {
      test: "Round trip: L, d → F → L",
      inputs: `L = ${fmt(L)} W, d = 10 pc`,
      expected: `recovers L ≈ ${fmt(L)} W`,
      computed: `F = ${fmt(F1)} W/m², back to L = ${fmt(Lback)} W`,
      pass: percentDiff(Lback, L) < 1e-6,
    },
    {
      test: "Round trip: F, L → d → F",
      inputs: `F = ${fmt(F2)} W/m², L = ${fmt(L2)} W`,
      expected: `recovers F ≈ ${fmt(F2)} W/m²`,
      computed: `d = ${fmt(d2)} m, back to F = ${fmt(F2back)} W/m²`,
      pass: percentDiff(F2back, F2) < 1e-9,
    },
    {
      test: "Doubling distance quarters flux (inverse-square law)",
      inputs: "L = L☉, d = 1 pc vs. d = 2 pc",
      expected: "ratio ≈ 4.0000",
      computed: `ratio = ${fmt(near / far)}`,
      pass: percentDiff(near / far, 4) < 1e-6,
    },
    {
      test: "Flux error combines L's and d²'s relative errors in quadrature",
      inputs: "relL = 10%, relD = 0 vs. relL = 0, relD = 10%",
      expected: "10.00% and 20.00% (d enters squared)",
      computed: `${fmt(relFluxA * 100)}% and ${fmt(relFluxB * 100)}%`,
      pass: percentDiff(relFluxA, 0.1) < 1e-6 && percentDiff(relFluxB, 0.2) < 1e-6,
    },
    {
      test: "Luminosity error propagation matches the general power-law formula",
      inputs: `relF = ${fmt(relL)}, relD = ${fmt(relD)}`,
      expected: `≈ ${fmt(relLumExpected * 100)}%`,
      computed: `${fmt(relLumComputed * 100)}%`,
      pass: percentDiff(relLumComputed, relLumExpected) < 1e-9,
    },
    {
      test: "Distance error combines flux's and luminosity's relative errors, each halved (sqrt law)",
      inputs: "relF = 10%, relL = 10%",
      expected: `≈ ${fmt(Math.sqrt((0.5 * 0.1) ** 2 + (0.5 * 0.1) ** 2) * 100, 2)}%`,
      computed: `${fmt(relDistComputed * 100)}%`,
      pass: percentDiff(relDistComputed, Math.sqrt((0.5 * 0.1) ** 2 + (0.5 * 0.1) ** 2)) < 1e-9,
    },
  ];
}

// Edge cases: flux.js's core formulas are plain algebra with no input
// validation of their own (that guard lives in
// FluxLuminosityDistanceCalculator.jsx's `result` useMemo, which requires
// positive flux/luminosity/distance before ever calling these) — so these
// rows confirm what the real functions actually do when handed zero,
// negative, or degenerate inputs, rather than inventing rejection logic
// they don't have.
function edgeCaseRows() {
  const cases = [
    {
      test: "Zero flux",
      inputs: "F = 0 W/m², L = L☉",
      expected: "not rejected — L/(4π·0) gives +Infinity",
      run: () => distanceFromFluxLuminosity(0, L_SUN),
      check: (v) => v === Infinity,
    },
    {
      test: "Negative distance",
      inputs: "L = L☉, d = −1 AU",
      expected: "not rejected — d is squared, so the sign has no effect on the result",
      run: () => fluxFromLuminosityDistance(L_SUN, -distanceToMeters(1, "au")),
      check: (v) => Number.isFinite(v) && percentDiff(v, fluxFromLuminosityDistance(L_SUN, distanceToMeters(1, "au"))) < 1e-9,
    },
    {
      test: "Negative luminosity",
      inputs: "L = −L☉, d = 1 AU",
      expected: "not rejected — gives a negative, unphysical flux",
      run: () => fluxFromLuminosityDistance(-L_SUN, distanceToMeters(1, "au")),
      check: (v) => Number.isFinite(v) && v < 0,
    },
    {
      test: "Negative flux fed into distance solver",
      inputs: "F = −1 W/m², L = L☉",
      expected: "not rejected — square root of a negative number gives NaN",
      run: () => distanceFromFluxLuminosity(-1, L_SUN),
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
export function getFluxLuminosityDistanceTestRows() {
  return [...referenceRows(), ...consistencyRows(), ...edgeCaseRows()];
}
