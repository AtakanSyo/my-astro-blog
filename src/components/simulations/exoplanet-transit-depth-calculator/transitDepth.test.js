import { describe, it, expect } from "vitest";
import {
  transitDepth,
  planetRadiusFromDepth,
  depthToMillimag,
  planetRadiusToMeters,
  starRadiusToMeters,
} from "./transitDepth";

describe("exoplanet-transit-depth-calculator", () => {
  it("matches the well-known ~1% depth for a Jupiter-size planet transiting a Sun-size star", () => {
    const rPlanet = planetRadiusToMeters(1, "rjup");
    const rStar = starRadiusToMeters(1, "rsun");
    const depth = transitDepth(rPlanet, rStar);
    expect(depth).toBeCloseTo(0.0106, 3); // ~1.06%
  });

  it("round-trips depth -> planet radius -> depth", () => {
    const rStar = starRadiusToMeters(1, "rsun");
    const depth = 0.005;
    const rPlanet = planetRadiusFromDepth(depth, rStar);
    expect(transitDepth(rPlanet, rStar)).toBeCloseTo(depth, 12);
  });

  it("a planet the same size as its star gives a depth of 1", () => {
    const r = starRadiusToMeters(1, "rsun");
    expect(transitDepth(r, r)).toBe(1);
  });

  it("depth scales with the square of the radius ratio", () => {
    const rStar = starRadiusToMeters(1, "rsun");
    const small = transitDepth(planetRadiusToMeters(1, "rearth"), rStar);
    const double = transitDepth(planetRadiusToMeters(2, "rearth"), rStar);
    expect(double / small).toBeCloseTo(4, 6);
  });

  it("depthToMillimag increases with depth and is well-defined below depth=1", () => {
    expect(depthToMillimag(0)).toBeCloseTo(0, 9);
    expect(depthToMillimag(0.5)).toBeGreaterThan(depthToMillimag(0.1));
    expect(depthToMillimag(1)).toBe(Infinity);
  });
});
