// Test cases for the "Tests" popup on the Quantum Particle Simulator. These
// run the simulator's real physics.js functions — grid setup, Gaussian
// wave-packet construction, normalization, expectation values, and the
// Crank-Nicolson time step — against genuine physical invariants of the
// numerical scheme, so this table is a live check that would visibly show
// failures on this page if the underlying numerics ever broke.
//
// IMPORTANT — what this actually validates: unlike a closed-form formula
// calculator, there is no textbook "reference value" a numerical PDE
// solver's output can be checked against here. These rows instead confirm
// the implementation's own internal self-consistency: a freshly built wave
// packet is normalized, its <x> matches the center it was built at, energy
// bookkeeping (<E> = <T> + <V>) is coherent, and Crank-Nicolson evolution —
// which is mathematically unitary for a Hermitian Hamiltonian — actually
// preserves norm in this implementation. None of this independently proves
// the simulator reproduces real quantum mechanics; it proves the numerics
// are internally consistent and behave the way this method is supposed to.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed.

import {
  makeGrid,
  potentialFree,
  potentialHarmonic,
  absorbingLayer,
  gaussianWavePacket,
  buildHamiltonianCoeffs,
  createSolverScratch,
  crankNicolsonStep,
  computeNorm,
  computeExpectationX,
  computeExpectationKinetic,
  computeExpectationV,
} from "./physics";

export const QUANTUM_PARTICLE_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

export const QUANTUM_PARTICLE_TEST_SOURCES = [
  {
    title: "Method: Crank-Nicolson finite differences",
    text: "The propagator (I + iβĤ)ψ' = (I − iβĤ)ψ is a Cayley transform of a Hermitian Ĥ, which is exactly unitary — it should conserve total probability (norm) to numerical precision whenever no absorbing layer is present. See physics.js's own header comment and the simulator's post text for the full derivation.",
  },
  {
    title: "Units",
    text: "Simulation uses natural units with ħ = 1, matching common pedagogical QM simulators (e.g. PhET's \"Quantum Bound States\") — these are not SI values, so there is no external physical constant to check them against.",
  },
  {
    title: "What these rows actually prove",
    text: "This is a numerical PDE solver, not a closed-form formula — there's no independent textbook value for \"⟨x⟩ of this exact wave packet on this exact grid at this exact time\" to check against. These checks instead confirm the implementation's internal self-consistency: normalization actually normalizes, ⟨x⟩ matches the center a packet was built at, kinetic + potential energy bookkeeping is coherent, and the Crank-Nicolson step actually preserves norm the way the method is mathematically supposed to. A genuine bug in the underlying physics (e.g. a wrong sign in the Hamiltonian) could still pass some of these rows while producing a simulation that looks wrong on screen.",
  },
];

// Same grid the simulator itself uses (see QuantumParticleSimulator.jsx's
// XMIN/XMAX/N constants), so these checks run at the same resolution the
// page actually renders at.
const XMIN = -20;
const XMAX = 20;
const N = 500;

function fmt(n, digits = 6) {
  if (!Number.isFinite(n)) return "NaN";
  return n.toFixed(digits);
}

// --- normalization: a freshly built wave packet has total probability 1 ---
function normalizationRows() {
  const cases = [
    { label: "Centered packet", x0: 0, p0: 0, sigma: 1 },
    { label: "Off-center, moving packet", x0: 6, p0: -3, sigma: 0.4 },
  ];

  return cases.map((c) => {
    const grid = makeGrid(XMIN, XMAX, N);
    const { re, im } = gaussianWavePacket(grid, c.x0, c.p0, c.sigma);
    const norm = computeNorm(re, im, grid.dx);
    return {
      test: `Normalization — ${c.label}`,
      inputs: `x₀=${c.x0}, p₀=${c.p0}, σ=${c.sigma}`,
      expected: "computeNorm ≈ 1",
      computed: fmt(norm),
      pass: Number.isFinite(norm) && Math.abs(norm - 1) < 1e-9,
    };
  });
}

// --- <x> of a freshly-initialized packet matches the center it was built at ---
function expectationXRows() {
  const cases = [
    { label: "Centered at origin", x0: 0, p0: 0, sigma: 1 },
    { label: "Off-center, moving left", x0: -7, p0: 2, sigma: 1.5 },
  ];

  return cases.map((c) => {
    const grid = makeGrid(XMIN, XMAX, N);
    const { re, im } = gaussianWavePacket(grid, c.x0, c.p0, c.sigma);
    // Packet is already normalized (norm ≈ 1), so the raw expectation
    // integral is directly comparable to x0 without dividing by norm.
    const meanX = computeExpectationX(re, im, grid.x, grid.dx);
    return {
      test: `⟨x⟩ at t=0 — ${c.label}`,
      inputs: `x₀=${c.x0}, p₀=${c.p0}, σ=${c.sigma}`,
      expected: `≈ ${c.x0}`,
      computed: fmt(meanX, 4),
      pass: Number.isFinite(meanX) && Math.abs(meanX - c.x0) < 1e-3,
    };
  });
}

