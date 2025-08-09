// Simple photometric functions for planets/rings.

import { clamp } from './math.js';

// Henyey–Greenstein phase function (forward scattering for rings/dust).
export function hgPhase(cosTheta, g=0.55){
  const g2 = g*g;
  const denom = Math.pow(1 + g2 - 2*g*cosTheta, 1.5);
  return (1 - g2) / Math.max(1e-4, 4*Math.PI*denom);
}

// Classic limb darkening (approx). mu = cos(view angle); k in [0..1]
export function limbDarkening(mu, k=0.4){
  mu = clamp(mu, 0, 1);
  return (1 - k) + k * mu;
}

// Cheap rim “haze” (for thick atmospheres)
export function rimHaze(mu, amount=0.35, gamma=2.2){
  const rim = Math.pow(1 - clamp(mu, 0, 1), 2.0) * amount;
  return Math.pow(1 - rim, 1 / gamma);
}

// Optical depth profile for Saturn-ish ring regions (tweak as needed)
export function ringTau(rr, {
  C_end=1.52, B_end=1.95, Cass_0=1.95, Cass_1=2.02
} = {}){
  if (rr < C_end) return 0.25;      // C (faint)
  if (rr < B_end) return 1.00;      // B (dense)
  if (rr < Cass_1) return 0.05;     // Cassini division
  return 0.60;                       // A
}