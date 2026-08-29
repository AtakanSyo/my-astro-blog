// Exoplanet transit depth: how much a star's brightness dips when a
// planet crosses its disk, in the simplest (uniform stellar disk,
// central transit) approximation.
//
//   δ = (R_p / R_star)²
//
// This ignores limb darkening, non-central (grazing) transits, and
// finite ingress/egress geometry — real transit depths measured from
// light curves deviate somewhat from this idealized value for exactly
// those reasons. It's still the right first calculation for "roughly
// how deep should this transit be," and the one every more detailed
// model is a correction to.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

const R_EARTH_M = 6371000; // m, mean radius
const R_JUPITER_M = 71492000; // m, equatorial radius (standard exoplanet-literature convention)
const R_SUN_M = 696000000; // m, IAU 2015 nominal solar radius

export const PLANET_RADIUS_UNITS = {
  rearth: { label: "Earth radii", short: "R⊕", toM: R_EARTH_M },
  rjup: { label: "Jupiter radii", short: "R♃", toM: R_JUPITER_M },
  km: { label: "Kilometers", short: "km", toM: 1000 },
};
export const PLANET_RADIUS_UNIT_ORDER = ["rearth", "rjup", "km"];

export const STAR_RADIUS_UNITS = {
  rsun: { label: "Solar radii", short: "R☉", toM: R_SUN_M },
  km: { label: "Kilometers", short: "km", toM: 1000 },
};
export const STAR_RADIUS_UNIT_ORDER = ["rsun", "km"];

export const DEPTH_UNITS = {
  fraction: { label: "Fraction", short: "(fraction)", toFraction: 1 },
  percent: { label: "Percent", short: "%", toFraction: 1e-2 },
  ppm: { label: "ppm", short: "ppm", toFraction: 1e-6 },
};
export const DEPTH_UNIT_ORDER = ["percent", "ppm", "fraction"];

export function planetRadiusToMeters(value, unit) {
  return value * PLANET_RADIUS_UNITS[unit].toM;
}
export function planetRadiusFromMeters(m, unit) {
  return m / PLANET_RADIUS_UNITS[unit].toM;
}
export function starRadiusToMeters(value, unit) {
  return value * STAR_RADIUS_UNITS[unit].toM;
}
export function depthToFraction(value, unit) {
  return value * DEPTH_UNITS[unit].toFraction;
}
export function depthFromFraction(frac, unit) {
  return frac / DEPTH_UNITS[unit].toFraction;
}

/** Transit depth (fraction of stellar flux blocked), given both radii in the same unit. */
export function transitDepth(planetRadiusM, starRadiusM) {
  return (planetRadiusM / starRadiusM) ** 2;
}

/** Planet radius in meters, given a transit depth (fraction) and stellar radius in meters. */
export function planetRadiusFromDepth(depthFraction, starRadiusM) {
  return starRadiusM * Math.sqrt(depthFraction);
}

/** Depth expressed in millimagnitudes of dimming: -2.5 log10(1-delta), times 1000. */
export function depthToMillimag(depthFraction) {
  if (!(depthFraction < 1)) return Infinity;
  return -2.5 * Math.log10(1 - depthFraction) * 1000;
}
