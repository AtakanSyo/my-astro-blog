// /public/interactive/learning-webgl/runtime.js
// Three.js Mars with stars — hard pause + texture grading + robustness polish (no controls)

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161/build/three.module.js';

export async function run(canvas, { pausedRef, options = {} } = {}) {
  // ---------------- Config ----------------
  const AXIAL_TILT_DEG    = options.axialTiltDeg ?? 0.0;
  const tiltSpeed = THREE.MathUtils.degToRad(1.6); // degrees per second, adjust for speed
  let currentTilt = THREE.MathUtils.degToRad(AXIAL_TILT_DEG);
  const ROT_PERIOD_H      = options.rotationHours ?? 24.623;
  const TIME_SCALE        = options.timeScale ?? 12000;
  const STAR_DIM          = options.starDim ?? 0.5;
  const R_PLANET          = options.planetRadius ?? 1.0;
  const R_ATMOS           = R_PLANET * (options.atmosScale ?? 1.005);
  const STAR_RADIUS       = options.starRadius ?? 200;
  const ATMOS_INTENSITY   = options.atmosIntensity ?? 0.08;

  const TEXTURE_SAT_INIT  = options.textureSaturation ?? 1.00;
  const TEXTURE_CON_INIT  = options.textureContrast   ?? 0.80;

  const SUN_INTENSITY     = options.lightIntensity ?? 2.0;
  const AMBIENT_INTENSITY = options.ambientIntensity ?? 0.08;

  const TEX_ALBEDO        = options.albedoTexture ?? '/textures/saturn_texture.webp';
  const TEX_STARS         = options.starsTexture  ?? '/interactive/saturn/stars_texture.jpg';

  // Reduced motion?
  const PREFERS_REDUCED_MOTION = typeof matchMedia === 'function'
    ? matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  // ---------------- Scene / Camera / Renderer ----------------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera_radius = 5;
  const camera_angularSpeed = 0.7; // radians per second (tweak)
  let angle = 0;

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);

  camera.lookAt(0,0,0)

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  const getDPR = () => Math.min(2, (window.devicePixelRatio || 1));
  renderer.setPixelRatio(getDPR());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.physicallyCorrectLights = true;

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

  // ---------------- Mars material (with adjustable saturation/contrast) ----------------
  const planetMat = new THREE.MeshStandardMaterial({ map: albedoMap, roughness: 1.0, metalness: 0.0 });

  let uSat, uCon;
  planetMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTexSat = { value: TEXTURE_SAT_INIT };
    shader.uniforms.uTexCon = { value: TEXTURE_CON_INIT };
    uSat = shader.uniforms.uTexSat;
    uCon = shader.uniforms.uTexCon;

    const hook = '#include <map_fragment>';
    if (shader.fragmentShader.includes(hook)) {
      shader.fragmentShader =
        `
        uniform float uTexSat;
        uniform float uTexCon;
        ` + shader.fragmentShader.replace(
          hook,
          `
          ${hook}
          vec3 c = diffuseColor.rgb;
          float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c = mix(vec3(luma), c, clamp(uTexSat, 0.0, 2.0));
          c = (c - 0.5) * clamp(uTexCon, 0.0, 2.0) + 0.5;
          diffuseColor.rgb = c;
          `
        );
    }

    planetMat.userData.setSaturation = (v) => { uSat.value = v; };
    planetMat.userData.setContrast   = (v) => { uCon.value = v; };
  };
  planetMat.needsUpdate = true;

  // --- Common tilt node for planet + rings + atmosphere ---
  const tiltGroup = new THREE.Group();
  tiltGroup.rotation.z = THREE.MathUtils.degToRad(AXIAL_TILT_DEG);
  scene.add(tiltGroup);

  const planet = new THREE.Mesh(new THREE.SphereGeometry(R_PLANET, 96, 96), planetMat);
  tiltGroup.add(planet);

  // ---------------- Jupiter's rings ----------------
  const ringMap = await loadTex('/interactive/saturn/saturns_rings_texture.png', t => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.transparent = true;
  });

  // Geometry: thin, almost flat ring
  const innerRadius = R_PLANET * 1.236;
  const outerRadius = R_PLANET * 2.326;
  const ringGeo = new THREE.RingGeometry(innerRadius, outerRadius, 128);

  // Rotate UVs so texture faces correctly
  const ringPos = ringGeo.attributes.position;
  const uv = [];
  for (let i = 0; i < ringPos.count; i++) {
    const x = ringPos.getX(i);
    const y = ringPos.getY(i);
    const r = Math.sqrt(x * x + y * y);
    uv.push((r - innerRadius) / (outerRadius - innerRadius), 0.5);
  }
  ringGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));

  const ringMat = new THREE.MeshBasicMaterial({
    map: ringMap,
    side: THREE.DoubleSide,
    transparent: true
  });

  const rings = new THREE.Mesh(ringGeo, ringMat);
  rings.rotation.x = THREE.MathUtils.degToRad(90 - AXIAL_TILT_DEG);
  tiltGroup.add(rings);

  // ---------------- Thin halo ----------------
  const atmosMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uLightDir:  { value: new THREE.Vector3(1, 0.2, 0.7).normalize() },
      uColor:     { value: new THREE.Color(0xffe6c0) },
      uIntensity: { value: ATMOS_INTENSITY }
    },
    vertexShader: `
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uLightDir;
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 N = normalize(vNormal);
        float fres = pow(1.0 - max(dot(N, V), 0.0), 2.2);
        float fwd  = pow(max(dot(N, normalize(uLightDir)), 0.0), 1.0);
        float a = clamp(fres * (0.5 + 0.5 * fwd), 0.0, 1.0) * uIntensity;
        gl_FragColor = vec4(uColor, a);
      }
    `,
    side: THREE.BackSide
  });
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(R_ATMOS, 96, 96), atmosMat);
  tiltGroup.add(atmosphere);

  // ---------------- Starfield ----------------
  const stars = new THREE.Mesh(
    new THREE.SphereGeometry(STAR_RADIUS, 64, 64),
    new THREE.MeshBasicMaterial({ map: starMap, side: THREE.BackSide })
  );
  stars.material.color.setScalar(STAR_DIM);
  scene.add(stars);

  // ---------------- Lights ----------------
  const sun = new THREE.DirectionalLight(0xffffff, SUN_INTENSITY);
  sun.position.set(5, 2, 3).normalize();
  scene.add(sun);

  const ambient = new THREE.AmbientLight(0xffffff, AMBIENT_INTENSITY);
  scene.add(ambient);

  const syncLightUniforms = () => {
    atmosMat.uniforms.uLightDir.value.copy(sun.position).normalize();
  };
  syncLightUniforms();

  // ---------------- Resize ----------------
  function resize() {
    const w = Math.max(1, canvas.clientWidth | 0);
    const h = Math.max(1, canvas.clientHeight | 0);
    renderer.setPixelRatio(getDPR());
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
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
  camera.up.set(1, 0, 0);

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

    angle += camera_angularSpeed * (dt/10);
    if (angle >= Math.PI * 2) angle -= Math.PI * 2;
    const y = camera_radius * Math.cos(angle);
    const z = camera_radius * Math.sin(angle);
    camera.position.set(-2, y, z);
    camera.lookAt(0, 0, 0);
    currentTilt += tiltSpeed * dt;   // dt comes from clock.getDelta()
    tiltGroup.rotation.z = currentTilt;

    planet.rotation.y += THREE.MathUtils.degToRad(spinDeg);
    atmosphere.rotation.y = planet.rotation.y;
    stars.rotation.y -= 0.003 * dt;

    renderer.render(scene, camera);
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

    renderer.dispose();
    planet.geometry.dispose();
    atmosphere.geometry.dispose();
    stars.geometry.dispose();
    planetMat.dispose();
    atmosMat.dispose();
    albedoMap?.dispose?.();
    starMap?.dispose?.();
  };
}
