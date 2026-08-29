// The binary mass function: how far you can constrain an unseen
// companion's mass from radial-velocity measurements of its visible
// companion alone, with no knowledge of orbital inclination i or the
// visible star's own mass M1.
//
//   f(M) = P K³ / (2π G) · (1-e²)^(3/2) = M2³ sin³i / (M1+M2)²
//
// The single most useful, assumption-free fact this gives you: since
// M1 >= 0 makes (M1+M2)² >= M2², and sin i <= 1,
//
//   f(M) = M2³ sin³i / (M1+M2)² <= M2³ / M2² = M2
//
// so f(M) is a strict LOWER BOUND on the companion's mass — true for any
// M1 and any inclination, no assumptions required. This is exactly the
// reasoning historically used to argue Cygnus X-1's compact companion
// was too massive to be a neutron star.
//
// Given an estimate of M1 and the inclination i, f(M) can be inverted
// (a genuine cubic in M2, solved numerically here) for a specific M2.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

export const G = 6.6743e-11; // m^3 kg^-1 s^-2, CODATA 2018
export const M_SUN = 1.98847e30; // kg, IAU nominal solar mass
const DAY_S = 86400;
const YEAR_S = 365.25 * DAY_S;

export const PERIOD_UNITS = {
  hour: { label: "Hours", short: "hr", toS: 3600 },
  day: { label: "Days", short: "d", toS: DAY_S },
  year: { label: "Years", short: "yr", toS: YEAR_S },
};
export const PERIOD_UNIT_ORDER = ["hour", "day", "year"];

export const VELOCITY_UNITS = {
  kms: { label: "km/s", short: "km/s", toMs: 1000 },
  ms: { label: "m/s", short: "m/s", toMs: 1 },
};
export const VELOCITY_UNIT_ORDER = ["kms", "ms"];

export function periodToSeconds(value, unit) {
  return value * PERIOD_UNITS[unit].toS;
}
export function velocityToMs(value, unit) {
  return value * VELOCITY_UNITS[unit].toMs;
}

/** Binary mass function in kg, given P in seconds, K in m/s, eccentricity e. */
export function massFunctionKg(P_s, K_ms, e = 0) {
  const eTerm = Math.pow(Math.max(0, 1 - e * e), 1.5);
  return ((P_s * K_ms ** 3) / (2 * Math.PI * G)) * eTerm;
}

/** Same, in solar masses. */
export function massFunctionSolar(P_s, K_ms, e = 0) {
  return massFunctionKg(P_s, K_ms, e) / M_SUN;
}

/** f(M) implied by a specific (M1, M2, i) — used to build the M2-vs-i curve and to sanity-check the solver. */
export function massFunctionFromMasses(M1, M2, inclinationDeg) {
  const s = Math.sin((inclinationDeg * Math.PI) / 180);
  return (M2 ** 3 * s ** 3) / (M1 + M2) ** 2;
}

/**
 * Solve the cubic f(M) = M2^3 sin^3(i) / (M1+M2)^2 for M2 (all masses in
 * solar masses), given f(M), M1, and inclination in degrees. Robust
 * bisection: g(M2) = M2^3 sin^3(i) - f(M)(M1+M2)^2 is negative at M2=0
 * and strictly increasing to +infinity for M2>0 (sin i > 0), so it has
 * exactly one positive root.
 */
export function solveCompanionMass(fMSolar, M1Solar, inclinationDeg) {
  const s = Math.sin((inclinationDeg * Math.PI) / 180);
  if (!(fMSolar > 0) || !(M1Solar >= 0) || !(s > 0)) return null;
  const s3 = s ** 3;
  const g = (M2) => M2 ** 3 * s3 - fMSolar * (M1Solar + M2) ** 2;

  let lo = 0;
  let hi = Math.max(1, fMSolar, M1Solar) * 2;
  let guard = 0;
  while (g(hi) < 0 && guard < 200) {
    hi *= 2;
    guard++;
  }
  if (g(hi) < 0) return null;

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (g(mid) < 0) lo = mid;
    else hi = mid;
    if (hi - lo < mid * 1e-12 + 1e-15) break;
  }
  return (lo + hi) / 2;
}
