// Apparent magnitude ↔ relative brightness (flux ratio).
//
// The astronomical magnitude scale is reversed and logarithmic: a LOWER
// (or more negative) magnitude means a BRIGHTER object, and every step of
// exactly 5 magnitudes corresponds to exactly a factor of 100 in flux —
// fixed by definition since Pogson's 1856 proposal formalized what had
// been a rough ancient ranking into a precise scale.
//
//   F1 / F2 = 10^(-0.4 * (m1 - m2))
//   m1 - m2 = -2.5 * log10(F1 / F2)
//
// This module is deliberately unit-free: "flux" here can be bolometric
// flux, a single filter band's flux, or even photon count rate, as long
// as both objects being compared were measured the same way.

export const POGSON_RATIO = Math.pow(100, 1 / 5); // ≈ 2.511886…, exact by definition

/** F1/F2 given the magnitude difference m1 - m2. */
export function ratioFromMagDiff(deltaM) {
  return Math.pow(10, -0.4 * deltaM);
}

/** m1 - m2 given the flux ratio F1/F2. */
export function magDiffFromRatio(ratio) {
  return -2.5 * Math.log10(ratio);
}

/**
 * Flux ratio between two objects `d` magnitudes apart — always >= 1,
 * independent of which one is brighter. Used for the static "reference
 * table" of well-known magnitude steps.
 */
export function ratioForMagnitudeStep(d) {
  return Math.pow(10, 0.4 * Math.abs(d));
}

/**
 * Turn a signed flux ratio F_A/F_B into a brighter/dimmer, always->=1
 * factor for display, e.g. "Object A is 100x brighter than Object B".
 */
export function describeRatio(ratioAOverB) {
  if (!Number.isFinite(ratioAOverB) || ratioAOverB <= 0) return null;
  if (Math.abs(Math.log10(ratioAOverB)) < 1e-9) return { brighter: "equal", factor: 1 };
  return ratioAOverB > 1
    ? { brighter: "A", factor: ratioAOverB }
    : { brighter: "B", factor: 1 / ratioAOverB };
}

/** A "nice" tick step (1/2/5 × a power of 10) covering `span` in ~targetCount ticks. */
export function niceStep(span, targetCount = 6) {
  if (!(span > 0)) return 1;
  const raw = span / targetCount;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
  return step * mag;
}
