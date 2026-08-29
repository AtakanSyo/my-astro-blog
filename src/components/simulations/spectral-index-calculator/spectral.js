// Spectral index — how a source's flux density varies with frequency.
//
// This tool uses the convention
//
//   S_ν ∝ ν^α
//
// which is standard in radio astronomy (NVSS, VLSS, and most survey
// catalogs use it). Some older or non-radio literature instead defines
// α via S_ν ∝ ν^-α — the opposite sign. Always check which convention a
// quoted α uses before comparing values across sources; this calculator
// is consistent throughout with S_ν ∝ ν^α.
//
// Given two flux-density measurements S1 at ν1 and S2 at ν2:
//
//   S2/S1 = (ν2/ν1)^α   ⇒   α = ln(S2/S1) / ln(ν2/ν1)
//
// and that same α extrapolates a predicted flux density at any third
// frequency ν3 via S3 = S1·(ν3/ν1)^α.

export const FREQ_UNITS = {
  hz: { label: "Hertz", short: "Hz", toHz: 1 },
  khz: { label: "Kilohertz", short: "kHz", toHz: 1e3 },
  mhz: { label: "Megahertz", short: "MHz", toHz: 1e6 },
  ghz: { label: "Gigahertz", short: "GHz", toHz: 1e9 },
};
export const FREQ_UNIT_ORDER = ["hz", "khz", "mhz", "ghz"];

export const FLUX_DENSITY_UNITS = {
  jy: { label: "Jansky", short: "Jy", toJy: 1 },
  mjy: { label: "Millijansky", short: "mJy", toJy: 1e-3 },
  ujy: { label: "Microjansky", short: "µJy", toJy: 1e-6 },
};
export const FLUX_DENSITY_UNIT_ORDER = ["jy", "mjy", "ujy"];

export function freqToHz(value, unit) {
  return value * FREQ_UNITS[unit].toHz;
}
export function fluxToJy(value, unit) {
  return value * FLUX_DENSITY_UNITS[unit].toJy;
}
export function jyToFlux(jy, unit) {
  return jy / FLUX_DENSITY_UNITS[unit].toJy;
}

/** α from two (frequency, flux density) points — both in any consistent unit. */
export function computeAlpha(S1, nu1, S2, nu2) {
  if (!(S1 > 0) || !(S2 > 0) || !(nu1 > 0) || !(nu2 > 0) || nu1 === nu2) {
    return { valid: false, reason: "Enter two distinct, positive frequencies and positive flux densities." };
  }
  return { valid: true, alpha: Math.log(S2 / S1) / Math.log(nu2 / nu1) };
}

// Treats ν1, ν2 as exactly known (frequencies are normally tuned/measured
// far more precisely than flux density) and S1, S2 as independent with
// relative uncertainties relS1, relS2. First-order propagation of
// α = ln(S2/S1)/ln(ν2/ν1) gives σα = √(relS1² + relS2²) / |ln(ν2/ν1)|.
export function alphaUncertainty(relS1, relS2, nu1, nu2) {
  if (relS1 <= 0 && relS2 <= 0) return 0;
  return Math.sqrt(relS1 * relS1 + relS2 * relS2) / Math.abs(Math.log(nu2 / nu1));
}

/** Predicted flux density at ν3, extrapolating from (ν1, S1) with index α. */
export function extrapolateFlux(S1, nu1, alpha, nu3) {
  return S1 * Math.pow(nu3 / nu1, alpha);
}

// S3 = S1·(ν3/ν1)^α ⇒ relative uncertainty combines S1's own relative
// uncertainty with α's uncertainty amplified by how far (in log-frequency)
// ν3 is from ν1 — extrapolating further always widens the error bar, even
// with a perfectly known α, simply because a power law's uncertainty
// compounds with distance from the anchor point.
export function extrapolatedFluxUncertainty(relS1, sigmaAlpha, nu1, nu3) {
  if (relS1 <= 0 && sigmaAlpha <= 0) return 0;
  const lnRatio = Math.log(nu3 / nu1);
  return Math.sqrt(relS1 * relS1 + (lnRatio * sigmaAlpha) ** 2);
}

export function classifySpectrum(alpha) {
  if (alpha > 0.1) return { label: "Inverted / self-absorbed", tone: "warn" };
  if (alpha >= -0.1) return { label: "Flat spectrum", tone: "good" };
  if (alpha >= -1.2) return { label: "Steep spectrum", tone: "good" };
  return { label: "Ultra-steep spectrum", tone: "warn" };
}
