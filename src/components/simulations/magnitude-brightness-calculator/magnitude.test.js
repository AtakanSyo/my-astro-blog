import { describe, it, expect } from "vitest";
import {
  POGSON_RATIO,
  ratioFromMagDiff,
  magDiffFromRatio,
  ratioForMagnitudeStep,
  describeRatio,
  niceStep,
} from "./magnitude";

describe("magnitude-brightness-calculator", () => {
  it("5 magnitudes is exactly a factor of 100 in flux, by definition", () => {
    expect(ratioFromMagDiff(-5)).toBeCloseTo(100, 9);
    expect(ratioForMagnitudeStep(5)).toBeCloseTo(100, 9);
  });

  it("one magnitude step is the fifth root of 100 (Pogson's ratio)", () => {
    expect(ratioForMagnitudeStep(1)).toBeCloseTo(POGSON_RATIO, 9);
    expect(POGSON_RATIO).toBeCloseTo(2.511886, 5);
  });

  it("round-trips magnitude difference -> ratio -> magnitude difference", () => {
    const deltaM = 3.7;
    const ratio = ratioFromMagDiff(deltaM);
    expect(magDiffFromRatio(ratio)).toBeCloseTo(deltaM, 9);
  });

  it("a lower magnitude means brighter (larger flux ratio)", () => {
    // Object A is 2 mag brighter than B (m1 - m2 = -2)
    const ratio = ratioFromMagDiff(-2);
    expect(ratio).toBeGreaterThan(1);
  });

  it("describeRatio labels which object is brighter", () => {
    expect(describeRatio(100).brighter).toBe("A");
    expect(describeRatio(100).factor).toBeCloseTo(100, 9);
    expect(describeRatio(0.01).brighter).toBe("B");
    expect(describeRatio(0.01).factor).toBeCloseTo(100, 9);
    expect(describeRatio(1).brighter).toBe("equal");
  });

  it("describeRatio rejects invalid ratios", () => {
    expect(describeRatio(0)).toBeNull();
    expect(describeRatio(-5)).toBeNull();
    expect(describeRatio(NaN)).toBeNull();
  });

  it("niceStep picks a sensible round increment", () => {
    expect(niceStep(10, 5)).toBe(2);
    expect(niceStep(0)).toBe(1);
  });
});
