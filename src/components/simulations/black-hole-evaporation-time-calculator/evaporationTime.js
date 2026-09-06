// Schwarzschild black hole evaporation time via Hawking radiation, in the
// idealized (non-rotating, uncharged, isolated in a vacuum colder than the
// black hole) approximation:
//
//   t_evap = 5120 π G² M³ / (ħ c⁴)
//
// This is the standard leading-order result for the lifetime of a black
// hole against Hawking evaporation. It ignores accretion (any real black
// hole sitting in a bath of ambient radiation or matter would gain mass
// faster than it loses it, at least until the universe cools well below
// the black hole's own Hawking temperature), and it ignores the changing
// number of emitted particle species as the hole shrinks and heats up —
// but the M³ scaling is exact and is the whole point of this tool.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

const HBAR = 1.054571817e-34; // J·s, reduced Planck constant
const C = 2.99792458e8; // m/s, speed of light
const G = 6.6743e-11; // m³/(kg·s²), gravitational constant

const SECONDS_PER_YEAR = 365.25 * 24 * 3600;
export const AGE_OF_UNIVERSE_YEARS = 13.8e9;

const M_SUN_KG = 1.98892e30; // kg
const M_EARTH_KG = 5.972e24; // kg

export const MASS_UNITS = {
  msun: { label: "Solar masses", short: "M☉", toKg: M_SUN_KG },
  mearth: { label: "Earth masses", short: "M⊕", toKg: M_EARTH_KG },
  kg: { label: "Kilograms", short: "kg", toKg: 1 },
};
export const MASS_UNIT_ORDER = ["msun", "mearth", "kg"];

export function massToKg(value, unit) {
  return value * MASS_UNITS[unit].toKg;
}
export function massFromKg(kg, unit) {
  return kg / MASS_UNITS[unit].toKg;
}

/** Evaporation time in seconds, given a black hole mass in kilograms. */
export function evaporationTimeSeconds(massKg) {
  return (5120 * Math.PI * G * G * massKg ** 3) / (HBAR * C ** 4);
}

/** Evaporation time in years, given a black hole mass in kilograms. */
export function evaporationTimeYears(massKg) {
  return evaporationTimeSeconds(massKg) / SECONDS_PER_YEAR;
}

/** Black hole mass in kilograms that evaporates in exactly this many seconds (inverts the M³ relation). */
export function massFromEvaporationTimeSeconds(tSeconds) {
  return Math.cbrt((tSeconds * HBAR * C ** 4) / (5120 * Math.PI * G * G));
}

/** Black hole mass in kilograms that evaporates in exactly this many years. */
export function massFromEvaporationTimeYears(tYears) {
  return massFromEvaporationTimeSeconds(tYears * SECONDS_PER_YEAR);
}

/** How many multiples of the age of the universe (~13.8 Gyr) a given evaporation time (in years) represents. */
export function ageOfUniverseMultiple(tYears) {
  return tYears / AGE_OF_UNIVERSE_YEARS;
}

/**
 * The mass (in kg) of a hypothetical black hole that would just be
 * finishing evaporation today — i.e. t_evap(M) = age of the universe.
 * The single most interesting number this tool produces: below this
 * mass, a primordial black hole formed at the Big Bang would already
 * be gone; above it, it's still with us.
 */
export function massEvaporatingTodayKg() {
  return massFromEvaporationTimeYears(AGE_OF_UNIVERSE_YEARS);
}
