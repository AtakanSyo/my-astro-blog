// X-ray hardness ratio and its Poisson-propagated uncertainty, given soft-
// and hard-band photon counts S and H.
//
//   HR = (H - S) / (H + S)
//
// Ranges from -1 (all soft) to +1 (all hard), 0 for an even split. Counting
// statistics are assumed Poisson (sigma = sqrt(N)) unless the caller
// supplies custom uncertainties. Standard first-order error propagation on
// HR = (H-S)/(H+S) gives:
//
//   sigma_HR = (2 / (H+S)^2) * sqrt(S^2 sigma_H^2 + H^2 sigma_S^2)
//
// Extracted from HardnessRatioCalculator.jsx's own inline logic so the math
// is independently testable, matching the pattern this site's other
// calculators already follow (a pure, colocated module the component
// imports from).

export const LOW_COUNT_THRESHOLD = 20;

export function classify(hr) {
  if (hr < -0.5) return "Very soft";
  if (hr < -0.1) return "Soft";
  if (hr <= 0.1) return "Balanced";
  if (hr <= 0.5) return "Hard";
  return "Very hard";
}

export function toNumber(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Computes the hardness ratio and its uncertainty from soft/hard counts.
 * sigmaS/sigmaH default to Poisson (sqrt(count)) when not provided.
 * Returns { valid: false } for negative or all-zero counts.
 */
export function computeHardnessRatio(S, H, sigmaS = Math.sqrt(S), sigmaH = Math.sqrt(H)) {
  if (!Number.isFinite(S) || !Number.isFinite(H) || S < 0 || H < 0 || S + H <= 0) {
    return { valid: false };
  }

  const denom = H + S;
  const HR = (H - S) / denom;

  let sigmaHR = null;
  if (Number.isFinite(sigmaS) && Number.isFinite(sigmaH) && sigmaS >= 0 && sigmaH >= 0) {
    sigmaHR = (2 / (denom * denom)) * Math.sqrt(S * S * sigmaH * sigmaH + H * H * sigmaS * sigmaS);
  }

  const ratio = S > 0 ? H / S : Infinity;
  const lowCounts = S < LOW_COUNT_THRESHOLD || H < LOW_COUNT_THRESHOLD;

  return {
    valid: true,
    S,
    H,
    sigmaS,
    sigmaH,
    HR,
    sigmaHR,
    ratio,
    lowCounts,
    label: classify(HR),
  };
}
