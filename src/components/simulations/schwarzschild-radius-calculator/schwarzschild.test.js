import { describe, it, expect } from "vitest";
import {
  M_SUN,
  M_EARTH,
  schwarzschildRadiusM,
  massFromSchwarzschildRadiusM,
  closestSizeComparison,
} from "./schwarzschild";

describe("schwarzschild-radius-calculator", () => {
  it("matches the Sun's famous Schwarzschild radius (~2.95 km)", () => {
    const rs = schwarzschildRadiusM(M_SUN);
    expect(rs / 1000).toBeCloseTo(2.95, 1);
  });

  it("matches Earth's famous Schwarzschild radius (~9 mm)", () => {
    const rs = schwarzschildRadiusM(M_EARTH);
    expect(rs * 1000).toBeCloseTo(9, 0); // millimeters
  });

  it("is exactly linear in mass — doubling mass exactly doubles the radius", () => {
    const r1 = schwarzschildRadiusM(M_SUN);
    const r2 = schwarzschildRadiusM(2 * M_SUN);
    expect(r2 / r1).toBeCloseTo(2, 12);
  });

  it("round-trips mass -> radius -> mass", () => {
    const rs = schwarzschildRadiusM(M_SUN);
    const roundTripMass = massFromSchwarzschildRadiusM(rs);
    expect(Math.abs(roundTripMass - M_SUN) / M_SUN).toBeLessThan(1e-9);
  });

  it("picks a sensible closest-size comparison and a ratio near 1 for an exact match", () => {
    const match = closestSizeComparison(6371); // Earth's radius in km
    expect(match.label).toMatch(/Earth's radius/);
    expect(match.ratio).toBeCloseTo(1, 6);
  });

  it("returns null for a non-positive size", () => {
    expect(closestSizeComparison(0)).toBeNull();
    expect(closestSizeComparison(-5)).toBeNull();
  });
});
