// Apparent magnitude (m), absolute magnitude (M), and distance (d), tied
// together by the distance modulus.
//
// Absolute magnitude is defined as the apparent magnitude an object
// WOULD have if it were placed exactly 10 parsecs away — so the
// difference m - M, the "distance modulus," is purely a function of how
// far past (or short of) that 10 pc reference point the object actually
// sits:
//
//   m - M = 5 log10(d / 10 pc)                       [no extinction]
//   m - M = 5 log10(d / 10 pc) + A                    [with extinction]
//
// A is the extinction in magnitudes along the line of sight — dust and
// gas dim (never brighten) an object, so A >= 0 always makes the object
// look fainter (larger m) than the extinction-free relation predicts for
// its true distance.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

export const PC_PER_LY = 1 / 3.2615637997; // 1 ly in parsecs

export const DISTANCE_UNITS = {
  pc: { label: "Parsecs", short: "pc", toParsecs: 1 },
  kpc: { label: "Kiloparsecs", short: "kpc", toParsecs: 1e3 },
  mpc: { label: "Megaparsecs", short: "Mpc", toParsecs: 1e6 },
  ly: { label: "Light-years", short: "ly", toParsecs: PC_PER_LY },
};
export const DISTANCE_UNIT_ORDER = ["pc", "kpc", "mpc", "ly"];

export function distanceToParsecs(value, unit) {
  return value * DISTANCE_UNITS[unit].toParsecs;
}
export function distanceFromParsecs(pc, unit) {
  return pc / DISTANCE_UNITS[unit].toParsecs;
}

/** m - M, given distance in parsecs and extinction A (magnitudes, default 0). */
export function distanceModulus(dPc, A = 0) {
  return 5 * Math.log10(dPc / 10) + A;
}

/** Apparent magnitude m, given M, distance in parsecs, and A. */
export function apparentFromAbsolute(M, dPc, A = 0) {
  return M + distanceModulus(dPc, A);
}

/** Absolute magnitude M, given m, distance in parsecs, and A. */
export function absoluteFromApparent(m, dPc, A = 0) {
  return m - distanceModulus(dPc, A);
}

/** Distance in parsecs, given m, M, and A. */
export function distanceFromMagnitudes(m, M, A = 0) {
  return 10 * Math.pow(10, (m - M - A) / 5);
}

// A handful of well-known real distances, for the distance-ladder chart —
// spanning from the nearest star to a nearby galaxy cluster, anchored on
// the 10 pc reference distance that absolute magnitude is defined at.
export const LANDMARKS = [
  { label: "Proxima Centauri (nearest star)", pc: 1.30 },
  { label: "10 pc — the M reference distance", pc: 10, special: true },
  { label: "Pleiades cluster", pc: 136 },
  { label: "Galactic center", pc: 8178 },
  { label: "Large Magellanic Cloud", pc: 49970 },
  { label: "Andromeda Galaxy (M31)", pc: 765000 },
  { label: "Virgo Cluster", pc: 16500000 },
];
