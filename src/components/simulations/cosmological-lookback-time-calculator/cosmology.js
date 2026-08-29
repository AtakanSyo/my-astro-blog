// Cosmological lookback time in a Friedmann–Lemaître–Robertson–Walker
// (FLRW) universe with matter and a cosmological constant.
//
// The expansion rate at redshift z, relative to today, is
//
//   E(z) = sqrt(Ω_m (1+z)^3 + Ω_k (1+z)^2 + Ω_Λ)
//
// where Ω_k = 1 - Ω_m - Ω_Λ is the curvature density (zero for a flat
// universe, which is what this calculator assumes by default). The
// lookback time to redshift z — how long ago that light was emitted —
// is then
//
//   t_L(z) = (1/H0) ∫[0,z] dz' / [(1+z') E(z')]
//
// This is a genuine numerical integral, not a closed-form algebraic
// relation, evaluated here with Simpson's rule at a resolution far finer
// than the difference matters at (see chooseSteps below). Radiation
// (Ω_r) is omitted, matching the standard matter+Λ approximation used
// at the redshifts most observational targets sit at; it becomes
// relevant only deep in the early universe (z ~ 1000+), where this
// calculator's results should be treated as approximate.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

const M_PER_AU = 149597870700; // m, IAU 2012, exact
const M_PER_PC = (648000 / Math.PI) * M_PER_AU; // IAU 2015, exact
export const KM_PER_MPC = (M_PER_PC / 1000) * 1e6; // km per megaparsec
const JULIAN_YEAR_S = 365.25 * 86400;
export const GYR_S = JULIAN_YEAR_S * 1e9;

/** Hubble time 1/H0 in Gyr, given H0 in km/s/Mpc. */
export function hubbleTimeGyr(H0) {
  return KM_PER_MPC / H0 / GYR_S;
}

/** E(z) = H(z)/H0 for a matter + curvature + Λ universe. */
export function Efunc(z, Om, OL, Ok) {
  const zp1 = 1 + z;
  return Math.sqrt(Om * zp1 ** 3 + Ok * zp1 ** 2 + OL);
}

/** Same expansion function in terms of scale factor a = 1/(1+z). */
export function EfuncA(a, Om, OL, Ok) {
  return Math.sqrt(Om / a ** 3 + Ok / a ** 2 + OL);
}

/** Composite Simpson's rule for f on [a,b] with n (even) subintervals. */
export function simpson(f, a, b, n) {
  const steps = n % 2 === 0 ? n : n + 1;
  const h = (b - a) / steps;
  let sum = f(a) + f(b);
  for (let i = 1; i < steps; i++) {
    const x = a + i * h;
    sum += (i % 2 === 0 ? 2 : 4) * f(x);
  }
  return (sum * h) / 3;
}

/** More subintervals for larger z keeps per-step resolution roughly fixed. */
function chooseSteps(z) {
  return Math.min(20000, Math.max(400, Math.ceil(z * 400)));
}

/**
 * Lookback time in Gyr to redshift z, and the finite integral's validity.
 * Returns null if the model is unphysical over [0, z] (e.g. a
 * recollapsing universe where E(z) would need to be imaginary).
 */
export function lookbackTimeGyr(z, Om, OL, Ok, H0) {
  if (!(z >= 0) || !(H0 > 0)) return null;
  if (z === 0) return 0;
  const integrand = (zp) => {
    const e = Efunc(zp, Om, OL, Ok);
    return Number.isFinite(e) && e > 0 ? 1 / ((1 + zp) * e) : NaN;
  };
  const integral = simpson(integrand, 0, z, chooseSteps(z));
  if (!Number.isFinite(integral)) return null;
  return integral * hubbleTimeGyr(H0);
}

/**
 * Age of the universe in Gyr at scale factor a (a=1 is today). Uses the
 * scale-factor form of the age integral, which stays finite and
 * well-behaved all the way down to a -> 0 (matter domination makes the
 * integrand vanish as sqrt(a) there), unlike integrating the redshift
 * form out to z -> infinity.
 */
export function ageAtScaleFactorGyr(a, Om, OL, Ok, H0) {
  if (!(a > 0) || !(H0 > 0)) return null;
  const aMin = 1e-8;
  const integrand = (ap) => {
    const e = EfuncA(ap, Om, OL, Ok);
    return Number.isFinite(e) && e > 0 ? 1 / (ap * e) : NaN;
  };
  const integral = simpson(integrand, aMin, a, 4000);
  if (!Number.isFinite(integral)) return null;
  return integral * hubbleTimeGyr(H0);
}

export function ageOfUniverseTodayGyr(Om, OL, Ok, H0) {
  return ageAtScaleFactorGyr(1, Om, OL, Ok, H0);
}
