// The Roche limit: how close a self-gravitating satellite can orbit a
// much more massive primary before tidal forces overcome the
// satellite's own gravity holding it together.
//
// Fluid-satellite approximation (the satellite is assumed to deform
// into its own tidal equilibrium shape as it's stretched — the more
// commonly cited, more physically realistic version for a body with
// little internal strength, like an icy moon or a rubble pile):
//
//   d_fluid ≈ 2.44 R_M (ρ_M / ρ_m)^(1/3)
//
// Rigid-body approximation (the satellite is assumed to stay perfectly
// spherical right up until it's torn apart — an upper-bound
// idealization more relevant to strong, monolithic bodies):
//
//   d_rigid = R_M (2 ρ_M / ρ_m)^(1/3) ≈ 1.26 R_M (ρ_M / ρ_m)^(1/3)
//
// R_M and ρ_M are the primary body's radius and mean density; ρ_m is
// the satellite's mean density. Both are idealizations — real
// satellites (with internal strength, non-spherical shape, or their
// own rotation) can survive somewhat inside or get disrupted somewhat
// outside these idealized limits.
//
// Physical constants match this site's other astronomy tools —
// duplicated deliberately (each simulation tool here is a self-contained
// bundle) rather than imported across components.

export const FLUID_COEFFICIENT = 2.44;
export const RIGID_COEFFICIENT = Math.cbrt(2); // ≈ 1.2599

export const DISTANCE_UNITS = {
  km: { label: "Kilometers", short: "km", toKm: 1 },
  primaryRadii: { label: "Primary radii", short: "R_M", toKm: null }, // handled specially (depends on R_M)
};

/** Roche limit in the same length unit as R_M, for a given coefficient. */
export function rocheLimit(radiusPrimary, densityPrimary, densitySatellite, coefficient) {
  return coefficient * radiusPrimary * Math.cbrt(densityPrimary / densitySatellite);
}

export function fluidRocheLimit(radiusPrimary, densityPrimary, densitySatellite) {
  return rocheLimit(radiusPrimary, densityPrimary, densitySatellite, FLUID_COEFFICIENT);
}

export function rigidRocheLimit(radiusPrimary, densityPrimary, densitySatellite) {
  return rocheLimit(radiusPrimary, densityPrimary, densitySatellite, RIGID_COEFFICIENT);
}

/** A representative real-world density lookup (kg/m^3), for reference lines and presets. */
export const REFERENCE_DENSITIES = [
  { label: "Porous ice / comet nucleus", kgm3: 500 },
  { label: "Water ice", kgm3: 920 },
  { label: "Icy moon (Enceladus-like)", kgm3: 1609 },
  { label: "Icy-rocky moon (Europa-like)", kgm3: 3013 },
  { label: "Rocky body (Moon-like)", kgm3: 3344 },
  { label: "Rocky planet (Mercury-like)", kgm3: 5427 },
  { label: "Iron-rich asteroid", kgm3: 7800 },
];
