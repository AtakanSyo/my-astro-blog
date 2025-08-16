// /public/interactive/learning-webgl/runtime.js
// Nebula as a glowing point cloud with GPU N-body dynamics (softened gravity)
// Only control: hard pause/resume via pausedRef()

import * as THREE from 'three';
import { GPUComputationRenderer } from 'https://cdn.jsdelivr.net/npm/three@0.161/examples/jsm/misc/GPUComputationRenderer.js';
export async function run(canvas, { pausedRef, options = {} } = {}) {
  // ---------------- Config ----------------
  const CFG = {
    TEX_W: options.texW ?? 64,     // particles = TEX_W * TEX_H
    TEX_H: options.texH ?? 32,

    G: options.G ?? 0.0005,        // gravitational constant (scaled)
    SOFTEN: options.soften ?? 0.012, // softening length (prevents singularities)
    DAMP: options.damp ?? 0.02,    // velocity damping (gas-like drag)
    PRESSURE: options.pressure ?? 0.0, // short-range repulsion strength (0..0.2)
    R_CORE: options.rCore ?? 0.02, // repulsion core radius

    DT: options.dt ?? 0.016,       // seconds per step (synced to clock)
    SUBSTEPS: options.substeps ?? 1, // physics sub-steps per frame

    // Initial condition: rotating disk with noise -> filaments/wisps
    INIT_RADIUS: options.initRadius ?? 1.0,
    INIT_THICK: options.initThick ?? 0.25,
    INIT_SPIN: options.initSpin ?? 0.6, // fraction of circular velocity

    // Camera & look
    FOV: options.fov ?? 55,
    CAMERA_DIST: options.cameraDist ?? 4.5,
    CAMERA_ELEV: options.cameraElev ?? 1.2,
    ORBIT_SPEED: options.orbitSpeed ?? 0.02, // 0 for static camera

    // Rendering
    POINT_SIZE: options.pointSize ?? 5.0, // logical size; scaled by DPR
    EXPOSURE: options.exposure ?? 1.2,
    BG: options.bg ?? 0x00000a,
  };

  const PARTICLES = CFG.TEX_W * CFG.TEX_H;

  // ---------------- Renderer / Scene / Camera ----------------
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
    depth: true,
    stencil: false,
    preserveDrawingBuffer: false,
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

  // ---------------- GPU Compute Setup ----------------
  const gpuCompute = new GPUComputationRenderer(CFG.TEX_W, CFG.TEX_H, renderer);

  // Create initial position/velocity textures
  function fillInitialPosition(tex) {
    const arr = tex.image.data;
    let i = 0;
    for (let y = 0; y < CFG.TEX_H; y++) {
      for (let x = 0; x < CFG.TEX_W; x++) {
        // Disk + thickness + noise
        const r = Math.sqrt(Math.random()) * CFG.INIT_RADIUS;
        const theta = Math.random() * Math.PI * 2.0;
        const h = (Math.random() * 2 - 1) * CFG.INIT_THICK;
        const px = r * Math.cos(theta) * (0.8 + 0.2*Math.random());
        const py = h * (0.8 + 0.2*Math.random());
        const pz = r * Math.sin(theta) * (0.8 + 0.2*Math.random());

        // Store xyz + mass (w)
        arr[i + 0] = px;
        arr[i + 1] = py;
        arr[i + 2] = pz;
        // Modest mass variation -> clumps/filaments
        arr[i + 3] = 0.8 + 0.4 * Math.random();
        i += 4;
      }
    }
  }
  function fillInitialVelocity(tex) {
    const arr = tex.image.data;
    let i = 0;
    for (let y = 0; y < CFG.TEX_H; y++) {
      for (let x = 0; x < CFG.TEX_W; x++) {
        // We'll initialize angular velocity around Y axis (galactic disk feel)
        arr[i + 0] = 0;
        arr[i + 1] = 0;
        arr[i + 2] = 0;
        arr[i + 3] = 0; // padding
        i += 4;
      }
    }
  }

  const pos0 = gpuCompute.createTexture();
  const vel0 = gpuCompute.createTexture();
  fillInitialPosition(pos0);
  fillInitialVelocity(vel0);

  // Compute shaders: velocity (force accumulation) and position (integration)
  const defines = `
    #define TEX_W ${CFG.TEX_W}
    #define TEX_H ${CFG.TEX_H}
    #define PARTICLES (${CFG.TEX_W * CFG.TEX_H})
  `;

  const commonUniforms = `
    uniform sampler2D positions;
    uniform sampler2D velocities;
    uniform float dt;
    uniform float G;
    uniform float soften;
    uniform float damp;
    uniform float pressure;
    uniform float rCore;
    uniform float initSpin;
  `;

  // --- Velocity shader: sums forces over all particles (softened gravity + pressure) ---
  const velocityShader = /* glsl */`
    ${defines}
    precision highp float;
    varying vec2 vUv;
    ${commonUniforms}

    // Fetch helpers
    vec4 texelPos(ivec2 ij) {
      vec2 uv = (vec2(ij) + 0.5) / vec2(TEX_W, TEX_H);
      return texture2D(positions, uv);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / vec2(TEX_W, TEX_H);
      vec4 self = texture2D(positions, uv); // xyz + mass
      vec3 pos = self.xyz;
      float mi = max(self.w, 0.0001);

      // Read current velocity
      vec3 vel = texture2D(velocities, uv).xyz;

      // Initial spin: add azimuthal velocity proportional to circular speed
      // (applied gently at early times)
      float r = length(pos.xz);
      if (r > 1e-4) {
        vec3 tang = vec3(-pos.z, 0.0, pos.x) / r;
        float vCirc = sqrt(G * 1.0 / (r + 0.2));
        float blend = clamp(1.0 - exp(-dt * 2.0), 0.0, 1.0);
        vel += tang * (initSpin * vCirc) * blend * 0.2;
      }

      // Accumulate gravitational acceleration from all particles
      vec3 acc = vec3(0.0);
      for (int jY = 0; jY < TEX_H; jY++) {
        for (int jX = 0; jX < TEX_W; jX++) {
          ivec2 j = ivec2(jX, jY);
          vec4 other = texelPos(j);
          vec3 d = other.xyz - pos;
          float m = other.w;

          // Skip self (branch is very cheap for big loops)
          if (abs(d.x) < 1e-9 && abs(d.y) < 1e-9 && abs(d.z) < 1e-9) continue;

          float r2 = dot(d, d) + soften*soften;
          float invR = inversesqrt(r2);
          float invR3 = invR * invR * invR;

          // Gravity
          vec3 aG = G * m * d * invR3;
          acc += aG;

          // Optional short-range pressure / repulsion
          // Push apart if closer than rCore (helps prevent over-collapse)
          if (pressure > 0.0) {
            float rLen = 1.0 / invR; // true r
            float s = max(0.0, 1.0 - rLen / rCore);
            if (s > 0.0) {
              // Quadratic falloff inside core
              vec3 aP = -pressure * s * s * d * invR3 * soften;
              acc += aP;
            }
          }
        }
      }

      // Damping (gas drag)
      vel += acc * dt;
      vel *= (1.0 - damp * dt);

      gl_FragColor = vec4(vel, 1.0);
    }
  `;

  // --- Position shader: explicit Euler (can be upgraded to leapfrog) ---
  const positionShader = /* glsl */`
    ${defines}
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D positions;
    uniform sampler2D velocities;
    uniform float dt;

    void main() {
      vec2 uv = gl_FragCoord.xy / vec2(TEX_W, TEX_H);
      vec4 p = texture2D(positions, uv);
      vec3 v = texture2D(velocities, uv).xyz;

      // Integrate
      p.xyz += v * dt;

      // Soft boundary: if too far, gently pull back (keeps cloud framed)
      float Rlim = 4.0;
      float r = length(p.xyz);
      if (r > Rlim) {
        p.xyz *= (Rlim / r);
      }

      gl_FragColor = p;
    }
  `;

  const posVar = gpuCompute.addVariable('positions', positionShader, pos0);
  const velVar = gpuCompute.addVariable('velocities', velocityShader, vel0);

  gpuCompute.setVariableDependencies(posVar, [posVar, velVar]);
  gpuCompute.setVariableDependencies(velVar, [posVar, velVar]);

  // Uniforms for compute shaders
  velVar.material.uniforms.dt       = { value: CFG.DT / CFG.SUBSTEPS };
  velVar.material.uniforms.G        = { value: CFG.G };
  velVar.material.uniforms.soften   = { value: CFG.SOFTEN };
  velVar.material.uniforms.damp     = { value: CFG.DAMP };
  velVar.material.uniforms.pressure = { value: CFG.PRESSURE };
  velVar.material.uniforms.rCore    = { value: CFG.R_CORE };
  velVar.material.uniforms.initSpin = { value: CFG.INIT_SPIN };

  posVar.material.uniforms.dt       = { value: CFG.DT / CFG.SUBSTEPS };
  posVar.material.uniforms.positions = { value: null }; // injected by GPGPU
  posVar.material.uniforms.velocities= { value: null };

  const e = gpuCompute.init();
  if (e) {
    console.error(e);
    throw new Error('GPUComputationRenderer init failed');
  }

  // ---------------- Render geometry (point cloud) ----------------
  const geom = new THREE.BufferGeometry();
  const ref = new Float32Array(PARTICLES * 2); // UVs into compute textures
  let p = 0;
  for (let y = 0; y < CFG.TEX_H; y++) {
    for (let x = 0; x < CFG.TEX_W; x++) {
      ref[p++] = (x + 0.5) / CFG.TEX_W;
      ref[p++] = (y + 0.5) / CFG.TEX_H;
    }
  }
  geom.setAttribute('ref', new THREE.BufferAttribute(ref, 2));
  // Dummy positions so Three draws N points
  geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PARTICLES * 3), 3));

  const pointsMat = new THREE.ShaderMaterial({
    uniforms: {
      posTex: { value: null },
      velTex: { value: null },
      size:   { value: CFG.POINT_SIZE * (renderer.getPixelRatio() || 1) },
      cameraBillboard: { value: 1.0 },
    },
    vertexShader: /* glsl */`
      precision highp float;
      attribute vec2 ref;
      uniform sampler2D posTex;
      uniform float size;
      varying float vSpeed;
      varying float vRad;
      void main() {
        vec3 P = texture2D(posTex, ref).xyz;
        // Derive a fake speed from local velocity via dFdx/dFdy trick (approx), or read velTex in frag
        vRad = length(P);
        vec4 mvPosition = modelViewMatrix * vec4(P, 1.0);
        float dist = -mvPosition.z;
        gl_PointSize = size * clamp(300.0 / (dist + 1.0), 1.0, 6.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform sampler2D velTex;
      varying float vRad;

      // Soft particle
      void main() {
        vec2 uv = gl_PointCoord * 2.0 - 1.0;
        float r2 = dot(uv, uv);
        if (r2 > 1.0) discard;
        float falloff = exp(-3.0 * r2);

        // Color by radius (teal center -> magenta outskirts)
        vec3 cInner = vec3(0.2, 0.9, 1.0);
        vec3 cOuter = vec3(1.2, 0.3, 0.7);
        float t = clamp(vRad / 2.2, 0.0, 1.0);
        vec3 col = mix(cInner, cOuter, t);

        // Bright core
        float core = smoothstep(0.0, 0.3, 1.0 - sqrt(r2));
        col *= (0.6 + 0.4 * core);

        gl_FragColor = vec4(col * falloff, falloff);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geom, pointsMat);
  scene.add(points);

  // ---------------- Resize ----------------
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

  // ---------------- Animation with HARD PAUSE ----------------
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

    for (let s = 0; s < CFG.SUBSTEPS; s++) {
      gpuCompute.compute();
    }
  }

  function updateCamera(time) {
    if (CFG.ORBIT_SPEED <= 0) return;
    const ang = time * CFG.ORBIT_SPEED * Math.PI * 2.0;
    camera.position.set(
      Math.cos(ang) * CFG.CAMERA_DIST,
      CFG.CAMERA_ELEV,
      Math.sin(ang) * CFG.CAMERA_DIST
    );
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

    // Bind the latest compute textures to the points material
    pointsMat.uniforms.posTex.value = gpuCompute.getCurrentRenderTarget(posVar).texture;
    pointsMat.uniforms.velTex.value = gpuCompute.getCurrentRenderTarget(velVar).texture;

    updateCamera(clock.elapsedTime);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(loop);
  }

  rafId = requestAnimationFrame(loop);

  // ---------------- Cleanup ----------------
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