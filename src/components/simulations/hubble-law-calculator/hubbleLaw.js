// Hubble's law: the linear relation between a nearby galaxy's recession
// velocity and its distance from us.
//
//   v = H0 * d
//
// This is the low-redshift limit of the full FLRW cosmological
// distance-redshift relation — it holds well for d up to a few hundred
// megaparsecs (roughly z ≲ 0.1), where "distance" and "redshift-inferred
// velocity" are still unambiguous and space's expansion looks locally
// linear. Beyond that, "distance" itself splits into several distinct
// cosmological definitions (comoving, luminosity, angular-diameter...)
// that depend on the full expansion history (Ωm, ΩΛ), not just H0 — this
// module intentionally does NOT attempt that calculation. See the
// isLinearApproximationValid / getValidityLevel helpers below, which
// exist to flag exactly when the linear approximation is breaking down
// rather than silently returning a number that looks precise but isn't.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

const C_KM_S = 299792.458; // km/s, exact (SI definition of the metre)
const LY_PER_MPC = 3261563.777; // light-years per megaparsec (1 pc = 3.26156... ly)
const MLY_PER_MPC = LY_PER_MPC / 1e6; // million light-years per megaparsec

export const DISTANCE_UNITS = {
  mpc: { label: "Megaparsecs", short: "Mpc", toMpc: 1 },
  mly: { label: "Million light-years", short: "Mly", toMpc: 1 / MLY_PER_MPC },
};
export const DISTANCE_UNIT_ORDER = ["mpc", "mly"];

export const VELOCITY_UNITS = {
  kms: { label: "km/s", short: "km/s", toKms: 1 },
  c: { label: "Fraction of c", short: "c", toKms: C_KM_S },
};
export const VELOCITY_UNIT_ORDER = ["kms", "c"];

export function distanceToMpc(value, unit) {
  return value * DISTANCE_UNITS[unit].toMpc;
}
export function distanceFromMpc(mpc, unit) {
  return mpc / DISTANCE_UNITS[unit].toMpc;
}
export function velocityToKms(value, unit) {
  return value * VELOCITY_UNITS[unit].toKms;
}
export function velocityFromKms(kms, unit) {
  return kms / VELOCITY_UNITS[unit].toKms;
}

/** Recession velocity (km/s), given distance in Mpc and H0 in km/s/Mpc. */
export function velocityFromDistance(distanceMpc, H0) {
  return H0 * distanceMpc;
}

/** Distance (Mpc), given recession velocity in km/s and H0 in km/s/Mpc. */
export function distanceFromVelocity(velocityKms, H0) {
  return velocityKms / H0;
}

/** Recession velocity expressed as a fraction of the speed of light. */
export function velocityFractionOfC(velocityKms) {
  return velocityKms / C_KM_S;
}

export { C_KM_S };

/**
 * How trustworthy the linear v = H0*d approximation is at this velocity.
 * "ok"   — well within the low-redshift regime.
 * "warn" — starting to leave it; treat the number as a rough estimate only.
 * "bad"  — the linear approximation has clearly broken down; a full FLRW
 *          treatment (comoving/luminosity distance, Ωm, ΩΛ) is required.
 *
 * The 10% / 20% of c thresholds are deliberately round or-of-thumb
 * markers, not a precise redshift cutoff.
 */
export function getValidityLevel(velocityKms) {
  const frac = Math.abs(velocityFractionOfC(velocityKms));
  if (frac > 0.2) return "bad";
  if (frac > 0.1) return "warn";
  return "ok";
}
