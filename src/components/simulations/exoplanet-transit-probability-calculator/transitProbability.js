// Geometric transit probability: given a randomly oriented orbital
// plane, the chance that a planet happens to pass in front of its star
// as seen from a random direction (Earth's direction, in practice).
//
// For a circular orbit:
//
//   P_transit ≈ (R_star + R_p) / a
//
// (often simplified to R_star/a when R_p << R_star, which barely
// changes anything for a small rocky planet but matters more for a
// large gas giant). This comes directly from geometry: viewed edge-on,
// a transit happens only if the orbital plane crosses the star's disk
// (plus the planet's own radius) — a strip of width 2(R_star+R_p) out
// of the full 2a range of possible impact parameters a randomly
// oriented orbit could produce.
//
// For an eccentric orbit, the planet's distance from the star (and how
// long it lingers at any given orbital phase) both depend on where in
// the orbit it's currently at, which the argument of periapsis ω ties
// to the line of sight:
//
//   P_transit ≈ [(R_star + R_p) / a] × [(1 + e sinω) / (1 - e²)]
//
// This reduces to the circular-orbit formula exactly at e=0.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

const R_SUN_M = 696000000; // m, IAU 2015 nominal solar radius
const R_EARTH_M = 6371000; // m
const R_JUPITER_M = 71492000; // m
const M_PER_AU = 149597870700; // m, IAU 2012, exact

export const STAR_RADIUS_UNITS = {
  rsun: { label: "Solar radii", short: "R☉", toM: R_SUN_M },
  km: { label: "Kilometers", short: "km", toM: 1000 },
};
export const STAR_RADIUS_UNIT_ORDER = ["rsun", "km"];

export const PLANET_RADIUS_UNITS = {
  rearth: { label: "Earth radii", short: "R⊕", toM: R_EARTH_M },
  rjup: { label: "Jupiter radii", short: "R♃", toM: R_JUPITER_M },
  km: { label: "Kilometers", short: "km", toM: 1000 },
};
export const PLANET_RADIUS_UNIT_ORDER = ["rearth", "rjup", "km"];

export const DISTANCE_UNITS = {
  au: { label: "Astronomical units", short: "AU", toM: M_PER_AU },
  km: { label: "Kilometers", short: "km", toM: 1000 },
};
export const DISTANCE_UNIT_ORDER = ["au", "km"];

export function starRadiusToMeters(value, unit) {
  return value * STAR_RADIUS_UNITS[unit].toM;
}
export function planetRadiusToMeters(value, unit) {
  return value * PLANET_RADIUS_UNITS[unit].toM;
}
export function distanceToMeters(value, unit) {
  return value * DISTANCE_UNITS[unit].toM;
}

/**
 * Geometric transit probability (0-1), given radii and semi-major axis
 * in consistent units, plus optional eccentricity e and argument of
 * periapsis omega (radians). e defaults to 0 (circular orbit).
 */
export function transitProbability(rStarM, rPlanetM, aM, e = 0, omega = 0) {
  const base = (rStarM + rPlanetM) / aM;
  const eccentricityFactor = (1 + e * Math.sin(omega)) / (1 - e * e);
  return base * eccentricityFactor;
}
