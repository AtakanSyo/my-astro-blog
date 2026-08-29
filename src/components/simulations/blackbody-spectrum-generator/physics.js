// Blackbody (Planck) radiation physics — SI constants, CODATA 2018 values.
const H = 6.62607015e-34; // Planck constant, J·s
const C = 2.99792458e8; // speed of light, m/s
const K_B = 1.380649e-23; // Boltzmann constant, J/K
const SIGMA = 5.670374419e-8; // Stefan–Boltzmann constant, W/m²K⁴
const WIEN_B_NM = 2.897771955e6; // Wien displacement constant, expressed in nm·K

/**
 * Spectral radiance of a blackbody at wavelength `lambdaNm` (nanometres)
 * and temperature `tempK` (Kelvin), via Planck's law.
 * Returns W·sr⁻¹·m⁻³ (unnormalized) — safe against overflow for
 * short-wavelength / low-temperature combinations where exp() would blow up.
 */
export function planckRadiance(lambdaNm, tempK) {
  if (lambdaNm <= 0 || tempK <= 0) return 0;
  const lambdaM = lambdaNm * 1e-9;
  const exponent = (H * C) / (lambdaM * K_B * tempK);
  if (exponent > 700) return 0; // exp(700+) overflows to Infinity in double precision
  const denom = Math.exp(exponent) - 1;
  if (denom <= 0) return 0;
  return (2 * H * C * C) / Math.pow(lambdaM, 5) / denom;
}

/** Wien's displacement law: wavelength of peak emission, in nanometres. */
export function wienPeakNm(tempK) {
  return WIEN_B_NM / tempK;
}

/** Stefan–Boltzmann law: total radiant exitance of a blackbody, W/m². */
export function stefanBoltzmannFlux(tempK) {
  return SIGMA * Math.pow(tempK, 4);
}

// CIE 1931 2° color matching function approximation — sum of Gaussians,
// Wyman, Sloan & Shirley, "Simple Analytic Approximations to the CIE XYZ
// Color Matching Functions" (JCGT 2013). Good to a few percent, well within
// what's needed for a representative swatch color.
function gaussPiece(lambda, mu, sigma1, sigma2) {
  const sigma = lambda < mu ? sigma1 : sigma2;
  const t = (lambda - mu) / sigma;
  return Math.exp(-0.5 * t * t);
}

function cieMatch(lambdaNm) {
  const x =
    1.056 * gaussPiece(lambdaNm, 599.8, 37.9, 31.0) +
    0.362 * gaussPiece(lambdaNm, 442.0, 16.0, 26.7) -
    0.065 * gaussPiece(lambdaNm, 501.1, 20.4, 26.2);
  const y =
    0.821 * gaussPiece(lambdaNm, 568.8, 46.9, 40.5) +
    0.286 * gaussPiece(lambdaNm, 530.9, 16.3, 31.1);
  const z =
    1.217 * gaussPiece(lambdaNm, 437.0, 11.8, 36.0) +
    0.681 * gaussPiece(lambdaNm, 459.0, 26.0, 13.8);
  return [x, y, z];
}

const VISIBLE_MIN_NM = 380;
const VISIBLE_MAX_NM = 780;
const CIE_STEP_NM = 5;

function clamp01(v) {
  return Math.min(1, Math.max(0, v));
}

function srgbCompand(linear) {
  const v = clamp01(linear);
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

/** Raw (unnormalized) CIE XYZ tristimulus values from the Planck spectrum. */
function rawXyz(tempK) {
  let X = 0;
  let Y = 0;
  let Z = 0;
  for (let lambda = VISIBLE_MIN_NM; lambda <= VISIBLE_MAX_NM; lambda += CIE_STEP_NM) {
    const radiance = planckRadiance(lambda, tempK);
    const [x, y, z] = cieMatch(lambda);
    X += radiance * x;
    Y += radiance * y;
    Z += radiance * z;
  }
  return [X, Y, Z];
}

// Below the Draper point (~798 K, the classic threshold for a just-visible
// dull red glow in the dark), a blackbody's visible-band output is real but
// utterly negligible — a human body at 310 K does emit some 380–780 nm
// light, but not enough for the eye to register anything. Reference
// luminances (not colors — just the Y integral) at a "not yet glowing" and
// a "clearly glowing white-hot" temperature let us gate perceived
// brightness by the *actual* amount of visible light, instead of always
// stretching the output to a fully saturated color regardless of how
// vanishingly faint it is.
const DRAPER_POINT_K = 798;
const BRIGHT_REFERENCE_K = 6500;
const Y_DARK_REF = rawXyz(DRAPER_POINT_K)[1];
const Y_BRIGHT_REF = rawXyz(BRIGHT_REFERENCE_K)[1];
const LOG_Y_DARK_REF = Math.log10(Y_DARK_REF);
const LOG_Y_BRIGHT_REF = Math.log10(Y_BRIGHT_REF);

/**
 * Approximate perceived sRGB color of a blackbody radiator at `tempK`,
 * derived by integrating the actual Planck spectrum against the CIE 1931
 * color matching functions (not a canned temperature→color lookup table).
 * Brightness — not just hue — is gated by the true integrated visible-band
 * luminance, so temperatures that don't actually glow to the human eye
 * (anything well below the Draper point) render as dark, not a
 * fully-saturated "phantom" color. Returns { r, g, b } as 0–255 integers.
 */
export function blackbodyColor(tempK) {
  const [X, Y, Z] = rawXyz(tempK);
  if (Y <= 0) return { r: 0, g: 0, b: 0 };

  // Chromaticity: normalize luminance to 1 so only the ratios (the hue)
  // survive, independent of how bright the source actually is.
  const Xn = X / Y;
  const Zn = Z / Y;
  const Yn = 1;

  // CIE XYZ (D65) -> linear sRGB
  let r = 3.2406 * Xn - 1.5372 * Yn - 0.4986 * Zn;
  let g = -0.9689 * Xn + 1.8758 * Yn + 0.0415 * Zn;
  let b = 0.0557 * Xn - 0.204 * Yn + 1.057 * Zn;

  r = Math.max(0, r);
  g = Math.max(0, g);
  b = Math.max(0, b);

  const maxChannel = Math.max(r, g, b, 1e-6);
  r /= maxChannel;
  g /= maxChannel;
  b /= maxChannel;

  // Absolute brightness: where does this temperature's real luminance fall
  // between "not visibly glowing" and "clearly white-hot"? Log-compressed
  // because Y spans many orders of magnitude across the temperature range.
  const logY = Math.log10(Y);
  const brightness = clamp01(
    (logY - LOG_Y_DARK_REF) / (LOG_Y_BRIGHT_REF - LOG_Y_DARK_REF)
  );

  r *= brightness;
  g *= brightness;
  b *= brightness;

  return {
    r: Math.round(srgbCompand(r) * 255),
    g: Math.round(srgbCompand(g) * 255),
    b: Math.round(srgbCompand(b) * 255),
  };
}

export function rgbToCss({ r, g, b }) {
  return `rgb(${r}, ${g}, ${b})`;
}

export function rgbToHex({ r, g, b }) {
  const toHex = (n) => n.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}
