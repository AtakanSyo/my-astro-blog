// Exoplanet equilibrium temperature: the temperature a planet would
// settle to if the stellar energy it absorbs were exactly balanced by
// the thermal radiation it emits — ignoring internal heat sources and
// any atmospheric greenhouse effect.
//
// Absorbed power depends only on the planet's cross-section (πR_p²) and
// the stellar flux at its distance, regardless of rotation. What
// depends on the heat-redistribution assumption is how much AREA that
// absorbed energy is re-radiated from:
//
//   Full redistribution (day and night sides equalized before
//   re-radiating, emitting over the whole sphere, 4πR_p²):
//
//     T_eq = T_star sqrt(R_star / 2a) (1-A)^(1/4)
//
//   No redistribution (a slowly rotating or tidally locked planet
//   re-radiating only from its permanently lit dayside hemisphere,
//   2πR_p² — a real regime many hot Jupiters likely sit close to):
//
//     T_eq = T_star sqrt(R_star / a) (2^-1 (1-A))^(1/4)  =  2^(1/4) × the full-redistribution value
//
// Both share the same underlying energy balance; only the assumed
// emitting area differs. Real planets (Earth included) sit somewhere
// in between, and their actual surface temperature also depends on the
// atmospheric greenhouse effect, which this idealized model omits
// entirely by design.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

export const SIGMA_SB = 5.670374419e-8; // W m^-2 K^-4, Stefan-Boltzmann constant, exact (SI redefinition)
export const T_SUN = 5772; // K, IAU nominal solar effective temperature
export const R_SUN_M = 696000000; // m, IAU 2015 nominal solar radius
const M_PER_AU = 149597870700; // m, IAU 2012, exact

export const STAR_RADIUS_UNITS = {
  rsun: { label: "Solar radii", short: "R☉", toM: R_SUN_M },
  km: { label: "Kilometers", short: "km", toM: 1000 },
};
export const STAR_RADIUS_UNIT_ORDER = ["rsun", "km"];

export const DISTANCE_UNITS = {
  au: { label: "Astronomical units", short: "AU", toM: M_PER_AU },
  km: { label: "Kilometers", short: "km", toM: 1000 },
};
export const DISTANCE_UNIT_ORDER = ["au", "km"];

export function starRadiusToMeters(value, unit) {
  return value * STAR_RADIUS_UNITS[unit].toM;
}
export function distanceToMeters(value, unit) {
  return value * DISTANCE_UNITS[unit].toM;
}

/** Stellar flux at the planet's distance, in W/m². */
export function stellarFlux(tStar, rStarM, aM) {
  return SIGMA_SB * tStar ** 4 * (rStarM / aM) ** 2;
}

/**
 * Equilibrium temperature in Kelvin.
 * redistribution: "full" (whole-sphere emission) or "dayside" (dayside-hemisphere-only emission).
 */
export function equilibriumTemperature(tStar, rStarM, aM, bondAlbedo, redistribution = "full") {
  const f = redistribution === "dayside" ? 0.5 : 0.25;
  return tStar * Math.sqrt(rStarM / aM) * (f * (1 - bondAlbedo)) ** 0.25;
}

export function kelvinToCelsius(k) {
  return k - 273.15;
}

// A few familiar physical reference points, for the temperature gauge.
export const TEMPERATURE_LANDMARKS = [
  { label: "Liquid nitrogen boils", k: 77 },
  { label: "Water freezes", k: 273.15 },
  { label: "Room temperature", k: 293 },
  { label: "Water boils", k: 373.15 },
  { label: "Lead melts", k: 601 },
  { label: "Lava", k: 1300 },
];

// Solar-system planets' own equilibrium temperatures — computed with
// this same formula and the Sun's real parameters, held fixed
// regardless of whatever star is currently entered above, since these
// are meant as familiar anchors, not values that should move around.
export const SOLAR_SYSTEM_LANDMARKS = [
  { label: "Mercury", k: 437 },
  { label: "Venus", k: 232 },
  { label: "Earth", k: 255 },
  { label: "Mars", k: 210 },
  { label: "Jupiter", k: 110 },
  { label: "Saturn", k: 81 },
];
