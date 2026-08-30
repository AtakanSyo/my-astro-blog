// Main-sequence lifetime: a star's usable hydrogen fuel scales roughly
// with its mass, while the rate it burns that fuel scales with its
// luminosity, so
//
//   t_MS ∝ M / L
//
// Because luminosity itself rises steeply with mass on the main
// sequence (roughly L ∝ M^3.5 for M > ~0.5 M_sun — see this site's
// Stellar Mass-Luminosity Relation Calculator), the two effects don't
// cancel: t_MS ∝ M / M^3.5 = M^-2.5. Calibrated so a 1 M_sun star comes
// out close to the Sun's own remaining-plus-elapsed main-sequence span
// (~10 Gyr), this is commonly written as a single power law:
//
//   t_MS ≈ 10^10 (M/M_sun)^-2.5 yr
//
// This is an ORDER-OF-MAGNITUDE approximation, not a stellar-evolution
// model. It inherits the mass-luminosity relation's own limits: the
// real exponent isn't exactly 3.5 across the whole mass range (shallower
// below ~0.43 M_sun, nearly linear above ~20 M_sun), so real lifetimes
// depart from this single power law at both ends — most notably, very
// low-mass stars are fully convective and mix their entire hydrogen
// supply, stretching their lifetime even further than M^-2.5 alone
// would suggest. Composition, mass loss, and rotation shift real
// lifetimes further still. Treat the output as "roughly this many
// years," not a precise age.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

export const T_SUN_YR = 1e10; // yr, calibration lifetime at 1 M_sun
export const LIFETIME_EXPONENT = -2.5;
export const UNIVERSE_AGE_YR = 13.8e9; // yr, current age of the universe (Planck 2018)

// Forward: mass (solar masses) -> main-sequence lifetime (years).
export function lifetimeFromMass(mSolar) {
  return T_SUN_YR * Math.pow(mSolar, LIFETIME_EXPONENT);
}

// Reverse: main-sequence lifetime (years) -> mass (solar masses).
export function massFromLifetime(tYr) {
  return Math.pow(tYr / T_SUN_YR, 1 / LIFETIME_EXPONENT);
}

// For comparison: the lifetime if fuel consumption scaled 1:1 with mass
// (t ∝ 1/M) instead of with the much steeper luminosity — i.e. what
// you'd guess if you ignored that heavier stars burn disproportionately
// brighter, not just bigger.
export function naiveLifetimeFromMass(mSolar) {
  return T_SUN_YR / mSolar;
}

export const YEAR_UNITS = {
  yr: { label: "Years", short: "yr", toYr: 1 },
  kyr: { label: "Thousand years", short: "kyr", toYr: 1e3 },
  myr: { label: "Million years", short: "Myr", toYr: 1e6 },
  gyr: { label: "Billion years", short: "Gyr", toYr: 1e9 },
  tyr: { label: "Trillion years", short: "Tyr", toYr: 1e12 },
};
export const YEAR_UNIT_ORDER = ["yr", "kyr", "myr", "gyr", "tyr"];

export function yearsToUnit(yr, unit) {
  return yr / YEAR_UNITS[unit].toYr;
}
export function yearsFromUnit(value, unit) {
  return value * YEAR_UNITS[unit].toYr;
}

/** Picks the key of the largest year-unit that keeps the value >= 1, for compact auto-formatted display. */
export function pickYearUnitKey(yr) {
  const order = [...YEAR_UNIT_ORDER].reverse(); // largest first
  for (const key of order) {
    if (yr >= YEAR_UNITS[key].toYr) return key;
  }
  return "yr";
}

/** A rough spectral-type classification by mass, for context only (same buckets used across this site's stellar calculators). */
export function classifyByMass(mSolar) {
  if (mSolar < 0.08) return { label: "Below the hydrogen-fusion limit — a brown dwarf, not a true star", tone: "warn" };
  if (mSolar < 0.45) return { label: "M-type red dwarf", tone: "normal" };
  if (mSolar < 0.8) return { label: "K-type (orange dwarf)", tone: "normal" };
  if (mSolar < 1.04) return { label: "G-type (Sun-like)", tone: "normal" };
  if (mSolar < 1.4) return { label: "F-type", tone: "normal" };
  if (mSolar < 2.1) return { label: "A-type", tone: "normal" };
  if (mSolar < 16) return { label: "B-type", tone: "normal" };
  if (mSolar <= 150) return { label: "O-type — very massive, short-lived", tone: "normal" };
  return { label: "Above the highest reliably measured stellar masses (~150–300 M☉)", tone: "warn" };
}

// A representative spread across the main sequence — by spectral class,
// not individual named stars, since this calculator's whole point is
// the formula's own output across masses, not a fit to specific real
// stars' measured ages. Used for both the chart markers and the
// horizontal lifetime-comparison bars.
export const REPRESENTATIVE_STARS = [
  { label: "Red dwarf (M)", mSolar: 0.2 },
  { label: "Orange dwarf (K)", mSolar: 0.7 },
  { label: "The Sun (G)", mSolar: 1 },
  { label: "F-type", mSolar: 1.5 },
  { label: "A-type", mSolar: 2.5 },
  { label: "B-type", mSolar: 10 },
  { label: "O-type", mSolar: 40 },
];
