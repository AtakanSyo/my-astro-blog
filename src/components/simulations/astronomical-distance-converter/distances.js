// Astronomical distance conversions — fixed physical definitions, no
// external data. Everything is derived from three defining constants:
// the SI speed of light, the IAU-defined astronomical unit, and the
// IAU-defined parsec (via the AU and the small-angle definition).

export const C = 299792458; // speed of light, m/s (SI, exact)
export const M_PER_AU = 149597870700; // 1 AU in metres (IAU 2012, exact)
// 1 pc is the distance at which 1 AU subtends 1 arcsecond, i.e.
// 1 pc = 1 AU / tan(1″) ≈ (648000/π) AU (IAU 2015 definition, exact).
export const M_PER_PC = (648000 / Math.PI) * M_PER_AU;
// Julian year = 365.25 days of 86400 SI seconds each (exact, IAU/Gaia
// convention) — this is the standard definition used for "light-year."
export const JULIAN_YEAR_S = 365.25 * 86400;
export const M_PER_LY = C * JULIAN_YEAR_S;

export const UNITS = {
  m: { label: "Meters", short: "m", toMeters: 1 },
  km: { label: "Kilometers", short: "km", toMeters: 1e3 },
  au: { label: "Astronomical units", short: "AU", toMeters: M_PER_AU },
  ly: { label: "Light-years", short: "ly", toMeters: M_PER_LY },
  pc: { label: "Parsecs", short: "pc", toMeters: M_PER_PC },
  kpc: { label: "Kiloparsecs", short: "kpc", toMeters: M_PER_PC * 1e3 },
  mpc: { label: "Megaparsecs", short: "Mpc", toMeters: M_PER_PC * 1e6 },
  gpc: { label: "Gigaparsecs", short: "Gpc", toMeters: M_PER_PC * 1e9 },
};

export const UNIT_ORDER = ["m", "km", "au", "ly", "pc", "kpc", "mpc", "gpc"];

export function toMeters(value, unit) {
  return value * UNITS[unit].toMeters;
}

export function fromMeters(meters, unit) {
  return meters / UNITS[unit].toMeters;
}

const TIME_UNITS = [
  { unit: "Gyr", secs: JULIAN_YEAR_S * 1e9 },
  { unit: "Myr", secs: JULIAN_YEAR_S * 1e6 },
  { unit: "kyr", secs: JULIAN_YEAR_S * 1e3 },
  { unit: "yr", secs: JULIAN_YEAR_S },
  { unit: "day", secs: 86400 },
  { unit: "hr", secs: 3600 },
  { unit: "min", secs: 60 },
  { unit: "s", secs: 1 },
  { unit: "ms", secs: 1e-3 },
];

/** Light-travel time for a distance in metres, as a human-scale string. */
export function formatLightTime(meters, formatNumber) {
  const seconds = meters / C;
  for (const { unit, secs } of TIME_UNITS) {
    if (seconds >= secs) return `${formatNumber(seconds / secs)} ${unit}`;
  }
  return `${formatNumber(seconds * 1e3)} ms`;
}
