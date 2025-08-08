// /public/p5/saturn.js
// Saturn: shader-lit globe + Perlin-swirling ring particles (fast, pretty)

export const saturnSketch = (p) => {
  // ---- Config ----
  const DPR = Math.min(1.5, window.devicePixelRatio || 1);
  let W = 900, H = 520;
  let R = 180;                  // planet radius (set in setup)
  let rotSpeed = 0.35;          // deg/frame (hook to #js-speed if present)
  let ringTiltDeg = 18;         // deg (hook to #js-tilt if present)
  let paused = false;

  // Ring geometry (relative to planet radius), approx real values
  const R_INNER  = 1.23;
  const R_C_END  = 1.52;
  const R_B_END  = 1.95;
  const R_CASS_0 = 1.95;
  const R_CASS_1 = 2.02;
  const R_A_END  = 2.27;
  const R_ENCKE  = 2.26;

  // Particles
  const NUM_PARTICLES = 1500;
  const TRAIL_LEN = 6;
  const RAD_JITTER = 0.35;
  const ANG_NOISE  = 0.6;
  let particles = [];

  // Light direction
  const LIGHT = norm3(-0.4, -0.25, 0.85);

  // State
  let phase = 0; // planet rotation (deg)
  let t = 0;     // time

  // Shader
  let saturnShader;

  p.setup = () => {
    const parent = document.getElementById('saturn-sim') || document.body;
    const size = chooseCanvasSize(parent);
    W = size[0]; H = size[1];

    p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
    p.createCanvas(W, H, p.WEBGL);
    p.frameRate(60);

    R = Math.min(W, H) * 0.33;

    saturnShader = p.createShader(SATURN_VERT, SATURN_FRAG);

    initParticles();
    hookControls();
  };

  p.windowResized = () => {
    const parent = document.getElementById('saturn-sim') || document.body;
    const size = chooseCanvasSize(parent);
    W = size[0]; H = size[1];
    p.resizeCanvas(W, H);
    R = Math.min(W, H) * 0.33;
    initParticles(); // re-seed for new size so ring widths stay proportional
  };

  // tiny helpers to rotate vectors (for light-space transform)
  function rotX(v, a){ const s=Math.sin(a), c=Math.cos(a); return {x:v.x, y:v.y*c - v.z*s, z:v.y*s + v.z*c}; }
  function rotY(v, a){ const s=Math.sin(a), c=Math.cos(a); return {x:v.x*c + v.z*s, y:v.y, z:-v.x*s + v.z*c}; }

  p.draw = () => {
    if (paused) return;

    p.background(8, 10, 16);

    // Time + rotation
    t += 0.006;
    phase = (phase + rotSpeed) % 360;

    const tiltRad  = p.radians(ringTiltDeg);
    const phaseRad = p.radians(phase);

    // ---- Globe (shader-based) ----
    // Move light into object space (undo model rotations)
    let Lobj = {...LIGHT};
    Lobj = rotX(Lobj, -tiltRad);
    Lobj = rotY(Lobj, -phaseRad);

    p.push();
    // Align bands to ring plane tilt and spin the globe
    p.rotateY(phaseRad);
    p.rotateX(tiltRad);

    p.shader(saturnShader);
    saturnShader.setUniform('uLightDir', [Lobj.x, Lobj.y, Lobj.z]);
    saturnShader.setUniform('uTime', t);
    saturnShader.setUniform('uBandContrast', 1.15); // tweak 1.05–1.30
    saturnShader.setUniform('uRim', 0.35);          // limb haze 0.25–0.45
    saturnShader.setUniform('uGamma', 2.2);
    saturnShader.setUniform('uRingTilt', tiltRad);
    saturnShader.setUniform('uRingInnerOuter', [R_INNER, R_A_END]);
    saturnShader.setUniform('uCassini', [R_CASS_0, R_CASS_1]);
    saturnShader.setUniform('uEncke', R_ENCKE);

    p.noStroke();
    p.sphere(R, 96, 72); // higher tesselation for crisp terminator
    p.resetShader();
    p.pop();

    // ---- Ring particles (in ring plane coords, then transform) ----
    const inner = R * R_INNER;
    const outer = R * R_A_END;

    p.push();
    p.rotateY(phaseRad);
    p.rotateX(tiltRad);

    // rotate light into the rotated ring frame (inverse of the rotations we just applied)
    let Lr = {...LIGHT};
    Lr = rotX(Lr, -tiltRad);
    Lr = rotY(Lr, -phaseRad);

    // planet shadow on rings, aligned + on far side
    drawRingShadow(outer, R, Lr);

    // Draw/update particles
    p.strokeWeight(1.25);
    for (let i = 0; i < particles.length; i++) {
      const s = particles[i];

      // Kepler-ish base speed + Perlin swirl
      const rRel = s.rRel;
      const baseAng = 0.70 / Math.pow(rRel, 1.5);
      const ns = 0.0038;
      const angN = (p.noise(s.theta * ns, s.r * ns, t * 0.8) - 0.5) * ANG_NOISE;
      const radN = (p.noise(s.r * ns, s.theta * ns + 100, t * 0.65) - 0.5) * RAD_JITTER;

      s.theta = (s.theta + baseAng + angN) % 360;

      let rNew = s.r + radN;
      const rr = rNew / R;
      if (rr > R_CASS_0 && rr < R_CASS_1) rNew += (rr < (R_CASS_0 + R_CASS_1)/2 ? -1 : 1) * 0.8;
      if (Math.abs(rr - R_ENCKE) < 0.01)   rNew += (rr < R_ENCKE ? -1 : 1) * 0.6;
      s.r = clamp(rNew, inner, outer);

      // Position in ring plane
      const th = p.radians(s.theta);
      const pos = { x: s.r * Math.cos(th), y: 0, z: s.r * Math.sin(th) };

      // Trail history
      s.hist[s.hi] = pos;
      s.hi = (s.hi + 1) % TRAIL_LEN;

      // Color by ring region
      const col = colorForRadius(s.r / R, s.tint, t, s.theta);

      // Trail
      p.noFill();
      p.stroke(col.r, col.g, col.b, col.aTrail);
      p.beginShape();
      for (let k = 0; k < TRAIL_LEN; k++) {
        const idx = (s.hi + k) % TRAIL_LEN;
        const pt = s.hist[idx];
        if (pt) p.vertex(pt.x, pt.y, pt.z);
      }
      p.endShape();

      // Head spark
      p.stroke(col.rHead, col.gHead, col.bHead, col.aHead);
      p.point(pos.x, pos.y, pos.z);
    }
    p.pop();

    // Vignette
    drawVignette();
  };

  // ---------- Particles ----------
  function initParticles() {
    particles = [];
    const rng = mulberry32(20250808);

    const inner = R * R_INNER;
    const outer = R * R_A_END;

    function regionWeight(rr) {
      if (rr < R_C_END) return 0.35;    // C (faint)
      if (rr < R_B_END) return 1.0;     // B (dense)
      if (rr < R_CASS_1) return 0.04;   // Cassini (sparse)
      const base = 0.65;                // A
      const gap  = Math.max(0, 1 - (Math.abs(rr - R_ENCKE) / 0.008));
      return base * Math.max(0.1, 1 - gap);
    }

    let tries = 0;
    while (particles.length < NUM_PARTICLES && tries < NUM_PARTICLES * 50) {
      tries++;
      const rr = lerp(R_INNER, R_A_END, rng());
      const w  = regionWeight(rr);
      if (rng() > w) continue;

      const r   = rr * R;
      const th  = rng() * 360;
      const tin = (rng() - 0.5) * 0.06;

      particles.push({
        r, rRel: rr,
        theta: th,
        tint: tin,
        hist: new Array(TRAIL_LEN),
        hi: 0
      });
    }
  }

  // ---------- Colors ----------
  function colorForRadius(rr, tint, time, theta) {
    const Ccol  = [210, 205, 195];
    const Bcol  = [238, 230, 215];
    const Acol  = [225, 220, 205];
    const Dcol  = [90,  90,  95];

    let base = Acol, aTrail = 140, aHead = 220;

    if (rr < R_C_END) {          // C
      base = mixRGB(Ccol, Bcol, 0.2);
      aTrail = 80; aHead = 160;
    } else if (rr < R_B_END) {   // B
      base = Bcol;
      aTrail = 200; aHead = 255;
    } else if (rr < R_CASS_1) {  // Cassini Div
      base = Dcol;
      aTrail = 45;  aHead = 90;
    } else {                     // A
      base = Acol;
      aTrail = 140; aHead = 220;
      const d = Math.abs(rr - R_ENCKE);
      if (d < 0.02) {
        const f = 1 - (0.02 - d) / 0.02;
        aTrail *= f; aHead *= f;
      }
    }

    const jitter = 0.035 * (p.noise(0.025 * theta, time * 0.4) - 0.5);
    const r = clamp((base[0] * (1 + tint + jitter)) | 0, 0, 255);
    const g = clamp((base[1] * (1 + tint + jitter)) | 0, 0, 255);
    const b = clamp((base[2] * (1 + tint + jitter)) | 0, 0, 255);

    const rHead = clamp((r * 1.10) | 0, 0, 255);
    const gHead = clamp((g * 1.10) | 0, 0, 255);
    const bHead = clamp((b * 1.10) | 0, 0, 255);

    return { r, g, b, aTrail, rHead, gHead, bHead, aHead };
  }

  // ---------- UI ----------
  function hookControls() {
    const speed   = document.getElementById('js-speed');
    const tilt    = document.getElementById('js-tilt');
    const pauseBtn= document.getElementById('js-pause');

    if (speed) speed.addEventListener('input', function (e) { rotSpeed = +e.target.value; });
    if (tilt)  tilt.addEventListener('input',  function (e) { ringTiltDeg = +e.target.value; });

    if (pauseBtn) pauseBtn.addEventListener('click', function () {
      paused = !paused;
      pauseBtn.textContent = paused ? 'Resume' : 'Pause';
      if (!paused) p.loop();
    });
  }

  function drawRingShadow(outer, planetR, Lr) {
    p.push();
    p.noStroke();

    // project light onto ring plane (y=0 in this local frame)
    const len = Math.hypot(Lr.x, Lr.z) || 1e-4;
    const dirx = Lr.x / len, dirz = Lr.z / len;

    // put the shadow on the FAR side: move opposite the light
    const off = planetR * 0.6;
    p.translate(-dirx * off, 0, -dirz * off);

    // slightly larger than the planet, softly feathered
    const rx = planetR * 1.85;
    const rz = planetR * 1.05;

    // nicer blending
    if (p.blendMode) p.blendMode(p.MULTIPLY);
    for (let i = 0; i < 6; i++) {
      const a = 18 - i * 3; // 18,15,12,9,6,3
      p.fill(0, 0, 0, a);
      p.ellipse(0, 0, rx, rz);
    }
    if (p.blendMode) p.blendMode(p.BLEND);
    p.pop();
  }

  function drawVignette() {
    p.push();
    p.resetMatrix();
    p.noStroke();
    for (let i = 0; i < 6; i++) {
      const a = 22 - i * 4;
      p.fill(0, 0, 0, a);
      p.rect(-W/2, -H/2, W, H, 24);
    }
    p.pop();
  }

  function chooseCanvasSize(parent) {
    if (!parent) return [window.innerWidth, window.innerHeight];
    return [parent.clientWidth, parent.clientHeight];
  }

  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function mixRGB(a, b, t) { return [a[0] + (b[0]-a[0]) * t, a[1] + (b[1]-a[1]) * t, a[2] + (b[2]-a[2]) * t]; }
  function norm3(x, y, z) { const m = Math.sqrt(x*x + y*y + z*z) || 1; return { x:x/m, y:y/m, z:z/m }; }
  function mulberry32(a) { return function() { let t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7, t|61); return ((t^t>>>14)>>>0)/4294967296; } }
};

