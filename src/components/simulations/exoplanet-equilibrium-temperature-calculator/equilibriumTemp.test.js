import { describe, it, expect } from "vitest";
import {
  T_SUN,
  R_SUN_M,
  equilibriumTemperature,
  stellarFlux,
  kelvinToCelsius,
  SOLAR_SYSTEM_LANDMARKS,
} from "./equilibriumTemp";

const M_PER_AU = 149597870700;

describe("exoplanet-equilibrium-temperature-calculator", () => {
  it("reproduces Earth's known equilibrium temperature (~255 K) using the Sun's real parameters", () => {
    const earthBondAlbedo = 0.306;
    const teq = equilibriumTemperature(T_SUN, R_SUN_M, M_PER_AU, earthBondAlbedo, "full");
    const earthLandmark = SOLAR_SYSTEM_LANDMARKS.find((p) => p.label === "Earth").k;
    expect(Math.abs(teq - earthLandmark)).toBeLessThan(2);
  });

  it("dayside-only re-radiation is hotter than full redistribution by exactly 2^(1/4)", () => {
    const full = equilibriumTemperature(T_SUN, R_SUN_M, M_PER_AU, 0.3, "full");
    const dayside = equilibriumTemperature(T_SUN, R_SUN_M, M_PER_AU, 0.3, "dayside");
    expect(dayside / full).toBeCloseTo(Math.pow(2, 0.25), 9);
  });

  it("a higher albedo means a cooler planet, all else equal", () => {
    const dark = equilibriumTemperature(T_SUN, R_SUN_M, M_PER_AU, 0.1);
    const reflective = equilibriumTemperature(T_SUN, R_SUN_M, M_PER_AU, 0.9);
    expect(reflective).toBeLessThan(dark);
  });

  it("a perfect reflector (albedo = 1) has zero equilibrium temperature", () => {
    expect(equilibriumTemperature(T_SUN, R_SUN_M, M_PER_AU, 1)).toBe(0);
  });

  it("farther orbits are colder (temperature falls off as 1/sqrt(a))", () => {
    const near = equilibriumTemperature(T_SUN, R_SUN_M, M_PER_AU, 0.3);
    const far = equilibriumTemperature(T_SUN, R_SUN_M, 4 * M_PER_AU, 0.3);
    expect(near / far).toBeCloseTo(2, 6); // sqrt(4) = 2
  });

  it("stellar flux follows the inverse-square law with distance", () => {
    const fluxNear = stellarFlux(T_SUN, R_SUN_M, M_PER_AU);
    const fluxFar = stellarFlux(T_SUN, R_SUN_M, 2 * M_PER_AU);
    expect(fluxNear / fluxFar).toBeCloseTo(4, 6);
  });

  it("kelvinToCelsius converts water's freezing point correctly", () => {
    expect(kelvinToCelsius(273.15)).toBeCloseTo(0, 9);
  });
});
