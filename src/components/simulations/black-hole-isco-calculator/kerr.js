// Innermost stable circular orbit (ISCO) around a Kerr (spinning) black
// hole, and the accretion efficiency it implies.
//
// All radii are naturally measured in gravitational radii,
// r_g = GM/c², which is HALF the Schwarzschild radius (r_s = 2GM/c²).
// The dimensionless spin a* = a/M = Jc/(GM²) ranges over [-1, 1]; this
// module uses the sign of a* itself to pick prograde vs. retrograde,
// so a single continuous function sweeps the whole textbook curve as
// a* goes from -1 (maximally retrograde) to +1 (maximally prograde).
//
// ISCO radius (Bardeen, Press & Teukolsky 1972):
//
//   Z1 = 1 + (1-a*²)^(1/3) [(1+a*)^(1/3) + (1-a*)^(1/3)]
//   Z2 = sqrt(3a*² + Z1²)
//   r_ISCO/r_g = 3 + Z2 ∓ sqrt[(3-Z1)(3+Z1+2Z2)]     (− prograde, + retrograde)
//
// At a*=0 this gives exactly 6 r_g (the Schwarzschild result quoted in
// every textbook); at a*=+1, exactly 1 r_g; at a*=-1, exactly 9 r_g.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

export const G = 6.6743e-11; // m^3 kg^-1 s^-2, CODATA 2018
export const C = 299792458; // m/s, exact
export const M_SUN = 1.98847e30; // kg, IAU nominal solar mass

export const MASS_UNITS = {
  msun: { label: "Solar masses", short: "M☉", toKg: M_SUN },
  kg: { label: "Kilograms", short: "kg", toKg: 1 },
};
export const MASS_UNIT_ORDER = ["msun", "kg"];

export function massToKg(value, unit) {
  return value * MASS_UNITS[unit].toKg;
}

/** Gravitational radius r_g = GM/c², in meters. */
export function gravitationalRadiusM(massKg) {
  return (G * massKg) / (C * C);
}

/**
 * ISCO radius in units of r_g, given signed dimensionless spin a* in
 * [-1, 1]. a* >= 0 selects the prograde branch, a* < 0 the retrograde
 * branch (using |a*|) — a single continuous, monotonic function of a*.
 */
export function iscoRadiusRg(aStar) {
  const a = Math.max(-1, Math.min(1, aStar));
  const absA = Math.abs(a);
  const Z1 = 1 + Math.cbrt(1 - absA * absA) * (Math.cbrt(1 + absA) + Math.cbrt(1 - absA));
  const Z2 = Math.sqrt(3 * absA * absA + Z1 * Z1);
  const sqrtTerm = Math.sqrt(Math.max(0, (3 - Z1) * (3 + Z1 + 2 * Z2)));
  return a >= 0 ? 3 + Z2 - sqrtTerm : 3 + Z2 + sqrtTerm;
}

/** Outer event horizon radius in units of r_g (depends only on |a*|). */
export function horizonRadiusRg(aStar) {
  const a = Math.max(-1, Math.min(1, aStar));
  return 1 + Math.sqrt(Math.max(0, 1 - a * a));
}

/** Equatorial ergosphere outer boundary in units of r_g — always exactly 2, for any spin. */
export const EQUATORIAL_ERGOSPHERE_RG = 2;

/**
 * Specific orbital energy (per unit rest-mass energy) at the ISCO, for
 * signed spin a*. The accretion efficiency is eta = 1 - E. Extremal
 * prograde spin (a* -> 1) is a genuine coordinate degeneracy (ISCO,
 * horizon, and photon orbit coincide) where this ratio is 0/0; a* is
 * nudged very slightly inward of +-1 there so the limit (eta = 1 -
 * 1/sqrt(3) approx 42.3% prograde) comes out numerically rather than as NaN.
 */
export function specificEnergyAtISCO(aStar) {
  const a = Math.max(-1, Math.min(1, aStar));
  // Exactly (or numerically indistinguishable from) extremal prograde is
  // a genuine 0/0 in the general formula, floating-point or not — use
  // the known closed-form limit rather than let cancellation error creep
  // in over the last few representable steps toward a*=1.
  if (1 - a < 1e-9) return 1 / Math.sqrt(3);
  const r = iscoRadiusRg(a);
  const sqrtR = Math.sqrt(r);
  const num = r ** 1.5 - 2 * sqrtR + a;
  const den = r ** 0.75 * Math.sqrt(Math.max(1e-12, r ** 1.5 - 3 * sqrtR + 2 * a));
  return num / den;
}

/** Accretion (radiative) efficiency at the ISCO, eta = 1 - E_isco. */
export function accretionEfficiency(aStar) {
  return 1 - specificEnergyAtISCO(aStar);
}
