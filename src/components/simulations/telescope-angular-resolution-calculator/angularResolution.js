// Diffraction-limited angular resolution of a telescope: the smallest
// angular separation between two point sources it can theoretically
// distinguish, set by light diffracting through its finite aperture —
// nothing about the telescope's quality, tracking, or the atmosphere.
//
// Rayleigh criterion (the standard, physically-derived definition — two
// point sources are "just resolved" when the first diffraction minimum
// of one source's pattern falls on the central peak of the other's):
//
//   θ = 1.22 λ / D   (radians)
//
// Dawes limit (an older, empirical rule from William Dawes' 19th-century
// observations of double stars in visible light — somewhat optimistic
// compared to Rayleigh, and NOT a function of wavelength the way Rayleigh
// is; it's calibrated specifically for visible light, around 550 nm):
//
//   θ_Dawes (arcsec) ≈ 116 / D(mm) ≈ 4.56 / D(inches)
//
// Both are theoretical, diffraction-only limits. Real observations,
// especially from the ground, are very often limited far more strongly
// by atmospheric seeing, optical imperfections, tracking error, or
// how finely the detector samples the image — see the accompanying
// post for why this ideal number is a ceiling, not a guarantee.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

export const RAYLEIGH_COEFFICIENT = 1.22;
const MM_PER_INCH = 25.4;
export const DAWES_ARCSEC_MM = 4.56 * MM_PER_INCH; // ≈ 115.824

export const APERTURE_UNITS = {
  mm: { label: "Millimeters", short: "mm", toM: 1e-3 },
  cm: { label: "Centimeters", short: "cm", toM: 1e-2 },
  m: { label: "Meters", short: "m", toM: 1 },
  inch: { label: "Inches", short: "in", toM: MM_PER_INCH * 1e-3 },
};
export const APERTURE_UNIT_ORDER = ["mm", "cm", "m", "inch"];

export const WAVELENGTH_UNITS = {
  nm: { label: "Nanometers", short: "nm", toM: 1e-9 },
  um: { label: "Micrometers", short: "µm", toM: 1e-6 },
  cm: { label: "Centimeters", short: "cm", toM: 1e-2 },
};
export const WAVELENGTH_UNIT_ORDER = ["nm", "um", "cm"];

export const ANGLE_UNITS = {
  arcsec: { label: "Arcseconds", short: "″", toRad: Math.PI / (180 * 3600) },
  mas: { label: "Milliarcseconds", short: "mas", toRad: Math.PI / (180 * 3600 * 1000) },
  arcmin: { label: "Arcminutes", short: "′", toRad: Math.PI / (180 * 60) },
  deg: { label: "Degrees", short: "°", toRad: Math.PI / 180 },
  rad: { label: "Radians", short: "rad", toRad: 1 },
};
export const ANGLE_UNIT_ORDER = ["arcsec", "mas", "arcmin", "deg", "rad"];

export function apertureToMeters(value, unit) {
  return value * APERTURE_UNITS[unit].toM;
}
export function wavelengthToMeters(value, unit) {
  return value * WAVELENGTH_UNITS[unit].toM;
}
export function radiansToAngle(rad, unit) {
  return rad / ANGLE_UNITS[unit].toRad;
}
export function angleToRadians(value, unit) {
  return value * ANGLE_UNITS[unit].toRad;
}

/** Rayleigh diffraction limit, in radians. */
export function rayleighLimitRad(apertureM, wavelengthM) {
  return (RAYLEIGH_COEFFICIENT * wavelengthM) / apertureM;
}

/** Dawes limit, in radians — visible-light-only, independent of the chosen wavelength. */
export function dawesLimitRad(apertureM) {
  const arcsec = DAWES_ARCSEC_MM / (apertureM * 1000);
  return angleToRadians(arcsec, "arcsec");
}

// Reference apertures/resolutions, for the comparison ruler — mixing a
// few real telescopes (at visible or their characteristic wavelength)
// and the human eye, to give a sense of scale across many orders of
// magnitude.
export const RESOLUTION_LANDMARKS = [
  { label: "Human eye (~1 arcmin)", arcsec: 60 },
  { label: "100 mm amateur scope (550 nm)", arcsec: 1.38 },
  { label: "Hubble Space Telescope (2.4 m, 550 nm)", arcsec: 0.0559 },
  { label: "Keck Telescope (10 m, 2.2 µm)", arcsec: 0.0552 },
  { label: "25 m radio dish (21 cm)", arcsec: 2160 },
];
