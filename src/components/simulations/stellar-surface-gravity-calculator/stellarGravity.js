// Stellar surface gravity, and the astronomically standard log g.
//
//   g = GM/R²
//
// Astronomers almost universally quote this in cgs units (cm/s²) before
// taking the base-10 logarithm — a convention old enough (and useful
// enough, since g spans many orders of magnitude across stellar types)
// that it has outlived the rest of the cgs system in everyday use. The
// Sun's log g ≈ 4.44 is the reference point every other value gets
// compared against, implicitly or explicitly.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

export const G = 6.6743e-11; // m^3 kg^-1 s^-2, CODATA 2018
export const M_SUN = 1.98847e30; // kg, IAU nominal solar mass
export const R_SUN = 696000000; // m, IAU 2015 nominal solar radius

export const MASS_UNITS = {
  msun: { label: "Solar masses", short: "M☉", toKg: M_SUN },
  kg: { label: "Kilograms", short: "kg", toKg: 1 },
};
export const MASS_UNIT_ORDER = ["msun", "kg"];

export const RADIUS_UNITS = {
  rsun: { label: "Solar radii", short: "R☉", toM: R_SUN },
  km: { label: "Kilometers", short: "km", toM: 1000 },
  m: { label: "Meters", short: "m", toM: 1 },
};
export const RADIUS_UNIT_ORDER = ["rsun", "km", "m"];

export function massToKg(value, unit) {
  return value * MASS_UNITS[unit].toKg;
}
export function radiusToMeters(value, unit) {
  return value * RADIUS_UNITS[unit].toM;
}

/** Surface gravity in SI units (m/s²). */
export function surfaceGravitySI(massKg, radiusM) {
  return (G * massKg) / (radiusM * radiusM);
}

/** cgs surface gravity (cm/s²) — the astronomically conventional unit. */
export function surfaceGravityCGS(gSI) {
  return gSI * 100;
}

/** log10 of surface gravity in cgs units — "log g." */
export function logG(gCGS) {
  return Math.log10(gCGS);
}

/** log g of the Sun itself — the reference point every other value is implicitly compared to. */
export const LOG_G_SUN = logG(surfaceGravityCGS(surfaceGravitySI(M_SUN, R_SUN)));

/**
 * A rough, commonly-used classification by log g. Real luminosity
 * classes come from spectroscopy, not log g alone — this is a useful
 * rule of thumb, not a substitute for it.
 */
export function classifyLogG(logg) {
  if (!Number.isFinite(logg)) return null;
  if (logg >= 9) return { label: "Neutron star (or denser)", tone: "extreme" };
  if (logg >= 5.5) return { label: "White dwarf", tone: "dense" };
  if (logg >= 3.0) return { label: "Dwarf (main sequence)", tone: "normal" };
  if (logg >= 0.5) return { label: "Giant", tone: "low" };
  return { label: "Supergiant", tone: "verylow" };
}
