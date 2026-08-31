import { describe, it, expect } from "vitest";
import {
  T_SUN_YR,
  lifetimeFromMass,
  massFromLifetime,
  yearsToUnit,
  yearsFromUnit,
  pickYearUnitKey,
  classifyByMass,
} from "./mainSequenceLifetime";

describe("main-sequence-lifetime-calculator", () => {
  it("a 1-solar-mass star gets the calibration lifetime (~10 billion years)", () => {
    expect(lifetimeFromMass(1)).toBeCloseTo(T_SUN_YR, 0);
  });

  it("more massive stars live dramatically shorter lives", () => {
    const sun = lifetimeFromMass(1);
    const tenSolar = lifetimeFromMass(10);
    expect(tenSolar).toBeLessThan(sun);
    // t ~ M^-2.5, so a 10x mass star lives 10^2.5 (~316x) shorter
    expect(sun / tenSolar).toBeCloseTo(Math.pow(10, 2.5), 6);
  });

  it("round-trips mass -> lifetime -> mass", () => {
    const mSolar = 3.2;
    const t = lifetimeFromMass(mSolar);
    expect(massFromLifetime(t)).toBeCloseTo(mSolar, 9);
  });

  it("year-unit conversions round-trip", () => {
    const gyr = 4.5;
    const yr = yearsFromUnit(gyr, "gyr");
    expect(yearsToUnit(yr, "gyr")).toBeCloseTo(gyr, 9);
    expect(yr).toBeCloseTo(4.5e9, 0);
  });

  it("pickYearUnitKey picks the largest unit that still keeps the value >= 1", () => {
    expect(pickYearUnitKey(5e9)).toBe("gyr");
    expect(pickYearUnitKey(5e6)).toBe("myr");
    expect(pickYearUnitKey(0.5)).toBe("yr");
  });

  it("classifyByMass labels the Sun as G-type", () => {
    expect(classifyByMass(1).label).toMatch(/G-type/);
  });

  it("classifyByMass flags sub-hydrogen-fusion masses as not a true star", () => {
    expect(classifyByMass(0.05).tone).toBe("warn");
  });
});
