// /public/interactive/learning-webgl/runtime.js
// Three.js Mars with stars — hard pause + adjustable texture saturation/contrast

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161/build/three.module.js';

export async function run(canvas, { pausedRef, options = {} } = {}) {
  // ---------------- Config ----------------
  const AXIAL_TILT_DEG   = options.axialTiltDeg ?? 25.19;     // Mars obliquity
  const ROT_PERIOD_H     = options.rotationHours ?? 24.623;   // Mars day
  const TIME_SCALE       = options.timeScale ?? 4000;          // visual spin speed
  const STAR_DIM         = options.starDim ?? 0.05;
  const R_PLANET         = options.planetRadius ?? 1.0;
  const R_ATMOS          = R_PLANET * (options.atmosScale ?? 1.005); // very thin for Mars
  const STAR_RADIUS      = options.starRadius ?? 200;
  const ATMOS_INTENSITY  = options.atmosIntensity ?? 0.08;    // faint halo

  // NEW: texture grading controls (Mars often needs less saturation)
  const TEXTURE_SAT      = options.textureSaturation ?? 1.0; // 1.0 = original
  const TEXTURE_CONTRAST = options.textureContrast   ?? 1.5; // subtle

  const SUN_INTENSITY     = options.lightIntensity ?? 2.0;   // DirectionalLight power
  const AMBIENT_INTENSITY = options.ambientIntensity ?? 0.1; // Ambient fill

  // Assets (Mars)
  const TEX_ALBEDO = options.albedoTexture ?? '/textures/uranus_texture.webp';
  const TEX_STARS  = options.starsTexture  ?? '/interactive/uranus/stars_texture.jpg';

  // ---------------- Scene / Camera / Renderer ----------------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
  camera.position.set(0, 0, 3);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.physicallyCorrectLights = true;

  // ---------------- Textures ----------------
  const texLoader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const albedoMap = texLoader.load(TEX_ALBEDO, t => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
  });

  const starMap = texLoader.load(TEX_STARS, t => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = maxAniso;
  });

  // ---------------- Mars material (with adjustable saturation/contrast) ----------------
  const planetMat = new THREE.MeshStandardMaterial({
    map: albedoMap,
    roughness: 1.0,
    metalness: 0.0,
  });


  planetMat.onBeforeCompile = (shader) => {
    // 1) expose uniforms to WebGL program
    shader.uniforms.uTexSat = { value: TEXTURE_SAT };
    shader.uniforms.uTexCon = { value: TEXTURE_CONTRAST };

    // 2) declare them in GLSL and inject the grading
    shader.fragmentShader =
      `
      uniform float uTexSat;
      uniform float uTexCon;
      ` + shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
        #include <map_fragment>
        // Grade the sampled albedo: reduce saturation / trim contrast.
        vec3 c = diffuseColor.rgb;
        float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(luma), c, clamp(uTexSat, 0.0, 2.0));   // saturation
        c = (c - 0.5) * clamp(uTexCon, 0.0, 2.0) + 0.5;     // contrast
        diffuseColor.rgb = c;
        `
      );

    // (optional) easy runtime tweaks without recompiling:
    planetMat.userData.uTexSat = shader.uniforms.uTexSat;
    planetMat.userData.uTexCon = shader.uniforms.uTexCon;
  };
  // later you can do: planetMat.userData.uTexSat.value = 0.8; renderer.render(...)
  planetMat.needsUpdate = true;

  const planet = new THREE.Mesh(new THREE.SphereGeometry(R_PLANET, 96, 96), planetMat);
  planet.rotation.z = THREE.MathUtils.degToRad(AXIAL_TILT_DEG);
  scene.add(planet);

  // ---------------- Thin halo (very subtle for Mars) ----------------
  const atmosMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uLightDir: { value: new THREE.Vector3(1, 0.2, 0.7).normalize() },
      uColor:    { value: new THREE.Color(0xffe6c0) }, // warmish limb tint
      uIntensity:{ value: ATMOS_INTENSITY }
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
        float fwd = pow(max(dot(N, normalize(uLightDir)), 0.0), 1.0);
        float a = clamp(fres * (0.5 + 0.5 * fwd), 0.0, 1.0) * uIntensity;
        gl_FragColor = vec4(uColor, a);
      }
    `,
    side: THREE.BackSide
  });
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(R_ATMOS, 96, 96), atmosMat);
  atmosphere.rotation.copy(planet.rotation);
  scene.add(atmosphere);

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

  scene.add(new THREE.AmbientLight(0xffffff, 0.03));
  const syncLightUniforms = () => {
    const dir = sun.position.clone().normalize();
    atmosMat.uniforms.uLightDir.value.copy(dir);
  };
  syncLightUniforms();

  // ---------------- Resize ----------------
  function resize() {
    const w = Math.max(1, canvas.clientWidth | 0);
    const h = Math.max(1, canvas.clientHeight | 0);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  requestAnimationFrame(resize);
  window.addEventListener('orientationchange', resize);

  // ---------------- Animation with HARD PAUSE ----------------
  const clock = new THREE.Clock();
  const degPerSec = 360.0 / (ROT_PERIOD_H * 3600.0);

  let rafId = 0;
  let pollId = 0;
  let wasPaused = false;

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
    const isPaused = pausedRef && pausedRef();
    if (isPaused) {
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

    planet.rotation.y += THREE.MathUtils.degToRad(spinDeg);
    atmosphere.rotation.y = planet.rotation.y;
    stars.rotation.y -= 0.003 * dt;

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(loop);
  }

  rafId = requestAnimationFrame(loop);

  // ---------------- Cleanup ----------------
  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    if (pollId) clearInterval(pollId);
    ro.disconnect();
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
