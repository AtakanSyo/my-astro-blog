// /public/interactive/learning-webgl/runtime.js
// Thin-lens gravitational lens (Einstein ring) with a lensed background star texture.
// Only control: hard pause/resume via pausedRef().

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161/build/three.module.js';

export async function run(canvas, { pausedRef, options = {} } = {}) {
  const CFG = {
    // Lens look
    thetaE: options.thetaE ?? 0.24,   // Einstein radius (in NDC-ish units)
    gamma:  options.gamma  ?? 0.05,   // weak external shear strength
    phi:    options.phi    ?? 0.25,   // shear angle (radians)
    lensGlow: options.lensGlow ?? 0.10,
    exposure: options.exposure ?? 5.25,

    // Background stars texture (will be lensed)
    bgUrl: options.bgUrl ?? '/interactive/gravity-lens/stars_texture.jpg',
    bgScale: options.bgScale ?? 1.0, // how “zoomed” the background appears
    bgGain: options.bgGain ?? 1.0,    // brightness multiplier for the background

    // Source galaxy (adds a clear arc/ring on top of the star field)
    srcR: options.srcR ?? 0.085,
    srcQ: options.srcQ ?? 0.70,
    srcAngle: options.srcAngle ?? 0.4,

    // Gentle auto-orbit (set orbitSpeed: 0 for static)
    orbitRadius: options.orbitRadius ?? 0.16,
    orbitSpeed:  options.orbitSpeed  ?? 0.06,
  };

  // --- Renderer / scene / camera ---
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const quadGeo = new THREE.PlaneGeometry(2, 2);

  // --- Load background stars texture ---
  const loader = new THREE.TextureLoader();
  const bgTex = loader.load(CFG.bgUrl);
  bgTex.wrapS = bgTex.wrapT = THREE.RepeatWrapping;
  bgTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 1);
  bgTex.colorSpace = THREE.SRGBColorSpace;
  bgTex.minFilter = THREE.LinearMipmapLinearFilter;
  bgTex.magFilter = THREE.LinearFilter;
  bgTex.generateMipmaps = true;

  // --- Shader uniforms/material ---
  const uniforms = {
    uTime: { value: 0.0 },
    uResolution: { value: new THREE.Vector2(1, 1) },

    // Lens params
    uThetaE: { value: CFG.thetaE },
    uGamma:  { value: CFG.gamma },
    uPhi:    { value: CFG.phi },
    uLensGlow: { value: CFG.lensGlow },
    uExposure: { value: CFG.exposure },

    // Source galaxy
    uSrcR: { value: CFG.srcR },
    uSrcQ: { value: CFG.srcQ },
    uSrcAngle: { value: CFG.srcAngle },

    // Orbit
    uOrbitRadius: { value: CFG.orbitRadius },
    uOrbitSpeed:  { value: CFG.orbitSpeed },

    // Background texture
    uBgTex: { value: bgTex },
    uBgScale: { value: CFG.bgScale },
    uBgGain:  { value: CFG.bgGain },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 vUv;

      uniform vec2  uResolution;
      uniform float uTime;

      // Lens
      uniform float uThetaE;
      uniform float uGamma;
      uniform float uPhi;
      uniform float uLensGlow;
      uniform float uExposure;

      // Source galaxy
      uniform float uSrcR;
      uniform float uSrcQ;
      uniform float uSrcAngle;

      // Orbit of source center
      uniform float uOrbitRadius;
      uniform float uOrbitSpeed;

      // Background stars
      uniform sampler2D uBgTex;
      uniform float uBgScale;
      uniform float uBgGain;

      mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

      // ACES-ish tonemap
      vec3 aces(vec3 x){
        const float a=2.51, b=0.03, c=2.43, d=0.59, e=0.14;
        return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
      }

      void main() {
        // Image-plane coords with aspect correction so circles look round
        vec2 uv = vUv * 2.0 - 1.0; // [-1,1]
        float aspect = uResolution.x / uResolution.y;
        vec2 theta = vec2(uv.x * aspect, uv.y);

        // Source center does a slow orbit (set uOrbitSpeed=0 for static)
        float t = uTime * uOrbitSpeed * 6.28318530718;
        vec2 beta0 = uOrbitRadius * vec2(cos(t), 0.7 * sin(t));

        // --- Thin-lens deflection: point mass + external shear ---
        float r2 = dot(theta, theta) + 1e-8;
        vec2 alpha_point = (uThetaE*uThetaE) * theta / r2;

        float c2=cos(2.0*uPhi), s2=sin(2.0*uPhi);
        mat2 G = mat2(c2, s2, s2, -c2);
        vec2 alpha_shear = uGamma * (G * theta);

        vec2 alpha = alpha_point + alpha_shear;
        vec2 beta  = theta - alpha; // source-plane coordinate

        // --- Lensed background: sample star texture in source plane ---
        // Map source-plane coords to repeating UVs. uBgScale controls how zoomed the background is.
        // Keep stars roughly isotropic regardless of aspect by scaling x.
        vec2 betaN = vec2(beta.x / max(1e-6, aspect), beta.y);
        vec2 bgUv = 0.5 + uBgScale * betaN; // center on 0.5, allow wrap
        vec3 bg = texture2D(uBgTex, bgUv).rgb * uBgGain;

        // --- Add a simple elliptical Gaussian galaxy in source plane (for clear arcs/ring) ---
        vec2 x = beta - beta0;
        x = rot(uSrcAngle) * x;
        x.y /= max(0.05, uSrcQ);
        float Igal = exp(-0.5 * dot(x,x) / (uSrcR*uSrcR));
        vec3 galCol = vec3(1.15, 1.0, 0.92) * Igal;

        // Foreground lens galaxy glow in image plane (unlensed)
        float r = length(theta);
        vec3 lensGlow = vec3(1.0, 0.96, 1.06) * (uLensGlow * exp(-3.0 * r));

        // Compose
        vec3 col = bg + galCol + lensGlow;

        // Vignette + exposure
        float vign = smoothstep(1.35, 0.2, length(uv));
        col *= uExposure * vign;

        // Tonemap to sRGB
        col = aces(col);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
    transparent: false,
  });

  const quad = new THREE.Mesh(quadGeo, material);
  scene.add(quad);

  // --- Resize ---
  function resize() {
    const w = Math.max(1, canvas.clientWidth | 0);
    const h = Math.max(1, canvas.clientHeight | 0);
    renderer.setSize(w, h, false);
    uniforms.uResolution.value.set(w, h);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  requestAnimationFrame(resize);
  window.addEventListener('orientationchange', resize);

  // --- Animation with HARD PAUSE ---
  const clock = new THREE.Clock();
  let rafId = 0;
  let pollId = 0;

  function startPollingForResume() {
    if (pollId) return;
    pollId = setInterval(() => {
      if (!pausedRef || !pausedRef()) {
        clearInterval(pollId);
        pollId = 0;
        clock.getDelta();
        rafId = requestAnimationFrame(loop);
      }
    }, 100);
  }

  function loop() {
    if (pausedRef && pausedRef()) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      startPollingForResume();
      return;
    }
    const dt = clock.getDelta();
    uniforms.uTime.value += dt;
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);

  // --- Cleanup ---
  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    if (pollId) clearInterval(pollId);
    ro.disconnect();
    window.removeEventListener('orientationchange', resize);
    quad.geometry?.dispose?.();
    material.dispose();
    bgTex?.dispose?.();
    renderer.dispose();
  };
}