import { describe, it, expect } from "vitest";
import {
  M_PER_AU,
  M_PER_PC,
  M_PER_LY,
  distancePcFromParallaxArcsec,
  parallaxArcsecFromDistancePc,
  parallaxToArcsec,
  distanceToMeters,
  metersToDistance,
  parallaxReliability,
} from "./parallax";

describe("parallax-distance-calculator", () => {
  it("a parsec is, by definition, ~206,265 AU", () => {
    expect(M_PER_PC / M_PER_AU).toBeCloseTo(206264.8, 0);
  });

  it("a parsec is, by definition, ~3.26 light-years", () => {
    expect(M_PER_PC / M_PER_LY).toBeCloseTo(3.2616, 3);
  });

  it("matches Proxima Centauri's known distance (~1.30 pc) from its real parallax", () => {
    const proximaParallaxArcsec = 0.7687;
    expect(distancePcFromParallaxArcsec(proximaParallaxArcsec)).toBeCloseTo(1.301, 2);
  });

  it("round-trips parallax -> distance -> parallax", () => {
    const p = 0.05;
    const d = distancePcFromParallaxArcsec(p);
    expect(parallaxArcsecFromDistancePc(d)).toBeCloseTo(p, 12);
  });

  it("1 arcsecond of parallax is, by definition, exactly 1 parsec away", () => {
    expect(distancePcFromParallaxArcsec(1)).toBe(1);
  });

  it("milliarcsecond/microarcsecond parallax units convert correctly", () => {
    expect(parallaxToArcsec(1000, "mas")).toBeCloseTo(1, 9);
    expect(parallaxToArcsec(1e6, "uas")).toBeCloseTo(1, 9);
  });

  it("distance unit conversions round-trip", () => {
    const pc = 10;
    const m = distanceToMeters(pc, "pc");
    expect(metersToDistance(m, "pc")).toBeCloseTo(pc, 9);
  });

  it("flags large fractional parallax uncertainty as unreliable", () => {
    expect(parallaxReliability(0.05).label).toBe("Reliable");
    expect(parallaxReliability(0.15).label).toBe("Use with caution");
    expect(parallaxReliability(0.5).label).toBe("Simple inversion unreliable");
  });
});
