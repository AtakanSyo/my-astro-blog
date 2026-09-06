// Hawking temperature: the blackbody temperature of the thermal radiation
// a non-rotating, uncharged (Schwarzschild) black hole emits due to
// quantum effects near its event horizon.
//
//   T_H = ħc³ / (8π G M k_B)
//
// Smaller black holes are hotter — mass and temperature are inversely
// proportional. This is why the astrophysical black holes we actually
// observe (stellar remnants and supermassive galactic-center objects)
// are almost inconceivably cold, while a black hole with the mass of a
// small asteroid would be dramatically hot.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

export const HBAR = 1.054571817e-34; // J·s, reduced Planck constant
export const C = 2.99792458e8; // m/s, speed of light
export const G = 6.6743e-11; // m³/(kg·s²), gravitational constant (CODATA 6.67430e-11)
export const KB = 1.380649e-23; // J/K, Boltzmann constant

// Cosmic Microwave Background temperature — the floor a black hole's
// Hawking temperature must exceed before it can be a net emitter (absorbing
// less than it radiates) in today's universe.
export const CMB_TEMPERATURE_K = 2.725;

const M_SUN_KG = 1.98892e30; // kg, solar mass
const M_EARTH_KG = 5.972e24; // kg, Earth mass

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

/** Hawking temperature in Kelvin for a black hole of the given mass in kg. */
export function hawkingTemperature(massKg) {
  if (!(massKg > 0)) return NaN;
  return (HBAR * C ** 3) / (8 * Math.PI * G * massKg * KB);
}

/** Inverse: the mass (kg) whose Hawking temperature equals the given T (K). */
export function massAtHawkingTemperature(temperatureK) {
  if (!(temperatureK > 0)) return NaN;
  return (HBAR * C ** 3) / (8 * Math.PI * G * KB * temperatureK);
}
