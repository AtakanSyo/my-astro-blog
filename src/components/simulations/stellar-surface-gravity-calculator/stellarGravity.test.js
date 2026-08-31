import { describe, it, expect } from "vitest";
import {
  M_SUN,
  R_SUN,
  surfaceGravitySI,
  surfaceGravityCGS,
  logG,
  LOG_G_SUN,
  classifyLogG,
} from "./stellarGravity";

describe("stellar-surface-gravity-calculator", () => {
  it("matches the well-known solar log g ~= 4.44", () => {
    expect(LOG_G_SUN).toBeCloseTo(4.44, 1);
  });

  it("computes the Sun's own surface gravity consistently via the SI path", () => {
    const gSI = surfaceGravitySI(M_SUN, R_SUN);
    const gCGS = surfaceGravityCGS(gSI);
    expect(logG(gCGS)).toBeCloseTo(LOG_G_SUN, 9);
  });

  it("doubling radius quarters surface gravity (inverse-square law)", () => {
    const near = surfaceGravitySI(M_SUN, R_SUN);
    const far = surfaceGravitySI(M_SUN, 2 * R_SUN);
    expect(near / far).toBeCloseTo(4, 6);
  });

  it("doubling mass doubles surface gravity", () => {
    const g1 = surfaceGravitySI(M_SUN, R_SUN);
    const g2 = surfaceGravitySI(2 * M_SUN, R_SUN);
    expect(g2 / g1).toBeCloseTo(2, 9);
  });

  it("classifies a white dwarf-like log g correctly", () => {
    expect(classifyLogG(8).label).toBe("White dwarf");
    expect(classifyLogG(LOG_G_SUN).label).toBe("Dwarf (main sequence)");
    expect(classifyLogG(1).label).toBe("Giant");
    expect(classifyLogG(10).label).toBe("Neutron star (or denser)");
  });

  it("returns null for non-finite input", () => {
    expect(classifyLogG(NaN)).toBeNull();
  });
});
