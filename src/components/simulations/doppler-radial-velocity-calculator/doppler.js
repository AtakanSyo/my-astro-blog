// Doppler shift <-> radial velocity for a spectral line, in both the
// classical (low-velocity) approximation and the exact relativistic
// longitudinal Doppler relation.
//
// Classical (v << c):
//
//   v_r / c ≈ (λ_obs - λ0) / λ0 = Δλ / λ0
//
// Relativistic (purely radial motion, exact — this already includes
// time dilation, not just the classical piece):
//
//   λ_obs / λ0 = sqrt[(1+β)/(1-β)],   β = v_r / c
//
// Both use the same sign convention: v_r > 0 is receding (redshifted,
// λ_obs > λ0), v_r < 0 is approaching (blueshifted, λ_obs < λ0) — the
// same convention spectroscopists use for radial velocity.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

export const C = 299792458; // m/s, exact

export const WAVELENGTH_UNITS = {
  angstrom: { label: "Ångströms", short: "Å", toM: 1e-10 },
  nm: { label: "Nanometers", short: "nm", toM: 1e-9 },
  um: { label: "Micrometers", short: "µm", toM: 1e-6 },
};
export const WAVELENGTH_UNIT_ORDER = ["angstrom", "nm", "um"];

export const VELOCITY_UNITS = {
  kms: { label: "km/s", short: "km/s", toMs: 1000 },
  ms: { label: "m/s", short: "m/s", toMs: 1 },
};
export const VELOCITY_UNIT_ORDER = ["kms", "ms"];

export function wavelengthToMeters(value, unit) {
  return value * WAVELENGTH_UNITS[unit].toM;
}
export function metersToWavelength(meters, unit) {
  return meters / WAVELENGTH_UNITS[unit].toM;
}
export function velocityToMs(value, unit) {
  return value * VELOCITY_UNITS[unit].toMs;
}
export function msToVelocity(ms, unit) {
  return ms / VELOCITY_UNITS[unit].toMs;
}

/** Classical radial velocity (m/s) from rest and observed wavelengths (any consistent unit). */
export function velocityClassical(lamRest, lamObs) {
  return C * ((lamObs - lamRest) / lamRest);
}

/** Exact relativistic radial velocity (m/s) from rest and observed wavelengths. */
export function velocityRelativistic(lamRest, lamObs) {
  const R = lamObs / lamRest;
  const R2 = R * R;
  const beta = (R2 - 1) / (R2 + 1);
  return beta * C;
}

/** Classical observed wavelength given rest wavelength and radial velocity (m/s). */
export function observedWavelengthClassical(lamRest, v) {
  return lamRest * (1 + v / C);
}

/** Exact relativistic observed wavelength given rest wavelength and radial velocity (m/s). Returns null if |v| >= c. */
export function observedWavelengthRelativistic(lamRest, v) {
  const beta = v / C;
  if (Math.abs(beta) >= 1) return null;
  return lamRest * Math.sqrt((1 + beta) / (1 - beta));
}

/** λ_obs/λ0 ratio predicted classically for a given β = v/c. */
export function ratioClassical(beta) {
  return 1 + beta;
}
/** λ_obs/λ0 ratio predicted relativistically for a given β = v/c. Returns null if |β| >= 1. */
export function ratioRelativistic(beta) {
  if (Math.abs(beta) >= 1) return null;
  return Math.sqrt((1 + beta) / (1 - beta));
}