/* ==================== Shaders ==================== */
const SATURN_VERT = `
precision mediump float;
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aTexCoord;
uniform mat4 uProjectionMatrix;
uniform mat4 uModelViewMatrix;
uniform mat3 uNormalMatrix;
varying vec3 vObj;     // position in object-space (unit sphere)
varying vec3 vNormal;  // normal in view-space (unused)
varying vec2 vUv;
void main(){
  vUv = aTexCoord;
  vObj = normalize(aPosition);
  vNormal = normalize(uNormalMatrix * aNormal);
  gl_Position = uProjectionMatrix * (uModelViewMatrix * vec4(aPosition, 1.0));
}
`;

const SATURN_FRAG = `
precision mediump float;
varying vec3 vObj;
varying vec3 vNormal;
varying vec2 vUv;

uniform vec3  uLightDir;        // light in object-space
uniform float uTime;
uniform float uBandContrast;    // 1.05..1.30
uniform float uRim;             // 0..1
uniform float uGamma;           // 2.2 default
uniform float uRingTilt;        // radians
uniform vec2  uRingInnerOuter;  // [inner, outer] in planet radii
uniform vec2  uCassini;         // [c0, c1]
uniform float uEncke;           // radius

// --- tiny hash/fbm (cheap) ---
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0,0.0));
  float c = hash(i + vec2(0.0,1.0));
  float d = hash(i + vec2(1.0,1.0));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
float fbm(vec2 p){
  float v=0.0, a=0.5;
  for(int i=0;i<5;i++){ v += a*noise(p); p*=2.2; a*=0.55; }
  return v;
}
float smoothstep01(float e0, float e1, float x){
  float t = clamp((x - e0) / max(1e-6, e1 - e0), 0.0, 1.0);
  return t*t*(3.0-2.0*t);
}

// --- ring shadow test in object-space ---
// Ray from surface point P toward light L; rings lie in tilted plane
float ringShadowFactor(vec3 P, vec3 L, float tilt, vec2 innerOuter, vec2 cassini, float encke){
  // ring plane normal (tilt about +X)
  vec3 nR = normalize(vec3(0.0, cos(tilt), sin(tilt)));
  float denom = dot(nR, L);
  if (abs(denom) < 1e-4) return 0.0; // light parallel to plane: no shadow cast
  float t = -dot(nR, P) / denom;
  if (t <= 0.0) return 0.0; // intersection is behind the light

  vec3 Q = P + L * t; // intersection point on plane
  // distance from planet center projected to ring plane
  vec3 qPlane = Q - nR * dot(nR, Q);
  float r = length(qPlane); // planet radii (P is unit sphere)

  float sh = 0.0;
  float inner = innerOuter.x;
  float outer = innerOuter.y;

  // broad ring body
  sh = smoothstep01(inner, inner+0.03, r) * (1.0 - smoothstep01(outer-0.05, outer, r));

  // Cassini division softening (reduce shadow there)
  float c0=cassini.x, c1=cassini.y;
  float inCass = smoothstep01(c0, c0+0.01, r) * (1.0 - smoothstep01(c1-0.01, c1, r));
  sh *= (1.0 - 0.7 * inCass);

  // Encke gap nibble
  sh *= (1.0 - smoothstep01(encke-0.008, encke+0.008, r) * 0.6);

  return clamp(sh, 0.0, 1.0);
}

void main(){
  // object-space normal (unit sphere)
  vec3 N = normalize(vObj);
  vec3 L = normalize(uLightDir);
  vec3 V = normalize(-vec3(0.0,0.0,1.0)); // camera along -Z in object-space

  // latitude (−1..1), longitude
  float lat = N.y;
  float lon = atan(N.z, N.x); // -pi..pi

  // flow-warp the latitude to break "painted stripe" look
  float flow = fbm(vec2(lon*2.0, lat*6.0) + vec2(0.7*uTime, 0.03*uTime));
  float latW = lat + (flow - 0.5) * 0.06;

  // multi-frequency banding
  float b1 = sin(latW * 16.0);
  float b2 = sin(latW * 7.0 + 0.8);
  float bands = b1*0.55 + b2*0.35;

  // equatorial brightening & polar cool tint
  float eq = 1.0 - clamp(abs(lat) / 0.35, 0.0, 1.0);
  float pol = smoothstep01(0.58, 0.82, abs(lat));

  // base creamy palette
  vec3 base = vec3(0.92, 0.88, 0.80);
  base -= bands * uBandContrast * vec3(0.06, 0.07, 0.05);
  base += eq * vec3(0.03);                         // gentle equatorial lift
  base = mix(base, base * vec3(0.75, 0.80, 0.95), pol * 0.22); // polar bluish

  // tiny grain
  float grain = (fbm(vec2(lon*24.0, lat*18.0)) - 0.5) * 0.04;
  base += grain;

  // lighting
  float diffuse = max(0.0, dot(N, L));
  float rim = pow(1.0 - max(0.0, dot(N, V)), 2.2) * uRim; // atmospheric haze at limb
  float spec = pow(max(0.0, dot(reflect(-L, N), V)), 24.0) * 0.02; // tiny, Saturn is matte

  // ring shadow across disc
  float sh = ringShadowFactor(N, L, uRingTilt, uRingInnerOuter, uCassini, uEncke);

  // gentle limb darkening
  float limb = pow(max(0.0, dot(N, V)), 0.45);
  vec3 col = base * (diffuse * 1.05 + 0.06) * limb * (1.0 - 0.7*sh) + spec;
  // gamma
  col = pow(max(col, 0.0), vec3(1.0 / uGamma));
  gl_FragColor = vec4(col, 1.0);
}
`;