// Lightweight math helpers for astro sims (no deps).
export const PI = Math.PI;
export const TAU = Math.PI * 2;

export const toRad = (d) => d * (PI / 180);
export const toDeg = (r) => r * (180 / PI);

export const clamp = (x, lo=0, hi=1) => Math.max(lo, Math.min(hi, x));
export const saturate = (x) => clamp(x, 0, 1);
export const lerp = (a, b, t) => a + (b - a) * t;
export const mix  = lerp;

export const dot = (a,b) => a.x*b.x + a.y*b.y + a.z*b.z;
export const len = (v) => Math.hypot(v.x, v.y, v.z);
export const norm = (v) => { const L = len(v) || 1; return { x:v.x/L, y:v.y/L, z:v.z/L }; };
export const cross = (a,b) => ({ x:a.y*b.z - a.z*b.y, y:a.z*b.x - a.x*b.z, z:a.x*b.y - a.y*b.x });

export const rotX = (v,a)=>{ const s=Math.sin(a),c=Math.cos(a); return {x:v.x, y:c*v.y - s*v.z, z:s*v.y + c*v.z}; };
export const rotY = (v,a)=>{ const s=Math.sin(a),c=Math.cos(a); return {x:c*v.x + s*v.z, y:v.y, z:-s*v.x + c*v.z}; };
export const rotZ = (v,a)=>{ const s=Math.sin(a),c=Math.cos(a); return {x:c*v.x - s*v.y, y:s*v.x + c*v.y, z:v.z}; };

// Spherical ↔ Cartesian (lat/lon in degrees)
export function sphToCart(radius, latDeg, lonDeg){
  const lat = toRad(latDeg), lon = toRad(lonDeg);
  const cl = Math.cos(lat), sl = Math.sin(lat);
  return { x: radius * cl * Math.cos(lon), y: radius * sl, z: radius * cl * Math.sin(lon) };
}
export function cartToSph(p){
  const r = len(p);
  const lat = Math.asin((r ? p.y / r : 0)) * 180/PI;
  const lon = Math.atan2(p.z, p.x) * 180/PI;
  return { r, lat, lon };
}

// Stable tiny PRNG (deterministic)
export function mulberry32(seed){
  return function(){
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t>>>15), t | 1);
    t ^= t + Math.imul(t ^ (t>>>7), t | 61);
    return ((t ^ (t>>>14)) >>> 0) / 4294967296;
  };
}

// Uniform unit-sphere sample (Marsaglia)
export function sampleUnitSphere(rng=Math.random){
  let u=0,v=0,s=2;
  while(s>=1 || s===0){ u = rng()*2-1; v = rng()*2-1; s = u*u+v*v; }
  const x = 2*u*Math.sqrt(1-s);
  const y = 1 - 2*s;
  const z = 2*v*Math.sqrt(1-s);
  return norm({x,y,z});
}