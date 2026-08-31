import { describe, it, expect } from "vitest";
import { classify, toNumber, computeHardnessRatio, LOW_COUNT_THRESHOLD } from "./hardnessRatio";

describe("xray-hardness-ratio-calculator", () => {
  it("equal soft/hard counts give a hardness ratio of exactly 0 (balanced)", () => {
    const { valid, HR, label } = computeHardnessRatio(100, 100);
    expect(valid).toBe(true);
    expect(HR).toBe(0);
    expect(label).toBe("Balanced");
  });

  it("all-hard counts give HR = 1, all-soft counts give HR = -1", () => {
    expect(computeHardnessRatio(0, 100).HR).toBe(1);
    expect(computeHardnessRatio(100, 0).HR).toBe(-1);
  });

  it("HR is bounded within [-1, 1] for any positive counts", () => {
    const { HR } = computeHardnessRatio(37, 963);
    expect(HR).toBeGreaterThanOrEqual(-1);
    expect(HR).toBeLessThanOrEqual(1);
  });

  it("defaults to Poisson (sqrt(N)) uncertainty when none is supplied", () => {
    const { sigmaS, sigmaH } = computeHardnessRatio(100, 400);
    expect(sigmaS).toBeCloseTo(10, 9);
    expect(sigmaH).toBeCloseTo(20, 9);
  });

  it("propagates a known custom uncertainty via the documented formula", () => {
    const S = 100, H = 100, sigmaS = 10, sigmaH = 10;
    const { sigmaHR } = computeHardnessRatio(S, H, sigmaS, sigmaH);
    const denom = H + S;
    const expected = (2 / (denom * denom)) * Math.sqrt(S * S * sigmaH * sigmaH + H * H * sigmaS * sigmaS);
    expect(sigmaHR).toBeCloseTo(expected, 12);
  });

  it("flags low counts below the documented threshold", () => {
    expect(computeHardnessRatio(LOW_COUNT_THRESHOLD - 1, 500).lowCounts).toBe(true);
    expect(computeHardnessRatio(500, 500).lowCounts).toBe(false);
  });

  it("rejects negative counts and all-zero counts", () => {
    expect(computeHardnessRatio(-1, 100).valid).toBe(false);
    expect(computeHardnessRatio(0, 0).valid).toBe(false);
  });

  it("classifies HR into the expected bands", () => {
    expect(classify(-0.8)).toBe("Very soft");
    expect(classify(-0.3)).toBe("Soft");
    expect(classify(0)).toBe("Balanced");
    expect(classify(0.3)).toBe("Hard");
    expect(classify(0.8)).toBe("Very hard");
  });

  it("toNumber parses valid numbers and rejects garbage", () => {
    expect(toNumber("42")).toBe(42);
    expect(Number.isNaN(toNumber("not a number"))).toBe(true);
  });
});
