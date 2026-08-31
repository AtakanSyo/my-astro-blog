import { describe, it, expect } from "vitest";
import {
  C,
  computeRedshift,
  computeObservedWavelength,
  computeRestWavelength,
  velocityClassical,
  velocityRelativistic,
} from "./redshift";

describe("redshift-wavelength-calculator", () => {
  it("matches a well-known quasar-scale redshift (3C 273, z ~ 0.158)", () => {
    const lamRest = 121.567; // Lyman-alpha rest wavelength, nm
    const lamObs = lamRest * 1.158; // observed at z ~ 0.158
    const { valid, z } = computeRedshift(lamRest, lamObs);
    expect(valid).toBe(true);
    expect(z).toBeCloseTo(0.158, 6);
  });

  it("round-trips rest+observed -> z -> observed", () => {
    const lamRest = 656.28;
    const lamObs = 700;
    const { z } = computeRedshift(lamRest, lamObs);
    const { valid, lamObsM } = computeObservedWavelength(z, lamRest);
    expect(valid).toBe(true);
    expect(lamObsM).toBeCloseTo(lamObs, 9);
  });

  it("round-trips rest+observed -> z -> rest", () => {
    const lamRest = 656.28;
    const lamObs = 700;
    const { z } = computeRedshift(lamRest, lamObs);
    const { valid, lamRestM } = computeRestWavelength(z, lamObs);
    expect(valid).toBe(true);
    expect(lamRestM).toBeCloseTo(lamRest, 9);
  });

  it("z=0 means no shift at all", () => {
    const { z } = computeRedshift(500, 500);
    expect(z).toBe(0);
  });

  it("a negative z (blueshift) means the observed wavelength is shorter", () => {
    const { z } = computeRedshift(500, 490);
    expect(z).toBeLessThan(0);
  });

  it("rejects non-positive wavelengths", () => {
    expect(computeRedshift(0, 500).valid).toBe(false);
    expect(computeRedshift(500, -1).valid).toBe(false);
  });

  it("rejects a redshift at or below -1 (implies a non-positive observed wavelength)", () => {
    expect(computeObservedWavelength(-1, 500).valid).toBe(false);
    expect(computeObservedWavelength(-1.5, 500).valid).toBe(false);
  });

  it("classical and relativistic velocity agree to within 0.1% for small z, diverge for large z", () => {
    const smallZ = 0.001;
    const relDiff = Math.abs(velocityRelativistic(smallZ) - velocityClassical(smallZ)) / velocityClassical(smallZ);
    expect(relDiff).toBeLessThan(0.001);

    const largeZ = 3;
    expect(velocityRelativistic(largeZ)).toBeLessThan(C); // always physical
    expect(velocityClassical(largeZ)).toBeGreaterThan(C); // naive formula breaks down
  });
});
