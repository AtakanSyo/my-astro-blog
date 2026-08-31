import { describe, it, expect } from "vitest";
import {
  M_SUN,
  eddingtonLuminosityWatts,
  eddingtonRatio,
  classifyRatio,
  luminosityFromSI,
} from "./eddington";

describe("eddington-luminosity-calculator", () => {
  it("matches the commonly-cited L_Edd ~= 1.26e38 (M/M_sun) erg/s figure", () => {
    const lEddWatts = eddingtonLuminosityWatts(M_SUN);
    const lEddErgS = luminosityFromSI(lEddWatts, "ergs");
    const expected = 1.26e38;
    expect(Math.abs(lEddErgS - expected) / expected).toBeLessThan(0.01);
  });

  it("scales linearly with mass", () => {
    const l1 = eddingtonLuminosityWatts(M_SUN);
    const l10 = eddingtonLuminosityWatts(10 * M_SUN);
    expect(l10 / l1).toBeCloseTo(10, 9);
  });

  it("eddingtonRatio is just L / L_Edd", () => {
    expect(eddingtonRatio(50, 100)).toBeCloseTo(0.5, 12);
    expect(eddingtonRatio(150, 100)).toBeCloseTo(1.5, 12);
  });

  it("classifies ratios into the expected bands", () => {
    expect(classifyRatio(0.001).label).toBe("Deeply sub-Eddington");
    expect(classifyRatio(0.1).label).toBe("Sub-Eddington");
    expect(classifyRatio(0.5).label).toBe("Approaching Eddington");
    expect(classifyRatio(1.2).label).toBe("Near-Eddington");
    expect(classifyRatio(5).label).toBe("Super-Eddington");
  });

  it("rejects non-positive or non-finite ratios", () => {
    expect(classifyRatio(0)).toBeNull();
    expect(classifyRatio(-1)).toBeNull();
    expect(classifyRatio(NaN)).toBeNull();
  });
});
