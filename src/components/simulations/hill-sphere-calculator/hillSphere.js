// The Hill sphere: the region around a smaller body (a planet orbiting
// a star, a moon orbiting a planet) where its own gravity dominates
// over the tidal pull of the larger body it orbits — roughly, how far
// out it can hold onto a satellite of its own.
//
//   r_H ≈ a (m / 3M)^(1/3)                    [circular orbit]
//   r_H ≈ a(1-e) (m / 3M)^(1/3)                [conservative, at periapsis]
//
// a is the smaller body's own semi-major axis around the larger body,
// m its mass, M the larger body's mass, and e its orbital eccentricity.
// The periapsis form is "conservative" because tidal stress is
// strongest at closest approach — a satellite that would be stable at
// the circular-orbit r_H can still be stripped away if the body's own
// orbit is eccentric enough to swing it well inside that at periapsis.
//
// This is an approximation (the exact boundary from the restricted
// three-body problem is close to, but not identical to, this formula),
// and even the Hill radius itself is not a hard stability boundary —
// see the accompanying post for why long-term-stable satellite orbits
// need to sit substantially inside it.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

export const M_SUN = 1.98847e30; // kg
export const M_EARTH = 5.9722e24; // kg
export const M_JUPITER = 1.89813e27; // kg
export const M_MOON = 7.342e22; // kg
const M_PER_AU = 149597870700; // m, IAU 2012, exact
const R_EARTH_M = 6371000; // m
const R_JUPITER_M = 71492000; // m
const R_MOON_M = 1737400; // m

export const MASS_UNITS = {
  msun: { label: "Solar masses", short: "M☉", toKg: M_SUN },
  mearth: { label: "Earth masses", short: "M⊕", toKg: M_EARTH },
  mjupiter: { label: "Jupiter masses", short: "M♃", toKg: M_JUPITER },
  mmoon: { label: "Lunar masses", short: "M☾", toKg: M_MOON },
  kg: { label: "Kilograms", short: "kg", toKg: 1 },
};
export const MASS_UNIT_ORDER = ["msun", "mearth", "mjupiter", "mmoon", "kg"];

export const DISTANCE_UNITS = {
  au: { label: "Astronomical units", short: "AU", toM: M_PER_AU },
  km: { label: "Kilometers", short: "km", toM: 1000 },
};
export const DISTANCE_UNIT_ORDER = ["au", "km"];

export const RADIUS_UNITS = {
  rearth: { label: "Earth radii", short: "R⊕", toM: R_EARTH_M },
  rjupiter: { label: "Jupiter radii", short: "R♃", toM: R_JUPITER_M },
  rmoon: { label: "Lunar radii", short: "R☾", toM: R_MOON_M },
  km: { label: "Kilometers", short: "km", toM: 1000 },
};
export const RADIUS_UNIT_ORDER = ["rearth", "rjupiter", "rmoon", "km"];

export function massToKg(value, unit) {
  return value * MASS_UNITS[unit].toKg;
}
export function distanceToMeters(value, unit) {
  return value * DISTANCE_UNITS[unit].toM;
}
export function distanceFromMeters(m, unit) {
  return m / DISTANCE_UNITS[unit].toM;
}
export function radiusToMeters(value, unit) {
  return value * RADIUS_UNITS[unit].toM;
}
export function radiusFromMeters(m, unit) {
  return m / RADIUS_UNITS[unit].toM;
}

/** Hill radius (circular-orbit approximation), all masses/distance in consistent units. */
export function hillRadius(a, m, M) {
  return a * Math.cbrt(m / (3 * M));
}

/** Conservative (periapsis) Hill radius, given eccentricity e. */
export function hillRadiusPeriapsis(a, m, M, e) {
  return a * (1 - e) * Math.cbrt(m / (3 * M));
}
