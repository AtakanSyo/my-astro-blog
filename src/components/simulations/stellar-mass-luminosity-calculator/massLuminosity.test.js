import { describe, it, expect } from "vitest";
import {
  luminosityFromMass,
  massFromLuminosity,
  localExponent,
  absoluteBolometricMagnitude,
  M_BOL_SUN,
  REAL_STAR_LANDMARKS,
} from "./massLuminosity";

describe("stellar-mass-luminosity-calculator", () => {
  it("the Sun's own mass gives the Sun's own luminosity (calibration point)", () => {
    expect(luminosityFromMass(1)).toBeCloseTo(1, 9);
  });

  it("round-trips mass -> luminosity -> mass within each branch", () => {
    for (const mSolar of [0.2, 1, 5, 30]) {
      const l = luminosityFromMass(mSolar);
      expect(massFromLuminosity(l)).toBeCloseTo(mSolar, 6);
    }
  });

  it("localExponent matches the documented piecewise slopes", () => {
    expect(localExponent(0.2)).toBe(2.3);
    expect(localExponent(1)).toBe(4);
    expect(localExponent(10)).toBe(3.5);
    expect(localExponent(50)).toBe(1);
  });

  it("luminosity increases monotonically with mass across all branches", () => {
    const masses = [0.1, 0.4, 0.43, 1, 2, 10, 20, 100];
    for (let i = 1; i < masses.length; i++) {
      expect(luminosityFromMass(masses[i])).toBeGreaterThan(luminosityFromMass(masses[i - 1]));
    }
  });

  it("the Sun's absolute bolometric magnitude matches the IAU-defined reference value", () => {
    expect(absoluteBolometricMagnitude(1)).toBeCloseTo(M_BOL_SUN, 9);
  });

  it("the formula roughly tracks real stars' known luminosities (order of magnitude)", () => {
    for (const star of REAL_STAR_LANDMARKS) {
      const predicted = luminosityFromMass(star.mSolar);
      const logRatio = Math.abs(Math.log10(predicted / star.lSolar));
      expect(logRatio).toBeLessThan(1); // within a factor of 10 — it's an empirical fit, not exact
    }
  });
});
