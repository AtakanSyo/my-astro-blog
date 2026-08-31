import { describe, it, expect } from "vitest";
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
  computeSplitProbabilities,
} from "./physics";

describe("quantum-particle-simulator", () => {
  it("a freshly built Gaussian wave packet is normalized (total probability = 1)", () => {
    const grid = makeGrid(-20, 20, 400);
    const { re, im } = gaussianWavePacket(grid, 0, 0, 1);
    expect(computeNorm(re, im, grid.dx)).toBeCloseTo(1, 6);
  });

  it("a symmetric packet centered at x0=0 with p0=0 has <x> ≈ 0", () => {
    const grid = makeGrid(-20, 20, 400);
    const { re, im } = gaussianWavePacket(grid, 0, 0, 1);
    expect(computeExpectationX(re, im, grid.x, grid.dx)).toBeCloseTo(0, 3);
  });

  it("an off-center packet has <x> close to its center", () => {
    const grid = makeGrid(-20, 20, 400);
    const { re, im } = gaussianWavePacket(grid, 5, 0, 1);
    expect(computeExpectationX(re, im, grid.x, grid.dx)).toBeCloseTo(5, 1);
  });

  it("Crank-Nicolson evolution conserves norm (unitarity) for a free particle with no absorption", () => {
    const grid = makeGrid(-30, 30, 500);
    const { re, im } = gaussianWavePacket(grid, 0, 2, 1);
    const V = potentialFree(grid);
    const eta = new Float64Array(grid.n); // no absorbing layer
    const mass = 1;
    const dt = 0.05;
    const coeffs = buildHamiltonianCoeffs(grid, V, eta, mass, dt);
    const scratch = createSolverScratch(grid.n);

    const normBefore = computeNorm(re, im, grid.dx);
    for (let step = 0; step < 200; step++) {
      crankNicolsonStep(re, im, coeffs, scratch);
    }
    const normAfter = computeNorm(re, im, grid.dx);

    expect(normAfter).toBeCloseTo(normBefore, 6);
  });

  it("an absorbing layer actually reduces norm as probability reaches the boundary", () => {
    const grid = makeGrid(-10, 10, 300);
    // Fast-moving packet aimed at the right edge, starting close to it.
    const { re, im } = gaussianWavePacket(grid, 5, 15, 0.5);
    const V = potentialFree(grid);
    const eta = absorbingLayer(grid, 0.15, 5);
    const coeffs = buildHamiltonianCoeffs(grid, V, eta, 1, 0.01);
    const scratch = createSolverScratch(grid.n);

    const normBefore = computeNorm(re, im, grid.dx);
    for (let step = 0; step < 300; step++) {
      crankNicolsonStep(re, im, coeffs, scratch);
    }
    const normAfter = computeNorm(re, im, grid.dx);

    expect(normAfter).toBeLessThan(normBefore);
  });

  it("split probabilities across the midpoint sum to the total norm", () => {
    const grid = makeGrid(-20, 20, 400);
    const { re, im } = gaussianWavePacket(grid, 3, 0, 1);
    const { left, right } = computeSplitProbabilities(re, im, grid.x, 0, grid.dx);
    expect(left + right).toBeCloseTo(computeNorm(re, im, grid.dx), 6);
  });

  it("potentialHarmonic is a symmetric parabola, zero at the origin", () => {
    const grid = makeGrid(-5, 5, 101);
    const V = potentialHarmonic(grid, 2);
    const midIndex = Math.floor(grid.n / 2);
    expect(V[midIndex]).toBeCloseTo(0, 9);
    expect(V[0]).toBeCloseTo(V[grid.n - 1], 6); // symmetric
    expect(V[0]).toBeGreaterThan(0);
  });
});
