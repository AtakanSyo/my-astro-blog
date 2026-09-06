import { describe, it, expect } from "vitest";
import {
  MASS_UNITS,
  AGE_OF_UNIVERSE_YEARS,
  massToKg,
  massFromKg,
  evaporationTimeSeconds,
  evaporationTimeYears,
  massFromEvaporationTimeSeconds,
  massFromEvaporationTimeYears,
  ageOfUniverseMultiple,
  massEvaporatingTodayKg,
} from "./evaporationTime";

describe("black-hole-evaporation-time-calculator", () => {
  it("converts mass units to and from kilograms", () => {
    expect(massToKg(1, "msun")).toBeCloseTo(1.98892e30, -20);
    expect(massToKg(1, "mearth")).toBeCloseTo(5.972e24, -14);
    expect(massToKg(1, "kg")).toBe(1);
    expect(massFromKg(MASS_UNITS.msun.toKg, "msun")).toBeCloseTo(1, 9);
  });

  it("matches the well-known ~2.1 x 10^67 year lifetime for a 1 solar-mass black hole", () => {
    const massKg = massToKg(1, "msun");
    const years = evaporationTimeYears(massKg);
    // The raw number is astronomically large, so compare orders of
    // magnitude via log10 rather than the value itself.
    expect(Math.log10(years)).toBeCloseTo(Math.log10(2.1e67), 1);
  });

  it("evaporation time scales with the cube of the mass", () => {
    const massKg = massToKg(1, "msun");
    const tOne = evaporationTimeSeconds(massKg);
    const tDouble = evaporationTimeSeconds(2 * massKg);
    expect(tDouble / tOne).toBeCloseTo(8, 6);
  });

  it("a thousand-fold smaller mass evaporates a billion times faster", () => {
    const massKg = massToKg(1, "msun");
    const tFull = evaporationTimeSeconds(massKg);
    const tSmall = evaporationTimeSeconds(massKg / 1000);
    expect(tFull / tSmall).toBeCloseTo(1e9, 3);
  });

  it("evaporationTimeYears is evaporationTimeSeconds converted with the same ratio regardless of mass", () => {
    const m1 = massToKg(1, "mearth");
    const m2 = massToKg(3, "mearth");
    const ratioSeconds = evaporationTimeSeconds(m2) / evaporationTimeSeconds(m1);
    const ratioYears = evaporationTimeYears(m2) / evaporationTimeYears(m1);
    expect(ratioYears).toBeCloseTo(ratioSeconds, 9);
    expect(ratioYears).toBeCloseTo(27, 6); // 3^3
  });

  it("round-trips mass -> evaporation time -> mass (seconds)", () => {
    const massKg = massToKg(5, "msun");
    const tSeconds = evaporationTimeSeconds(massKg);
    const recoveredMassKg = massFromEvaporationTimeSeconds(tSeconds);
    expect(recoveredMassKg / massKg).toBeCloseTo(1, 9);
  });

  it("round-trips mass -> evaporation time -> mass (years)", () => {
    const massKg = massToKg(1, "mearth");
    const tYears = evaporationTimeYears(massKg);
    const recoveredMassKg = massFromEvaporationTimeYears(tYears);
    expect(recoveredMassKg / massKg).toBeCloseTo(1, 9);
  });

  it("ageOfUniverseMultiple divides by 13.8 billion years", () => {
    expect(ageOfUniverseMultiple(AGE_OF_UNIVERSE_YEARS)).toBeCloseTo(1, 9);
    expect(ageOfUniverseMultiple(2 * AGE_OF_UNIVERSE_YEARS)).toBeCloseTo(2, 9);
  });

  it("a 1 solar-mass black hole would take vastly longer than the age of the universe to evaporate", () => {
    const massKg = massToKg(1, "msun");
    const years = evaporationTimeYears(massKg);
    expect(ageOfUniverseMultiple(years)).toBeGreaterThan(1e50);
  });

  it("massEvaporatingTodayKg is derived from the same formula and evaporates in ~13.8 Gyr", () => {
    const mCrossKg = massEvaporatingTodayKg();
    const years = evaporationTimeYears(mCrossKg);
    expect(years).toBeCloseTo(AGE_OF_UNIVERSE_YEARS, -1);
    expect(years / AGE_OF_UNIVERSE_YEARS).toBeCloseTo(1, 6);

    // Sanity check: this crossing mass should land in the "small
    // asteroid" / classic primordial-black-hole mass range, around
    // 1e11-1e12 kg, not anywhere near a stellar mass.
    expect(mCrossKg).toBeGreaterThan(1e10);
    expect(mCrossKg).toBeLessThan(1e13);
  });

  it("massFromEvaporationTimeSeconds and massFromEvaporationTimeYears agree", () => {
    const years = 1e20;
    const seconds = years * 365.25 * 24 * 3600;
    const mFromYears = massFromEvaporationTimeYears(years);
    const mFromSeconds = massFromEvaporationTimeSeconds(seconds);
    expect(mFromYears / mFromSeconds).toBeCloseTo(1, 9);
  });

  it("a much more massive black hole (Sgr A*-scale) evaporates far slower than a stellar-mass one", () => {
    const stellarMassKg = massToKg(10, "msun");
    const sgrAMassKg = massToKg(4.3e6, "msun");
    expect(evaporationTimeYears(sgrAMassKg)).toBeGreaterThan(evaporationTimeYears(stellarMassKg));
  });

  it("handles a very small (near-zero) mass without throwing, tending toward a near-zero evaporation time", () => {
    expect(evaporationTimeSeconds(1)).toBeGreaterThan(0);
    expect(evaporationTimeSeconds(1)).toBeLessThan(evaporationTimeSeconds(1e10));
  });
});
