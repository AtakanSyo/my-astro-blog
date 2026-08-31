import { describe, it, expect } from "vitest";
import {
  TANGENTIAL_VELOCITY_CONSTANT,
  totalProperMotion,
  tangentialVelocity,
  properMotionFromVelocityDistance,
  distancePcFromVelocityProperMotion,
  totalSpaceVelocity,
} from "./properMotion";

describe("proper-motion-velocity-calculator", () => {
  it("derives the well-known 4.74047 km/s constant exactly from unit conversion", () => {
    expect(TANGENTIAL_VELOCITY_CONSTANT).toBeCloseTo(4.74047, 4);
  });

  it("Barnard's Star: known proper motion + distance give its known tangential velocity (~90 km/s)", () => {
    const muArcsecYr = 10.3396; // Barnard's Star total proper motion, arcsec/yr
    const dPc = 1.828; // Barnard's Star distance, pc
    const vt = tangentialVelocity(muArcsecYr, dPc);
    expect(vt).toBeCloseTo(90, -1); // within ~10 km/s
  });

  it("round-trips proper motion -> velocity -> proper motion", () => {
    const mu = 0.5;
    const d = 20;
    const vt = tangentialVelocity(mu, d);
    expect(properMotionFromVelocityDistance(vt, d)).toBeCloseTo(mu, 9);
  });

  it("round-trips proper motion -> velocity -> distance", () => {
    const mu = 0.5;
    const d = 20;
    const vt = tangentialVelocity(mu, d);
    expect(distancePcFromVelocityProperMotion(vt, mu)).toBeCloseTo(d, 9);
  });

  it("totalProperMotion combines RA/Dec components as a Pythagorean sum", () => {
    expect(totalProperMotion(3, 4)).toBeCloseTo(5, 9);
  });

  it("totalSpaceVelocity combines tangential and radial velocity perpendicularly", () => {
    expect(totalSpaceVelocity(3, 4)).toBeCloseTo(5, 9);
    expect(totalSpaceVelocity(10, 0)).toBe(10);
  });
});