// --- energy bookkeeping stays coherent across Crank-Nicolson evolution ---
// Ĥ is time-independent and the CN propagator is unitary with respect to
// it, so ⟨E⟩ = ⟨T⟩ + ⟨V⟩ — each computed via the real observable
// functions — should stay approximately constant as the packet evolves
// under a bound potential with no absorbing layer draining probability.
// This both validates the ⟨E⟩ = ⟨T⟩ + ⟨V⟩ bookkeeping and exercises real
// crankNicolsonStep calls.
function energyConservationRow() {
  const grid = makeGrid(XMIN, XMAX, N);
  const mass = 1;
  const dt = 0.02;
  const V = potentialHarmonic(grid, 0.3);
  const eta = new Float64Array(grid.n); // no absorbing layer — energy should be conserved
  const coeffs = buildHamiltonianCoeffs(grid, V, eta, mass, dt);
  const scratch = createSolverScratch(grid.n);
  const { re, im } = gaussianWavePacket(grid, -4, 0, 1);

  const T0 = computeExpectationKinetic(re, im, mass, grid.dx);
  const V0 = computeExpectationV(re, im, V, grid.dx);
  const E0 = T0 + V0;

  const steps = 150;
  for (let s = 0; s < steps; s++) crankNicolsonStep(re, im, coeffs, scratch);

  const T1 = computeExpectationKinetic(re, im, mass, grid.dx);
  const V1 = computeExpectationV(re, im, V, grid.dx);
  const E1 = T1 + V1;

  const relDrift = Math.abs(E1 - E0) / Math.abs(E0);

  return {
    test: "Energy bookkeeping (⟨E⟩ = ⟨T⟩ + ⟨V⟩) stays coherent across evolution",
    inputs: `Harmonic well, k=0.3, x₀=−4, p₀=0, σ=1, ${steps} CN steps, dt=${dt}, no absorbing layer`,
    expected: "⟨E⟩ after evolution ≈ ⟨E⟩ before (< 1% relative drift)",
    computed: `E₀=${fmt(E0, 4)}, E₁=${fmt(E1, 4)} (${fmt(relDrift * 100, 3)}% drift)`,
    pass: Number.isFinite(E0) && Number.isFinite(E1) && relDrift < 0.01,
  };
}

// --- Crank-Nicolson evolution conserves norm (unitarity) ---
function normConservationRow() {
  const grid = makeGrid(-30, 30, 500);
  const mass = 1;
  const dt = 0.05;
  const V = potentialFree(grid);
  const eta = new Float64Array(grid.n); // no absorbing layer
  const coeffs = buildHamiltonianCoeffs(grid, V, eta, mass, dt);
  const scratch = createSolverScratch(grid.n);
  const { re, im } = gaussianWavePacket(grid, 0, 2, 1);

  const normBefore = computeNorm(re, im, grid.dx);
  const steps = 200;
  for (let s = 0; s < steps; s++) crankNicolsonStep(re, im, coeffs, scratch);
  const normAfter = computeNorm(re, im, grid.dx);

  return {
    test: "Crank-Nicolson evolution conserves norm (unitarity)",
    inputs: `Free particle, x₀=0, p₀=2, σ=1, ${steps} CN steps, dt=${dt}, no absorbing layer`,
    expected: "norm after ≈ norm before",
    computed: `before=${fmt(normBefore)}, after=${fmt(normAfter)}`,
    pass: Number.isFinite(normAfter) && Math.abs(normAfter - normBefore) < 1e-6,
  };
}

// --- edge case: a very narrow packet (near the grid resolution limit) ---
// doesn't produce NaN/Infinity or otherwise misbehave.
function edgeCaseRow() {
  const grid = makeGrid(XMIN, XMAX, N); // dx ≈ 0.08
  const sigma = 0.3; // the simulator's own UI slider floor — the narrowest packet a user can dial in
  const { re, im } = gaussianWavePacket(grid, 0, 0, sigma);
  const norm = computeNorm(re, im, grid.dx);
  const meanX = computeExpectationX(re, im, grid.x, grid.dx);
  const finiteEverywhere = Array.from(re).every(Number.isFinite) && Array.from(im).every(Number.isFinite);

  return {
    test: "Edge case — very narrow wave packet doesn't blow up",
    inputs: `x₀=0, p₀=0, σ=${sigma} (grid dx≈${fmt(grid.dx, 3)}, the UI's narrowest allowed width)`,
    expected: "finite ψ everywhere, norm ≈ 1, ⟨x⟩ ≈ 0",
    computed: `norm=${fmt(norm)}, ⟨x⟩=${fmt(meanX, 4)}, all finite=${finiteEverywhere}`,
    pass: finiteEverywhere && Number.isFinite(norm) && Math.abs(norm - 1) < 1e-9 && Math.abs(meanX) < 1e-3,
  };
}

/** Computes the full Tests table for this simulator, live, on every call. */
export function getQuantumParticleTestRows() {
  return [
    ...normalizationRows(),
    ...expectationXRows(),
    energyConservationRow(),
    normConservationRow(),
    edgeCaseRow(),
  ];
}
