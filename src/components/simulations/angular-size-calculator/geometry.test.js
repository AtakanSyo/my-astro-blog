import { describe, it, expect } from "vitest";
import {
  M_PER_AU,
  M_PER_LY,
  angleToRad,
  radToAngle,
  lengthToMeters,
  metersToLength,
  exactThetaFromSizeDistance,
  exactDiameterFromAngleDistance,
  exactDistanceFromAngleSize,
  smallAngleTheta,
  approxQuality,
} from "./geometry";

describe("angular-size-calculator geometry", () => {
  it("matches the Moon's known angular size (~31 arcmin)", () => {
    const D = lengthToMeters(3474.8, "km");
    const d = lengthToMeters(384400, "km");
    const { valid, theta } = exactThetaFromSizeDistance(D, d);

    expect(valid).toBe(true);
    expect(radToAngle(theta, "arcmin")).toBeCloseTo(31.08, 1);
  });

  it("round-trips diameter -> theta -> diameter for an arbitrary object", () => {
    const D = 1.2e9; // metres
    const d = 5e10; // metres

    const { theta } = exactThetaFromSizeDistance(D, d);
    const { valid, D: roundTripD } = exactDiameterFromAngleDistance(theta, d);

    expect(valid).toBe(true);
    expect(roundTripD).toBeCloseTo(D, 6);
  });

  it("round-trips theta -> distance -> theta for an arbitrary angle", () => {
    const theta = angleToRad(2.5, "deg");
    const D = 4e8;

    const { d } = exactDistanceFromAngleSize(theta, D);
    const { valid, theta: roundTripTheta } = exactThetaFromSizeDistance(D, d);

    expect(valid).toBe(true);
    expect(roundTripTheta).toBeCloseTo(theta, 12);
  });

  it("rejects non-positive size/distance inputs", () => {
    expect(exactThetaFromSizeDistance(0, 10)).toEqual({ valid: false });
    expect(exactThetaFromSizeDistance(10, -5)).toEqual({ valid: false });
  });

  it("rejects an angle outside (0, 180deg)", () => {
    const result = exactDiameterFromAngleDistance(Math.PI, 10);
    expect(result.valid).toBe(false);
  });

  it("converges to the small-angle approximation for small theta", () => {
    const D = 1000; // metres
    const d = 1e9; // metres, D << d so theta is tiny

    const { theta: exactTheta } = exactThetaFromSizeDistance(D, d);
    const approxTheta = smallAngleTheta(D, d);

    expect(exactTheta).toBeCloseTo(approxTheta, 9);
  });

  it("classifies approximation quality by percent error", () => {
    expect(approxQuality(0.5).label).toBe("Excellent");
    expect(approxQuality(3).label).toBe("Good");
    expect(approxQuality(10).label).toBe("Use with caution");
    expect(approxQuality(50).label).toBe("Not valid here");
  });

  it("round-trips length unit conversions (AU, ly)", () => {
    expect(metersToLength(M_PER_AU, "au")).toBeCloseTo(1, 9);
    expect(metersToLength(M_PER_LY, "ly")).toBeCloseTo(1, 9);
    expect(lengthToMeters(metersToLength(5e15, "ly"), "ly")).toBeCloseTo(5e15, 3);
  });
});
