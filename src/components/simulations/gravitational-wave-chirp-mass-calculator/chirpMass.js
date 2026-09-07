// Gravitational-wave chirp mass: the single combination of two compact
// objects' masses that a gravitational-wave detector like LIGO/Virgo
// measures most precisely, because it alone sets the leading-order rate
// at which the signal's frequency sweeps upward during inspiral.
//
//   M_c = (M1 M2)^(3/5) / (M1 + M2)^(1/5)
//
// Also computed here: total mass, mass ratio q = M2/M1, the symmetric
// mass ratio eta = M1 M2 / (M1+M2)^2 (0 < eta <= 0.25, maximized for
// equal masses), and the reduced mass mu = M1 M2 / (M1+M2). Together
// with the chirp mass these are the standard set of "mass parameters"
// used to describe a compact binary in the post-Newtonian literature.
//
// Also included:
//   - iscoFrequency: an order-of-magnitude estimate of the gravitational-
//     wave frequency at the innermost stable circular orbit (ISCO) for
//     the TOTAL mass, treating the binary as a test particle in
//     Schwarzschild spacetime. This is NOT a precise numerical-relativity
//     merger frequency (the true merger happens a bit later, at somewhat
//     higher frequency, once strong-field two-body dynamics take over)
//     — it's the standard "back of the envelope" marker for where the
//     signal is roughly expected to end, and is presented to the user as
//     exactly that.
//   - gwFrequency / timeToMerger: the leading (Newtonian/quadrupole)
//     post-Newtonian frequency evolution of an inspiraling binary, i.e.
//     the actual "chirp" — frequency sweeping upward as coalescence
//     approaches. This is the real textbook formula (e.g. Maggiore,
//     "Gravitational Waves" Vol. 1, eq. 4.23) used to draw the frequency-
//     sweep chart on this calculator's page.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

export const G = 6.6743e-11; // m^3 kg^-1 s^-2 (CODATA 2018)
export const C = 299792458; // m/s, exact (SI definition of the metre)

// IAU (2015) nominal solar mass parameter GM_sun = 1.3271244e20 m^3/s^2,
// divided by G above, gives the solar mass in kilograms used throughout.
export const SOLAR_MASS_KG = 1.98892e30; // kg

export const MASS_UNITS = {
  msun: { label: "Solar masses", short: "M☉", toKg: SOLAR_MASS_KG },
  kg: { label: "Kilograms", short: "kg", toKg: 1 },
};
export const MASS_UNIT_ORDER = ["msun", "kg"];

export function massToKg(value, unit) {
  return value * MASS_UNITS[unit].toKg;
}
export function massFromKg(kg, unit) {
  return kg / MASS_UNITS[unit].toKg;
}

/**
 * Chirp mass, M_c = (M1 M2)^(3/5) / (M1+M2)^(1/5). Unit-agnostic — pass
 * both masses in the same unit (kg, solar masses, whatever) and the
 * result comes back in that same unit.
 */
export function chirpMass(m1, m2) {
  return Math.pow(m1 * m2, 3 / 5) / Math.pow(m1 + m2, 1 / 5);
}

/** Total mass, M1 + M2 (same unit as the inputs). */
export function totalMass(m1, m2) {
  return m1 + m2;
}

/** Mass ratio q = M2 / M1 (dimensionless — unit-agnostic as long as both inputs share a unit). */
export function massRatio(m1, m2) {
  return m2 / m1;
}

/** Symmetric mass ratio, eta = M1 M2 / (M1+M2)^2. Dimensionless; 0 < eta <= 0.25. */
export function symmetricMassRatio(m1, m2) {
  const total = m1 + m2;
  return (m1 * m2) / (total * total);
}

/** Reduced mass, mu = M1 M2 / (M1+M2) (same unit as the inputs). */
export function reducedMass(m1, m2) {
  return (m1 * m2) / (m1 + m2);
}

/**
 * Order-of-magnitude gravitational-wave frequency at the innermost
 * stable circular orbit (ISCO), for a given TOTAL mass in kilograms.
 * Derived from the Schwarzschild ISCO radius r_isco = 6GM/c^2 and the
 * test-particle orbital angular velocity there, doubled for the
 * dominant (l=2) gravitational-wave harmonic:
 *
 *   f_ISCO = c^3 / (6^1.5 * pi * G * M)
 *
 * Returns Hz. This treats the merging pair as a test particle orbiting
 * a single Schwarzschild mass equal to the binary's total mass — a
 * genuinely rough estimate of "where the signal ends," not the precise
 * frequency of the true numerical-relativity merger (which real
 * simulations show arrives somewhat later, at a somewhat higher
 * frequency, once strong-field two-body effects that this estimate
 * ignores take over).
 */
export function iscoFrequency(totalMassKg) {
  return Math.pow(C, 3) / (Math.pow(6, 1.5) * Math.PI * G * totalMassKg);
}

/**
 * Leading post-Newtonian (Newtonian-quadrupole) gravitational-wave
 * frequency, a time `tauSeconds` before coalescence, for a binary with
 * the given chirp mass in kilograms:
 *
 *   f(tau) = (1/pi) * (5 / (256 * tau))^(3/8) * (G M_c / c^3)^(-5/8)
 *
 * Returns Hz. `tauSeconds` is the time REMAINING until merger (so it
 * decreases toward 0 as the signal sweeps upward and ends at the
 * merger). This is the real leading-order chirp formula (e.g. Maggiore,
 * "Gravitational Waves" Vol. 1, eq. 4.23) — deliberately left as pure
 * algebra with no input guards, so it responds exactly as the formula
 * predicts even at degenerate inputs (see chirpMassTests.js for what
 * that looks like at tau = 0 or negative tau).
 */
export function gwFrequency(tauSeconds, chirpMassKg) {
  const gmc3 = (G * chirpMassKg) / Math.pow(C, 3); // seconds — the binary's characteristic "geometric" timescale
  return (1 / Math.PI) * Math.pow(5 / (256 * tauSeconds), 3 / 8) * Math.pow(gmc3, -5 / 8);
}

/**
 * Inverse of gwFrequency: the time remaining until merger at which the
 * gravitational-wave frequency equals `freqHz`, for a binary with the
 * given chirp mass in kilograms. Returns seconds.
 */
export function timeToMerger(freqHz, chirpMassKg) {
  const gmc3 = (G * chirpMassKg) / Math.pow(C, 3);
  const base = freqHz * Math.PI * Math.pow(gmc3, 5 / 8);
  return 5 / (256 * Math.pow(base, 8 / 3));
}
