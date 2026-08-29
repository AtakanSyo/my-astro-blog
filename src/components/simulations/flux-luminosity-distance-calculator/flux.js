// Flux ↔ luminosity ↔ distance via the inverse-square law.
//
//   F = L / (4π d²)
//
// This assumes isotropic emission (the source radiates equally in all
// directions) and an idealized, unobstructed line of sight. Real observed
// flux can differ from this prediction because of dust/gas absorption and
// extinction along the line of sight, relativistic beaming for sources
// with bulk motion toward the observer, and — for cosmological sources —
// because "distance" itself stops being a single well-defined number once
// the universe's expansion is significant (luminosity distance and
// angular-diameter distance diverge from each other and from any naive
// light-travel-time distance). See the post text for the full discussion;
// this calculator implements the flat, static-space inverse-square law
// exactly as written above and no more.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

export const C = 299792458; // m/s, exact
export const M_PER_AU = 149597870700; // m, IAU 2012, exact
export const M_PER_PC = (648000 / Math.PI) * M_PER_AU; // IAU 2015, exact
export const JULIAN_YEAR_S = 365.25 * 86400;
export const M_PER_LY = C * JULIAN_YEAR_S;
export const L_SUN = 3.828e26; // W, IAU 2015 nominal solar luminosity (exact, by definition)

export const FLUX_UNITS = {
  cgs: { label: "erg s⁻¹ cm⁻²", short: "erg s⁻¹ cm⁻²", toSI: 1e-3 },
  si: { label: "W m⁻²", short: "W m⁻²", toSI: 1 },
};
export const FLUX_UNIT_ORDER = ["cgs", "si"];

export const LUMINOSITY_UNITS = {
  ergs: { label: "erg s⁻¹", short: "erg s⁻¹", toSI: 1e-7 },
  watt: { label: "Watts", short: "W", toSI: 1 },
  lsun: { label: "Solar luminosities", short: "L☉", toSI: L_SUN },
};
export const LUMINOSITY_UNIT_ORDER = ["ergs", "watt", "lsun"];

export const DISTANCE_UNITS = {
  au: { label: "Astronomical units", short: "AU", toMeters: M_PER_AU },
  ly: { label: "Light-years", short: "ly", toMeters: M_PER_LY },
  pc: { label: "Parsecs", short: "pc", toMeters: M_PER_PC },
  kpc: { label: "Kiloparsecs", short: "kpc", toMeters: M_PER_PC * 1e3 },
  mpc: { label: "Megaparsecs", short: "Mpc", toMeters: M_PER_PC * 1e6 },
};
export const DISTANCE_UNIT_ORDER = ["au", "ly", "pc", "kpc", "mpc"];

export function fluxToSI(value, unit) {
  return value * FLUX_UNITS[unit].toSI;
}
export function fluxFromSI(si, unit) {
  return si / FLUX_UNITS[unit].toSI;
}
export function luminosityToSI(value, unit) {
  return value * LUMINOSITY_UNITS[unit].toSI;
}
export function luminosityFromSI(si, unit) {
  return si / LUMINOSITY_UNITS[unit].toSI;
}
export function distanceToMeters(value, unit) {
  return value * DISTANCE_UNITS[unit].toMeters;
}
export function distanceFromMeters(meters, unit) {
  return meters / DISTANCE_UNITS[unit].toMeters;
}

// --- the inverse-square law itself (all SI: W, m, W/m²) -------------------

export function fluxFromLuminosityDistance(L, d) {
  return L / (4 * Math.PI * d * d);
}
export function luminosityFromFluxDistance(F, d) {
  return 4 * Math.PI * d * d * F;
}
export function distanceFromFluxLuminosity(F, L) {
  return Math.sqrt(L / (4 * Math.PI * F));
}

// --- error propagation ------------------------------------------------
// F = L / (4π d²) is a pure power law, so standard first-order
// (log-linear) propagation applies cleanly: for y = k·x₁^p₁·x₂^p₂,
// (σy/y)² = (p₁·σx₁/x₁)² + (p₂·σx₂/x₂)². Relative errors are
// unit-independent, so callers can pass a value's uncertainty in whatever
// unit that value itself is in — no separate conversion needed.

export function propagateRelativeError(relA, powerA, relB, powerB) {
  return Math.sqrt((powerA * relA) ** 2 + (powerB * relB) ** 2);
}

/** Relative uncertainty of F, given L's and d's relative uncertainties. */
export function relErrorFlux(relL, relD) {
  return propagateRelativeError(relL, 1, relD, 2);
}
/** Relative uncertainty of L, given F's and d's relative uncertainties. */
export function relErrorLuminosity(relF, relD) {
  return propagateRelativeError(relF, 1, relD, 2);
}
/** Relative uncertainty of d, given F's and L's relative uncertainties. */
export function relErrorDistance(relF, relL) {
  return propagateRelativeError(relF, 0.5, relL, 0.5);
}
