// Test cases for the "Tests" popup on the Free-Fall Time Calculator.
// These run the calculator's real freeFall.js functions against cited
// reference densities and internal-consistency checks, so this table is
// a genuine live check — not a hardcoded, unverified table — and would
// visibly show failures on this page if the underlying math ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<slug>Tests.js" per calculator, computing rows from that calculator's
// own math module — to add the Tests popup to another calculator.

import {
  M_H,
  freeFallTime,
  numberDensityToMassDensity,
  massDensityToKgM3,
  timeFromSeconds,
  collapseCurvePoint,
  collapseCurve,
} from "./freeFall";

export const FREE_FALL_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes above the reference figures
// below — rendered at the bottom of the Tests popup by CalculatorTests.
// Keep these two in sync when either changes.
export const FREE_FALL_TEST_SOURCES = [
  {
    title: "The Sun",
    text: "Mean density 1408 kg/m³, giving a widely cited free-fall time of roughly half an hour — a standard illustration (e.g. when comparing a star's free-fall time against its much longer Kelvin–Helmholtz contraction time) of just how strongly gravity would win without pressure support.",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html",
    urlLabel: "NASA Sun Fact Sheet",
  },
  {
    title: "Earth",
    text: "Mean density 5514 kg/m³ — used here only as a second, denser rocky-body reference point, not a physically meaningful scenario (Earth isn't a gas cloud and never actually free-falls this way).",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/factsheet.html",
    urlLabel: "NASA Earth Fact Sheet",
  },
  {
    title: "Molecular cloud gas (number density → mass density)",
    text: "n(H₂) ≈ 100 cm⁻³ with mean molecular weight μ ≈ 2.3 (standard for molecular gas including helium) is a commonly used illustrative density for diffuse molecular cloud material in star-formation texts — not a single universal constant, since real clouds span several orders of magnitude in density.",
  },
  {
    title: "What these rows actually prove",
    text: "The reference rows confirm the formula reproduces the right order of magnitude for cited real densities. The comparison rows below them confirm the formula responds to density in the physically correct direction, and that the collapse-curve geometry matches its own exact parametric solution. None of this independently re-verifies the cited density figures themselves — see each source above.",
  },
];

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

// Free-fall time depends only on density, so there's no independent
// second figure to round-trip against (unlike, say, angular size vs.
// physical size vs. distance) — each row instead checks the computed
// value falls within a generous, clearly-labeled order-of-magnitude
// band around the commonly cited figure, rather than claiming false
// precision against a single "exact" published number.
function rangeRow(test, inputs, tffSeconds, unit, lo, hi) {
  const value = timeFromSeconds(tffSeconds, unit);
  return {
    test,
    inputs,
    expected: `${fmt(lo)}–${fmt(hi)} ${unit}`,
    computed: `${fmt(value)} ${unit}`,
    pass: value >= lo && value <= hi,
  };
}

function validationRows() {
  const rows = [];

  const sunTff = freeFallTime(massDensityToKgM3(1408, "kgm3"));
  rows.push(rangeRow("The Sun — free-fall time", "ρ = 1408 kg/m³", sunTff, "min", 20, 40));

  const earthTff = freeFallTime(massDensityToKgM3(5514, "kgm3"));
  rows.push(rangeRow("Earth — free-fall time", "ρ = 5514 kg/m³", earthTff, "min", 10, 20));

  const cloudRho = numberDensityToMassDensity(100 * 1e6, 2.3);
  const cloudTff = freeFallTime(cloudRho);
  rows.push(rangeRow("Molecular cloud gas — free-fall time", "n(H₂) = 100 cm⁻³, μ = 2.3", cloudTff, "myr", 1, 10));

  const coreRho = numberDensityToMassDensity(1e5 * 1e6, 2.3);
  const coreTff = freeFallTime(coreRho);
  rows.push(rangeRow("Dense prestellar core — free-fall time", "n(H₂) = 10⁵ cm⁻³, μ = 2.3", coreTff, "kyr", 10, 500));

  return rows;
}

// Internal-consistency checks: these don't depend on any externally
// cited figure, just on the formula and collapse-curve geometry behaving
// the way the exact analytic solution requires.
function consistencyRows() {
  const loose = freeFallTime(1000);
  const dense = freeFallTime(8000); // 8x denser -> t_ff shrinks by sqrt(8)

  const nCm3 = numberDensityToMassDensity(1 * 1e6, 1); // 1 particle/cm^3, mu=1 -> should equal M_H
  const start = collapseCurvePoint(0);
  const end = collapseCurvePoint(Math.PI);
  const points = collapseCurve(48);
  const isMonotonic = points.every((p, i) => i === 0 || p.rFraction <= points[i - 1].rFraction);

  return [
    {
      test: "A denser sphere collapses faster (t_ff ∝ ρ^(-1/2))",
      inputs: "ρ = 1000 kg/m³ vs. ρ = 8000 kg/m³ (8× denser)",
      expected: "ratio ≈ 2.8284 (√8)",
      computed: `ratio = ${fmt(loose / dense)}`,
      pass: percentDiff(loose / dense, Math.sqrt(8)) < 1e-6,
    },
    {
      test: "Number-density conversion matches n × μ × m_H directly",
      inputs: "n = 1 particle/cm³, μ = 1",
      expected: `${M_H} kg/m³ (= m_H)`,
      computed: `${fmt(nCm3, 30)} kg/m³`,
      pass: percentDiff(nCm3, M_H) < 1e-9,
    },
    {
      test: "Collapse curve starts at full radius, at rest, at t = 0",
      inputs: "θ = 0",
      expected: "r/r₀ = 1, t/t_ff = 0",
      computed: `r/r₀ = ${fmt(start.rFraction)}, t/t_ff = ${fmt(start.tFraction)}`,
      pass: percentDiff(start.rFraction, 1) < 1e-9 && Math.abs(start.tFraction) < 1e-9,
    },
    {
      test: "Collapse curve reaches the center exactly at t = t_ff",
      inputs: "θ = π",
      expected: "r/r₀ = 0, t/t_ff = 1",
      computed: `r/r₀ = ${fmt(end.rFraction)}, t/t_ff = ${fmt(end.tFraction)}`,
      pass: Math.abs(end.rFraction) < 1e-9 && percentDiff(end.tFraction, 1) < 1e-9,
    },
    {
      test: "Collapse curve radius decreases monotonically with time",
      inputs: "48 sampled points from θ = 0 to π",
      expected: "never increases",
      computed: isMonotonic ? "monotonically non-increasing" : "increased somewhere — bug",
      pass: isMonotonic,
    },
    {
      test: "Collapse accelerates near the end, not the start",
      inputs: "θ = π/2 (radius has fallen exactly to half, r/r₀ = 0.5)",
      expected: "more than 50% of t_ff has already elapsed",
      computed: `${fmt(collapseCurvePoint(Math.PI / 2).tFraction * 100, 1)}% of t_ff elapsed`,
      pass: collapseCurvePoint(Math.PI / 2).tFraction > 0.5,
    },
    {
      test: "Zero or negative density is not physical",
      inputs: "ρ = 0 kg/m³ and ρ = −100 kg/m³",
      expected: "non-finite result (rejected)",
      computed: `${Number.isFinite(freeFallTime(0)) ? "finite (bug)" : "non-finite"}, ${Number.isFinite(freeFallTime(-100)) ? "finite (bug)" : "non-finite"}`,
      pass: !Number.isFinite(freeFallTime(0)) && !Number.isFinite(freeFallTime(-100)),
    },
  ];
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getFreeFallTestRows() {
  return [...validationRows(), ...consistencyRows()];
}
