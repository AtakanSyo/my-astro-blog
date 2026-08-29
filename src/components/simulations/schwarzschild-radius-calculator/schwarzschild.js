// The Schwarzschild radius: the event horizon size of an idealized
// non-rotating, uncharged (Schwarzschild) black hole of mass M.
//
//   r_s = 2GM/c²
//
// This is a genuinely LINEAR relation — double the mass, exactly double
// the radius, no exponent involved. It applies specifically to a
// Schwarzschild (non-spinning) black hole; a spinning Kerr black hole's
// horizon follows a different formula (r_+ = r_g(1 + sqrt(1-a*²)), see
// this site's Black Hole ISCO calculator), which reduces to r_s exactly
// when the spin a* = 0.
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

/** Schwarzschild radius in meters, given mass in kilograms. */
export function schwarzschildRadiusM(massKg) {
  return (2 * G * massKg) / (C * C);
}

/** Mass in kilograms, given a Schwarzschild radius in meters. */
export function massFromSchwarzschildRadiusM(rsM) {
  return (rsM * C * C) / (2 * G);
}

// A human-scale "about the size of..." lookup, spanning from a marble to
// planetary orbits — for turning an abstract radius into something to
// picture, regardless of how astronomically large or small it is.
export const SIZE_COMPARISONS = [
  { label: "a grain of sand (~1 mm)", km: 1e-6 },
  { label: "a marble (~1 cm)", km: 1e-5 },
  { label: "a car (~4 m)", km: 0.004 },
  { label: "a football field (~100 m)", km: 0.1 },
  { label: "a small town (~1 km across)", km: 1 },
  { label: "Mount Everest's height (~9 km)", km: 9 },
  { label: "a large metropolitan area (~50 km across)", km: 50 },
  { label: "a mid-sized country (~1,000 km across)", km: 1000 },
  { label: "Earth's radius (~6,371 km)", km: 6371 },
  { label: "the Moon's orbit (~384,000 km)", km: 384400 },
  { label: "the Sun's radius (~696,000 km)", km: 696000 },
  { label: "Mercury's orbit (~0.39 AU)", km: (M_PER_AU / 1000) * 0.39 },
  { label: "Earth's orbit (1 AU)", km: M_PER_AU / 1000 },
  { label: "Neptune's orbit (~30 AU)", km: (M_PER_AU / 1000) * 30 },
  { label: "Pluto's orbit (~40 AU)", km: (M_PER_AU / 1000) * 40 },
];

/** Nearest human-scale comparison to a size in km, with over/under context. */
export function closestSizeComparison(km) {
  if (!(km > 0)) return null;
  let best = SIZE_COMPARISONS[0];
  let bestDist = Infinity;
  for (const c of SIZE_COMPARISONS) {
    const dist = Math.abs(Math.log10(km) - Math.log10(c.km));
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  const ratio = km / best.km;
  return { ...best, ratio };
}
