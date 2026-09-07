// The habitable zone: the range of orbital distances from a star where a
// rocky planet with an Earth-like atmosphere could sustain liquid water
// on its surface. This module implements the real, empirically-fitted
// formulation from Kopparapu, R. K., et al. (2013), "Habitable Zones
// Around Main-Sequence Stars: New Estimates", ApJ, 765, 131
// (https://doi.org/10.1088/0004-637X/765/2/131), NOT a simplified
// sqrt(luminosity) scaling.
//
// The paper computes a normalized "effective solar flux" S_eff at each
// of five named boundaries, as a quartic fit in stellar effective
// temperature:
//
//   S_eff = S_eff☉ + a·T★ + b·T★² + c·T★³ + d·T★⁴,   T★ = T_eff − 5780 K
//
// (5780 K is the nominal solar effective temperature the paper's own fit
// is centered on — a slightly different rounding than the IAU nominal
// 5772 K used elsewhere on this site for Stefan-Boltzmann calculations;
// both are cited "solar Teff" values, just for two different purposes,
// so both are kept, deliberately, as separate constants below.)
//
// The fit coefficients (Table 3 of the paper) are reproduced here to full
// published precision. They were cross-checked two ways before use: (1)
// against the paper's own worked example for the Sun — moist-greenhouse
// inner edge 0.99 AU, maximum-greenhouse outer edge 1.70 AU — which this
// module reproduces to within 0.001 AU (see habitableZone.test.js), and
// (2) against the widely-published TRAPPIST-1 conservative HZ figures of
// ≈0.024–0.048 AU (e.g. Kopparapu-formula figures reproduced in Gillon et
// al. 2017 discussion pieces), which this module also reproduces closely.
//
// Once S_eff is known, the boundary distance follows from the inverse-
// square law:
//
//   d = sqrt(L / S_eff)     (d in AU, L in solar luminosities)
//
// "Conservative" vs. "optimistic" habitable zone, as commonly used
// throughout the exoplanet literature that builds on this paper (Kane et
// al., the NASA Exoplanet Archive, the Planetary Habitability
// Laboratory, and Kopparapu's own follow-up mass-dependent paper,
// Kopparapu et al. 2014, ApJ 787, L29):
//   - Conservative HZ: inner = Runaway Greenhouse, outer = Maximum
//     Greenhouse — the narrower, higher-confidence zone most commonly
//     quoted as "the" habitable zone.
//   - Optimistic HZ: inner = Recent Venus, outer = Early Mars — a wider,
//     more liberal zone bounded by "Venus/Mars might once have had
//     surface water" empirical arguments, useful for not prematurely
//     ruling planets out.
// Moist Greenhouse is a third, in-between inner boundary the paper also
// discusses (and uses in its own Sun worked example) — included here for
// completeness and citation purposes, though the calculator's UI only
// surfaces the conservative/optimistic pair above.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

export const KOPPARAPU_T_REF = 5780; // K, the paper's own T★ = Teff − 5780 reference point
export const T_SUN = 5772; // K, IAU nominal solar effective temperature (Stefan-Boltzmann use, matches equilibriumTemp.js)
export const KOPPARAPU_TEFF_MIN = 2600; // K, lower bound of the paper's calibrated fit range
export const KOPPARAPU_TEFF_MAX = 7200; // K, upper bound of the paper's calibrated fit range

// Table 3, Kopparapu et al. (2013) — S_eff☉, a, b, c, d for each boundary,
// to the paper's full published precision.
export const KOPPARAPU_COEFFICIENTS = {
  recentVenus: {
    label: "Recent Venus",
    seffSun: 1.7753,
    a: 1.4316e-4,
    b: 2.9875e-9,
    c: -7.5702e-12,
    d: -1.1635e-15,
  },
  runawayGreenhouse: {
    label: "Runaway Greenhouse",
    seffSun: 1.0512,
    a: 1.3242e-4,
    b: 1.5418e-8,
    c: -7.9895e-12,
    d: -1.8328e-15,
  },
  moistGreenhouse: {
    label: "Moist Greenhouse",
    seffSun: 1.0140,
    a: 8.1774e-5,
    b: 1.7063e-9,
    c: -4.3241e-12,
    d: -6.6462e-16,
  },
  maximumGreenhouse: {
    label: "Maximum Greenhouse",
    seffSun: 0.3438,
    a: 5.8942e-5,
    b: 1.6558e-9,
    c: -3.0045e-12,
    d: -5.2983e-16,
  },
  earlyMars: {
    label: "Early Mars",
    seffSun: 0.3179,
    a: 5.4513e-5,
    b: 1.5313e-9,
    c: -2.7786e-12,
    d: -4.8997e-16,
  },
};

