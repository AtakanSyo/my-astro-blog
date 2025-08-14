// /public/interactive/learning-webgl/runtime.js
// Three.js Sun — self-lit star disk with animated granulation, limb darkening,
// soft animated corona, gentle bloom, and robust pause/resize handling.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161/build/three.module.js';
import { EffectComposer }  from 'https://esm.sh/three@0.161/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }      from 'https://esm.sh/three@0.161/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://esm.sh/three@0.161/examples/jsm/postprocessing/UnrealBloomPass.js';

export async function run(canvas, { pausedRef, options = {} } = {}) {
  // ---------------- Config ----------------
  const AXIAL_TILT_DEG    = options.axialTiltDeg ?? 7.25;         // Sun's obliquity ~7.25°
  const ROT_PERIOD_H      = options.rotationHours ?? 587.0;       // ~24.47 days at equator
  const TIME_SCALE        = options.timeScale ?? 4000;
  const STAR_DIM          = options.starDim ?? 0.1;
  const R_PLANET          = options.planetRadius ?? 1.0;
  const R_ATMOS           = R_PLANET * (options.atmosScale ?? 0.965);
  const STAR_RADIUS       = options.starRadius ?? 200;

  const TEXTURE_SAT_INIT  = options.textureSaturation ?? 1.0;
  const TEXTURE_CON_INIT  = options.textureContrast   ?? 1.00;

  const TEX_ALBEDO        = options.albedoTexture ?? '/interactive/sun/sun_texture.jpg';
  const TEX_STARS         = options.starsTexture  ?? '/interactive/sun/stars_texture.jpg';

  // Reduced motion?
  const PREFERS_REDUCED_MOTION = typeof matchMedia === 'function'
    ? matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  // ---------------- Scene / Camera / Renderer ----------------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
  camera.position.set(0, 0, 3);

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true, powerPreference: 'high-performance'
  });
  const getDPR = () => Math.min(2, (window.devicePixelRatio || 1));
  renderer.setPixelRatio(getDPR());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.physicallyCorrectLights = true;

  // Post-processing (Bloom)
  let composer, bloomPass, renderPass;
  function setupComposer() {
    renderPass = new RenderPass(scene, camera);
    bloomPass  = new UnrealBloomPass(
      new THREE.Vector2(canvas.clientWidth || 1, canvas.clientHeight || 1),
      options.bloomStrength ?? 0.9,   // strength
      options.bloomRadius   ?? 0.4,   // radius
      options.bloomThreshold?? 0.7    // threshold
    );
    composer   = new EffectComposer(renderer);
    composer.addPass(renderPass);
    composer.addPass(bloomPass);
  }
  setupComposer();

  // ---------------- Textures (lazy, awaited) ----------------
  const texLoader = new THREE.TextureLoader();
  const loadTex = (url, setup) => new Promise((res, rej) => {
    texLoader.load(url, t => { setup?.(t); res(t); }, undefined, rej);
  });

  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const [albedoMap, starMap] = await Promise.all([
    loadTex(TEX_ALBEDO, t => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = maxAniso;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
    }),
    loadTex(TEX_STARS, t => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = maxAniso;
      t.repeat.set(2, 1);
    })
  ]);

  // ---------------- Sun material (self-lit, animated) ----------------
  const sunUniforms = {
    map:        { value: albedoMap },
    uTime:      { value: 0 },
    uSat:       { value: TEXTURE_SAT_INIT },
    uCon:       { value: TEXTURE_CON_INIT },
    uTint:      { value: new THREE.Color(0xfff0b4) },
    uGranAmp:   { value: 0.15 },
    uFlow:      { value: 0.02 },
    uSpotAmp:   { value: 0.08 },
    uLimbA:     { value: 0.55 },
    uLimbB:     { value: 0.45 },
    uLimbC:     { value: 0.15 }
  };

  const sunMat = new THREE.ShaderMaterial({
    uniforms: sunUniforms,
    vertexShader: `
      varying vec3 vN;
      varying vec3 vWP;
      varying vec2 vUv_;
      void main() {
        vN  = normalize(normalMatrix * normal);
        vWP = (modelMatrix * vec4(position,1.0)).xyz;
        vUv_ = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform sampler2D map;
      uniform float uTime, uSat, uCon;
      uniform vec3  uTint;
      uniform float uGranAmp, uFlow, uSpotAmp;
      uniform float uLimbA, uLimbB, uLimbC;
      varying vec3 vN;
      varying vec3 vWP;
      varying vec2 vUv_;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        float a = hash(i), b = hash(i+vec2(1.,0.));
        float c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
        vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
      float fbm(vec2 p){
        float s=0., a=0.5;
        for(int i=0;i<5;i++){ s += a*noise(p); p*=2.02; a*=0.5; }
        return s;
      }
      vec3 grade(vec3 c, float sat, float con){
        float luma = dot(c, vec3(0.2126,0.7152,0.0722));
        c = mix(vec3(luma), c, clamp(sat, 0.0, 2.0));
        c = (c - 0.5) * clamp(con, 0.0, 2.0) + 0.5;
        return c;
      }

      void main() {
        vec3 V = normalize(cameraPosition - vWP);
        float mu = clamp(dot(normalize(vN), V), 0.0, 1.0);
        float limb = uLimbA + uLimbB*mu + uLimbC*mu*mu;

        float lat = asin(clamp(vN.y, -1.0, 1.0));
        float eq  = cos(lat);
        vec2 flow = vec2(uFlow * eq*eq * uTime, 0.0);

        vec3 base = texture2D(map, vUv_ + flow).rgb;

        float gran = fbm(vUv_ * 50.0 + flow * 10.0 + vec2(0.0, uTime*0.03));
        base *= 1.0 + uGranAmp*(gran - 0.5);

        float spots = fbm(vUv_ * 6.0 + flow * 2.0);
        base *= 1.0 - uSpotAmp * pow(max(0.0, 0.6 - spots), 2.0);

        base *= clamp(limb, 0.0, 1.1);
        base = grade(base, uSat, uCon) * uTint;

        gl_FragColor = vec4(base, 1.0);
      }
    `,
    transparent: false
  });

  const planet = new THREE.Mesh(new THREE.SphereGeometry(R_PLANET, 96, 96), sunMat);
  planet.rotation.z = THREE.MathUtils.degToRad(AXIAL_TILT_DEG);
  scene.add(planet);

  // ---------------- Animated corona (soft rim glow) ----------------
  const coronaMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    uniforms: {
      uTime:   { value: 0 },                   // animation time (changes noise pattern over time)
      uColor:  { value: new THREE.Color(0xfff5cf) }, // base color of the corona glow
      uGain:   { value: options.coronaGain ?? 1.0 }, // overall brightness multiplier for the glow
      uNoiseA: { value: options.coronaNoise ?? 0.6 }, // strength of noise/filament texture in the glow
      uRadius: { value: options.coronaRadius ?? 2.2 } // spread/size of the rim glow:
                                                      // higher = thicker & softer halo,
                                                      // lower = thinner & tighter to the sun’s edge
    },
    vertexShader: `
      varying vec3 vN;
      varying vec3 vWP;
      void main(){
        vN  = normalize(normalMatrix * normal);
        vWP = (modelMatrix * vec4(position,1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(vWP,1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vN;
      varying vec3 vWP;
      uniform float uTime, uGain, uNoiseA, uRadius;
      uniform vec3  uColor;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p);
        float a = hash(i), b = hash(i+vec2(1.,0.));
        float c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
        vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
      float fbm(vec2 p){
        float s=0., a=0.5;
        for(int i=0;i<4;i++){ s += a*noise(p); p*=2.1; a*=0.5; }
        return s;
      }

void main(){
    vec3 V = normalize(cameraPosition - vWP);
    float rim = pow(1.0 - max(dot(normalize(vN), V), 0.0), uRadius);

    // Base filament turbulence
    float fil = fbm(vec2(atan(vN.z, vN.x), vN.y) * 8.0 + vec2(uTime*0.15, 0.0));

    // --- New: simulate prominences ---
    // Convert normal to spherical coords
    float lat = asin(vN.y);                  // -PI/2 to PI/2
    float lon = atan(vN.z, vN.x);             // -PI to PI

    // Base eruption pattern (slow rotation)
    float eruption = smoothstep(0.85, 1.0, abs(vN.y)) * // near poles weaker
                     smoothstep(0.8, 1.0, rim) *        // only at edge
                     (0.5 + 0.5*sin(uTime*0.5 + lon*6.0 + fbm(vec2(lon,lat)*3.0)*3.14));

    // Random hot spots (sporadic eruptions)
    float hotspot = smoothstep(0.75, 1.0, rim) *
                    step(0.97, noise(vec2(lon*5.0 + uTime*0.1, lat*5.0))) *
                    (1.0 + 0.5*sin(uTime*4.0));

    float eruptionGlow = max(eruption, hotspot);

    // Combine rim, turbulence, and eruptions
    float a = rim * (0.6 + uNoiseA*(fil - 0.5)) * uGain;
    a += eruptionGlow * 1.5; // boost eruption brightness

    a = smoothstep(0.0, 0.6, a);
    gl_FragColor = vec4(uColor, a);
}
    `
  });
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(R_ATMOS * 1.05, 96, 96), coronaMat);
  atmosphere.rotation.copy(planet.rotation);
  scene.add(atmosphere);

  // ---------------- Starfield (very dim) ----------------
  const stars = new THREE.Mesh(
    new THREE.SphereGeometry(STAR_RADIUS, 64, 64),
    new THREE.MeshBasicMaterial({ map: starMap, side: THREE.BackSide })
  );
  stars.material.color.setScalar(STAR_DIM);
  scene.add(stars);

  // ---------------- Resize ----------------
  function resize() {
    const w = Math.max(1, canvas.clientWidth | 0);
    const h = Math.max(1, canvas.clientHeight | 0);
    renderer.setPixelRatio(getDPR());
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    composer.setSize(w, h);
    bloomPass.setSize(w, h);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  requestAnimationFrame(resize);
  const onOrientation = () => resize();
  window.addEventListener('orientationchange', onOrientation);
  let lastDPR = getDPR();
  const dprInterval = setInterval(() => {
    const now = getDPR();
    if (now !== lastDPR) { lastDPR = now; resize(); }
  }, 500);

  // ---------------- Animation with HARD PAUSE + visibility/reduced-motion ----------------
  const clock = new THREE.Clock();
  const degPerSec = 360.0 / (ROT_PERIOD_H * 3600.0);

  let rafId = 0;
  let pollId = 0;
  let wasPaused = false;

  const isActuallyPaused = () => {
    if (pausedRef && pausedRef()) return true;
    if (PREFERS_REDUCED_MOTION) return true;
    if (document.visibilityState === 'hidden') return true;
    return false;
  };

  function startPollingForResume() {
    if (pollId) return;
    pollId = setInterval(() => {
      if (!isActuallyPaused()) {
        clearInterval(pollId);
        pollId = 0;
        clock.getDelta();
        rafId = requestAnimationFrame(loop);
      }
    }, 120);
  }

  function loop() {
    if (isActuallyPaused()) {
      wasPaused = true;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      startPollingForResume();
      return;
    }

    if (wasPaused) {
      wasPaused = false;
      clock.getDelta();
    }

    const dt = clock.getDelta();
    const spinDeg = degPerSec * TIME_SCALE * dt;

    // Advance time uniforms
    sunUniforms.uTime.value += dt;
    coronaMat.uniforms.uTime.value += dt;

    // Gentle rotation
    planet.rotation.y += THREE.MathUtils.degToRad(spinDeg);
    atmosphere.rotation.y = planet.rotation.y;

    // Slow parallax for stars
    stars.rotation.y -= 0.003 * dt;

    // Render with bloom
    composer.render();
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);

  const onVisibility = () => {
    if (document.visibilityState === 'hidden' && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
      startPollingForResume();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  const onContextLost = (e) => {
    e.preventDefault();
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  };
  const onContextRestored = () => {
    renderer.setPixelRatio(getDPR());
    resize();
    clock.getDelta();
    rafId = requestAnimationFrame(loop);
  };
  canvas.addEventListener('webglcontextlost', onContextLost, false);
  canvas.addEventListener('webglcontextrestored', onContextRestored, false);

  // ---------------- Cleanup ----------------
  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    if (pollId) clearInterval(pollId);
    clearInterval(dprInterval);
    ro.disconnect();
    window.removeEventListener('orientationchange', onOrientation);
    document.removeEventListener('visibilitychange', onVisibility);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);

    composer?.dispose?.();
    renderer.dispose();
    planet.geometry.dispose();
    atmosphere.geometry.dispose();
    stars.geometry.dispose();
    sunMat.dispose();
    coronaMat.dispose();
    albedoMap?.dispose?.();
    starMap?.dispose?.();
  };
}