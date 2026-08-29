// Proper motion ↔ tangential velocity — converting a star's apparent
// creep across the sky into its actual sideways speed through space.
//
//   v_t = 4.74047 · μ · d
//
// where μ is in arcsec/yr, d is in parsecs, and v_t comes out in km/s.
// That constant isn't an empirical fit — it falls straight out of unit
// conversion. In one year, a star with proper motion μ (arcsec/yr) at
// distance d (pc) sweeps a transverse distance of exactly μ·d
// astronomical units — a direct consequence of how the parsec itself is
// defined (1 pc is where 1 AU subtends 1″), so the AU and arcsec factors
// cancel perfectly. Converting AU/yr to km/s is what leaves the 4.74047:
//
//   1 AU/yr = (149,597,870.7 km) / (365.25 × 86400 s) ≈ 4.74047 km/s

export const M_PER_AU = 149597870700; // m, IAU 2012, exact
export const AU_KM = M_PER_AU / 1000;
export const JULIAN_YEAR_S = 365.25 * 86400;
export const M_PER_PC = (648000 / Math.PI) * M_PER_AU; // IAU 2015, exact
export const C = 299792458;
export const M_PER_LY = C * JULIAN_YEAR_S;

// km/s per (arcsec/yr · pc) — the "4.74047" constant, derived exactly.
export const TANGENTIAL_VELOCITY_CONSTANT = AU_KM / JULIAN_YEAR_S;

export const PROPER_MOTION_UNITS = {
  arcsec: { label: "Arcsec/yr", short: "″/yr", toArcsecYr: 1 },
  mas: { label: "Milliarcsec/yr", short: "mas/yr", toArcsecYr: 1e-3 },
};
export const PROPER_MOTION_UNIT_ORDER = ["mas", "arcsec"];

export const PARALLAX_UNITS = {
  arcsec: { label: "Arcseconds", short: "″", toArcsec: 1 },
  mas: { label: "Milliarcseconds", short: "mas", toArcsec: 1e-3 },
};
export const PARALLAX_UNIT_ORDER = ["mas", "arcsec"];

export const DISTANCE_UNITS = {
  au: { label: "Astronomical units", short: "AU", toMeters: M_PER_AU },
  pc: { label: "Parsecs", short: "pc", toMeters: M_PER_PC },
  ly: { label: "Light-years", short: "ly", toMeters: M_PER_LY },
  kpc: { label: "Kiloparsecs", short: "kpc", toMeters: M_PER_PC * 1e3 },
};
export const DISTANCE_UNIT_ORDER = ["pc", "ly", "au", "kpc"];

export function properMotionToArcsecYr(value, unit) {
  return value * PROPER_MOTION_UNITS[unit].toArcsecYr;
}
export function arcsecYrToProperMotion(arcsecYr, unit) {
  return arcsecYr / PROPER_MOTION_UNITS[unit].toArcsecYr;
}
export function parallaxToArcsec(value, unit) {
  return value * PARALLAX_UNITS[unit].toArcsec;
}
export function distanceToMeters(value, unit) {
  return value * DISTANCE_UNITS[unit].toMeters;
}
export function metersToDistance(meters, unit) {
  return meters / DISTANCE_UNITS[unit].toMeters;
}
export function distancePcFromParallaxArcsec(pArcsec) {
  return 1 / pArcsec;
}
export function parallaxArcsecFromDistancePc(dPc) {
  return 1 / dPc;
}

/** Combine RA/Dec proper-motion components (μ_α* already ×cos δ, and μ_δ) into total μ. */
export function totalProperMotion(muAlphaStar, muDelta) {
  return Math.sqrt(muAlphaStar * muAlphaStar + muDelta * muDelta);
}

export function tangentialVelocity(muArcsecYr, dPc) {
  return TANGENTIAL_VELOCITY_CONSTANT * muArcsecYr * dPc;
}
export function properMotionFromVelocityDistance(vtKms, dPc) {
  return vtKms / (TANGENTIAL_VELOCITY_CONSTANT * dPc);
}
export function distancePcFromVelocityProperMotion(vtKms, muArcsecYr) {
  return vtKms / (TANGENTIAL_VELOCITY_CONSTANT * muArcsecYr);
}

/** Total 3D space speed from tangential and radial velocity — perpendicular by definition. */
export function totalSpaceVelocity(vtKms, vrKms) {
  return Math.sqrt(vtKms * vtKms + vrKms * vrKms);
}
