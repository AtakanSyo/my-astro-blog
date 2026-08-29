// Angular velocity: how fast something rotates, expressed as angle
// swept per unit time.
//
//   ω = Δθ/Δt                    (general definition)
//   ω = 2π/T = 2πf               (uniform circular motion: one full
//                                 revolution is 2π radians, so period T
//                                 and frequency f = 1/T both convert
//                                 directly)
//
// Every point on a rigid rotating body shares the same ω regardless of
// its distance from the axis — but tangential (linear) speed does not:
//
//   v = ω r
//
// A point twice as far from the axis moves twice as fast in a straight-
// line sense, even though it completes the same number of rotations per
// second as every other point on the same rigid body.

export const TWO_PI = 2 * Math.PI;

export const TIME_UNITS = {
  s: { label: "Seconds", short: "s", toS: 1 },
  min: { label: "Minutes", short: "min", toS: 60 },
  h: { label: "Hours", short: "h", toS: 3600 },
  day: { label: "Days", short: "d", toS: 86400 },
};
export const TIME_UNIT_ORDER = ["s", "min", "h", "day"];

export const FREQUENCY_UNITS = {
  hz: { label: "Hz (rev/s)", short: "Hz", toHz: 1 },
  rpm: { label: "RPM (rev/min)", short: "RPM", toHz: 1 / 60 },
};
export const FREQUENCY_UNIT_ORDER = ["hz", "rpm"];

export const ANGULAR_VELOCITY_UNITS = {
  rads: { label: "Radians/second", short: "rad/s", toRadS: 1 },
  degs: { label: "Degrees/second", short: "°/s", toRadS: Math.PI / 180 },
  rpm: { label: "Revolutions/minute (RPM)", short: "RPM", toRadS: TWO_PI / 60 },
  revs: { label: "Revolutions/second", short: "rev/s", toRadS: TWO_PI },
};
export const ANGULAR_VELOCITY_UNIT_ORDER = ["rads", "degs", "rpm", "revs"];

export const RADIUS_UNITS = {
  m: { label: "Meters", short: "m", toM: 1 },
  cm: { label: "Centimeters", short: "cm", toM: 0.01 },
  km: { label: "Kilometers", short: "km", toM: 1000 },
};
export const RADIUS_UNIT_ORDER = ["m", "cm", "km"];

export function timeToSeconds(value, unit) {
  return value * TIME_UNITS[unit].toS;
}
export function frequencyToHz(value, unit) {
  return value * FREQUENCY_UNITS[unit].toHz;
}
export function radiansPerSecondToUnit(radS, unit) {
  return radS / ANGULAR_VELOCITY_UNITS[unit].toRadS;
}
export function unitToRadiansPerSecond(value, unit) {
  return value * ANGULAR_VELOCITY_UNITS[unit].toRadS;
}
export function radiusToMeters(value, unit) {
  return value * RADIUS_UNITS[unit].toM;
}

/** ω in rad/s from a period T (seconds). */
export function omegaFromPeriod(periodS) {
  return TWO_PI / periodS;
}
/** ω in rad/s from a frequency f (Hz). */
export function omegaFromFrequency(fHz) {
  return TWO_PI * fHz;
}
/** ω in rad/s from N complete rotations over elapsed time t (seconds). */
export function omegaFromRotationsAndTime(rotations, elapsedS) {
  return (TWO_PI * rotations) / elapsedS;
}
/** Period T (seconds) from ω (rad/s). */
export function periodFromOmega(omegaRadS) {
  return TWO_PI / omegaRadS;
}
/** Tangential speed v = ωr, in m/s, given ω in rad/s and r in meters. */
export function tangentialVelocity(omegaRadS, radiusM) {
  return omegaRadS * radiusM;
}

// Real-world rotation rates, for the comparison ladder — a fixed
// reference table spanning about nine orders of magnitude, so any
// input's position relative to everyday objects and extreme
// astrophysical ones is visible at a glance.
export const OMEGA_LANDMARKS = [
  { label: "The Moon (tidally locked, ~27.3 d)", omegaRadS: omegaFromPeriod(27.321661 * 86400) },
  { label: "Earth (sidereal day)", omegaRadS: omegaFromPeriod(86164.0905) },
  { label: "Ceiling fan (~200 RPM)", omegaRadS: omegaFromFrequency(200 / 60) },
  { label: "Washing machine spin cycle (~1200 RPM)", omegaRadS: omegaFromFrequency(1200 / 60) },
  { label: "7200 RPM hard drive", omegaRadS: omegaFromFrequency(7200 / 60) },
  { label: "Crab Pulsar (~30 Hz)", omegaRadS: omegaFromFrequency(29.9) },
  { label: "Fastest known pulsar (~716 Hz)", omegaRadS: omegaFromFrequency(716) },
];
