// Kepler's third law, general two-body form:
//
//   P² = 4π² a³ / (G (M1 + M2))
//
// Solves for whichever one of {period P, semi-major axis a, total mass
// M1+M2} isn't supplied, given the other two. All internal math is done
// in SI (seconds, meters, kilograms) so it's exact for any system —
// binaries, exoplanets, moons — not just the Sun's.
//
// Most calculators online instead use the solar-system shortcut
//
//   P[yr]² = a[AU]³
//
// which is the *same* law with M implicitly fixed at exactly 1 M☉ and
// the orbiting body's own mass ignored. That's fine for a planet around
// a Sun-like star, and silently wrong everywhere else — the ISS around
// Earth, a hot Jupiter around a 1.4 M☉ star, two neutron stars orbiting
// each other. In AU/year/solar-mass units the general law reduces to
// the clean, unit-normalized identity
//
//   P[yr]² = a[AU]³ / M[M☉]
//
// which is what the shortcut actually is once mass is put back in — so
// that's the form this module uses to draw the divergence chart: in
// log(P) vs log(a) space, changing M only ever slides the P–a line up
// or down in a straight, parallel shift of -0.5·log10(M) dex; it never
// changes the line's slope.

export const G = 6.6743e-11; // m^3 kg^-1 s^-2, CODATA 2018
export const M_SUN = 1.98847e30; // kg, IAU nominal solar mass
export const M_EARTH = 5.9722e24; // kg
export const M_JUP = 1.89813e27; // kg
export const AU_M = 1.495978707e11; // m, IAU 2012 fixed definition
export const R_SUN_M = 6.957e8; // m

const MIN_S = 60;
const HOUR_S = 3600;
const DAY_S = 86400;
const YEAR_S = 365.25 * DAY_S; // Julian year — matches this site's other tools

export const PERIOD_UNITS = {
  second: { label: "Seconds", short: "s", toS: 1 },
  minute: { label: "Minutes", short: "min", toS: MIN_S },
  hour: { label: "Hours", short: "hr", toS: HOUR_S },
  day: { label: "Days", short: "d", toS: DAY_S },
  year: { label: "Years", short: "yr", toS: YEAR_S },
};
export const PERIOD_UNIT_ORDER = ["second", "minute", "hour", "day", "year"];

export const DISTANCE_UNITS = {
  km: { label: "Kilometers", short: "km", toM: 1000 },
  au: { label: "AU", short: "AU", toM: AU_M },
  rsun: { label: "Solar radii", short: "R☉", toM: R_SUN_M },
};
export const DISTANCE_UNIT_ORDER = ["km", "au", "rsun"];

export const MASS_UNITS = {
  msun: { label: "Solar masses", short: "M☉", toKg: M_SUN },
  mearth: { label: "Earth masses", short: "M⊕", toKg: M_EARTH },
  mjup: { label: "Jupiter masses", short: "M♃", toKg: M_JUP },
};
export const MASS_UNIT_ORDER = ["msun", "mearth", "mjup"];

export function periodToSeconds(value, unit) {
  return value * PERIOD_UNITS[unit].toS;
}
export function periodFromSeconds(seconds, unit) {
  return seconds / PERIOD_UNITS[unit].toS;
}
export function distanceToMeters(value, unit) {
  return value * DISTANCE_UNITS[unit].toM;
}
export function distanceFromMeters(meters, unit) {
  return meters / DISTANCE_UNITS[unit].toM;
}
export function massToKg(value, unit) {
  return value * MASS_UNITS[unit].toKg;
}
export function massFromKg(kg, unit) {
  return kg / MASS_UNITS[unit].toKg;
}

/** P (seconds) from semi-major axis (m) and total mass (kg). */
export function periodFromAxisMass(a_m, M_kg) {
  if (!(a_m > 0) || !(M_kg > 0)) return null;
  return 2 * Math.PI * Math.sqrt(a_m ** 3 / (G * M_kg));
}

/** Semi-major axis (m) from period (s) and total mass (kg). */
export function axisFromPeriodMass(P_s, M_kg) {
  if (!(P_s > 0) || !(M_kg > 0)) return null;
  return Math.cbrt((G * M_kg * P_s ** 2) / (4 * Math.PI ** 2));
}

/** Total mass (kg) from period (s) and semi-major axis (m). */
export function massFromPeriodAxis(P_s, a_m) {
  if (!(P_s > 0) || !(a_m > 0)) return null;
  return (4 * Math.PI ** 2 * a_m ** 3) / (G * P_s ** 2);
}

/**
 * The solar-system shortcut, P[yr]² = a[AU]³, generalized to carry mass
 * explicitly: P[yr]² = a[AU]³ / M[M☉]. Fixing M = 1 recovers the exact
 * shortcut everyone uses; this generalized form is what makes the two
 * lines in the divergence chart both straight and parallel in log-log
 * space, offset only by -0.5·log10(M).
 */
export function periodYearsFromAxisAuMass(a_AU, M_Msun) {
  if (!(a_AU > 0) || !(M_Msun > 0)) return null;
  return Math.sqrt(a_AU ** 3 / M_Msun);
}

/** The plain shortcut everyone actually uses online: assumes M = 1 M☉. */
export function simplifiedPeriodYears(a_AU) {
  return periodYearsFromAxisAuMass(a_AU, 1);
}
export function simplifiedAxisAU(P_yr) {
  if (!(P_yr > 0)) return null;
  return Math.pow(P_yr, 2 / 3);
}
