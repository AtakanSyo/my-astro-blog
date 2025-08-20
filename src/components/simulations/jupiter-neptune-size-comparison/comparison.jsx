import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function PlanetSim({
  id = 'planet-compare',
  aspect = '16 / 9',
  showPause = true,
  dprCap = 1.5,
  options = {},
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const btnRef = useRef(null);

  const pausedRef = useRef(true);
  const [paused, setPaused] = useState(true);
  const madeVisibleRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // ---------- Defaults & Options ----------
    const cfg = {
      axialTiltDeg: options.axialTiltDeg ?? 28.32,
      rotationHours: options.rotationHours ?? 16.11, // hours
      timeScale: options.timeScale ?? 2000,
      starDim: options.starDim ?? 0.05,
      planetRadius: options.planetRadius ?? 1,       // first planet base radius
      secondRadiusScale: options.secondRadiusScale ?? 1 / 2.9, // ~Neptune/Jupiter
      atmosScale: options.atmosScale ?? 1.015,
      starRadius: options.starRadius ?? 200,
      atmosIntensity: options.atmosIntensity ?? 0.2,

      // textures (pass absolute /public paths or imported URLs)
      planetTexture: options.planetTexture ?? '/textures/jupiter_texture.jpg',
      secondTexture: options.secondTexture ?? '/textures/neptune_texture.jpg',
      starsTexture: options.starsTexture ?? '/textures/stars_texture.jpg',

      // positions
      planetPosition: options.planetPosition ?? [-1, 0, 0],
      secondPosition: options.secondPosition ?? [1, 0, 0],
    };

    const R_PLANET = cfg.planetRadius;
    const R_PLANET_2 = R_PLANET * cfg.secondRadiusScale;
    const R_ATMOS = R_PLANET * cfg.atmosScale;

    // ---------- Renderer ----------
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.physicallyCorrectLights = true;

    // ---------- Scene & Camera ----------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
    camera.position.set(0, 0, 4);

    // ---------- Helpers ----------
    const texLoader = new THREE.TextureLoader();
    const aniso = renderer.capabilities.getMaxAnisotropy();

    function loadMap(url, opts = {}) {
      const t = texLoader.load(url);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = aniso;
      if (opts.repeatWrap) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
      }
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      return t;
    }

    function makeSTDMaterial(map) {
      const mat = new THREE.MeshStandardMaterial({
        map,
        roughness: 1.0,
        metalness: 0.0,
      });
      // mild color grading
      mat.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          `
          #include <map_fragment>
          vec3 c = diffuseColor.rgb;
          float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
          float SAT = 1.35;
          float CONTRAST = 1.06;
          c = mix(vec3(luma), c, SAT);
          c = (c - 0.5) * CONTRAST + 0.5;
          diffuseColor.rgb = c;
          `
        );
      };
      mat.needsUpdate = true;
      return mat;
    }

    function makePlanet(radius, material, tiltDeg, position) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 96), material);
      mesh.rotation.z = THREE.MathUtils.degToRad(tiltDeg);
      mesh.position.set(...position);
      scene.add(mesh);
      return mesh;
    }

    // ---------- Textures ----------
    const mapPlanet = loadMap(cfg.planetTexture);
    const mapSecond = loadMap(cfg.secondTexture);
    const mapStars  = loadMap(cfg.starsTexture, { repeatWrap: true });

    // ---------- Materials ----------
    const matPlanet = makeSTDMaterial(mapPlanet);
    const matSecond = makeSTDMaterial(mapSecond);

    // ---------- Planets ----------
    const planetA = makePlanet(R_PLANET,  matPlanet, cfg.axialTiltDeg, cfg.planetPosition);
    const planetB = makePlanet(R_PLANET_2, matSecond, cfg.axialTiltDeg, cfg.secondPosition);

    // ---------- Atmosphere (around first planet) ----------
    const atmosMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uLightDir:  { value: new THREE.Vector3(1, 0.2, 0.7).normalize() },
        uColor:     { value: new THREE.Color(0x6db8ff) },
        uIntensity: { value: cfg.atmosIntensity },
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
          float fres = pow(1.0 - max(dot(N, V), 0.0), 2.5);
          float fwd = pow(max(dot(N, normalize(uLightDir)), 0.0), 1.0);
          float a = clamp(fres * (0.6 + 0.6 * fwd), 0.0, 1.0) * uIntensity;
          gl_FragColor = vec4(uColor, a);
        }
      `,
      side: THREE.BackSide,
    });

    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(R_ATMOS, 96, 96), atmosMat);
    atmosphere.position.copy(planetA.position);
    atmosphere.rotation.copy(planetA.rotation);
    scene.add(atmosphere);

    const atmosphereB = new THREE.Mesh(
      new THREE.SphereGeometry(R_PLANET_2 * cfg.atmosScale, 96, 96),
      atmosMat.clone()
    );
    atmosphereB.position.copy(planetB.position);
    atmosphereB.rotation.copy(planetB.rotation);
    scene.add(atmosphereB);

    // ---------- Starfield ----------
    const stars = new THREE.Mesh(
      new THREE.SphereGeometry(cfg.starRadius, 64, 64),
      new THREE.MeshBasicMaterial({ map: mapStars, side: THREE.BackSide })
    );
    stars.material.color.setScalar(cfg.starDim);
    scene.add(stars);

    // ---------- Lights ----------
    const sun = new THREE.DirectionalLight(0xffffff, 2.0);
    sun.position.set(5, 2, 3).normalize();
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffffff, 0.12));

    const syncLightUniforms = () => {
      atmosMat.uniforms.uLightDir.value.copy(sun.position.clone().normalize());
    };
    syncLightUniforms();

    // ---------- Resize / DPR ----------
    const fit = () => {
      const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
      renderer.setPixelRatio(dpr);
      const w = Math.max(1, container.clientWidth | 0);
      const h = Math.max(1, container.clientHeight | 0);
      renderer.setSize(w, h, false);
      camera.aspect = w / h || 1;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    window.addEventListener('resize', fit, { passive: true });
    requestAnimationFrame(fit);

    // ---------- Animation (HARD pause) ----------
    const clock = new THREE.Clock();
    const degPerSec = 360.0 / (cfg.rotationHours * 3600.0);

    let rafId = 0;
    let pollId = 0;
    let wasPaused = false;

    const startPollingForResume = () => {
      if (pollId) return;
      pollId = setInterval(() => {
        if (!pausedRef.current) {
          clearInterval(pollId);
          pollId = 0;
          clock.getDelta();
          rafId = requestAnimationFrame(loop);
        }
      }, 100);
    };

    const loop = () => {
      if (pausedRef.current) {
        wasPaused = true;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
        startPollingForResume();
        return;
      }

      if (wasPaused) {
        wasPaused = false;
        clock.getDelta(); // reset delta after pause
      }

      const dt = clock.getDelta();
      const spinDeg = degPerSec * cfg.timeScale * dt;

      planetA.rotation.y += THREE.MathUtils.degToRad(spinDeg);
      planetB.rotation.y += THREE.MathUtils.degToRad(spinDeg);

      atmosphere.rotation.y = planetA.rotation.y;
      atmosphere.position.copy(planetA.position);

      atmosphereB.rotation.y = planetB.rotation.y;
      atmosphereB.position.copy(planetB.position);

      stars.rotation.y -= 0.003 * dt;

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    // ---------- Cleanup ----------
    return () => {
      try { ro.disconnect(); } catch {}
      window.removeEventListener('resize', fit);
      if (rafId) cancelAnimationFrame(rafId);
      if (pollId) clearInterval(pollId);

      renderer.dispose();

      planetA.geometry.dispose();
      planetB.geometry.dispose();
      atmosphere.geometry.dispose();
      stars.geometry.dispose();

      matPlanet.dispose();
      matSecond.dispose();
      atmosMat.dispose();

      mapPlanet?.dispose?.();
      mapSecond?.dispose?.();
      mapStars?.dispose?.();
    };
  }, [dprCap, options]);

  // ---------- Play/Pause ----------
  const onToggle = () => {
    pausedRef.current = !pausedRef.current;
    const nowPaused = pausedRef.current;
    setPaused(nowPaused);

    if (!nowPaused && !madeVisibleRef.current) {
      madeVisibleRef.current = true;
      const el = containerRef.current?.closest('.sim-stage') ?? containerRef.current;
      if (el && !el.classList.contains('is-visible')) el.classList.add('is-visible');
    }
  };

  return (
    <div
      className="sim-stage centered_flex"
      id={`stage-${id}`}
      ref={containerRef}
      style={{ aspectRatio: aspect, width: '100%' }}
    >
      <canvas id={id} ref={canvasRef} />

      {showPause && (
        <button
          id={`pause-${id}`}
          ref={btnRef}
          className="pill sim-controls-inline"
          type="button"
          aria-pressed={!paused}
          onClick={onToggle}
        >
          {paused ? 'Play' : 'Pause'}
        </button>
      )}
    </div>
  );
}