import { describe, it, expect } from "vitest";
import {
  M_SUN,
  R_SUN_M,
  schwarzschildRadiusM,
  gravitationalRedshift,
  redshiftFactorBetween,
  observedWavelength,
} from "./gravitationalRedshift";

describe("gravitational-redshift-calculator", () => {
  it("matches the Sun's known surface redshift (~2.12e-6)", () => {
    const z = gravitationalRedshift(M_SUN, R_SUN_M);
    expect(z).toBeCloseTo(2.12e-6, 8);
  });

  it("returns null at or inside the Schwarzschild radius", () => {
    const rs = schwarzschildRadiusM(M_SUN);
    expect(gravitationalRedshift(M_SUN, rs)).toBeNull();
    expect(gravitationalRedshift(M_SUN, rs * 0.5)).toBeNull();
  });

  it("redshift grows as the emission radius approaches the Schwarzschild radius", () => {
    const rs = schwarzschildRadiusM(M_SUN);
    const zFar = gravitationalRedshift(M_SUN, rs * 100);
    const zNear = gravitationalRedshift(M_SUN, rs * 1.01);
    expect(zNear).toBeGreaterThan(zFar);
  });

  it("redshift vanishes far from the mass", () => {
    const rs = schwarzschildRadiusM(M_SUN);
    const zVeryFar = gravitationalRedshift(M_SUN, rs * 1e12);
    expect(zVeryFar).toBeCloseTo(0, 6);
  });

  it("redshiftFactorBetween(r, r) is 1 (no shift over zero climb)", () => {
    expect(redshiftFactorBetween(M_SUN, R_SUN_M, R_SUN_M)).toBeCloseTo(1, 12);
  });

  it("observedWavelength stretches the emitted wavelength by (1+z)", () => {
    expect(observedWavelength(500, 0.1)).toBeCloseTo(550, 9);
    expect(observedWavelength(500, 0)).toBe(500);
  });
});
