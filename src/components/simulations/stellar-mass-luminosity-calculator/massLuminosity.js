// The main-sequence mass-luminosity relation: an empirical fit, not a
// derived physical law. Luminosity rises far faster than mass for
// most of the main sequence — L ∝ M^4 near the Sun — because a more
// massive star's core runs hotter and burns hydrogen at a wildly
// disproportionate rate, not because it simply has more fuel.
//
// The exponent isn't constant across the whole mass range, which is
// why this uses a commonly-cited PIECEWISE approximation instead of one
// power law:
//
//   M < 0.43 M_sun:        L = 0.23 M^2.3
//   0.43 <= M < 2 M_sun:    L = M^4
//   2 <= M < 20 M_sun:      L = 1.4 M^3.5
//   M >= 20 M_sun:          L = 3200 M
//
// (masses and L in solar units). The branches don't join perfectly
// continuously at their boundaries — each is an independent fit to a
// different mass range's data, not pieces of one master formula — which
// is itself a genuine, worth-noticing feature of treating this as an
// empirical approximation rather than a single universal law.
//
// This describes MAIN-SEQUENCE stars only. Giants, white dwarfs,
// pre-main-sequence stars, and other evolved stars follow completely
// different mass-luminosity behavior and are not described by this
// relation at all.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

export const L_SUN_W = 3.828e26; // W, IAU 2015 nominal solar luminosity (exact, by definition)
export const M_BOL_SUN = 4.74; // IAU 2015 nominal absolute bolometric magnitude of the Sun

// Forward: mass (solar masses) -> luminosity (solar luminosities).
export function luminosityFromMass(mSolar) {
  if (mSolar < 0.43) return 0.23 * mSolar ** 2.3;
  if (mSolar < 2) return mSolar ** 4;
  if (mSolar < 20) return 1.4 * mSolar ** 3.5;
  return 3200 * mSolar;
}

// L thresholds for the reverse direction, taken consistently from the
// Sun-calibrated M^4 branch (and the upper branch's own boundary) so
// there's exactly one unambiguous branch to invert for any L.
const L_BREAK_LOW = 0.43 ** 4;
const L_BREAK_MID = 2 ** 4;
const L_BREAK_HIGH = 1.4 * 20 ** 3.5;

// Reverse: luminosity (solar luminosities) -> estimated mass (solar masses).
export function massFromLuminosity(lSolar) {
  if (lSolar < L_BREAK_LOW) return (lSolar / 0.23) ** (1 / 2.3);
  if (lSolar < L_BREAK_MID) return lSolar ** (1 / 4);
  if (lSolar < L_BREAK_HIGH) return (lSolar / 1.4) ** (1 / 3.5);
  return lSolar / 3200;
}

export function luminosityToWatts(lSolar) {
  return lSolar * L_SUN_W;
}

export function absoluteBolometricMagnitude(lSolar) {
  return M_BOL_SUN - 2.5 * Math.log10(lSolar);
}

/** The local power-law exponent (d ln L / d ln M) at a given mass — which branch's slope applies. */
export function localExponent(mSolar) {
  if (mSolar < 0.43) return 2.3;
  if (mSolar < 2) return 4;
  if (mSolar < 20) return 3.5;
  return 1;
}

/** A rough spectral-type classification by mass, for context only. */
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

// A few real (approximate) main-sequence stars, for the diagram's
// permanent landmarks — actual luminosities, not this formula's output,
// since the whole point is to show how closely (or not) the relation
// tracks reality.
export const REAL_STAR_LANDMARKS = [
  { label: "Proxima Centauri", mSolar: 0.122, lSolar: 0.0017 },
  { label: "The Sun", mSolar: 1, lSolar: 1 },
  { label: "Sirius A", mSolar: 2.063, lSolar: 25.4 },
  { label: "Rigel", mSolar: 21, lSolar: 120000 },
];
