// Tidal disruption radius: the distance from a black hole at which its
// tidal force overcomes a star's own self-gravity, tearing the star apart
// into a stream of debris — a "tidal disruption event" (TDE).
//
// This calculator uses the simple, non-relativistic, rigid-body-style
// estimate that's the standard back-of-envelope figure quoted in TDE
// literature and popular explainers:
//
//   r_t = R★ · (M_BH / M★)^(1/3)
//
// R★ and M★ are the star's radius and mass; M_BH is the black hole's
// mass. This is the same functional form as a Roche-limit-style estimate
// (see this site's Roche Limit calculator), applied to a star and a
// point-mass disruptor with an order-unity ("rigid") coefficient of 1
// instead of a two-extended-body coefficient. More careful treatments
// (e.g. Lodato, King & Pringle 2009) add structure-dependent factors of a
// few, but this simple form captures the right scaling and order of
// magnitude.
//
// The physically important subtlety this tool exists to show: because
// r_t ∝ M_BH^(1/3) grows far more slowly with mass than the black hole's
// own Schwarzschild radius r_s = 2GM_BH/c² (∝ M_BH, exactly linear), a
// massive enough black hole has r_s > r_t — the star would be swallowed
// whole, crossing the event horizon before tidal forces ever get the
// chance to shred it outside of it. No debris stream forms outside the
// horizon, so no observable flare is produced. This is a genuine,
// well-known limitation on TDE detectability discussed in the
// astrophysical literature (see e.g. Kesden 2012, and general TDE
// reviews), commonly quoted at roughly M_BH ≳ 10^8 M☉ for a Sun-like
// star — this module derives that crossover from the algebra itself
// rather than hard-coding the commonly cited figure.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

export const G = 6.6743e-11; // m^3 kg^-1 s^-2, CODATA 2018
export const C = 299792458; // m/s, exact
export const M_SUN = 1.98847e30; // kg, IAU nominal solar mass
export const M_EARTH = 5.9722e24; // kg
export const M_JUPITER = 1.89813e27; // kg
export const R_SUN_M = 696000000; // m, nominal solar radius (IAU 2015)
const R_EARTH_M = 6371000; // m, mean radius

export const MASS_UNITS = {
  msun: { label: "Solar masses", short: "M☉", toKg: M_SUN },
  mjupiter: { label: "Jupiter masses", short: "M♃", toKg: M_JUPITER },
  mearth: { label: "Earth masses", short: "M⊕", toKg: M_EARTH },
  kg: { label: "Kilograms", short: "kg", toKg: 1 },
};
export const MASS_UNIT_ORDER = ["msun", "mjupiter", "mearth", "kg"];

export const RADIUS_UNITS = {
  rsun: { label: "Solar radii", short: "R☉", toM: R_SUN_M },
  rearth: { label: "Earth radii", short: "R⊕", toM: R_EARTH_M },
  km: { label: "Kilometers", short: "km", toM: 1000 },
  m: { label: "Meters", short: "m", toM: 1 },
};
export const RADIUS_UNIT_ORDER = ["rsun", "rearth", "km", "m"];

export function massToKg(value, unit) {
  return value * MASS_UNITS[unit].toKg;
}
export function massFromKg(kg, unit) {
  return kg / MASS_UNITS[unit].toKg;
}
export function radiusToMeters(value, unit) {
  return value * RADIUS_UNITS[unit].toM;
}
export function radiusFromMeters(m, unit) {
  return m / RADIUS_UNITS[unit].toM;
}

/** Tidal disruption radius in meters, given SI inputs (all in meters/kg). */
export function tidalDisruptionRadiusM(starRadiusM, bhMassKg, starMassKg) {
  return starRadiusM * Math.cbrt(bhMassKg / starMassKg);
}

/** Schwarzschild radius in meters, given a mass in kilograms. */
export function schwarzschildRadiusM(massKg) {
  return (2 * G * massKg) / (C * C);
}

/**
 * The black hole mass (in kg) at which r_t exactly equals r_s for a given
 * star — the "swallowed whole" crossover. Above this mass, the star is
 * swallowed intact with no observable tidal disruption flare.
 *
 * Solving r_t(M) = r_s(M) for M:
 *   R★ (M / M★)^(1/3) = 2GM/c²
 * Substituting y = M^(1/3) and dividing through by y (y ≠ 0 for M > 0):
 *   R★ / M★^(1/3) = (2G/c²) y²
 *   y² = R★ c² / (2G M★^(1/3))
 *   M = y³ = [ R★ c² / (2G M★^(1/3)) ]^(3/2)
 */
export function crossoverMassKg(starRadiusM, starMassKg) {
  if (!(starRadiusM > 0) || !(starMassKg > 0)) return NaN;
  const base = (starRadiusM * C * C) / (2 * G * Math.cbrt(starMassKg));
  return Math.pow(base, 1.5);
}

// Real, citable star presets — a Sun-like star, a red giant, and a white
// dwarf — spanning the range of stellar radii (and hence tidal disruption
// radii) relevant to real observed and hypothetical TDEs.
export const STAR_PRESETS = [
  {
    label: "Sun-like star",
    massSolar: 1,
    radiusSolar: 1,
  },
  {
    label: "Red giant (Aldebaran-like)",
    massSolar: 1.16,
    radiusSolar: 44.2,
  },
  {
    label: "White dwarf (Sirius B-like)",
    massSolar: 1.018,
    radiusSolar: 0.0084,
  },
];

// Real (or realistically illustrative) black-hole-mass scenarios for a
// Sun-like star, spanning the full range this calculator is built to
// demonstrate — from an ordinary observable TDE around a stellar-mass
// black hole, through a real observed-TDE regime around a supermassive
// black hole like Sgr A*, to the "swallowed whole" regime around an
// extremely massive black hole.
export const SCENARIO_PRESETS = [
  {
    label: "Sun-like star + 10 M☉ black hole",
    bhMassSolar: 10,
    starMassSolar: 1,
    starRadiusSolar: 1,
  },
  {
    label: "Sun-like star + Sgr A* (4.3M M☉)",
    bhMassSolar: 4.297e6,
    starMassSolar: 1,
    starRadiusSolar: 1,
  },
  {
    label: "Sun-like star + 10⁹ M☉ black hole",
    bhMassSolar: 1e9,
    starMassSolar: 1,
    starRadiusSolar: 1,
  },
];
