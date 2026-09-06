// The free-fall time: how long a pressureless, uniform-density sphere
// takes to collapse to a point under its own self-gravity, starting
// from rest.
//
//   t_ff = sqrt(3π / (32 G ρ))
//
// This is a standard reference timescale throughout star formation:
// comparing how long a real molecular cloud actually takes to turn
// gas into stars against t_ff is central to arguments about whether
// star formation is "fast" (roughly free-fall) or "slow" (regulated by
// turbulence, magnetic fields, or feedback). ρ is deliberately taken as
// *uniform* here for tractability — a real, inhomogeneous cloud
// collapses hierarchically (denser clumps collapse faster than their
// surroundings) rather than as a single uniform shell, but t_ff
// remains the standard order-of-magnitude yardstick.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

export const G = 6.6743e-11; // m^3 kg^-1 s^-2
export const M_H = 1.6735575e-27; // kg, hydrogen atom mass

/** Free-fall time in seconds, given a uniform mass density in kg/m^3. */
export function freeFallTime(rhoKgM3) {
  return Math.sqrt((3 * Math.PI) / (32 * G * rhoKgM3));
}

/**
 * Mass density (kg/m^3) from a number density (particles/m^3) of gas
 * with mean molecular weight mu (in units of the hydrogen mass) — e.g.
 * mu ≈ 1.27 for atomic (HI) gas of primordial composition, mu ≈ 2.3 for
 * molecular (H2 + He) cloud gas, the standard star-formation default.
 */
export function numberDensityToMassDensity(nPerM3, mu) {
  return nPerM3 * mu * M_H;
}

export const MASS_DENSITY_UNITS = {
  kgm3: { label: "Kilograms/m³", short: "kg/m³", toKgM3: 1 },
  gcm3: { label: "Grams/cm³", short: "g/cm³", toKgM3: 1000 },
};
export const MASS_DENSITY_UNIT_ORDER = ["kgm3", "gcm3"];

export const NUMBER_DENSITY_UNITS = {
  percm3: { label: "Particles/cm³", short: "cm⁻³", toPerM3: 1e6 },
  perm3: { label: "Particles/m³", short: "m⁻³", toPerM3: 1 },
};
export const NUMBER_DENSITY_UNIT_ORDER = ["percm3", "perm3"];

export function massDensityToKgM3(value, unit) {
  return value * MASS_DENSITY_UNITS[unit].toKgM3;
}
export function massDensityFromKgM3(kgm3, unit) {
  return kgm3 / MASS_DENSITY_UNITS[unit].toKgM3;
}
export function numberDensityToPerM3(value, unit) {
  return value * NUMBER_DENSITY_UNITS[unit].toPerM3;
}

const JULIAN_YEAR_S = 365.25 * 86400; // s — matches this site's other astro tools

export const TIME_UNITS = {
  ms: { label: "Milliseconds", short: "ms", toS: 1e-3 },
  s: { label: "Seconds", short: "s", toS: 1 },
  min: { label: "Minutes", short: "min", toS: 60 },
  hr: { label: "Hours", short: "hr", toS: 3600 },
  day: { label: "Days", short: "day", toS: 86400 },
  yr: { label: "Years", short: "yr", toS: JULIAN_YEAR_S },
  kyr: { label: "Thousand years", short: "kyr", toS: 1e3 * JULIAN_YEAR_S },
  myr: { label: "Million years", short: "Myr", toS: 1e6 * JULIAN_YEAR_S },
  gyr: { label: "Billion years", short: "Gyr", toS: 1e9 * JULIAN_YEAR_S },
};
export const TIME_UNIT_ORDER = ["ms", "s", "min", "hr", "day", "yr", "kyr", "myr", "gyr"];

export function timeToSeconds(value, unit) {
  return value * TIME_UNITS[unit].toS;
}
export function timeFromSeconds(seconds, unit) {
  return seconds / TIME_UNITS[unit].toS;
}

/** Picks whichever unit renders the value closest to (but not below) 1, for a headline display. */
export function bestTimeUnit(seconds) {
  let best = "ms";
  for (const key of TIME_UNIT_ORDER) {
    if (timeFromSeconds(seconds, key) >= 1) best = key;
  }
  return best;
}

// --- exact collapse trajectory ---
//
// The outer edge of a uniform sphere of density ρ falls under the
// (fixed, enclosed) mass interior to it exactly like a test particle
// dropped from rest at the edge of a point mass — a degenerate
// (eccentricity = 1) Kepler orbit. Its radius and elapsed time trace
// out the classic parametric "cycloid" solution as the parameter θ
// runs from 0 (released at rest, r = r0) to π (reaches the center):
//
//   r(θ)/r0 = (1 + cos θ) / 2
//   t(θ)/t_ff = (θ + sin θ) / π
//
// Both ratios are dimensionless and independent of ρ, r0, or M — the
// shape of the collapse (slow at first, a rapid plunge right at the
// end) is universal to every uniform sphere collapsing this way.
export function collapseCurvePoint(theta) {
  return {
    tFraction: (theta + Math.sin(theta)) / Math.PI,
    rFraction: (1 + Math.cos(theta)) / 2,
  };
}

/** Samples the normalized collapse curve at `steps + 1` evenly-spaced θ from 0 to π. */
export function collapseCurve(steps = 48) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    points.push(collapseCurvePoint((Math.PI * i) / steps));
  }
  return points;
}

/**
 * Inverts the collapse curve: given an elapsed-time fraction t/t_ff in
 * [0, 1], returns the corresponding radius fraction r/r0. t(θ) has no
 * closed-form inverse, so this bisects on θ — tFraction(θ) is monotonic
 * over [0, π], so bisection converges reliably.
 */
export function radiusFractionAtTimeFraction(tFraction) {
  if (tFraction <= 0) return 1;
  if (tFraction >= 1) return 0;
  let lo = 0;
  let hi = Math.PI;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (collapseCurvePoint(mid).tFraction < tFraction) lo = mid;
    else hi = mid;
  }
  return collapseCurvePoint((lo + hi) / 2).rFraction;
}
