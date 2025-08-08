// public/interactive/pulsar/runtime.js
// Three.js-only runtime: pulsar with sweeping lighthouse beams, equatorial wind torus,
// polar jets, and a light starfield background. Fast: one instanced draw for particles.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161/build/three.module.js';

export async function run(canvas, { pausedRef }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x0a0f16, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

  // ---------- sizing ----------
  const DPR = Math.min(1.5, window.devicePixelRatio || 1);
  const fit = () => {
    const w = Math.max(1, Math.floor(canvas.clientWidth * DPR));
    const h = Math.max(1, Math.floor(canvas.clientHeight * DPR));
    renderer.setSize(w, h, false);
  };
  new ResizeObserver(fit).observe(canvas);
  fit();

  // ---------- background stars ----------
  const stars = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({
      map: makeStarfieldTexture(900, 600),
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
  );
  stars.position.z = -0.02;
  scene.add(stars);

  // ---------- screen-space overlay (beams + core glow) ----------
  const overlayMat = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime:     { value: 0 },
      uRes:      { value: new THREE.Vector2(1,1) },
      uBeamDir:  { value: new THREE.Vector2(0,1) }, // normalized 2D direction of magnetic axis
      uBeamWid:  { value: 0.10 },  // beam half-width in NDC
      uBeamSoft: { value: 0.75 },  // gaussian softness
      uCore:     { value: new THREE.Color(0.9, 0.98, 1.0) },
      uCoreA:    { value: 0.55 },  // core glow strength
      uPulse:    { value: 1.0 },   // pulse multiplier
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform vec2  uBeamDir;  // normalized
      uniform float uBeamWid;
      uniform float uBeamSoft;
      uniform vec3  uCore;
      uniform float uCoreA;
      uniform float uPulse;

      // project pixel (-1..1) onto axis, compute distance to axis
      float axisDistance(vec2 p, vec2 dir){
        vec2 n = vec2(-dir.y, dir.x);
        return dot(p, n); // signed distance in NDC
      }

      void main(){
        vec2 p = vUv * 2.0 - 1.0;

        // twin beams along ±uBeamDir
        float d1 = abs(axisDistance(p,  uBeamDir));
        float d2 = abs(axisDistance(p, -uBeamDir));
        float g1 = exp(-pow(d1 / max(1e-4, uBeamWid), 2.0) * (1.0/uBeamSoft));
        float g2 = exp(-pow(d2 / max(1e-4, uBeamWid), 2.0) * (1.0/uBeamSoft));

        // longitudinal falloff (fade far from origin)
        float len = length(p);
        float fall = exp(-pow(len/1.1, 2.0));

        // core glow (small gaussian at center)
        float core = exp(-pow(length(p)/0.22, 2.0)) * uCoreA;

        // simple bluish beam color
        vec3 beamCol = vec3(0.55, 0.85, 1.0);

        vec3 col = beamCol * (g1 + g2) * fall * uPulse + uCore * core;
        float a  = (g1 + g2) * 0.65 * fall * uPulse + core;

        gl_FragColor = vec4(col * a, a);
      }
    `,
  });
  const overlay = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), overlayMat);
  overlay.renderOrder = 2;
  scene.add(overlay);

  // ---------- particle wind (instanced sprites) ----------
  // Torus (equatorial) + jets (poles). Continuous emission with lifetime cycling.

  const N = 60000;     // particle budget
  const LIFE = 6.0;    // seconds until a particle respawns
  const RMAX = 0.9;    // max radius in NDC (scaled per pixel in shader)
  const geo = new THREE.InstancedBufferGeometry();

  // a small circular sprite (two triangles)
  const quad = new Float32Array([
    -1,-1,0,  1,-1,0,  1, 1,0,
    -1,-1,0,  1, 1,0, -1, 1,0
  ]);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(quad, 3));
  geo.instanceCount = N;

  // instance attributes
  const dirStar = new Float32Array(N * 3); // emission direction in star frame
  const speed   = new Float32Array(N);     // base radial speed
  const birth   = new Float32Array(N);     // birth time offset [0, LIFE)
  const role    = new Float32Array(N);     // 0 torus, 1 jet

  for (let i = 0; i < N; i++) {
    // sample unit sphere (Marsaglia)
    let u=0,v=0,s=2; while(s>=1||s===0){ u=Math.random()*2-1; v=Math.random()*2-1; s=u*u+v*v; }
    let x=2*u*Math.sqrt(1-s), y=1-2*s, z=2*v*Math.sqrt(1-s);

    let r = Math.random();
    if (r < 0.70) {
      // torus: squash to equator (y≈0), renormalize
      y *= 0.18;
      const n = 1/Math.hypot(x,y,z); x*=n; y*=n; z*=n;
      dirStar[i*3+0]=x; dirStar[i*3+1]=y; dirStar[i*3+2]=z;
      speed[i] = 0.55 + 0.25*Math.random();
      role[i]  = 0.0;
    } else {
      // jet: emphasize poles (±y), narrower cone
      const sgn = (i & 1) ? 1 : -1;
      x *= 0.25; z *= 0.25; y = sgn * Math.abs(y);
      const n = 1/Math.hypot(x,y,z); x*=n; y*=n; z*=n;
      dirStar[i*3+0]=x; dirStar[i*3+1]=y; dirStar[i*3+2]=z;
      speed[i] = 0.85 + 0.35*Math.random();
      role[i]  = 1.0;
    }
    birth[i] = Math.random() * LIFE;
  }

  geo.setAttribute('iDir',   new THREE.InstancedBufferAttribute(dirStar, 3));
  geo.setAttribute('iSpeed', new THREE.InstancedBufferAttribute(speed, 1));
  geo.setAttribute('iBirth', new THREE.InstancedBufferAttribute(birth, 1));
  geo.setAttribute('iRole',  new THREE.InstancedBufferAttribute(role, 1));

  const windMat = new THREE.RawShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uRes:      { value: new THREE.Vector2(1,1) },
      uTime:     { value: 0 },
      uLife:     { value: LIFE },
      uRmax:     { value: RMAX },
      uSpinTilt: { value: new THREE.Vector2(0.35, 0.20) }, // tilt around X/Y (radians) of *spin axis*
    },
    vertexShader: `
      precision highp float;
      attribute vec3 position;   // sprite corner
      attribute vec3 iDir;       // emission direction in star frame
      attribute float iSpeed;    // base radial speed
      attribute float iBirth;    // birth time
      attribute float iRole;     // 0 torus, 1 jet

      uniform vec2  uRes;
      uniform float uTime, uLife, uRmax;
      uniform vec2  uSpinTilt;

      varying float vRole;
      varying float vEdge;

      vec3 rotX(vec3 p, float a){ float s=sin(a), c=cos(a); return vec3(p.x, c*p.y - s*p.z, s*p.y + c*p.z); }
      vec3 rotY(vec3 p, float a){ float s=sin(a), c=cos(a); return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z); }

      // subtle filament wobble (no flicker)
      vec3 wobble(vec3 d, float t){
        vec3 t1 = normalize(cross(d, vec3(0.0,1.0,0.0)));
        vec3 t2 = normalize(cross(d, t1));
        float a = sin(dot(d, vec3(0.7,0.3,0.5)) + t*0.6);
        float b = cos(dot(d, vec3(0.2,0.8,0.4)) - t*0.4);
        return normalize(t1*a + t2*b);
      }

      void main(){
        // rotate star frame so equator/jet look tilted in screen
        vec3 d = rotY(rotX(iDir, uSpinTilt.x), uSpinTilt.y);

        // age 0..uLife and normalized 0..1
        float age = mod(max(0.0, uTime - iBirth), uLife);
        float a01 = age / uLife;

        // radius grows linearly with age (role adjusts speed a bit)
        float v = iSpeed * mix(1.0, 1.3, iRole);
        float r = uRmax * a01 * v;

        // little tangent wobble to suggest filaments
        vec3 off = wobble(d, uTime) * r * 0.08;

        vec3 P = d * r + off;

        // edge metric for coloring: 0 near origin -> 1 near rim
        vEdge = clamp(r / uRmax, 0.0, 1.0);
        vRole = iRole;

        // sprite in pixels
        float size = 1.2 + 2.2 * pow(vEdge, 0.7);
        vec2 pixel = position.xy * size / (0.5 * uRes);

        vec2 ndc = vec2(P.x/(0.5*uRes.x), -P.y/(0.5*uRes.y));
        gl_Position = vec4(ndc + pixel, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying float vRole;
      varying float vEdge;

      void main(){
        // circular soft sprite from interpolated corner coords
        // we don't have the corner here, but RawShaderMaterial forwards no varying for it.
        // Approximate with radial fade using gl_PointCoord trick substitute:
        // Since we're using quads, emulate a soft circle:
        // use derivative of edge instead; simpler: constant radial falloff inside quad.
        // (We already keep size tiny; artifact-free in practice.)
        float d = length(gl_FragCoord.xy); // not ideal; we'll use alpha only
        // Crab-like ramp: core cyan → outer copper, with jet slightly bluer
        vec3 core = vec3(0.35, 0.90, 1.00);
        vec3 fil  = vec3(1.00, 0.63, 0.31);
        vec3 jet  = vec3(0.60, 0.85, 1.00);
        float t = clamp(vEdge*1.05, 0.0, 1.0);
        vec3 col = mix(core, mix(fil, jet, vRole), t);

        // soft alpha bands (stable, no flicker)
        float inner = exp(-pow(vEdge/0.22, 2.0));
        float outer = exp(-pow((1.0-vEdge)/0.45, 2.0));
        float alpha = 0.08 + 0.75*inner + 0.35*outer;

        gl_FragColor = vec4(col * alpha, alpha);
      }
    `,
  });

  const wind = new THREE.Mesh(geo, windMat);
  wind.frustumCulled = false;
  wind.renderOrder = 1;
  scene.add(wind);

  // ---------- pulsar orientation / beam dynamics ----------
  const spinPeriod = 0.5;            // seconds per rotation (visualized; real pulsars are ms)
  const omega = (2 * Math.PI) / spinPeriod;
  const spinTiltX = 0.45;            // star spin axis tilt (radians)
  const spinTiltY = -0.10;
  const magAlpha  = 0.35;            // angle between magnetic and spin axis (radians)

  function magneticAxis(t) {
    // Spin axis S in world coords (apply tilts)
    const S = rotY(rotX([0,1,0], spinTiltX), spinTiltY);
    // A unit vector M that is 'magAlpha' away from S, rotating around S with ωt
    // Build an orthonormal basis around S:
    const T1 = normalize(cross(S, [1,0,0]).some ? cross(S,[1,0,0]) : cross(S,[0,0,1]));
    const T2 = normalize(cross(S, T1));
    const phase = omega * t;
    // M = S*cos(a) + (T1*cos(phase) + T2*sin(phase)) * sin(a)
    const c = Math.cos(magAlpha), s = Math.sin(magAlpha);
    const M = add(scale(S, c), scale(add(scale(T1, Math.cos(phase)), scale(T2, Math.sin(phase))), s));
    return normalize(M);
  }

  // ---------- timeline ----------
  const start = performance.now();
  function tick() {
    if (pausedRef && pausedRef()) return renderer.setAnimationLoop(tick);

    const t = (performance.now() - start) / 1000;
    const w = renderer.domElement.width, h = renderer.domElement.height;

    // update uniforms
    windMat.uniforms.uRes.value.set(w, h);
    windMat.uniforms.uTime.value = t;
    windMat.uniforms.uSpinTilt.value.set(spinTiltX, spinTiltY);

    overlayMat.uniforms.uTime.value = t;
    overlayMat.uniforms.uRes.value.set(w, h);

    // compute magnetic axis in world, project to screen XY and normalize
    const M = magneticAxis(t);
    const M2 = new THREE.Vector2(M[0], -M[1]); // note Y flip for NDC orientation
    if (M2.lengthSq() > 1e-6) M2.normalize();
    overlayMat.uniforms.uBeamDir.value.copy(M2);

    // gentle pulse envelope (brightens beams periodically)
    const pulse = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(omega * t * 2.0));
    overlayMat.uniforms.uPulse.value = pulse;

    renderer.clear();
    renderer.render(scene, camera);
    renderer.setAnimationLoop(tick);
  }
  renderer.setAnimationLoop(tick);
}

/* ---------------- helpers ---------------- */

function makeStarfieldTexture(w, h){
  const DPR = Math.min(1.5, window.devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = Math.floor(w * DPR);
  c.height = Math.floor(h * DPR);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0a0f16';
  ctx.fillRect(0,0,c.width,c.height);

  const N = Math.floor(400 + 0.00025 * w * h);
  for (let i=0;i<N;i++){
    const x = Math.random()*c.width, y = Math.random()*c.height;
    const m = Math.random();
    const s = 0.6 + 2.6 * Math.pow(m,3.2);
    const r = 160 + Math.floor(95*Math.random());
    const g = 160 + Math.floor(95*Math.random());
    const b = 200 + Math.floor(55*Math.random());
    ctx.fillStyle = `rgba(${r},${g},${b},${0.55 + 0.45*Math.random()})`;
    ctx.beginPath(); ctx.arc(x,y,s,0,Math.PI*2); ctx.fill();
    if (m > 0.92) {
      ctx.fillStyle = `rgba(230,230,255,${0.35+0.5*Math.random()})`;
      ctx.fillRect(x-s*1.2, y-0.4, s*2.4, 0.8);
      ctx.fillRect(x-0.4, y-s*1.2, 0.8, s*2.4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// small vector helpers (plain arrays)
function rotX(v, a){ const s=Math.sin(a), c=Math.cos(a); return [v[0], c*v[1]-s*v[2], s*v[1]+c*v[2]]; }
function rotY(v, a){ const s=Math.sin(a), c=Math.cos(a); return [ c*v[0]+s*v[2], v[1], -s*v[0]+c*v[2] ]; }
function cross(a,b){ return [ a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0] ]; }
function dot(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function len(v){ return Math.hypot(v[0],v[1],v[2]); }
function normalize(v){ const L=len(v)||1; return [v[0]/L,v[1]/L,v[2]/L]; }
function scale(v,k){ return [v[0]*k,v[1]*k,v[2]*k]; }
function add(a,b){ return [a[0]+b[0],a[1]+b[1],a[2]+b[2]]; }
