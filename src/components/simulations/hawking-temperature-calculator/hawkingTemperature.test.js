import { describe, it, expect } from "vitest";
import {
  hawkingTemperature,
  massAtHawkingTemperature,
  massToKg,
  massFromKg,
  CMB_TEMPERATURE_K,
  MASS_UNITS,
} from "./hawkingTemperature";

describe("hawking-temperature-calculator", () => {
  it("matches the well-known ~6.17e-8 K Hawking temperature for a 1 solar-mass black hole", () => {
    const massKg = massToKg(1, "msun");
    const t = hawkingTemperature(massKg);
    expect(t).toBeCloseTo(6.17e-8, 9);
    // relative check too, since toBeCloseTo's fixed digit count is a bit
    // coarse for numbers this small
    expect(Math.abs(t - 6.17e-8) / 6.17e-8).toBeLessThan(0.01);
  });

  it("converts mass units to and from kg correctly", () => {
    expect(massToKg(1, "msun")).toBe(1.98892e30);
    expect(massToKg(1, "mearth")).toBe(5.972e24);
    expect(massToKg(1, "kg")).toBe(1);
    expect(massFromKg(1.98892e30, "msun")).toBeCloseTo(1, 9);
  });

  it("round-trips value -> kg -> value for every mass unit", () => {
    for (const unit of Object.keys(MASS_UNITS)) {
      const value = 3.5;
      const kg = massToKg(value, unit);
      expect(massFromKg(kg, unit)).toBeCloseTo(value, 9);
    }
  });

  it("is inversely proportional to mass: doubling mass halves temperature", () => {
    const massKg = massToKg(1, "msun");
    const t1 = hawkingTemperature(massKg);
    const t2 = hawkingTemperature(massKg * 2);
    expect(t1 / t2).toBeCloseTo(2, 6);
  });

  it("smaller mass means higher temperature (monotonic, strictly decreasing in M)", () => {
    const masses = [1e-8, 1, 1e12, 1e22, 1.98892e30, 1e40].map((m) => m);
    const temps = masses.map((m) => hawkingTemperature(m));
    for (let i = 1; i < temps.length; i++) {
      expect(temps[i]).toBeLessThan(temps[i - 1]);
    }
  });

  it("a hypothetical ~1e12 kg black hole is dramatically hotter than a stellar-mass one", () => {
    const stellarT = hawkingTemperature(massToKg(10, "msun"));
    const tinyT = hawkingTemperature(1e12);
    expect(tinyT).toBeGreaterThan(stellarT * 1e15);
  });

  it("a supermassive black hole (Sgr A*-scale, ~4.3e6 solar masses) is colder than the CMB", () => {
    const t = hawkingTemperature(massToKg(4.3e6, "msun"));
    expect(t).toBeLessThan(CMB_TEMPERATURE_K);
  });

  it("massAtHawkingTemperature is the inverse of hawkingTemperature", () => {
    const massKg = massToKg(1, "msun");
    const t = hawkingTemperature(massKg);
    const recoveredMass = massAtHawkingTemperature(t);
    expect(Math.abs(recoveredMass - massKg) / massKg).toBeLessThan(1e-9);
  });

  it("the mass at which Hawking temperature equals the CMB temperature is far below any known astrophysical black hole", () => {
    const massKg = massAtHawkingTemperature(CMB_TEMPERATURE_K);
    // roughly 4.5e22 kg — far smaller than even the ~3 solar-mass floor
    // of known astrophysical black holes
    expect(massKg).toBeGreaterThan(0);
    expect(massKg).toBeLessThan(massToKg(3, "msun"));
  });

  it("handles non-positive mass as an invalid (NaN) input", () => {
    expect(Number.isNaN(hawkingTemperature(0))).toBe(true);
    expect(Number.isNaN(hawkingTemperature(-5))).toBe(true);
  });

  it("handles non-positive temperature as an invalid (NaN) input for the inverse", () => {
    expect(Number.isNaN(massAtHawkingTemperature(0))).toBe(true);
    expect(Number.isNaN(massAtHawkingTemperature(-1))).toBe(true);
  });
});
