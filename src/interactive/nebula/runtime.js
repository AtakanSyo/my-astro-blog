// src/interactive/nebula/runtime.js
// Nebula as a glowing point cloud with GPU N-body dynamics (softened gravity)
// Only control: hard pause/resume via pausedRef()

import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';

export async function run(canvas, { pausedRef, options = {} } = {}) {
  const CFG = {
    TEX_W: options.texW ?? 96,    // particles = TEX_W * TEX_H (bump if GPU is comfy)
    TEX_H: options.texH ?? 48,

    // Physics
    G: options.G ?? 0.00045,
    SOFTEN: options.soften ?? 0.012,
    DAMP: options.damp ?? 0.02,
    PRESSURE: options.pressure ?? 0.05, // 0..0.2 short-range repulsion (prevents over-collapse)
    R_CORE: options.rCore ?? 0.03,

    // Time integration
    DT: options.dt ?? 0.016,         // seconds per step
    SUBSTEPS: options.substeps ?? 1, // physics sub-steps per frame

    // Initial condition: rotating disk with noise
    INIT_RADIUS: options.initRadius ?? 1.0,
    INIT_THICK: options.initThick ?? 0.28,
    INIT_SPIN: options.initSpin ?? 0.55,

    // Camera
    FOV: options.fov ?? 55,
    CAMERA_DIST: options.cameraDist ?? 4.5,
    CAMERA_ELEV: options.cameraElev ?? 1.2,
    ORBIT_SPEED: options.orbitSpeed ?? 0.015, // 0 for static camera

    // Rendering
    POINT_SIZE: options.pointSize ?? 5.0,
    EXPOSURE: options.exposure ?? 1.25,
    BG: options.bg ?? 0x00000a,
  };

  const PARTICLES = CFG.TEX_W * CFG.TEX_H;

  // Renderer / scene / camera
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
    depth: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = CFG.EXPOSURE;
  renderer.setClearColor(CFG.BG, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CFG.FOV, 1, 0.1, 100);
  camera.position.set(CFG.CAMERA_DIST, CFG.CAMERA_ELEV, 0);
  camera.lookAt(0, 0, 0);

  // GPU compute setup
  const gpuCompute = new GPUComputationRenderer(CFG.TEX_W, CFG.TEX_H, renderer);

  const pos0 = gpuCompute.createTexture();
  const vel0 = gpuCompute.createTexture();

  // Seed positions: disk + thickness + jitter; masses in .w
  (function fillInitialPosition(tex) {
    const a = tex.image.data;
    let i = 0;
    for (let y = 0; y < CFG.TEX_H; y++) {
      for (let x = 0; x < CFG.TEX_W; x++) {
        const r = Math.sqrt(Math.random()) * CFG.INIT_RADIUS;
        const th = Math.random() * Math.PI * 2.0;
        const h = (Math.random() * 2 - 1) * CFG.INIT_THICK;
        const px = r * Math.cos(th) * (0.8 + 0.2 * Math.random());
        const py = h * (0.8 + 0.2 * Math.random());
        const pz = r * Math.sin(th) * (0.8 + 0.2 * Math.random());
        a[i + 0] = px;
        a[i + 1] = py;
        a[i + 2] = pz;
        a[i + 3] = 0.8 + 0.4 * Math.random(); // mass
        i += 4;
      }
    }
  })(pos0);

  // Seed velocities = 0 (spin added in compute)
  (function fillInitialVelocity(tex) {
    const a = tex.image.data;
    for (let i = 0; i < a.length; i++) a[i] = 0;
  })(vel0);

  // ----- Compute shaders (Leapfrog-ish: kick → drift) -----
  const defines = `
    #define TEX_W ${CFG.TEX_W}
    #define TEX_H ${CFG.TEX_H}
    #define PARTICLES (${PARTICLES})
  `;

  const velocityShader = /* glsl */`
    ${defines}
    precision highp float;
    uniform sampler2D positions;
    uniform sampler2D velocities;
    uniform float dt;
    uniform float G, soften, damp, pressure, rCore, initSpin;

    vec4 texelPos(ivec2 ij) {
      vec2 uv = (vec2(ij) + 0.5) / vec2(TEX_W, TEX_H);
      return texture2D(positions, uv);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / vec2(TEX_W, TEX_H);
      vec4 self = texture2D(positions, uv); // xyz + mass
      vec3 pos = self.xyz;
      float mi = max(self.w, 1e-4);
      vec3 vel = texture2D(velocities, uv).xyz;

      // Seed spin (gentle, early-time)
      float r = length(pos.xz);
      if (r > 1e-4) {
        vec3 tang = vec3(-pos.z, 0.0, pos.x) / r;
        float vCirc = sqrt(G * 1.0 / (r + 0.2));
        float blend = 1.0 - exp(-dt * 2.0);
        vel += tang * (initSpin * vCirc) * blend * 0.2;
      }

      // Accumulate forces (O(N^2))
      vec3 acc = vec3(0.0);
      for (int jY = 0; jY < TEX_H; jY++) {
        for (int jX = 0; jX < TEX_W; jX++) {
          ivec2 j = ivec2(jX, jY);
          vec4 other = texelPos(j);
          vec3 d = other.xyz - pos;
          float m = other.w;

          if (abs(d.x)+abs(d.y)+abs(d.z) < 1e-9) continue;

          float r2 = dot(d, d) + soften*soften;
          float invR = inversesqrt(r2);
          float invR3 = invR * invR * invR;

          // Gravity
          acc += G * m * d * invR3;

          // Short-range repulsion (prevents singular clumps)
          if (pressure > 0.0) {
            float rLen = 1.0 / invR;
            float s = max(0.0, 1.0 - rLen / rCore);
            if (s > 0.0) {
              acc += -pressure * s * s * d * invR3 * soften;
            }
          }
        }
      }

      // Kick (half step) + damping → leapfrog-friendly
      vel += acc * dt;
      vel *= (1.0 - damp * dt);

      gl_FragColor = vec4(vel, 1.0);
    }
  `;

  const positionShader = /* glsl */`
    ${defines}
    precision highp float;
    uniform sampler2D positions;
    uniform sampler2D velocities;
    uniform float dt;

    void main() {
      vec2 uv = gl_FragCoord.xy / vec2(TEX_W, TEX_H);
      vec4 p = texture2D(positions, uv);
      vec3 v = texture2D(velocities, uv).xyz;

      // Drift
      p.xyz += v * dt;

      // Soft boundary
      float Rlim = 4.0;
      float r = length(p.xyz);
      if (r > Rlim) p.xyz *= (Rlim / r);

      gl_FragColor = p;
    }
  `;

  const posVar = gpuCompute.addVariable('positions', positionShader, pos0);
  const velVar = gpuCompute.addVariable('velocities', velocityShader, vel0);
  gpuCompute.setVariableDependencies(posVar, [posVar, velVar]);
  gpuCompute.setVariableDependencies(velVar, [posVar, velVar]);

  velVar.material.uniforms = {
    positions: { value: null },
    velocities:{ value: null },
    dt:       { value: CFG.DT / CFG.SUBSTEPS },
    G:        { value: CFG.G },
    soften:   { value: CFG.SOFTEN },
    damp:     { value: CFG.DAMP },
    pressure: { value: CFG.PRESSURE },
    rCore:    { value: CFG.R_CORE },
    initSpin: { value: CFG.INIT_SPIN },
  };
  posVar.material.uniforms = {
    positions: { value: null },
    velocities:{ value: null },
    dt:       { value: CFG.DT / CFG.SUBSTEPS },
  };

  const e = gpuCompute.init();
  if (e) throw new Error('GPUComputationRenderer init failed: ' + e);

  // Render geometry
  const geom = new THREE.BufferGeometry();
  const ref = new Float32Array(PARTICLES * 2);
  let k = 0;
  for (let y = 0; y < CFG.TEX_H; y++) {
    for (let x = 0; x < CFG.TEX_W; x++) {
      ref[k++] = (x + 0.5) / CFG.TEX_W;
      ref[k++] = (y + 0.5) / CFG.TEX_H;
    }
  }
  geom.setAttribute('ref', new THREE.BufferAttribute(ref, 2));
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PARTICLES * 3), 3));

  const pointsMat = new THREE.ShaderMaterial({
    uniforms: {
      posTex: { value: null },
      size:   { value: CFG.POINT_SIZE * (renderer.getPixelRatio() || 1) },
    },
    vertexShader: /* glsl */`
      precision highp float;
      attribute vec2 ref;
      uniform sampler2D posTex;
      uniform float size;
      varying float vRad;
      void main() {
        vec3 P = texture2D(posTex, ref).xyz;
        vRad = length(P);
        vec4 mv = modelViewMatrix * vec4(P, 1.0);
        float dist = -mv.z;
        gl_PointSize = size * clamp(300.0 / (dist + 1.0), 1.0, 7.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying float vRad;
      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(uv, uv);
        if (r2 > 1.0) discard;

        float fall = exp(-3.0 * r2);
        vec3 cInner = vec3(0.20, 0.90, 1.00);
        vec3 cOuter = vec3(1.15, 0.30, 0.70);
        float t = clamp(vRad / 2.4, 0.0, 1.0);
        vec3 col = mix(cInner, cOuter, t);
        float core = smoothstep(0.0, 0.3, 1.0 - sqrt(r2));
        col *= (0.6 + 0.4 * core);

        gl_FragColor = vec4(col * fall, fall);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geom, pointsMat);
  scene.add(points);

  // Resize
  function resize() {
    const w = Math.max(1, canvas.clientWidth | 0);
    const h = Math.max(1, canvas.clientHeight | 0);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    pointsMat.uniforms.size.value = CFG.POINT_SIZE * (renderer.getPixelRatio() || 1);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  requestAnimationFrame(resize);
  window.addEventListener('orientationchange', resize);

  // Loop with HARD PAUSE
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

  function stepPhysics(dt) {
    const subDt = dt / CFG.SUBSTEPS;
    velVar.material.uniforms.dt.value = subDt;
    posVar.material.uniforms.dt.value = subDt;
    for (let s = 0; s < CFG.SUBSTEPS; s++) gpuCompute.compute();
  }

  function updateCamera(time) {
    if (CFG.ORBIT_SPEED <= 0) return;
    const ang = time * CFG.ORBIT_SPEED * Math.PI * 2.0;
    camera.position.set(Math.cos(ang) * CFG.CAMERA_DIST, CFG.CAMERA_ELEV, Math.sin(ang) * CFG.CAMERA_DIST);
    camera.lookAt(0, 0, 0);
  }

  function loop() {
    if (pausedRef && pausedRef()) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      startPollingForResume();
      return;
    }
    const dt = clock.getDelta();
    stepPhysics(CFG.DT > 0 ? CFG.DT : dt);

    // Bind latest compute textures
    pointsMat.uniforms.posTex.value = gpuCompute.getCurrentRenderTarget(posVar).texture;

    updateCamera(clock.elapsedTime);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(loop);
  }

  rafId = requestAnimationFrame(loop);

  // Cleanup
  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    if (pollId) clearInterval(pollId);
    ro.disconnect();
    window.removeEventListener('orientationchange', resize);
    points.geometry?.dispose?.();
    points.material?.dispose?.();
    gpuCompute?.dispose?.();
    renderer.dispose();
  };
}