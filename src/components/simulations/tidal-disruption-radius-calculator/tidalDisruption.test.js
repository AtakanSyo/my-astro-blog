import { describe, it, expect } from "vitest";
import {
  G,
  C,
  M_SUN,
  R_SUN_M,
  tidalDisruptionRadiusM,
  schwarzschildRadiusM,
  crossoverMassKg,
  massToKg,
  radiusFromMeters,
} from "./tidalDisruption";

describe("tidal-disruption-radius-calculator", () => {
  it("a Sun-like star near Sgr A* gives a tidal radius comparable to published TDE-radius estimates", () => {
    // Sgr A* mass 4.297e6 M☉ (GRAVITY Collaboration 2019); Sun's mass and
    // radius from the IAU nominal solar constants.
    const bhMassKg = massToKg(4.297e6, "msun");
    const rtM = tidalDisruptionRadiusM(R_SUN_M, bhMassKg, M_SUN);
    const rtAu = radiusFromMeters(rtM, "m") / 149597870700;
    // ~162 R☉ ≈ 0.76 AU — in the same ballpark (same order of magnitude,
    // within a factor of a few) as tidal-radius figures commonly quoted
    // for solar-type stars disrupted by Sgr A*-mass black holes.
    expect(rtAu).toBeGreaterThan(0.3);
    expect(rtAu).toBeLessThan(2);
  });

  it("doubling the black hole mass multiplies r_t by exactly 2^(1/3)", () => {
    const rt1 = tidalDisruptionRadiusM(R_SUN_M, M_SUN, M_SUN);
    const rt2 = tidalDisruptionRadiusM(R_SUN_M, 2 * M_SUN, M_SUN);
    expect(rt2 / rt1).toBeCloseTo(Math.cbrt(2), 9);
  });

  it("r_t scales linearly with star radius at fixed masses", () => {
    const rtSmall = tidalDisruptionRadiusM(R_SUN_M, 1e6 * M_SUN, M_SUN);
    const rtBig = tidalDisruptionRadiusM(3 * R_SUN_M, 1e6 * M_SUN, M_SUN);
    expect(rtBig / rtSmall).toBeCloseTo(3, 9);
  });

  it("r_t/r_s decreases as black hole mass increases, eventually dropping below 1 (swallowed whole)", () => {
    const ratioAt = (bhMassSolar) => {
      const bhMassKg = bhMassSolar * M_SUN;
      return tidalDisruptionRadiusM(R_SUN_M, bhMassKg, M_SUN) / schwarzschildRadiusM(bhMassKg);
    };
    const ratioLow = ratioAt(10);
    const ratioMid = ratioAt(1e6);
    const ratioHigh = ratioAt(1e10);
    expect(ratioLow).toBeGreaterThan(ratioMid);
    expect(ratioMid).toBeGreaterThan(ratioHigh);
    expect(ratioLow).toBeGreaterThan(1); // real TDE regime
    expect(ratioHigh).toBeLessThan(1); // swallowed-whole regime
  });

  it("crossoverMassKg locates the mass where r_t exactly equals r_s", () => {
    const mCross = crossoverMassKg(R_SUN_M, M_SUN);
    const rt = tidalDisruptionRadiusM(R_SUN_M, mCross, M_SUN);
    const rs = schwarzschildRadiusM(mCross);
    expect(rt / rs).toBeCloseTo(1, 6);
    // The commonly cited approximate threshold for a Sun-like star is
    // roughly 10^8 M☉ (see e.g. general TDE-detectability discussions);
    // this derived crossover should land in that same order-of-magnitude
    // neighborhood, not an arbitrary value.
    const mCrossSolar = mCross / M_SUN;
    expect(mCrossSolar).toBeGreaterThan(1e7);
    expect(mCrossSolar).toBeLessThan(1e9);
  });

  it("just below the crossover mass, r_t > r_s; just above it, r_t < r_s", () => {
    const mCross = crossoverMassKg(R_SUN_M, M_SUN);
    const below = mCross * 0.5;
    const above = mCross * 2;
    expect(tidalDisruptionRadiusM(R_SUN_M, below, M_SUN)).toBeGreaterThan(schwarzschildRadiusM(below));
    expect(tidalDisruptionRadiusM(R_SUN_M, above, M_SUN)).toBeLessThan(schwarzschildRadiusM(above));
  });

  it("schwarzschildRadiusM matches the standard r_s = 2GM/c^2 figure for the Sun (~2.95 km)", () => {
    const rsKm = schwarzschildRadiusM(M_SUN) / 1000;
    expect(rsKm).toBeCloseTo(2.9532, 3);
  });

  it("edge case: zero star mass gives an infinite tidal radius (division by zero)", () => {
    const rt = tidalDisruptionRadiusM(R_SUN_M, M_SUN, 0);
    expect(rt).toBe(Infinity);
  });

  it("edge case: zero black hole mass gives a zero tidal radius", () => {
    const rt = tidalDisruptionRadiusM(R_SUN_M, 0, M_SUN);
    expect(rt).toBe(0);
  });

  it("edge case: zero star radius gives a zero tidal radius regardless of masses", () => {
    const rt = tidalDisruptionRadiusM(0, 1e6 * M_SUN, M_SUN);
    expect(rt).toBe(0);
  });

  it("edge case: negative black hole mass is not rejected, giving an unphysical negative r_t", () => {
    const rt = tidalDisruptionRadiusM(R_SUN_M, -M_SUN, M_SUN);
    expect(Number.isFinite(rt)).toBe(true);
    expect(rt).toBeLessThan(0);
  });

  it("edge case: crossoverMassKg returns NaN for non-positive star radius or mass", () => {
    expect(Number.isNaN(crossoverMassKg(0, M_SUN))).toBe(true);
    expect(Number.isNaN(crossoverMassKg(R_SUN_M, 0))).toBe(true);
    expect(Number.isNaN(crossoverMassKg(-R_SUN_M, M_SUN))).toBe(true);
  });
});
