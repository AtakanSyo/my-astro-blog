import { describe, it, expect } from "vitest";
import {
  M_H,
  freeFallTime,
  numberDensityToMassDensity,
  massDensityToKgM3,
  massDensityFromKgM3,
  numberDensityToPerM3,
  timeToSeconds,
  timeFromSeconds,
  bestTimeUnit,
  collapseCurvePoint,
  collapseCurve,
  radiusFractionAtTimeFraction,
} from "./freeFall";

describe("free-fall-time-calculator", () => {
  it("matches the Sun's mean density giving a free-fall time on the order of tens of minutes", () => {
    // NASA Sun Fact Sheet mean density, 1408 kg/m^3.
    const tff = freeFallTime(1408);
    expect(timeFromSeconds(tff, "min")).toBeGreaterThan(20);
    expect(timeFromSeconds(tff, "min")).toBeLessThan(40);
  });

  it("a denser sphere collapses faster: t_ff scales as ρ^(-1/2)", () => {
    const loose = freeFallTime(1000);
    const dense = freeFallTime(8000); // 8x denser
    expect(loose / dense).toBeCloseTo(Math.sqrt(8), 6);
  });

  it("a typical molecular-cloud number density gives a free-fall time on the order of a megayear", () => {
    const n = 100 * 1e6; // 100 cm^-3 in particles/m^3
    const rho = numberDensityToMassDensity(n, 2.3);
    const tff = freeFallTime(rho);
    expect(timeFromSeconds(tff, "myr")).toBeGreaterThan(0.3);
    expect(timeFromSeconds(tff, "myr")).toBeLessThan(4);
  });

  it("mass density unit conversion round-trips", () => {
    expect(massDensityToKgM3(1, "gcm3")).toBe(1000);
    expect(massDensityFromKgM3(1000, "gcm3")).toBe(1);
  });

  it("number density unit conversion converts cm^-3 to m^-3", () => {
    expect(numberDensityToPerM3(1, "percm3")).toBe(1e6);
  });

  it("numberDensityToMassDensity multiplies by mean molecular weight and the hydrogen mass", () => {
    expect(numberDensityToMassDensity(1, 1)).toBe(M_H);
    expect(numberDensityToMassDensity(1, 2.3)).toBeCloseTo(2.3 * M_H, 30);
  });

  it("time unit conversion round-trips", () => {
    expect(timeToSeconds(1, "yr")).toBeCloseTo(365.25 * 86400, 6);
    expect(timeFromSeconds(3600, "hr")).toBe(1);
  });

  it("bestTimeUnit picks the largest unit that still reads as >= 1", () => {
    expect(bestTimeUnit(30)).toBe("s");
    expect(bestTimeUnit(90)).toBe("min");
    expect(bestTimeUnit(0.5)).toBe("ms");
  });

  it("a zero or negative density is not physical (t_ff is non-finite)", () => {
    expect(Number.isFinite(freeFallTime(0))).toBe(false);
    expect(Number.isNaN(freeFallTime(-100))).toBe(true);
  });

  it("collapse curve starts at full radius and zero time, and ends at zero radius at t_ff", () => {
    const start = collapseCurvePoint(0);
    expect(start.rFraction).toBeCloseTo(1, 9);
    expect(start.tFraction).toBeCloseTo(0, 9);

    const end = collapseCurvePoint(Math.PI);
    expect(end.rFraction).toBeCloseTo(0, 9);
    expect(end.tFraction).toBeCloseTo(1, 9);
  });

  it("collapse curve radius fraction decreases monotonically over time", () => {
    const points = collapseCurve(48);
    for (let i = 1; i < points.length; i++) {
      expect(points[i].rFraction).toBeLessThanOrEqual(points[i - 1].rFraction);
    }
  });

  it("collapse accelerates near the end: radius has barely shrunk by the time half of t_ff has passed", () => {
    // At θ=π/2 (a convenient interior point) the sphere has used ~82% of
    // its total free-fall time but its radius has only fallen to 50% —
    // i.e. more than half of the *time* remains before it reaches even
    // its halfway *radius*. This is the qualitative "slow start, fast
    // plunge" signature of free-fall collapse.
    const half = collapseCurvePoint(Math.PI / 2);
    expect(half.rFraction).toBeCloseTo(0.5, 9);
    expect(half.tFraction).toBeGreaterThan(0.8);
  });

  it("radiusFractionAtTimeFraction inverts the curve consistently with collapseCurvePoint", () => {
    const point = collapseCurvePoint(1.2);
    const inverted = radiusFractionAtTimeFraction(point.tFraction);
    expect(inverted).toBeCloseTo(point.rFraction, 6);
  });

  it("by the halfway point in time, the radius has barely shrunk (~84% remains)", () => {
    expect(radiusFractionAtTimeFraction(0.5)).toBeCloseTo(0.837, 2);
  });
});
