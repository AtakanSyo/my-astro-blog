import { describe, it, expect } from "vitest";
import { computeAlpha, extrapolateFlux, alphaUncertainty, classifySpectrum } from "./spectral";

describe("spectral-index-calculator", () => {
  it("computes a known steep-spectrum radio source's spectral index correctly", () => {
    // S ~ nu^-0.7 classically means alpha=-0.7 in this site's S ~ nu^alpha convention.
    const nu1 = 1.4; // GHz
    const nu2 = 5;
    const S1 = 1; // Jy
    const S2 = S1 * Math.pow(nu2 / nu1, -0.7);
    const { valid, alpha } = computeAlpha(S1, nu1, S2, nu2);
    expect(valid).toBe(true);
    expect(alpha).toBeCloseTo(-0.7, 9);
  });

  it("round-trips: alpha extrapolated from two points predicts the second point exactly", () => {
    const nu1 = 100, S1 = 5, nu2 = 1000, S2 = 2;
    const { alpha } = computeAlpha(S1, nu1, S2, nu2);
    expect(extrapolateFlux(S1, nu1, alpha, nu2)).toBeCloseTo(S2, 9);
  });

  it("a flat spectrum (alpha=0) predicts equal flux at any frequency", () => {
    expect(extrapolateFlux(5, 100, 0, 999)).toBe(5);
  });

  it("rejects non-positive or equal-frequency inputs", () => {
    expect(computeAlpha(0, 100, 5, 200).valid).toBe(false);
    expect(computeAlpha(5, 100, 5, 100).valid).toBe(false);
    expect(computeAlpha(5, -1, 5, 200).valid).toBe(false);
  });

  it("alpha uncertainty shrinks as the frequency baseline widens", () => {
    const narrow = alphaUncertainty(0.1, 0.1, 100, 110);
    const wide = alphaUncertainty(0.1, 0.1, 100, 10000);
    expect(wide).toBeLessThan(narrow);
  });

  it("classifies spectra into the expected bands", () => {
    expect(classifySpectrum(0.5).label).toBe("Inverted / self-absorbed");
    expect(classifySpectrum(0).label).toBe("Flat spectrum");
    expect(classifySpectrum(-0.7).label).toBe("Steep spectrum");
    expect(classifySpectrum(-2).label).toBe("Ultra-steep spectrum");
  });
});
