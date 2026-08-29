// Gravitational redshift: light climbing out of a mass's gravity well
// loses energy (stretches to longer wavelength) on the way out, purely
// from general relativity — no motion required.
//
// For light emitted at radius R from a spherical, non-rotating,
// uncharged (Schwarzschild) mass M and observed arbitrarily far away:
//
//   z = (1 - r_s/R)^(-1/2) - 1,   r_s = 2GM/c²
//
//   λ_obs = λ_emit (1 + z)
//
// This is only defined for R > r_s — at or inside the Schwarzschild
// radius there is no "escaping light" for this formula to describe at
// all; every future light-cone points inward, and nothing, light
// included, gets out to be redshifted. This module refuses to compute
// z there rather than return a number that looks meaningful but isn't.
//
// The formula also specifically assumes a spherical, non-rotating,
// uncharged mass (Schwarzschild geometry) and a static emitter and
// observer — a spinning (Kerr) mass or an orbiting emitter both add
// further terms this simple relation doesn't capture.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

export const G = 6.6743e-11; // m^3 kg^-1 s^-2, CODATA 2018
export const C = 299792458; // m/s, exact
export const M_SUN = 1.98847e30; // kg, IAU nominal solar mass
export const R_SUN_M = 696000000; // m, IAU 2015 nominal solar radius

export const MASS_UNITS = {
  msun: { label: "Solar masses", short: "M☉", toKg: M_SUN },
  kg: { label: "Kilograms", short: "kg", toKg: 1 },
};
export const MASS_UNIT_ORDER = ["msun", "kg"];

export const RADIUS_UNITS = {
  km: { label: "Kilometers", short: "km", toM: 1000 },
  rsun: { label: "Solar radii", short: "R☉", toM: R_SUN_M },
  m: { label: "Meters", short: "m", toM: 1 },
};
export const RADIUS_UNIT_ORDER = ["km", "rsun", "m"];

export const WAVELENGTH_UNITS = {
  nm: { label: "Nanometers", short: "nm", toM: 1e-9 },
  angstrom: { label: "Ångströms", short: "Å", toM: 1e-10 },
};
export const WAVELENGTH_UNIT_ORDER = ["nm", "angstrom"];

export function massToKg(value, unit) {
  return value * MASS_UNITS[unit].toKg;
}
export function radiusToMeters(value, unit) {
  return value * RADIUS_UNITS[unit].toM;
}
export function wavelengthToMeters(value, unit) {
  return value * WAVELENGTH_UNITS[unit].toM;
}
export function wavelengthFromMeters(m, unit) {
  return m / WAVELENGTH_UNITS[unit].toM;
}

/** Schwarzschild radius in meters. */
export function schwarzschildRadiusM(massKg) {
  return (2 * G * massKg) / (C * C);
}

/**
 * Gravitational redshift z for light emitted at radius R (meters) from
 * mass M (kg) and observed at infinity. Returns null for R <= r_s,
 * where the expression is undefined (no escaping light to redshift).
 */
export function gravitationalRedshift(massKg, radiusM) {
  const rs = schwarzschildRadiusM(massKg);
  if (!(radiusM > rs)) return null;
  return Math.pow(1 - rs / radiusM, -0.5) - 1;
}

/** Redshift factor (1+z) accumulated between two static radii r1 < r2 (both > r_s). */
export function redshiftFactorBetween(massKg, r1, r2) {
  const rs = schwarzschildRadiusM(massKg);
  if (!(r1 > rs) || !(r2 >= r1)) return null;
  return Math.sqrt((1 - rs / r1) / (1 - rs / r2));
}

export function observedWavelength(lambdaEmitM, z) {
  return lambdaEmitM * (1 + z);
}

/**
 * The recession velocity someone would (incorrectly) infer from z if
 * they attributed it entirely to relativistic Doppler motion — for
 * comparison/context only. Uses the same relativistic Doppler inversion
 * as this site's Doppler shift calculator.
 */
export function naiveEquivalentVelocity(z) {
  const R = (1 + z) ** 2;
  const beta = (R - 1) / (R + 1);
  return beta * C;
}
