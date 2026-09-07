import { describe, it, expect } from "vitest";
import {
  KOPPARAPU_COEFFICIENTS,
  effectiveSolarFlux,
  hzDistanceAU,
  conservativeHZ,
  optimisticHZ,
  isWithinCalibratedRange,
  luminosityFromRadiusTeff,
  classifyOrbit,
} from "./habitableZone";

describe("habitable-zone-boundary-calculator", () => {
  it("reproduces Kopparapu et al. (2013)'s own worked example for the Sun (moist greenhouse 0.99 AU, maximum greenhouse 1.70 AU)", () => {
    const moist = hzDistanceAU(5780, 1, "moistGreenhouse");
    const maxGH = hzDistanceAU(5780, 1, "maximumGreenhouse");
    expect(moist).toBeCloseTo(0.99, 2);
    expect(maxGH).toBeCloseTo(1.70, 1);
  });

  it("puts Earth's 1 AU orbit inside the Sun's conservative habitable zone", () => {
    const hz = conservativeHZ(5778, 1);
    expect(hz.inner).toBeLessThan(1);
    expect(hz.outer).toBeGreaterThan(1);
    expect(classifyOrbit(1, hz, optimisticHZ(5778, 1))).toBe("in-conservative");
  });

  it("conservative HZ nests inside the optimistic HZ, for the Sun", () => {
    const cons = conservativeHZ(5778, 1);
    const opt = optimisticHZ(5778, 1);
    expect(opt.inner).toBeLessThan(cons.inner);
    expect(opt.outer).toBeGreaterThan(cons.outer);
  });

  it("reproduces the well-known TRAPPIST-1 conservative HZ scale (~0.024-0.049 AU) for its real published Teff and luminosity", () => {
    // Teff ~2559-2566 K, L ~0.000524-0.000553 Lsun are the commonly cited
    // TRAPPIST-1 parameters (Gillon et al. 2017 and follow-ups).
    const hz = conservativeHZ(2566, 0.000553);
    expect(hz.inner).toBeGreaterThan(0.02);
    expect(hz.inner).toBeLessThan(0.03);
    expect(hz.outer).toBeGreaterThan(0.04);
    expect(hz.outer).toBeLessThan(0.06);
  });

  it("flags TRAPPIST-1's real Teff as a (small) extrapolation below the paper's calibrated 2600-7200 K range", () => {
    expect(isWithinCalibratedRange(2566)).toBe(false);
    expect(isWithinCalibratedRange(5778)).toBe(true);
    expect(isWithinCalibratedRange(7000)).toBe(true);
  });

  it("HZ distance scales with sqrt(L) at fixed Teff", () => {
    const d1 = hzDistanceAU(5778, 1, "runawayGreenhouse");
    const d4 = hzDistanceAU(5778, 4, "runawayGreenhouse");
    expect(d4 / d1).toBeCloseTo(2, 6); // sqrt(4) = 2
  });

  it("a realistically brighter hot F-type star (Teff 7000 K, L~4.24 via Stefan-Boltzmann) has a farther-out HZ than the Sun", () => {
    // Using each star's own real luminosity (not a fixed L) is what
    // actually matters here — a hotter main-sequence star is also far
    // more luminous, and that luminosity increase dominates.
    const sun = conservativeHZ(5778, 1);
    const fStar = conservativeHZ(7000, luminosityFromRadiusTeff(1.4, 7000));
    expect(fStar.inner).toBeGreaterThan(sun.inner);
    expect(fStar.outer).toBeGreaterThan(sun.outer);
  });

  it("documents a real, non-obvious Kopparapu feature: at a FIXED luminosity, S_eff for the runaway-greenhouse boundary is not simply flat with Teff (bluer starlight is scattered more efficiently, shifting how much flux a planet can tolerate) — so the fixed-L HZ distance is not monotonic with Teff the way a naive T^4-flux intuition would suggest", () => {
    const seffCool = effectiveSolarFlux(3000, "runawayGreenhouse");
    const seffSun = effectiveSolarFlux(5780, "runawayGreenhouse");
    const seffHot = effectiveSolarFlux(7000, "runawayGreenhouse");
    // S_eff climbs from cool M dwarf through the Sun to a hot F star —
    // meaning, at a fixed luminosity, the runaway-greenhouse edge
    // actually sits closer in for a hotter star, not farther out.
    expect(seffSun).toBeGreaterThan(seffCool);
    expect(seffHot).toBeGreaterThan(seffSun);
  });

  it("Stefan-Boltzmann luminosity derivation matches L=1 for a Sun-like star", () => {
    expect(luminosityFromRadiusTeff(1, 5772)).toBeCloseTo(1, 6);
  });

  it("Stefan-Boltzmann luminosity derivation scales as R^2 * Teff^4", () => {
    const base = luminosityFromRadiusTeff(1, 5772);
    const doubledRadius = luminosityFromRadiusTeff(2, 5772);
    expect(doubledRadius / base).toBeCloseTo(4, 6);
  });

  it("classifies a too-close planet as too-hot, and a too-far planet as too-cold", () => {
    const cons = conservativeHZ(5778, 1);
    const opt = optimisticHZ(5778, 1);
    expect(classifyOrbit(0.3, cons, opt)).toBe("too-hot");
    expect(classifyOrbit(5, cons, opt)).toBe("too-cold");
  });

  it("classifies the optimistic-only marginal bands correctly", () => {
    const cons = conservativeHZ(5778, 1);
    const opt = optimisticHZ(5778, 1);
    const warmMarginal = (opt.inner + cons.inner) / 2;
    const coldMarginal = (cons.outer + opt.outer) / 2;
    expect(classifyOrbit(warmMarginal, cons, opt)).toBe("optimistic-inner");
    expect(classifyOrbit(coldMarginal, cons, opt)).toBe("optimistic-outer");
  });

  it("edge case: zero or negative luminosity gives a non-positive/invalid distance, not a thrown error", () => {
    expect(hzDistanceAU(5778, 0, "runawayGreenhouse")).toBe(0);
    expect(Number.isNaN(hzDistanceAU(5778, -1, "runawayGreenhouse"))).toBe(true);
  });

  it("edge case: an unknown boundary key returns NaN rather than throwing", () => {
    expect(Number.isNaN(effectiveSolarFlux(5778, "notARealBoundary"))).toBe(true);
    expect(Number.isNaN(hzDistanceAU(5778, 1, "notARealBoundary"))).toBe(true);
  });

  it("edge case: classifyOrbit rejects non-positive orbital distance as invalid", () => {
    const cons = conservativeHZ(5778, 1);
    const opt = optimisticHZ(5778, 1);
    expect(classifyOrbit(0, cons, opt)).toBe("invalid");
    expect(classifyOrbit(-1, cons, opt)).toBe("invalid");
  });

  it("has five published Kopparapu boundaries with the paper's exact S_eff☉ coefficients", () => {
    expect(KOPPARAPU_COEFFICIENTS.recentVenus.seffSun).toBe(1.7753);
    expect(KOPPARAPU_COEFFICIENTS.runawayGreenhouse.seffSun).toBe(1.0512);
    expect(KOPPARAPU_COEFFICIENTS.moistGreenhouse.seffSun).toBe(1.0140);
    expect(KOPPARAPU_COEFFICIENTS.maximumGreenhouse.seffSun).toBe(0.3438);
    expect(KOPPARAPU_COEFFICIENTS.earlyMars.seffSun).toBe(0.3179);
  });
});
