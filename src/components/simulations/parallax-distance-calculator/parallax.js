// Stellar parallax ↔ distance — the definition of the parsec itself.
//
//   d(pc) = 1 / p(arcsec)
//
// A parsec is, by definition, the distance at which 1 AU subtends an
// angle of exactly 1 arcsecond — so this relation is exact, not
// approximate, as long as p is in arcseconds and d in parsecs.
//
// Parallax is measured by comparing a nearby star's apparent position
// against distant background stars from two points in Earth's orbit
// (classically, 6 months apart) — the star appears to shift because
// Earth itself has moved, not because the star has.

export const M_PER_AU = 149597870700; // m, IAU 2012, exact
export const M_PER_PC = (648000 / Math.PI) * M_PER_AU; // IAU 2015, exact
export const C = 299792458;
export const JULIAN_YEAR_S = 365.25 * 86400;
export const M_PER_LY = C * JULIAN_YEAR_S;

export const PARALLAX_UNITS = {
  arcsec: { label: "Arcseconds", short: "″", toArcsec: 1 },
  mas: { label: "Milliarcseconds", short: "mas", toArcsec: 1e-3 },
  uas: { label: "Microarcseconds", short: "µas", toArcsec: 1e-6 },
};
export const PARALLAX_UNIT_ORDER = ["arcsec", "mas", "uas"];

export const DISTANCE_UNITS = {
  au: { label: "Astronomical units", short: "AU", toMeters: M_PER_AU },
  pc: { label: "Parsecs", short: "pc", toMeters: M_PER_PC },
  ly: { label: "Light-years", short: "ly", toMeters: M_PER_LY },
  kpc: { label: "Kiloparsecs", short: "kpc", toMeters: M_PER_PC * 1e3 },
};
export const DISTANCE_UNIT_ORDER = ["au", "pc", "ly", "kpc"];

export function parallaxToArcsec(value, unit) {
  return value * PARALLAX_UNITS[unit].toArcsec;
}
export function arcsecToParallax(arcsec, unit) {
  return arcsec / PARALLAX_UNITS[unit].toArcsec;
}
export function distanceToMeters(value, unit) {
  return value * DISTANCE_UNITS[unit].toMeters;
}
export function metersToDistance(meters, unit) {
  return meters / DISTANCE_UNITS[unit].toMeters;
}

export function distancePcFromParallaxArcsec(pArcsec) {
  return 1 / pArcsec;
}
export function parallaxArcsecFromDistancePc(dPc) {
  return 1 / dPc;
}

// --- uncertainty ---------------------------------------------------------
// d = 1/p is a pure power law (exponent -1), so first-order propagation
// is exact and simple: fractional uncertainty is preserved,
// σd/d = σp/p. But that linear approximation is only trustworthy when
// the fractional parallax uncertainty is itself small — see
// parallaxReliability below for why.

export function relativeDistanceUncertainty(relParallaxUncertainty) {
  return relParallaxUncertainty;
}

/**
 * How trustworthy a naive d = 1/p point estimate and its linearly
 * propagated uncertainty are, given the fractional parallax uncertainty
 * σp/p. d = 1/p is a nonlinear transform, so for a (roughly) Gaussian
 * parallax measurement, the induced distribution on d becomes
 * increasingly skewed and biased as σp/p grows — the mean and mode of
 * 1/p pull apart, and simple symmetric error bars stop meaning what they
 * appear to mean. Practicing astrometry (e.g. Gaia distance work) treats
 * this as a real, well-documented effect, not a minor technicality —
 * see Bailer-Jones (2015) and the Bayesian-prior approaches it motivated.
 */
export function parallaxReliability(fracUncertainty) {
  const f = Math.abs(fracUncertainty);
  if (f < 0.1) return { label: "Reliable", tone: "good" };
  if (f < 0.2) return { label: "Use with caution", tone: "warn" };
  return { label: "Simple inversion unreliable", tone: "bad" };
}
