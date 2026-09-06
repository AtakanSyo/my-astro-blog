import { describe, it, expect } from "vitest";
import {
  C_KM_S,
  distanceToMpc,
  distanceFromMpc,
  velocityToKms,
  velocityFromKms,
  velocityFromDistance,
  distanceFromVelocity,
  velocityFractionOfC,
  getValidityLevel,
} from "./hubbleLaw";

describe("hubble-law-calculator", () => {
  it("matches the classic v = H0 * d relation at H0 = 70", () => {
    const v = velocityFromDistance(10, 70);
    expect(v).toBeCloseTo(700, 9);
  });

  it("round-trips distance -> velocity -> distance", () => {
    const H0 = 67.4;
    const d = 42.3;
    const v = velocityFromDistance(d, H0);
    expect(distanceFromVelocity(v, H0)).toBeCloseTo(d, 9);
  });

  it("round-trips velocity -> distance -> velocity", () => {
    const H0 = 73;
    const v = 5000;
    const d = distanceFromVelocity(v, H0);
    expect(velocityFromDistance(d, H0)).toBeCloseTo(v, 9);
  });

  it("a larger H0 predicts a larger velocity for the same distance", () => {
    const d = 16.5;
    expect(velocityFromDistance(d, 73)).toBeGreaterThan(velocityFromDistance(d, 67));
  });

  it("converts Mpc <-> million light-years consistently", () => {
    const mly = distanceFromMpc(1, "mly");
    expect(mly).toBeCloseTo(3.26156, 4);
    expect(distanceToMpc(mly, "mly")).toBeCloseTo(1, 9);
  });

  it("distanceToMpc is the identity for the mpc unit itself", () => {
    expect(distanceToMpc(16.5, "mpc")).toBe(16.5);
    expect(distanceFromMpc(16.5, "mpc")).toBe(16.5);
  });

  it("converts km/s <-> fraction of c consistently", () => {
    const kms = velocityToKms(0.1, "c");
    expect(kms).toBeCloseTo(29979.2458, 4);
    expect(velocityFromKms(kms, "c")).toBeCloseTo(0.1, 9);
  });

  it("velocityFractionOfC matches a direct division by c", () => {
    expect(velocityFractionOfC(C_KM_S)).toBeCloseTo(1, 9);
    expect(velocityFractionOfC(C_KM_S / 2)).toBeCloseTo(0.5, 9);
  });

  it("flags validity levels around the low-redshift approximation limits", () => {
    // Well within the linear regime: a Virgo-Cluster-like recession speed.
    expect(getValidityLevel(1100)).toBe("ok");
    // Comfortably past 10% of c but under 20%.
    expect(getValidityLevel(0.15 * C_KM_S)).toBe("warn");
    // Past 20% of c: the linear approximation has clearly broken down.
    expect(getValidityLevel(0.25 * C_KM_S)).toBe("bad");
    // Boundary values themselves should not be flagged as "bad"/"warn" yet
    // (strictly greater-than semantics).
    expect(getValidityLevel(0.1 * C_KM_S)).toBe("ok");
    expect(getValidityLevel(0.2 * C_KM_S)).toBe("warn");
  });

  it("validity is symmetric for negative (blueshifted / approaching) velocities", () => {
    expect(getValidityLevel(-0.25 * C_KM_S)).toBe("bad");
  });
});
