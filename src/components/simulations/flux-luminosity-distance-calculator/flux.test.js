import { describe, it, expect } from "vitest";
import {
  L_SUN,
  fluxFromLuminosityDistance,
  luminosityFromFluxDistance,
  distanceFromFluxLuminosity,
  distanceToMeters,
  fluxToSI,
  fluxFromSI,
  relErrorFlux,
  relErrorLuminosity,
  relErrorDistance,
} from "./flux";

describe("flux-luminosity-distance-calculator", () => {
  it("matches the known solar constant (~1361 W/m^2) at Earth's distance", () => {
    const d = distanceToMeters(1, "au");
    const flux = fluxFromLuminosityDistance(L_SUN, d);
    expect(flux).toBeCloseTo(1361, 0);
  });

  it("round-trips L,d -> F -> L", () => {
    const L = 3.828e27;
    const d = distanceToMeters(10, "pc");
    const F = fluxFromLuminosityDistance(L, d);
    expect(luminosityFromFluxDistance(F, d)).toBeCloseTo(L, 6);
  });

  it("round-trips F,L -> d -> F", () => {
    const F = 1e-12;
    const L = 3.828e26;
    const d = distanceFromFluxLuminosity(F, L);
    expect(fluxFromLuminosityDistance(L, d)).toBeCloseTo(F, 20);
  });

  it("doubling the distance quarters the flux (inverse-square law)", () => {
    const L = L_SUN;
    const near = fluxFromLuminosityDistance(L, distanceToMeters(1, "pc"));
    const far = fluxFromLuminosityDistance(L, distanceToMeters(2, "pc"));
    expect(near / far).toBeCloseTo(4, 9);
  });

  it("cgs/SI flux unit conversion round-trips, and matches 1 W/m^2 = 1e3 erg/s/cm^2", () => {
    const si = 1361;
    const cgs = fluxFromSI(si, "cgs");
    expect(cgs).toBeCloseTo(si * 1e3, 6);
    expect(fluxToSI(cgs, "cgs")).toBeCloseTo(si, 9);
  });

  it("error propagation: flux uncertainty combines L and d^2 relative errors in quadrature", () => {
    expect(relErrorFlux(0.1, 0)).toBeCloseTo(0.1, 9);
    expect(relErrorFlux(0, 0.1)).toBeCloseTo(0.2, 9); // d enters squared
    expect(relErrorFlux(0.03, 0.04)).toBeCloseTo(Math.sqrt(0.03 ** 2 + (2 * 0.04) ** 2), 9);
  });

  it("error propagation: distance uncertainty is half of flux+luminosity relative errors (sqrt law)", () => {
    expect(relErrorDistance(0.1, 0)).toBeCloseTo(0.05, 9);
    expect(relErrorDistance(0, 0.1)).toBeCloseTo(0.05, 9);
  });

  it("error propagation functions agree with the general power-law formula", () => {
    const relL = 0.05;
    const relD = 0.02;
    expect(relErrorLuminosity(relL, relD)).toBeCloseTo(Math.sqrt(relL ** 2 + (2 * relD) ** 2), 9);
  });
});
