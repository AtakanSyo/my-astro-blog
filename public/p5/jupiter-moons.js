// /public/p5/jupiter.js
// Jupiter: shader-lit globe + 4 moons with orbital trails
// - Orbits: scientific ordering + relative spacing (aRJ) rescaled to visible band
// - Moons slowed with SIM_DAYS_PER_SEC
// - Orbit guide ellipses removed

export const jupiterSketch = (p) => {
  // ---- Config ----
  const DPR = Math.min(1.5, window.devicePixelRatio || 1);
  let W = 900, H = 520;
  let R = 180;                 // planet radius (set in setup)
  let rotSpeed = 0.60;         // deg/frame (hookable via #js-speed)
  let equatorTiltDeg = 3.0;    // Jupiter axial tilt ≈ 3.1°
  let paused = false;

  // Sim time: how many "days" pass per real second (slower orbits)
  const SIM_DAYS_PER_SEC = 0.012;

  // Light direction (world space)
  const LIGHT = norm3(-0.45, -0.25, 0.85);

  // State
  let phase = 0; // planet rotation (deg)
  let t = 0;     // time

  // Shader
  let jupiterShader;
  let shaderOK = true;

  // ----- Moons -----
  // aRJ = semimajor axis in Jupiter radii (RJ)
  // period = days
  const MOONS_META = [
    { name: "Io",       aRJ: 5.905,  period: 1.769,  color: [246, 210, 120], radiusPx: 9 },
    { name: "Europa",   aRJ: 9.396,  period: 3.551,  color: [210, 220, 235], radiusPx: 8 },
    { name: "Ganymede", aRJ: 15.00,  period: 7.155,  color: [195, 200, 210], radiusPx: 11 },
    { name: "Callisto", aRJ: 26.33,  period: 16.689, color: [170, 175, 180], radiusPx: 10 },
  ];
  const MOON_TRAIL_LEN = 42;
  let moons = [];

  p.setup = () => {
    const parent = document.getElementById('jupiter-sim') || document.body;
    const size = chooseCanvasSize(parent);
    W = size[0]; H = size[1];

    p.pixelDensity(Math.min(2, window.devicePixelRatio || 1));
    p.createCanvas(W, H, p.WEBGL);
    p.frameRate(60);

    R = Math.min(W, H) * 0.33; // keep Jupiter nice and big

    try {
      jupiterShader = p.createShader(JUPITER_VERT, JUPITER_FRAG);
    } catch (e) {
      console.error("[Jupiter] Shader create failed:", e);
      shaderOK = false;
    }

    initMoons();
    hookControls();
  };

  p.windowResized = () => {
    const parent = document.getElementById('jupiter-sim') || document.body;
    const size = chooseCanvasSize(parent);
    W = size[0]; H = size[1];
    p.resizeCanvas(W, H);
    R = Math.min(W, H) * 0.33;
    initMoons();
  };

  // tiny helpers to rotate vectors (for light-space transform)
  function rotX(v, a){ const s=Math.sin(a), c=Math.cos(a); return {x:v.x, y:v.y*c - v.z*s, z:v.y*s + v.z*c}; }
  function rotY(v, a){ const s=Math.sin(a), c=Math.cos(a); return {x:v.x*c + v.z*s, y:v.y, z:-v.x*s + v.z*c}; }

  p.draw = () => {
    if (paused) return;

    p.background(8, 10, 16);

    // Time + rotation
    const dtSec = (p.deltaTime || 16.67) / 1000;
    t += 0.006;
    phase = (phase + rotSpeed) % 360;

    const tiltRad  = p.radians(equatorTiltDeg);
    const phaseRad = p.radians(phase);

    // ---- Jupiter (shader-based) ----
    p.push();
    p.rotateY(phaseRad);
    p.rotateX(tiltRad);

    if (shaderOK && jupiterShader) {
      // Move light into object space (undo model rotations)
      let Lobj = {...LIGHT};
      Lobj = rotX(Lobj, -tiltRad);
      Lobj = rotY(Lobj, -phaseRad);

      try { p.shader(jupiterShader); } catch (e) { shaderOK = false; }
      if (shaderOK) {
        jupiterShader.setUniform('uLightDir', [Lobj.x, Lobj.y, Lobj.z]);
        jupiterShader.setUniform('uTime', t);
        jupiterShader.setUniform('uBandContrast', 1.25);
        jupiterShader.setUniform('uGamma', 2.2);
        jupiterShader.setUniform('uNightAmbient', 0.012);
        jupiterShader.setUniform('uNightFactor', 0.94);
        // Great Red Spot
        jupiterShader.setUniform('uGRSLat', -0.37);
        jupiterShader.setUniform('uGRSWidth', 0.38);
        jupiterShader.setUniform('uGRSHeight', 0.18);
        jupiterShader.setUniform('uGRSRot', -0.35);
        jupiterShader.setUniform('uGRSStrength', 0.40);

        p.noStroke();
        p.sphere(R, 96, 72);
        p.resetShader();
      } else {
        // Fallback
        p.ambientLight(80);
        p.directionalLight(255, 255, 255, LIGHT.x, LIGHT.y, LIGHT.z);
        p.noStroke();
        p.fill(210);
        p.sphere(R, 64, 48);
      }
    } else {
      // Fallback
      p.ambientLight(80);
      p.directionalLight(255, 255, 255, LIGHT.x, LIGHT.y, LIGHT.z);
      p.noStroke();
      p.fill(210);
      p.sphere(R, 64, 48);
    }
    p.pop();

    // ---- Moons (equatorial plane) ----
    p.push();
    p.rotateX(tiltRad); // align to equator plane

    // Lighting for moon spheres
    p.ambientLight(50);
    p.directionalLight(255, 255, 255, LIGHT.x, LIGHT.y, LIGHT.z);
    p.specularMaterial(255);

    // update + draw moons (no orbit guides)
    p.strokeWeight(1.25);
    for (const m of moons) {
      // advance true anomaly using real period
      const omega = (2 * Math.PI) / m.period;   // rad/day
      m.theta = (m.theta + omega * (dtSec * SIM_DAYS_PER_SEC)) % (2 * Math.PI);

      const x = m.rOrbit * Math.cos(m.theta);
      const z = m.rOrbit * Math.sin(m.theta);
      const y = 0;

      // trail
      m.hist[m.hi] = {x, y, z};
      m.hi = (m.hi + 1) % MOON_TRAIL_LEN;

      // draw trail
      p.stroke(m.color[0], m.color[1], m.color[2], 160);
      p.noFill();
      p.beginShape();
      for (let k = 0; k < MOON_TRAIL_LEN; k++) {
        const idx = (m.hi + k) % MOON_TRAIL_LEN;
        const pt = m.hist[idx];
        if (pt) p.vertex(pt.x, pt.y, pt.z);
      }
      p.endShape();

      // moon sphere
      p.push();
      p.translate(x, y, z);
      p.ambientMaterial(m.color[0], m.color[1], m.color[2]);
      p.shininess(10);
      p.noStroke();
      p.sphere(m.radiusPx, 24, 20);
      p.pop();
    }
    p.pop();

    // Vignette
    drawVignette();
  };

  // ----- Moons setup -----
  function initMoons() {
    // Rescale scientific aRJ values to the visible band [inner .. outer]
    const aMin = Math.min.apply(null, MOONS_META.map(m => m.aRJ));
    const aMax = Math.max.apply(null, MOONS_META.map(m => m.aRJ));

    const inner = R * 1.35;                 // just outside the limb
    const outer = Math.min(W, H) * 0.47;    // safe screen edge
    const span  = Math.max(outer - inner, 40); // px, ensure >0

    const k = span / (aMax - aMin);         // linear map slope

    moons = [];
    const rng = mulberry32(20250808);
    for (let i = 0; i < MOONS_META.length; i++) {
      const meta = MOONS_META[i];
      const rOrbit = inner + (meta.aRJ - aMin) * k; // preserves relative spacing

      moons.push({
        name: meta.name,
        rOrbit,
        period: meta.period,
        radiusPx: meta.radiusPx,
        color: meta.color,
        theta: rng() * Math.PI * 2,       // random mean anomaly
        hist: new Array(MOON_TRAIL_LEN),
        hi: 0,
      });
    }
  }

  // ----- UI -----
  function hookControls() {
    const speed   = document.getElementById('js-speed');
    const tilt    = document.getElementById('js-tilt');
    const pauseBtn= document.getElementById('js-pause');

    if (speed) speed.addEventListener('input', function (e) { rotSpeed = +e.target.value; });
    if (tilt)  tilt.addEventListener('input',  function (e) { equatorTiltDeg = +e.target.value; });

    if (pauseBtn) pauseBtn.addEventListener('click', function () {
      paused = !paused;
      pauseBtn.textContent = paused ? 'Resume' : 'Pause';
      if (!paused) p.loop();
    });
  }

  // ----- Vignette -----
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

  // ----- Utils -----
  function chooseCanvasSize(parent) {
    const pw = (parent && parent.clientWidth)  ? parent.clientWidth  : Math.min(900, window.innerWidth || 900);
    let   ph = (parent && parent.clientHeight) ? parent.clientHeight : 0;
    if (!ph || ph < 60) ph = Math.max(520, Math.round(pw * 0.58));
    return [pw, ph];
  }
  function norm3(x, y, z) { const m = Math.sqrt(x*x + y*y + z*z) || 1; return { x:x/m, y:y/m, z:z/m }; }
  function mulberry32(a) { return function(){ let t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
};

/* ==================== Shaders ==================== */
// Mirrors Saturn’s shader structure; no rim add (keeps nightside dark)
const JUPITER_VERT = `
precision mediump float;
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aTexCoord;
uniform mat4 uProjectionMatrix;
uniform mat4 uModelViewMatrix;
uniform mat3 uNormalMatrix;
varying vec3 vObj;
varying vec2 vUv;
void main() {
  vObj = normalize(aPosition);
  vUv = aTexCoord;
  gl_Position = uProjectionMatrix * (uModelViewMatrix * vec4(aPosition, 1.0));
}
`;

const JUPITER_FRAG = `
precision mediump float;
varying vec3 vObj;
varying vec2 vUv;

uniform vec3  uLightDir;        // light in object-space
uniform float uTime;
uniform float uBandContrast;    // 1.1..1.4
uniform float uGamma;           // 2.2
// Great Red Spot controls
uniform float uGRSLat;          // ~ -0.37 ≈ sin(-22°)
uniform float uGRSWidth;        // lon scale
uniform float uGRSHeight;       // lat scale
uniform float uGRSRot;          // internal rotation
uniform float uGRSStrength;     // 0..1
// nightside
uniform float uNightAmbient;    // ~0.010..0.018
uniform float uNightFactor;     // 0.90..0.96

// --- fbm ---
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
  for(int i=0;i<5;i++){ v += a*noise(p); p*=2.15; a*=0.55; }
  return v;
}
float smoothstep01(float e0, float e1, float x){
  float t = clamp((x - e0) / max(1e-6, e1 - e0), 0.0, 1.0);
  return t*t*(3.0-2.0*t);
}

void main(){
  vec3 N = normalize(vObj);
  vec3 L = normalize(uLightDir);
  vec3 V = normalize(-vec3(0.0,0.0,1.0)); // camera ~ -Z

  float lat = N.y;                     // proxy latitude
  float lon = atan(N.z, N.x);          // -pi..pi

  // Flow-warped bands
  float flow = fbm(vec2(lon*3.0, lat*10.0) + vec2(0.9*uTime, 0.04*uTime));
  float latW = lat + (flow - 0.5) * 0.10;
  float b1 = sin(latW * 20.0);
  float b2 = sin(latW * 9.0 + 0.7);
  float bands = b1*0.65 + b2*0.45;

  // Palette & tints
  vec3 base = vec3(0.92, 0.90, 0.86);
  base -= bands * uBandContrast * vec3(0.10, 0.08, 0.06);
  float eq = 1.0 - clamp(abs(lat) / 0.42, 0.0, 1.0);
  base += vec3(0.04) * eq;
  float pol = smoothstep01(0.62, 0.86, abs(lat));
  base = mix(base, base * vec3(0.80, 0.86, 0.98), pol * 0.20);

  // Great Red Spot (elliptical gaussian)
  float lonCenter = -0.6 + 0.05 * sin(uTime * 0.2);
  float dLon = atan(sin(lon - lonCenter), cos(lon - lonCenter));
  float dLat = lat - uGRSLat;
  float c = cos(uGRSRot), s = sin(uGRSRot);
  vec2 uv = vec2(dLon, dLat);
  vec2 rot = vec2(uv.x*c - uv.y*s, uv.x*s + uv.y*c);
  float grs = exp(-((rot.x/uGRSWidth)*(rot.x/uGRSWidth) + (rot.y/uGRSHeight)*(rot.y/uGRSHeight)));
  vec3 grsCol = vec3(1.06, 0.75, 0.62);
  base = mix(base, grsCol, clamp(grs * uGRSStrength, 0.0, 1.0));

  // tiny grain
  base += (fbm(vec2(lon*28.0, lat*20.0)) - 0.5) * 0.04;

  // Lighting (dark nightside; no rim add)
  float NdotL = dot(N, L);
  float diffuse = max(0.0, NdotL);
  float term = pow(diffuse, 1.6);               // sharper terminator
  float night = 1.0 - smoothstep(-0.15, 0.05, NdotL);
  float limb = pow(max(0.0, dot(N, V)), 0.45);
  float spec = pow(max(0.0, dot(reflect(-L, N), V)), 24.0) * 0.015;

  vec3 col = base * (term * 1.05 + uNightAmbient) * limb + spec;
  col *= (1.0 - uNightFactor * night);          // darken nightside

  // gamma
  col = pow(max(col, 0.0), vec3(1.0 / uGamma));
  gl_FragColor = vec4(col, 1.0);
}
`;