export const CONSERVATIVE_BOUNDARIES = { inner: "runawayGreenhouse", outer: "maximumGreenhouse" };
export const OPTIMISTIC_BOUNDARIES = { inner: "recentVenus", outer: "earlyMars" };

/** Normalized effective solar flux S_eff at a named Kopparapu boundary, for a given Teff (K). */
export function effectiveSolarFlux(teffK, boundaryKey) {
  const c = KOPPARAPU_COEFFICIENTS[boundaryKey];
  if (!c) return NaN;
  const t = teffK - KOPPARAPU_T_REF;
  return c.seffSun + c.a * t + c.b * t ** 2 + c.c * t ** 3 + c.d * t ** 4;
}

/**
 * Habitable-zone boundary distance in AU, at a named Kopparapu boundary,
 * for a given stellar effective temperature (K) and luminosity (solar
 * luminosities). Pure algebra, no input validation — a non-positive
 * luminosity or a S_eff that comes out non-positive both flow straight
 * through to Math.sqrt and surface as NaN, exactly like this site's other
 * math modules (see roche.js).
 */
export function hzDistanceAU(teffK, luminositySun, boundaryKey) {
  const seff = effectiveSolarFlux(teffK, boundaryKey);
  return Math.sqrt(luminositySun / seff);
}

/** Conservative HZ (Runaway Greenhouse inner, Maximum Greenhouse outer), in AU. */
export function conservativeHZ(teffK, luminositySun) {
  return {
    inner: hzDistanceAU(teffK, luminositySun, CONSERVATIVE_BOUNDARIES.inner),
    outer: hzDistanceAU(teffK, luminositySun, CONSERVATIVE_BOUNDARIES.outer),
  };
}

/** Optimistic HZ (Recent Venus inner, Early Mars outer), in AU. */
export function optimisticHZ(teffK, luminositySun) {
  return {
    inner: hzDistanceAU(teffK, luminositySun, OPTIMISTIC_BOUNDARIES.inner),
    outer: hzDistanceAU(teffK, luminositySun, OPTIMISTIC_BOUNDARIES.outer),
  };
}

/** Whether teffK falls inside the paper's own calibrated fit range (2600–7200 K). */
export function isWithinCalibratedRange(teffK) {
  return teffK >= KOPPARAPU_TEFF_MIN && teffK <= KOPPARAPU_TEFF_MAX;
}

/**
 * Stellar luminosity (solar luminosities) from radius (solar radii) and
 * effective temperature (K), via the Stefan-Boltzmann law:
 *   L/L☉ = (R/R☉)² (Teff/Teff☉)⁴
 * A "nice-to-have" alternative to entering luminosity directly.
 */
export function luminosityFromRadiusTeff(rStarSun, teffK) {
  return rStarSun ** 2 * (teffK / T_SUN) ** 4;
}

/**
 * Classifies a candidate planet's orbital distance (AU) against the
 * conservative and optimistic habitable zones. Five bands, matching the
 * structure of the diagrams commonly published alongside this formula:
 *   "too-hot"       — inside even the optimistic inner edge
 *   "optimistic-inner" — between the optimistic and conservative inner
 *                        edges (a warm, marginal zone: only "maybe", by
 *                        the more liberal Recent Venus criterion)
 *   "in-conservative"  — inside the conservative HZ (the confident zone)
 *   "optimistic-outer" — between the conservative and optimistic outer
 *                        edges (a cold, marginal zone)
 *   "too-cold"      — outside even the optimistic outer edge
 *   "invalid"       — non-finite/non-positive distance or zone data
 */
export function classifyOrbit(aAU, conservative, optimistic) {
  if (!(aAU > 0)) return "invalid";
  if (![conservative?.inner, conservative?.outer, optimistic?.inner, optimistic?.outer].every(Number.isFinite)) {
    return "invalid";
  }
  if (aAU < optimistic.inner) return "too-hot";
  if (aAU < conservative.inner) return "optimistic-inner";
  if (aAU <= conservative.outer) return "in-conservative";
  if (aAU <= optimistic.outer) return "optimistic-outer";
  return "too-cold";
}
