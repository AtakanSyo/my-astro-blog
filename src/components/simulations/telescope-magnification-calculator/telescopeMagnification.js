// Telescope magnification, exit pupil, and true field — plus the two
// practical limits every visual-observing guide states but few
// calculators actually enforce:
//
//   M = F / f                    magnification: scope focal length
//                                  over eyepiece focal length
//   exit pupil = D / M            (mm) — the width of the light cone
//                                  leaving the eyepiece
//   true field = AFOV / M         the eyepiece's own apparent field,
//                                  shrunk by the magnification
//
// The two rules of thumb below are the standard amateur-astronomy
// guidance (see e.g. Sky & Telescope's and most eyepiece makers'
// observing guides), not a strict physical law — but they're grounded
// in real limits:
//
//   max useful M ≈ 2 × D(mm)      "empty magnification" above this:
//                                  atmospheric seeing and the eye's own
//                                  acuity essentially never let more
//                                  magnification reveal more real
//                                  detail — you're enlarging the blur,
//                                  not resolving anything finer. (Its
//                                  physical ceiling is the aperture's own
//                                  diffraction limit — see this site's
//                                  Telescope Angular Resolution
//                                  Calculator for that exact number.)
//   min useful M ≈ D(mm) / 7      below this, the exit pupil exceeds
//                                  about 7 mm, wider than a dark-adapted
//                                  eye's own pupil can ever open to — the
//                                  extra light cone just misses the eye
//                                  entirely and does nothing.

const MAX_USEFUL_PER_MM = 2;
const MIN_EXIT_PUPIL_DIVISOR = 7;
export const DARK_ADAPTED_EYE_PUPIL_MM = 7;
export const MOON_ANGULAR_DIAMETER_DEG = 0.518; // average apparent diameter

/** Magnification M = F/f. Both in the same length unit (mm here). */
export function magnification(F_mm, f_mm) {
  if (!(F_mm > 0) || !(f_mm > 0)) return null;
  return F_mm / f_mm;
}

/** Exit pupil (mm) = aperture / magnification. */
export function exitPupilMm(D_mm, M) {
  if (!(D_mm > 0) || !(M > 0)) return null;
  return D_mm / M;
}

/** True field of view (degrees) = eyepiece apparent field / magnification. */
export function trueFieldDeg(AFOV_deg, M) {
  if (!(AFOV_deg > 0) || !(M > 0)) return null;
  return AFOV_deg / M;
}

/** Focal ratio F/D — handy context, not used in the verdict itself. */
export function focalRatio(F_mm, D_mm) {
  if (!(F_mm > 0) || !(D_mm > 0)) return null;
  return F_mm / D_mm;
}

export function maxUsefulMagnification(D_mm) {
  if (!(D_mm > 0)) return null;
  return MAX_USEFUL_PER_MM * D_mm;
}

export function minUsefulMagnification(D_mm) {
  if (!(D_mm > 0)) return null;
  return D_mm / MIN_EXIT_PUPIL_DIVISOR;
}

/**
 * Classifies a magnification against the two practical limits.
 * Returns one of "empty" (past the useful ceiling), "wide-pupil" (exit
 * pupil bigger than a dark-adapted eye can use), or "good".
 */
export function classifyMagnification(M, D_mm) {
  const maxM = maxUsefulMagnification(D_mm);
  const minM = minUsefulMagnification(D_mm);
  if (maxM === null || minM === null || !(M > 0)) return null;
  if (M > maxM) return { level: "empty", maxM, minM };
  if (M < minM) return { level: "wide-pupil", maxM, minM };
  return { level: "good", maxM, minM };
}
