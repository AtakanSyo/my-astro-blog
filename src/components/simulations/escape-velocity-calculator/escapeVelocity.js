// Escape velocity: the speed needed to leave a body's gravity permanently
// with no further thrust, launched from radius r.
//
//   v_esc = √(2GM/r)
//
// This falls straight out of energy conservation — set kinetic energy
// equal to the (magnitude of the) gravitational potential energy,
// ½mv² = GMm/r, and the test mass m cancels — which is exactly why
// escape velocity is DIRECTION-INDEPENDENT: it's an energy condition on
// speed, not a statement about trajectory. Straight up, sideways, or at
// any angle, the same speed at the same r is enough (ignoring drag and
// other bodies). It also says nothing about atmosphere: a real rocket
// leaving Earth needs considerably more than 11.2 km/s of actual burn
// to fight drag and gravity losses on the way up.
//
// The endpoint: hold M fixed and shrink r, and v_esc rises without
// bound — until it reaches c. That happens exactly at the Schwarzschild
// radius, r_s = 2GM/c², which is just this same formula solved for
// v_esc = c. This calculator and this site's Schwarzschild Radius
// Calculator are the same equation, approached from two directions.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

export const G = 6.6743e-11; // m^3 kg^-1 s^-2, CODATA 2018
export const C = 299792458; // m/s, exact
export const M_SUN = 1.98847e30; // kg, IAU nominal solar mass
export const M_EARTH = 5.9722e24; // kg
export const M_JUPITER = 1.89813e27; // kg
const M_PER_AU = 149597870700; // m, IAU 2012, exact
const R_EARTH_M = 6371000; // m, mean radius
const R_SUN_M = 696000000; // m, nominal solar radius (IAU 2015)

export const MASS_UNITS = {
  msun: { label: "Solar masses", short: "M☉", toKg: M_SUN },
  mearth: { label: "Earth masses", short: "M⊕", toKg: M_EARTH },
  mjupiter: { label: "Jupiter masses", short: "M♃", toKg: M_JUPITER },
  kg: { label: "Kilograms", short: "kg", toKg: 1 },
};
export const MASS_UNIT_ORDER = ["msun", "mearth", "mjupiter", "kg"];

export const DISTANCE_UNITS = {
  km: { label: "Kilometers", short: "km", toM: 1000 },
  m: { label: "Meters", short: "m", toM: 1 },
  au: { label: "Astronomical units", short: "AU", toM: M_PER_AU },
  rearth: { label: "Earth radii", short: "R⊕", toM: R_EARTH_M },
  rsun: { label: "Solar radii", short: "R☉", toM: R_SUN_M },
};
export const DISTANCE_UNIT_ORDER = ["km", "m", "au", "rearth", "rsun"];

export const VELOCITY_UNITS = {
  kms: { label: "Kilometers/second", short: "km/s", toMs: 1000 },
  ms: { label: "Meters/second", short: "m/s", toMs: 1 },
  c: { label: "Fraction of light speed", short: "× c", toMs: C },
};
export const VELOCITY_UNIT_ORDER = ["kms", "ms", "c"];

export function velocityToUnit(vMs, unit) {
  return vMs / VELOCITY_UNITS[unit].toMs;
}
export function velocityFromUnit(value, unit) {
  return value * VELOCITY_UNITS[unit].toMs;
}

export function massToKg(value, unit) {
  return value * MASS_UNITS[unit].toKg;
}
export function massFromKg(kg, unit) {
  return kg / MASS_UNITS[unit].toKg;
}
export function distanceToMeters(value, unit) {
  return value * DISTANCE_UNITS[unit].toM;
}
export function distanceFromMeters(m, unit) {
  return m / DISTANCE_UNITS[unit].toM;
}

/** v_esc in m/s, given mass in kg and radius in meters. */
export function escapeVelocityFromMassRadius(massKg, radiusM) {
  if (!(massKg > 0) || !(radiusM > 0)) return { valid: false, reason: "Enter a positive mass and radius." };
  return { valid: true, v: Math.sqrt((2 * G * massKg) / radiusM) };
}

/** Mass in kg, given v_esc (m/s) and radius (m). */
export function massFromVelocityRadius(vMs, radiusM) {
  if (!(vMs > 0) || !(radiusM > 0)) return { valid: false, reason: "Enter a positive escape velocity and radius." };
  if (vMs >= C) return { valid: false, reason: "A finite radius can't give an escape velocity at or above the speed of light — that's the Schwarzschild limit itself, not something to solve past." };
  return { valid: true, massKg: (vMs * vMs * radiusM) / (2 * G) };
}

/** Radius in meters, given v_esc (m/s) and mass (kg). */
export function radiusFromVelocityMass(vMs, massKg) {
  if (!(vMs > 0) || !(massKg > 0)) return { valid: false, reason: "Enter a positive escape velocity and mass." };
  if (vMs >= C) return { valid: false, reason: "v_esc can approach c only in the limit r → r_s; it never exceeds c for a physical (finite, positive) radius." };
  return { valid: true, radiusM: (2 * G * massKg) / (vMs * vMs) };
}

/** The Schwarzschild radius for this mass — where v_esc would equal c exactly. */
export function schwarzschildRadiusM(massKg) {
  return (2 * G * massKg) / (C * C);
}

// Every preset is self-consistent (M and r actually give the stated
// v_esc under the exact formula above) and doubles as a landmark on the
// comparison ladder. Sources are cited on the calculator's page itself.
export const PRESETS = [
  { label: "The Moon", mass: 7.342e22, massUnit: "kg", radius: 1737.4, radiusUnit: "km" },
  { label: "Mars", mass: 6.4171e23, massUnit: "kg", radius: 3389.5, radiusUnit: "km" },
  { label: "Earth", mass: M_EARTH, massUnit: "kg", radius: 6371, radiusUnit: "km" },
  { label: "Jupiter", mass: M_JUPITER, massUnit: "kg", radius: 69911, radiusUnit: "km" },
  { label: "The Sun", mass: M_SUN, massUnit: "kg", radius: 696000, radiusUnit: "km" },
  { label: "A white dwarf (Sirius B)", mass: 1.018 * M_SUN, massUnit: "kg", radius: 5850, radiusUnit: "km" },
  { label: "A neutron star (typical)", mass: 1.4 * M_SUN, massUnit: "kg", radius: 11, radiusUnit: "km" },
];

// The comparison ladder's landmarks: the presets above, plus a genuinely
// small body at the low end so the scale actually starts from "small
// asteroid" as advertised — Bennu isn't a preset button (it's not a
// planet/star scenario worth solving for), just a landmark for scale.
export const LADDER_LANDMARKS = [
  { label: "Bennu (small asteroid)", mass: 7.329e10, radius: 245.03 },
  ...PRESETS.map((p) => ({ label: p.label, mass: p.mass, radius: distanceToMeters(p.radius, p.radiusUnit) })),
].map((l) => ({ ...l, v: escapeVelocityFromMassRadius(l.mass, l.radius).v }));
