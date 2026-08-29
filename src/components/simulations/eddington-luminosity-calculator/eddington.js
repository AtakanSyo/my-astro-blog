// Eddington luminosity and Eddington ratio for an accreting object.
//
// The Eddington limit is the luminosity at which outward radiation
// pressure on ionized gas (via electron/Thomson scattering) exactly
// balances the inward pull of gravity on that same gas. Above it,
// radiation pressure should in principle blow accreting material away
// rather than let it fall in — though real disks routinely exceed this
// "limit" via photon bubbles, geometric beaming, and other departures
// from the idealized spherical, steady-state, pure-hydrogen assumptions
// baked into the formula below.
//
//   L_Edd = 4π G M m_p c / σ_T  ≈  1.26 × 10^38 (M / M_sun) erg/s
//
// This assumes fully ionized hydrogen: one proton's worth of mass is
// dragged along per free electron doing the scattering (mean molecular
// weight per electron, μ_e = 1). A different composition — solar-mix
// plasma, or pure ionized helium — raises μ_e and lowers L_Edd by
// roughly that same factor; this calculator implements the standard
// pure-hydrogen case exactly as written above and no more.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

export const G = 6.6743e-11; // m^3 kg^-1 s^-2, CODATA 2018
export const C = 299792458; // m/s, exact
export const M_PROTON = 1.67262192369e-27; // kg, CODATA 2018
export const SIGMA_T = 6.6524587321e-29; // m^2, Thomson cross section
export const M_SUN = 1.98847e30; // kg, IAU nominal solar mass
export const L_SUN = 3.828e26; // W, IAU 2015 nominal solar luminosity (exact, by definition)

export const MASS_UNITS = {
  msun: { label: "Solar masses", short: "M☉", toKg: M_SUN },
  kg: { label: "Kilograms", short: "kg", toKg: 1 },
};
export const MASS_UNIT_ORDER = ["msun", "kg"];

export const LUMINOSITY_UNITS = {
  ergs: { label: "erg s⁻¹", short: "erg s⁻¹", toSI: 1e-7 },
  watt: { label: "Watts", short: "W", toSI: 1 },
  lsun: { label: "Solar luminosities", short: "L☉", toSI: L_SUN },
};
export const LUMINOSITY_UNIT_ORDER = ["ergs", "watt", "lsun"];

export function massToKg(value, unit) {
  return value * MASS_UNITS[unit].toKg;
}
export function luminosityToSI(value, unit) {
  return value * LUMINOSITY_UNITS[unit].toSI;
}
export function luminosityFromSI(si, unit) {
  return si / LUMINOSITY_UNITS[unit].toSI;
}

/** Eddington luminosity in Watts, given mass in kilograms. */
export function eddingtonLuminosityWatts(massKg) {
  return (4 * Math.PI * G * massKg * M_PROTON * C) / SIGMA_T;
}

/** L / L_Edd, both in the same (SI) units. */
export function eddingtonRatio(luminosityWatts, eddWatts) {
  return luminosityWatts / eddWatts;
}

/** A rough, commonly-used classification of the Eddington ratio. */
export function classifyRatio(lambda) {
  if (!Number.isFinite(lambda) || lambda <= 0) return null;
  if (lambda < 0.01) return { label: "Deeply sub-Eddington", tone: "good" };
  if (lambda < 0.3) return { label: "Sub-Eddington", tone: "good" };
  if (lambda < 1) return { label: "Approaching Eddington", tone: "warn" };
  if (lambda < 1.5) return { label: "Near-Eddington", tone: "warn" };
  return { label: "Super-Eddington", tone: "bad" };
}
