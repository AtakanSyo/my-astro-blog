// /public/interactive/saturn/runtime.js
// WebGL2/Three.js Saturn: shader-lit globe + physically-plausible rings.
// Hard pause supported via pausedRef() from your loader.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161/build/three.module.js';

export async function run(canvas, { pausedRef }) {
  // ---- Config (mirrors your p5) ----
  let rotSpeedDeg = 0.35; // °/frame visual spin
  let ringTiltDeg = 18;

  // Ring geometry (in planet radii)
  const R_INNER  = 1.23;
  const R_C_END  = 1.52;
  const R_B_END  = 1.95;
  const R_CASS_0 = 1.95;
  const R_CASS_1 = 2.02;
  const R_A_END  = 2.27;
  const R_ENCKE  = 2.26;

  // Particles
  const NUM_PARTICLES = 4000;

  // Light direction (world/object space)
  const LIGHT = norm3(-0.4, -0.25, 0.85);

  // ---- Renderer / Scene / Camera ----
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: false, alpha: true, powerPreference: 'high-performance'
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x080A10, 1);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 1000);
  camera.position.set(0, 0, 6);

  // DPR cap + fit
  const DPR = Math.min(1.5, window.devicePixelRatio || 1);
  function fit() {
    const w = Math.max(1, Math.floor(canvas.clientWidth * DPR));
    const h = Math.max(1, Math.floor(canvas.clientHeight * DPR));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(fit).observe(canvas); fit();

  // Desired planet radius in pixels (like p5: min(W,H)*0.33)
  function planetRadiusPx() {
    const w = renderer.domElement.width;
    const h = renderer.domElement.height;
    return Math.min(w, h) * 0.33;
  }

  // ---------------- Globe (shader) ----------------
  const globeGeo = new THREE.SphereGeometry(1, 96, 72); // unit sphere → scaled in world units
  const globeMat = new THREE.ShaderMaterial({
    uniforms: {
      uLightDir:        { value: new THREE.Vector3() },
      uTime:            { value: 0 },
      uBandContrast:    { value: 1.15 },
      uRim:             { value: 0.35 },
      uGamma:           { value: 2.2 },
      uRingTilt:        { value: toRad(ringTiltDeg) },
      uRingInnerOuter:  { value: new THREE.Vector2(R_INNER, R_A_END) },
      uCassini:         { value: new THREE.Vector2(R_CASS_0, R_CASS_1) },
      uEncke:           { value: R_ENCKE }
    },
    vertexShader: /* glsl */`
      varying vec3 vObj;
      void main(){
        vObj = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vObj;

      uniform vec3  uLightDir;
      uniform float uTime, uBandContrast, uRim, uGamma, uRingTilt, uEncke;
      uniform vec2  uRingInnerOuter, uCassini;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i=floor(p), f=fract(p);
        float a=hash(i), b=hash(i+vec2(1.0,0.0)), c=hash(i+vec2(0.0,1.0)), d=hash(i+vec2(1.0,1.0));
        vec2 u=f*f*(3.0-2.0*f);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
      float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.2; a*=0.55; } return v; }
      float sstep01(float e0,float e1,float x){ float t=clamp((x-e0)/max(1e-6,e1-e0),0.0,1.0); return t*t*(3.0-2.0*t); }

      float ringShadowFactor(vec3 P, vec3 L, float tilt, vec2 innerOuter, vec2 cassini, float encke){
        vec3 nR = normalize(vec3(0.0, cos(tilt), sin(tilt)));
        float denom = dot(nR, L); if (abs(denom)<1e-4) return 0.0;
        float t = -dot(nR, P)/denom; if (t<=0.0) return 0.0;
        vec3 Q = P + L*t;
        vec3 q = Q - nR * dot(nR, Q);
        float r = length(q);
        float inner=innerOuter.x, outer=innerOuter.y;
        float sh = sstep01(inner, inner+0.03, r) * (1.0 - sstep01(outer-0.05, outer, r));
        float c0=cassini.x, c1=cassini.y;
        float inCass = sstep01(c0, c0+0.01, r) * (1.0 - sstep01(c1-0.01, c1, r));
        sh *= (1.0 - 0.7*inCass);
        sh *= (1.0 - sstep01(encke-0.008, encke+0.008, r) * 0.6);
        return clamp(sh,0.0,1.0);
      }

      void main(){
        vec3 N = normalize(vObj);
        vec3 L = normalize(uLightDir);

        float lat = N.y;
        float lon = atan(N.z, N.x);

        // subtle flow to break painted stripes
        float flow = fbm(vec2(lon*2.0, lat*6.0) + vec2(0.7*uTime, 0.03*uTime));
        float latW = lat + (flow - 0.5) * 0.06;

        // slightly nicer banding distribution
        float latAmp = mix(0.6, 1.0, smoothstep(0.0, 0.35, abs(lat)));
        float b1 = sin(latW * 14.0 * latAmp);
        float b2 = sin(latW * 6.0 + 0.8);
        float bands = b1*0.55 + b2*0.35;

        float eq = 1.0 - clamp(abs(lat) / 0.35, 0.0, 1.0);
        float pol = sstep01(0.58, 0.82, abs(lat));

        vec3 base = vec3(0.92,0.88,0.80);
        base -= bands * uBandContrast * vec3(0.06,0.07,0.05);
        base += eq * 0.03;
        base = mix(base, base*vec3(0.75,0.80,0.95), pol*0.22);
        base += (fbm(vec2(lon*24.0, lat*18.0)) - 0.5) * 0.04;

        float diffuse = max(0.0, dot(N, L));
        float limb = pow(max(0.0, dot(N, vec3(0.0,0.0,1.0))), 0.45);
        float spec = pow(max(0.0, dot(reflect(-L,N), vec3(0.0,0.0,1.0))), 24.0) * 0.02;

        float sh = ringShadowFactor(N, L, uRingTilt, uRingInnerOuter, uCassini, uEncke);

        vec3 col = base * (diffuse * 1.05 + 0.06) * limb * (1.0 - 0.7*sh) + spec;
        col = pow(max(col, 0.0), vec3(1.0/uGamma));
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  const globe = new THREE.Mesh(globeGeo, globeMat);
  scene.add(globe);

  // ---------------- Rings (instanced sprites, proper depth) ----------------
  const ringGeo = new THREE.InstancedBufferGeometry();
  ringGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array([
    -1,-1,0,  1,-1,0,  1, 1,0,
    -1,-1,0,  1, 1,0, -1, 1,0
  ]), 3));
  ringGeo.instanceCount = NUM_PARTICLES;

  const rng = mulberry32(20250808);
  const rr   = new Float32Array(NUM_PARTICLES);
  const th0  = new Float32Array(NUM_PARTICLES);
  const tint = new Float32Array(NUM_PARTICLES);

  function regionWeight(x){
    if (x < R_C_END) return 0.35;        // C
    if (x < R_B_END) return 1.0;         // B
    if (x < R_CASS_1) return 0.04;       // Cassini
    const base=0.65, gap=Math.max(0, 1 - (Math.abs(x-R_ENCKE)/0.008));
    return base * Math.max(0.1, 1 - gap); // A w/ Encke
  }

  let filled=0, tries=0;
  while (filled<NUM_PARTICLES && tries<NUM_PARTICLES*50){
    tries++;
    const rrel = lerp(R_INNER, R_A_END, rng());
    if (rng() > regionWeight(rrel)) continue;
    rr[filled]   = rrel;
    th0[filled]  = rng() * Math.PI * 2;
    tint[filled] = (rng() - 0.5) * 0.06;
    filled++;
  }
  ringGeo.setAttribute('iRR',   new THREE.InstancedBufferAttribute(rr,   1));
  ringGeo.setAttribute('iTh0',  new THREE.InstancedBufferAttribute(th0,  1));
  ringGeo.setAttribute('iTint', new THREE.InstancedBufferAttribute(tint, 1));

  const ringMat = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: true,         // ✅ rings occlude behind globe
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uRes:      { value: new THREE.Vector2(1,1) },
      uTime:     { value: 0 },
      uRworld:   { value: 2.0 },              // planet radius in WORLD units (updated per frame)
      uTilt:     { value: toRad(ringTiltDeg) },
      uPhase:    { value: 0 },                // rotation about Y (globe spin)
      uAngK:     { value: 0.70 },             // Kepler-ish constant; set to const for same rate on all rings
      uAngNoiseAmp: { value: 0.0 },           // keep steady orbits
      uRadJitter:   { value: 0.0 },           // keep steady orbits
      uCassini:     { value: new THREE.Vector2(R_CASS_0, R_CASS_1) },
      uEncke:       { value: R_ENCKE },

      // Realistic scattering:
      uLightR:  { value: new THREE.Vector3(0,0,1) }, // light dir in ring frame
      uViewR:   { value: new THREE.Vector3(0,0,1) }, // view dir in ring frame
      uTau0:    { value: 0.7 },   // base optical depth
      uPhaseG:  { value: 0.55 },  // HG g parameter (0.45–0.7)
    },
    vertexShader: /* glsl */`
      precision highp float;
      attribute float iRR, iTh0, iTint;

      uniform vec2  uRes;
      uniform float uTime, uRworld, uTilt, uPhase;
      uniform float uAngK, uAngNoiseAmp, uRadJitter;
      uniform vec2  uCassini;
      uniform float uEncke;

      varying float vRR, vTint, vEdge;
      varying vec2  vCorner;

      vec3 rotX(vec3 p, float a){ float s=sin(a), c=cos(a); return vec3(p.x, c*p.y - s*p.z, s*p.y + c*p.z); }
      vec3 rotY(vec3 p, float a){ float s=sin(a), c=cos(a); return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z); }

      void main(){
        float rr = iRR;

        // constant angular speed (Kepler-ish)
        float baseDeg = uAngK / pow(rr, 1.5);
        float th = iTh0 + radians(baseDeg) * (uTime * 60.0);

        // fixed radius (no jitter)
        float r = rr * uRworld;

        // small vertical thickness so ring isn't razor-thin
        float seed = fract(sin(iTh0*43758.5453)*7141.123);
        float yOff = (seed - 0.5) * (0.012 * uRworld); // ~1.2% of planet radius

        // center in ring plane → spin → tilt
        vec3 pos = vec3(r * cos(th), yOff, r * sin(th));
        pos = rotY(pos, uPhase);
        pos = rotX(pos, uTilt);

        // project center to clip
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

        // pixel-sized sprite (use clip.w to convert NDC px to clip)
        float sizePx = 1.25;
        vec2 ndcOffset = position.xy * sizePx / (0.5 * uRes);
        clip.xy += ndcOffset * clip.w;

        gl_Position = clip;

        vRR = rr;
        vTint = iTint;
        vEdge = clamp(rr / 2.27, 0.0, 1.0);
        vCorner = position.xy;
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying float vRR, vTint, vEdge;
      varying vec2  vCorner;

      uniform vec3  uLightR, uViewR; // light/view in ring frame
      uniform float uTau0;           // base optical depth
      uniform float uPhaseG;         // HG g

      vec3 mixRGB(vec3 a, vec3 b, float t){ return a + (b-a)*t; }

      float hg(float cosT, float g){
        float g2 = g*g;
        float denom = pow(1.0 + g2 - 2.0*g*cosT, 1.5);
        return (1.0 - g2) / max(1e-4, 4.0*3.14159*denom);
      }

      // optical depth per ring region
      float tauOfR(float rr){
        if (rr < 1.52) return 0.25;  // C
        if (rr < 1.95) return 1.00;  // B (dense)
        if (rr < 2.02) return 0.05;  // Cassini
        return 0.60;                 // A
      }

      void main(){
        float d = length(vCorner);
        if (d > 1.0) discard;

        // palette per region
        vec3 Ccol = vec3(210.0,205.0,195.0)/255.0;
        vec3 Bcol = vec3(238.0,230.0,215.0)/255.0;
        vec3 Acol = vec3(225.0,220.0,205.0)/255.0;
        vec3 Dcol = vec3( 90.0, 90.0, 95.0)/255.0;
        vec3 base = Acol;
        if      (vRR < 1.52) base = mixRGB(Ccol, Bcol, 0.2);
        else if (vRR < 1.95) base = Bcol;
        else if (vRR < 2.02) base = Dcol;
        else                 base = Acol;

        float jitter = 0.035 * (vEdge - 0.5);
        vec3 rgb = clamp(base * (1.0 + vTint + jitter), 0.0, 1.0);

        // HG phase (forward scattering makes back/side-lit rings glow)
        float cosT = dot(normalize(uLightR), normalize(uViewR));
        float phase = hg(cosT, uPhaseG) * 6.0; // scaled into a nice range

        // transmission vs optical depth
        float tau = uTau0 * tauOfR(vRR);
        float transmit   = exp(-tau);
        float singleScat = (1.0 - transmit);

        // sprite shape * radial bias * scattering strength
        float spot  = (1.0 - d*d);
        float alpha = spot * (0.35 + 0.65*vEdge) * (0.35 + 0.8*singleScat) * phase;

        gl_FragColor = vec4(rgb * alpha, alpha);
      }
    `
  });

  const rings = new THREE.Mesh(ringGeo, ringMat);
  rings.frustumCulled = false;
  rings.renderOrder = 1; // over globe
  scene.add(rings);

  // ---------------- Ring-plane shadow (sun-elevation aware) ----------------
  const shadowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uAlpha:   { value: 0.20 },
      uSunElev: { value: 0.5 }
    },
    vertexShader: `varying vec2 vP; void main(){ vP=position.xz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      precision highp float; varying vec2 vP; uniform float uAlpha, uSunElev;
      void main(){
        float rx=1.85, rz=1.05;
        float d = length(vec2(vP.x/rx, vP.y/rz));
        float soft = mix(0.8, 0.3, clamp(uSunElev, 0.0, 1.0)); // lower opacity when Sun high over ring
        float a = smoothstep(1.0, 0.0, d) * uAlpha * soft;
        gl_FragColor = vec4(0.0,0.0,0.0,a);
      }
    `
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(12,12,1,1), shadowMat);
  shadow.renderOrder = 0.5; // between globe (0) and rings (1)
  scene.add(shadow);

  // ---------------- Vignette ----------------
  const vignette = new THREE.Mesh(
    new THREE.PlaneGeometry(2,2),
    new THREE.ShaderMaterial({
      transparent: true, depthTest: false, depthWrite: false,
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
      fragmentShader: `
        precision highp float; varying vec2 vUv;
        void main(){
          vec2 p=vUv*2.0-1.0; float a=0.0;
          for(int i=0;i<6;i++){ a += (22.0 - float(i)*4.0)/255.0 * smoothstep(1.0, 0.2 + float(i)*0.1, length(p)); }
          gl_FragColor = vec4(0.0,0.0,0.0,a);
        }
      `
    })
  );
  vignette.renderOrder = 10;
  scene.add(vignette);

  // ---------------- Controls ----------------
  hookControls();

  // ---------------- HARD-PAUSE ANIMATION LOOP ----------------
  const clock = new THREE.Clock();
  let elapsed = 0;          // seconds accumulated only while running
  let rafRunning = false;
  let pollId = 0;

  function startLoop() {
    if (rafRunning) return;
    clock.getDelta();       // reset delta so first frame dt is small
    renderer.setAnimationLoop(loop);
    rafRunning = true;
  }
  function stopLoop() {
    if (!rafRunning) return;
    renderer.setAnimationLoop(null);
    rafRunning = false;
  }
  function startPollingForResume() {
    if (pollId) return;
    pollId = setInterval(() => {
      if (!pausedRef || !pausedRef()) {
        clearInterval(pollId);
        pollId = 0;
        startLoop();
      }
    }, 100); // 10 Hz
  }

  function loop() {
    if (pausedRef && pausedRef()) {
      stopLoop();           // stop RAF entirely
      startPollingForResume();
      return;
    }

    const dt = clock.getDelta();
    elapsed += dt;
    const t = elapsed;

    const w = renderer.domElement.width, h = renderer.domElement.height;

    // Planet size: pixels → world units for correct perspective scaling
    const Rpx = planetRadiusPx();
    const halfFovRad = THREE.MathUtils.degToRad(camera.fov * 0.5);
    const ndcHalfHWorld = Math.tan(halfFovRad) * camera.position.z;
    const Rworld = (Rpx / (0.5 * h)) * ndcHalfHWorld;

    // Spin
    const phaseDeg = (rotSpeedDeg * 60.0) * t;
    const phaseRad = toRad(phaseDeg);

    // Globe uniforms & transform
    const Lobj = rotateY(rotateX(LIGHT, -toRad(ringTiltDeg)), -phaseRad);
    globeMat.uniforms.uLightDir.value.set(Lobj.x, Lobj.y, Lobj.z);
    globeMat.uniforms.uTime.value = t;
    globeMat.uniforms.uRingTilt.value = toRad(ringTiltDeg);

    // Oblateness
    const OBLATE = 0.92; // Saturn ~0.902–0.91; 0.92 looks nice
    globe.position.set(0,0,0);
    globe.rotation.set(toRad(ringTiltDeg), phaseRad, 0);
    globe.scale.set(Rworld, Rworld*OBLATE, Rworld);

    // Shadow: sit in ring plane; opacity reacts to solar elevation over ring
    shadow.position.set(0,0,0);
    shadow.rotation.set(toRad(ringTiltDeg), phaseRad, 0);

    const Lr = rotateY(rotateX(LIGHT, -toRad(ringTiltDeg)), -phaseRad);
    const nR = {x:0, y:Math.cos(toRad(ringTiltDeg)), z:Math.sin(toRad(ringTiltDeg))};
    const elev = Math.max(0, Lr.x*nR.x + Lr.y*nR.y + Lr.z*nR.z); // 0..1
    shadowMat.uniforms.uSunElev.value = elev;

    // Rings uniforms
    ringMat.uniforms.uRes.value.set(w, h);
    ringMat.uniforms.uTime.value = t;
    ringMat.uniforms.uRworld.value = Rworld;
    ringMat.uniforms.uTilt.value = toRad(ringTiltDeg);
    ringMat.uniforms.uPhase.value = phaseRad;

    // Light & view in ring frame (for phase function)
    ringMat.uniforms.uLightR.value.set(Lr.x, Lr.y, Lr.z);
    const VIEW = { x:0, y:0, z:1 }; // camera looks ~+Z in object space here
    const Vr = rotateY(rotateX(VIEW, -toRad(ringTiltDeg)), -phaseRad);
    ringMat.uniforms.uViewR.value.set(Vr.x, Vr.y, Vr.z);

    renderer.render(scene, camera);
  }

  // kick off
  startLoop();

  // ---------------- Helpers ----------------
  function hookControls(){
    const speed = document.getElementById('js-speed');
    const tilt  = document.getElementById('js-tilt');
    if (speed) speed.addEventListener('input', e => { rotSpeedDeg = +e.target.value; });
    if (tilt)  tilt.addEventListener('input',  e => { ringTiltDeg = +e.target.value; });
  }
  function toRad(d){ return d * Math.PI / 180; }
  function lerp(a,b,t){ return a + (b-a)*t; }
  function norm3(x,y,z){ const m=Math.hypot(x,y,z)||1; return {x:x/m, y:y/m, z:z/m}; }
  function rotateX(v,a){ const s=Math.sin(a),c=Math.cos(a); return { x:v.x, y:v.y*c - v.z*s, z:v.y*s + v.z*c }; }
  function rotateY(v,a){ const s=Math.sin(a),c=Math.cos(a); return { x:v.x*c + v.z*s, y:v.y, z:-v.x*s + v.z*c }; }
  function mulberry32(a){ return function(){ let t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
}