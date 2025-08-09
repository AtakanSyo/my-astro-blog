// Emitters/seeders for rings & spherical shells.

import { lerp, mulberry32 } from './math.js';

// ----- RINGS -----
// Returns typed arrays for instanced attributes of ring particles.
export function seedRings(N, {
  seed=20250808,
  R_INNER=1.23, R_A_END=2.27,
  C_end=1.52, B_end=1.95, Cass_1=2.02,
  encke=2.26,
  tintRange=0.06,
  thickness=0.012  // small vertical thickness relative to planet radius in world units
} = {}){
  const rng = mulberry32(seed);
  const rr  = new Float32Array(N);   // radius in planet radii (relative)
  const th0 = new Float32Array(N);   // start angle (rad)
  const tin = new Float32Array(N);   // color tint jitter
  const yOff= new Float32Array(N);   // vertical offset multiplier

  function regionWeight(x){
    if (x < C_end) return 0.35;           // C
    if (x < B_end) return 1.0;            // B
    if (x < Cass_1) return 0.04;          // Cassini
    const base = 0.65;
    const gap  = Math.max(0, 1 - (Math.abs(x - encke) / 0.008));
    return base * Math.max(0.1, 1 - gap); // A, suppress near Encke
  }

  let i=0, tries=0;
  while (i<N && tries < N*50){
    tries++;
    const rrel = lerp(R_INNER, R_A_END, rng());
    if (rng() > regionWeight(rrel)) continue;
    rr[i]   = rrel;
    th0[i]  = rng() * Math.PI*2;
    tin[i]  = (rng() - 0.5) * tintRange;
    // vertical thickness seed in [-0.5, 0.5]
    yOff[i] = (rng() - 0.5) * thickness;
    i++;
  }
  return { rr, th0, tin, yOff };
}

// ----- SPHERICAL SHELL -----
// Band-limited shell distribution (good for weather bands or winds).
export function seedShell(N, {
  seed=1337, latMin=-75, latMax=75
} = {}){
  const rng = mulberry32(seed);
  const lat = new Float32Array(N);
  const lon = new Float32Array(N);
  for (let i=0;i<N;i++){
    lat[i] = lerp(latMin, latMax, rng());
    lon[i] = rng() * 360;
  }
  return { lat, lon };
}