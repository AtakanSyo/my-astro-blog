// Angular size ↔ physical size ↔ distance — exact and small-angle forms.
//
// Picture a flat object of linear diameter D, centered at distance d from
// the observer and facing them broadside-on (its diameter perpendicular
// to the line of sight — like a disc or a ruler held up, not a ball you
// could stand inside of). The angle it subtends, θ, is the apex angle of
// the isosceles triangle formed by the observer and the two ends of the
// diameter — which splits into two right triangles with the right angle
// at the object's own center, adjacent side d, and opposite side D/2:
//
//   tan(θ/2) = (D/2) / d   ⇒   θ = 2·arctan(D / 2d)      (exact)
//
// Unlike a solid sphere's silhouette (where the observer can't be nearer
// the center than the object's own radius), a flat object has no such
// cap: D can be any positive size relative to d — a very wide, very close
// object just pushes θ toward (never reaching) 180°.
//
// For small θ, tan(θ/2) ≈ θ/2, which collapses this to the familiar
// astronomer's rule of thumb:
//
//   θ ≈ D / d                                             (small-angle)
//
// Physical constants below match astronomical-distance-converter's —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

export const C = 299792458; // m/s, exact
export const M_PER_AU = 149597870700; // m, IAU 2012, exact
export const M_PER_PC = (648000 / Math.PI) * M_PER_AU; // IAU 2015, exact
export const JULIAN_YEAR_S = 365.25 * 86400;
export const M_PER_LY = C * JULIAN_YEAR_S;

export const ANGLE_UNITS = {
  arcsec: { label: "Arcseconds", short: "″", toRad: Math.PI / (180 * 3600) },
  arcmin: { label: "Arcminutes", short: "′", toRad: Math.PI / (180 * 60) },
  deg: { label: "Degrees", short: "°", toRad: Math.PI / 180 },
  rad: { label: "Radians", short: "rad", toRad: 1 },
};
export const ANGLE_UNIT_ORDER = ["arcsec", "arcmin", "deg", "rad"];

export const LENGTH_UNITS = {
  m: { label: "Meters", short: "m", toMeters: 1 },
  km: { label: "Kilometers", short: "km", toMeters: 1e3 },
  au: { label: "Astronomical units", short: "AU", toMeters: M_PER_AU },
  ly: { label: "Light-years", short: "ly", toMeters: M_PER_LY },
  pc: { label: "Parsecs", short: "pc", toMeters: M_PER_PC },
  kpc: { label: "Kiloparsecs", short: "kpc", toMeters: M_PER_PC * 1e3 },
  mpc: { label: "Megaparsecs", short: "Mpc", toMeters: M_PER_PC * 1e6 },
};
export const LENGTH_UNIT_ORDER = ["m", "km", "au", "ly", "pc", "kpc", "mpc"];

export function angleToRad(value, unit) {
  return value * ANGLE_UNITS[unit].toRad;
}
export function radToAngle(rad, unit) {
  return rad / ANGLE_UNITS[unit].toRad;
}
export function lengthToMeters(value, unit) {
  return value * LENGTH_UNITS[unit].toMeters;
}
export function metersToLength(meters, unit) {
  return meters / LENGTH_UNITS[unit].toMeters;
}

// --- exact (trigonometric) solutions -------------------------------------

/** θ from physical diameter D and distance d (metres, radians). */
export function exactThetaFromSizeDistance(D, d) {
  if (!(D > 0) || !(d > 0)) return { valid: false };
  return { valid: true, theta: 2 * Math.atan(D / (2 * d)) };
}

/** Physical diameter D from angle θ and distance d (radians, metres). */
export function exactDiameterFromAngleDistance(theta, d) {
  if (!(theta > 0) || theta >= Math.PI || !(d > 0)) {
    return { valid: false, reason: "Angular size must be strictly between 0° and 180°." };
  }
  return { valid: true, D: 2 * d * Math.tan(theta / 2) };
}

/** Distance d from angle θ and physical diameter D (radians, metres). */
export function exactDistanceFromAngleSize(theta, D) {
  if (!(theta > 0) || theta >= Math.PI || !(D > 0)) {
    return { valid: false, reason: "Angular size must be strictly between 0° and 180°." };
  }
  return { valid: true, d: D / (2 * Math.tan(theta / 2)) };
}

// --- small-angle approximation --------------------------------------------

export function smallAngleTheta(D, d) {
  return D / d;
}
export function smallAngleDiameter(theta, d) {
  return theta * d;
}
export function smallAngleDistance(theta, D) {
  return D / theta;
}

/** How trustworthy the small-angle approximation is for this angle. */
export function approxQuality(percentError) {
  const e = Math.abs(percentError);
  if (e < 1) return { label: "Excellent", tone: "good" };
  if (e < 5) return { label: "Good", tone: "good" };
  if (e < 15) return { label: "Use with caution", tone: "warn" };
  return { label: "Not valid here", tone: "bad" };
}
