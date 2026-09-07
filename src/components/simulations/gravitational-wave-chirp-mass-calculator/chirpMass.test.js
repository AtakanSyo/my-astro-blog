import { describe, it, expect } from "vitest";
import {
  G,
  C,
  SOLAR_MASS_KG,
  chirpMass,
  totalMass,
  massRatio,
  symmetricMassRatio,
  reducedMass,
  iscoFrequency,
  gwFrequency,
  timeToMerger,
  massToKg,
  massFromKg,
} from "./chirpMass";

describe("gravitational-wave-chirp-mass-calculator", () => {
  it("reproduces the well-known ~26.1 M☉ chirp mass for two 30 M☉ black holes (GW150914-like)", () => {
    const mc = chirpMass(30, 30);
    expect(mc).toBeCloseTo(26.1, 1);
  });

  it("reproduces the ~1.19 M☉ chirp mass for a GW170817-like neutron star pair", () => {
    // Representative component masses from the GW170817 discovery paper
    // (Abbott et al. 2017, PRL 119, 161101), low-spin-prior source-frame
    // estimates: m1 ~ 1.46 M☉, m2 ~ 1.27 M☉. The paper's own reported
    // chirp mass is 1.188 (+0.004/-0.002) M☉ (detector frame).
    const mc = chirpMass(1.46, 1.27);
    expect(mc).toBeCloseTo(1.19, 1);
  });

  it("is invariant under swapping M1 and M2 (symmetry)", () => {
    expect(chirpMass(30, 8)).toBeCloseTo(chirpMass(8, 30), 12);
    expect(chirpMass(1.46, 1.27)).toBeCloseTo(chirpMass(1.27, 1.46), 12);
  });

  it("equal masses give the maximum possible chirp-mass fraction of total mass, M_c = M / 2^(1/5)", () => {
    const M = 42;
    expect(chirpMass(M, M)).toBeCloseTo(M / Math.pow(2, 1 / 5), 10);
  });

  it("total mass is the simple sum", () => {
    expect(totalMass(30, 30)).toBe(60);
    expect(totalMass(5, 50)).toBe(55);
  });

  it("mass ratio q = M2/M1", () => {
    expect(massRatio(50, 5)).toBeCloseTo(0.1, 10);
    expect(massRatio(30, 30)).toBe(1);
  });

  it("symmetric mass ratio eta peaks at 0.25 for equal masses and is smaller for asymmetric pairs", () => {
    expect(symmetricMassRatio(30, 30)).toBeCloseTo(0.25, 10);
    expect(symmetricMassRatio(5, 50)).toBeLessThan(0.25);
  });

  it("reduced mass matches the standard mu = M1 M2 / (M1+M2) formula", () => {
    expect(reducedMass(30, 30)).toBeCloseTo(15, 10);
    expect(reducedMass(5, 50)).toBeCloseTo((5 * 50) / 55, 10);
  });

  it("mass unit conversion round-trips between solar masses and kilograms", () => {
    const kg = massToKg(30, "msun");
    expect(kg).toBeCloseTo(30 * SOLAR_MASS_KG, 6);
    expect(massFromKg(kg, "msun")).toBeCloseTo(30, 9);
    expect(massToKg(5, "kg")).toBe(5);
  });

  it("ISCO frequency estimate scales inversely with total mass", () => {
    const fLight = iscoFrequency(10 * SOLAR_MASS_KG);
    const fHeavy = iscoFrequency(100 * SOLAR_MASS_KG);
    expect(fHeavy).toBeCloseTo(fLight / 10, 6);
  });

  it("ISCO frequency for a GW150914-like 60 M☉ total mass lands in the tens-of-Hz range LIGO actually observed", () => {
    const f = iscoFrequency(60 * SOLAR_MASS_KG);
    expect(f).toBeGreaterThan(30);
    expect(f).toBeLessThan(200);
  });

  it("gwFrequency increases as time-to-merger shrinks — the actual 'chirp'", () => {
    const mcKg = massToKg(chirpMass(30, 30), "msun");
    const fEarly = gwFrequency(1, mcKg); // 1 second before merger
    const fLate = gwFrequency(0.01, mcKg); // 10 ms before merger
    expect(fLate).toBeGreaterThan(fEarly);
  });

  it("gwFrequency near ~0.2 s before merger for a GW150914-like system is close to the ~35 Hz LIGO actually saw", () => {
    const mcKg = massToKg(chirpMass(30, 30), "msun");
    const f = gwFrequency(0.2, mcKg);
    expect(f).toBeGreaterThan(25);
    expect(f).toBeLessThan(45);
  });

  it("timeToMerger is the inverse of gwFrequency", () => {
    const mcKg = massToKg(chirpMass(30, 30), "msun");
    const f = gwFrequency(0.15, mcKg);
    const tau = timeToMerger(f, mcKg);
    expect(tau).toBeCloseTo(0.15, 6);
  });

  it("edge case: zero mass gives zero chirp mass (not rejected — pure algebra)", () => {
    expect(chirpMass(0, 30)).toBe(0);
  });

  it("edge case: a negative mass gives NaN (fractional power of a negative product)", () => {
    expect(Number.isNaN(chirpMass(-30, 30))).toBe(true);
  });

  it("edge case: zero primary mass sends the mass ratio to Infinity", () => {
    expect(massRatio(0, 30)).toBe(Infinity);
  });

  it("edge case: both masses zero sends the symmetric mass ratio to NaN (0/0)", () => {
    expect(Number.isNaN(symmetricMassRatio(0, 0))).toBe(true);
  });

  it("edge case: gwFrequency diverges to Infinity exactly at merger (tau = 0)", () => {
    const mcKg = massToKg(26.1, "msun");
    expect(gwFrequency(0, mcKg)).toBe(Infinity);
  });

  it("uses standard physical constants (G, c)", () => {
    expect(G).toBeCloseTo(6.6743e-11, 15);
    expect(C).toBe(299792458);
  });
});
