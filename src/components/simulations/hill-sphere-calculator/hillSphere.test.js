import { describe, it, expect } from "vitest";
import {
  M_SUN,
  M_EARTH,
  hillRadius,
  hillRadiusPeriapsis,
  massToKg,
  distanceToMeters,
  distanceFromMeters,
} from "./hillSphere";

describe("hill-sphere-calculator", () => {
  it("matches Earth's known Hill sphere radius (~1.5 million km)", () => {
    const a = distanceToMeters(1, "au");
    const rH = hillRadius(a, M_EARTH, M_SUN);
    expect(distanceFromMeters(rH, "km") / 1e6).toBeCloseTo(1.5, 1);
  });

  it("a more massive satellite has a larger Hill sphere, all else equal", () => {
    const a = distanceToMeters(1, "au");
    const small = hillRadius(a, M_EARTH, M_SUN);
    const big = hillRadius(a, 10 * M_EARTH, M_SUN);
    expect(big).toBeGreaterThan(small);
  });

  it("a more massive primary shrinks the Hill sphere", () => {
    const a = distanceToMeters(1, "au");
    const normal = hillRadius(a, M_EARTH, M_SUN);
    const heavierStar = hillRadius(a, M_EARTH, 10 * M_SUN);
    expect(heavierStar).toBeLessThan(normal);
  });

  it("Hill radius scales linearly with semi-major axis", () => {
    const rNear = hillRadius(distanceToMeters(1, "au"), M_EARTH, M_SUN);
    const rFar = hillRadius(distanceToMeters(2, "au"), M_EARTH, M_SUN);
    expect(rFar / rNear).toBeCloseTo(2, 9);
  });

  it("periapsis (eccentric) Hill radius reduces to the circular one at e=0", () => {
    const a = distanceToMeters(1, "au");
    const circular = hillRadius(a, M_EARTH, M_SUN);
    const eccentricAtZero = hillRadiusPeriapsis(a, M_EARTH, M_SUN, 0);
    expect(eccentricAtZero).toBeCloseTo(circular, 9);
  });

  it("a more eccentric orbit shrinks the conservative Hill radius", () => {
    const a = distanceToMeters(1, "au");
    const low = hillRadiusPeriapsis(a, M_EARTH, M_SUN, 0.1);
    const high = hillRadiusPeriapsis(a, M_EARTH, M_SUN, 0.5);
    expect(high).toBeLessThan(low);
  });

  it("massToKg round-trips a known unit", () => {
    expect(massToKg(1, "mearth")).toBe(M_EARTH);
  });
});
