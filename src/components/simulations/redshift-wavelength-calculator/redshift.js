// Redshift ↔ rest (emitted) wavelength ↔ observed wavelength.
//
// Redshift z is defined directly from the wavelength shift:
//
//   1 + z = λ_obs / λ_rest
//
// which rearranges to whichever of the three quantities is missing. z is
// dimensionless — positive for a redshift (source receding, or space
// expanding), negative for a blueshift (source approaching), always with
// 1+z > 0.
//
// Two different "velocities" can be read off z, and they mean different
// things:
//   - v = cz is the naive classical (non-relativistic Doppler) reading —
//     only accurate for z ≪ 1, and can exceed c for large z, which is a
//     sign it's being misapplied, not a real velocity.
//   - The special-relativistic Doppler formula stays below c at every z,
//     but even it only strictly describes a source moving *through*
//     space. At genuinely cosmological distances, redshift instead comes
//     from the expansion of space itself (the FRW metric), and there
//     isn't a single unambiguous "recession velocity" in the way special
//     relativity defines one — see the post text for the full caveat.

export const C = 299792458; // m/s, exact

export const WAVELENGTH_UNITS = {
  angstrom: { label: "Angstroms", short: "Å", toMeters: 1e-10 },
  nm: { label: "Nanometers", short: "nm", toMeters: 1e-9 },
  um: { label: "Micrometers", short: "µm", toMeters: 1e-6 },
  mm: { label: "Millimeters", short: "mm", toMeters: 1e-3 },
};
export const WAVELENGTH_UNIT_ORDER = ["angstrom", "nm", "um", "mm"];

export function wavelengthToMeters(value, unit) {
  return value * WAVELENGTH_UNITS[unit].toMeters;
}
export function metersToWavelength(meters, unit) {
  return meters / WAVELENGTH_UNITS[unit].toMeters;
}

export function computeRedshift(lamRestM, lamObsM) {
  if (!(lamRestM > 0) || !(lamObsM > 0)) {
    return { valid: false, reason: "Enter positive rest and observed wavelengths." };
  }
  return { valid: true, z: lamObsM / lamRestM - 1 };
}

export function computeObservedWavelength(z, lamRestM) {
  if (!(lamRestM > 0) || !(1 + z > 0)) {
    return { valid: false, reason: "Redshift must be greater than -1, and rest wavelength must be positive." };
  }
  return { valid: true, lamObsM: lamRestM * (1 + z) };
}

export function computeRestWavelength(z, lamObsM) {
  if (!(lamObsM > 0) || !(1 + z > 0)) {
    return { valid: false, reason: "Redshift must be greater than -1, and observed wavelength must be positive." };
  }
  return { valid: true, lamRestM: lamObsM / (1 + z) };
}

/** Naive v = cz — only valid for z ≪ 1; can (nonsensically) exceed c. */
export function velocityClassical(z) {
  return C * z;
}

/** Special-relativistic longitudinal Doppler velocity — always |v| < c. */
export function velocityRelativistic(z) {
  const R = 1 + z;
  return C * (R * R - 1) / (R * R + 1);
}
