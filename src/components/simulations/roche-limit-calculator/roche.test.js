import { describe, it, expect } from "vitest";
import { FLUID_COEFFICIENT, RIGID_COEFFICIENT, fluidRocheLimit, rigidRocheLimit } from "./roche";

describe("roche-limit-calculator", () => {
  it("uses the standard published coefficients (2.44 fluid, 2^(1/3) rigid)", () => {
    expect(FLUID_COEFFICIENT).toBe(2.44);
    expect(RIGID_COEFFICIENT).toBeCloseTo(1.2599, 4);
  });

  it("Saturn's rings sit just inside its known fluid Roche limit (~2.5 Saturn radii for icy density)", () => {
    const rSaturnKm = 58232;
    const densitySaturn = 687; // kg/m^3
    const densityIce = 920; // kg/m^3, typical ring particle density
    const limitKm = fluidRocheLimit(rSaturnKm, densitySaturn, densityIce);
    expect(limitKm / rSaturnKm).toBeCloseTo(2.2, 1);
  });

  it("fluid limit is always farther out than the rigid limit for the same bodies", () => {
    const fluid = fluidRocheLimit(1000, 3000, 1000);
    const rigid = rigidRocheLimit(1000, 3000, 1000);
    expect(fluid).toBeGreaterThan(rigid);
  });

  it("a denser satellite has a smaller Roche limit (holds together better)", () => {
    const loose = fluidRocheLimit(1000, 3000, 500);
    const dense = fluidRocheLimit(1000, 3000, 5000);
    expect(dense).toBeLessThan(loose);
  });

  it("equal densities give the same Roche limit regardless of coefficient choice ordering", () => {
    const limit = fluidRocheLimit(1000, 3000, 3000);
    expect(limit).toBeCloseTo(FLUID_COEFFICIENT * 1000, 9);
  });
});
