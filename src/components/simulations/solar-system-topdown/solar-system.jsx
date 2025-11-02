import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const PLANET_DATA = [
  {
    name: 'Mercury',
    radiusEarth: 0.383,
    orbitDays: 87.969,
    distanceAU: 0.387,
    rotationHours: 1407.6,
    color: 0xc6c0b6,
  },
  {
    name: 'Venus',
    radiusEarth: 0.949,
    orbitDays: 224.701,
    distanceAU: 0.723,
    rotationHours: -5832.5, // retrograde
    color: 0xe0c485,
  },
  {
    name: 'Earth',
    radiusEarth: 1.0,
    orbitDays: 365.256,
    distanceAU: 1.0,
    rotationHours: 23.934,
    color: 0x2f8de6,
  },
  {
    name: 'Mars',
    radiusEarth: 0.532,
    orbitDays: 686.98,
    distanceAU: 1.524,
    rotationHours: 24.623,
    color: 0xd0896d,
  },
  {
    name: 'Jupiter',
    radiusEarth: 11.21,
    orbitDays: 4332.59,
    distanceAU: 5.203,
    rotationHours: 9.925,
    color: 0xeaac77,
  },
  {
    name: 'Saturn',
    radiusEarth: 9.45,
    orbitDays: 10759.22,
    distanceAU: 9.537,
    rotationHours: 10.656,
    color: 0xe5d0a6,
  },
  {
    name: 'Uranus',
    radiusEarth: 4.01,
    orbitDays: 30688.5,
    distanceAU: 19.191,
    rotationHours: -17.24,
    color: 0x7bc7f4,
  },
  {
    name: 'Neptune',
    radiusEarth: 3.88,
    orbitDays: 60182,
    distanceAU: 30.07,
    rotationHours: 16.11,
    color: 0x3553ff,
  },
];

const EMPTY_OPTS = Object.freeze({});
export default function SolarSystemTopDown({
  id = 'solar-system-topdown',
  aspect = '3 / 2',
  showPause = true,
  dprCap = 1.5,
  options,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const pausedRef = useRef(true);
  const hasPlayedRef = useRef(false);
  const [paused, setPaused] = useState(true);
  const opts = useMemo(() => options ?? EMPTY_OPTS, [options]);

  // put this helper above useEffect
  function seededAngle(key) {
    // simple stable hash → [0, 1)
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const u = ((h >>> 0) % 1000003) / 1000003; // 0..1
    return u * Math.PI * 2;
  }

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const sunRadius = opts.sunRadius ?? 2.5;

    const cfg = {
      backgroundColor: opts.backgroundColor ?? 0x000000,
      auScale: opts.auScale ?? 3.2,
      radiusScale: opts.radiusScale ?? 0.24,
      sunRadius,
      sunColor: opts.sunColor ?? 0xffffff,
      sunIntensity: opts.sunIntensity ?? 9.0,
      daysPerSecond: opts.daysPerSecond ?? 5,
      orbitSegments: opts.orbitSegments ?? 256,
      planetRadius: opts.planetRadius ?? sunRadius * 0.5,
      orbitSpacing: opts.orbitSpacing ?? sunRadius * 1.0,
    };

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
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const texLoader = new THREE.TextureLoader();
    const maxAniso = renderer.capabilities.getMaxAnisotropy?.() ?? 1;
    const loadTexture = (url) => {
      const tex = texLoader.load(url);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      return tex;
    };
    const texturePaths = {
      Sun: '/interactive/sun/sun_texture.jpg',
      Mercury: '/interactive/mercury/mercury_texture.jpg',
      Venus: '/textures/2k_venus_atmosphere.webp',
      Earth: '/textures/earth-texture-1.webp',
      Mars: '/textures/mars_texture.webp',
      Jupiter: '/textures/8k_jupiter.webp',
      Saturn: '/textures/saturn_texture.jpg',
      Uranus: '/textures/uranus_texture.jpg',
      Neptune: '/textures/neptune_texture.jpg',
    };
    const textures = Object.fromEntries(
      Object.entries(texturePaths).map(([key, url]) => [key, loadTexture(url)])
    );

    // ---------- Scene & Camera ----------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(cfg.backgroundColor);

    const camera = new THREE.OrthographicCamera(-40, 40, 40, -40, 0.1, 200);
    camera.position.set(0, 80, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);

    // ---------- Sun ----------
    const sunRadiusScaled = cfg.sunRadius * 0.75;
    const planetRadiusScaled = cfg.planetRadius * 0.75;

    const sunGeo = new THREE.SphereGeometry(sunRadiusScaled, 64, 64);
    const sunMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: textures.Sun,
      emissive: new THREE.Color(cfg.sunColor),
      emissiveIntensity: 3.6,
      roughness: 0.2,
      metalness: 0.0,
      clearcoat: 0.1,
    });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.castShadow = false;
    sun.receiveShadow = false;
    scene.add(sun);

    const maxDistance = cfg.orbitSpacing * PLANET_DATA.length + sunRadiusScaled * 3;

    const sunlight = new THREE.PointLight(cfg.sunColor, cfg.sunIntensity, 0, 2);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(2048, 2048);
    sunlight.shadow.bias = -0.0002;
    sunlight.shadow.radius = 2;
    sunlight.decay = 0.6; // keep illumination across the wide orbital scale
    sunlight.shadow.camera.near = 0.5;
    sunlight.shadow.camera.far = Math.max(120, maxDistance * 2);
    sun.add(sunlight);

    scene.add(new THREE.AmbientLight(0xffffff, opts.ambientIntensity ?? 0.16));
    // ---------- Ecliptic plane ----------
    const eclipticGeo = new THREE.RingGeometry(
      Math.max(sunRadiusScaled * 1.1, planetRadiusScaled * 1.2),
      maxDistance + cfg.auScale * 0.5,
      256
    );
    const eclipticMat = new THREE.MeshStandardMaterial({
      color: 0x0a1020,
      transparent: true,
      opacity: 0.35,
      roughness: 1.0,
      metalness: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ecliptic = new THREE.Mesh(eclipticGeo, eclipticMat);
    ecliptic.receiveShadow = false;
    ecliptic.renderOrder = -1;
    ecliptic.rotation.x = -Math.PI / 2;
    scene.add(ecliptic);

    // ---------- Planets ----------
    const planets = [];
    PLANET_DATA.forEach((planet, index) => {
      const radius = Math.max(0.05, planetRadiusScaled);
      const orbitRadius = cfg.orbitSpacing * (index + 1) + sunRadiusScaled * 1.25;

      const geo = new THREE.SphereGeometry(radius, 48, 48);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures[planet.name],
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0.0,
        roughness: 0.48,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      const orbitPositions = new Float32Array(cfg.orbitSegments * 3);
      for (let i = 0; i < cfg.orbitSegments; i += 1) {
        const t = (i / cfg.orbitSegments) * Math.PI * 2;
        orbitPositions[i * 3] = Math.cos(t) * orbitRadius;
        orbitPositions[i * 3 + 1] = 0;
        orbitPositions[i * 3 + 2] = Math.sin(t) * orbitRadius;
      }
      const orbitGeo = new THREE.BufferGeometry();
      orbitGeo.setAttribute('position', new THREE.BufferAttribute(orbitPositions, 3));
      const orbitMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.45,
      });
      const orbit = new THREE.LineLoop(orbitGeo, orbitMat);
      scene.add(orbit);

      const orbitAngularSpeed = (Math.PI * 2) / planet.orbitDays;
      const angle = seededAngle(planet.name); // stable per-planet

      // place the planet immediately so paused frames are correct
      const x0 = Math.cos(angle) * orbitRadius;
      const z0 = Math.sin(angle) * orbitRadius;
      mesh.position.set(x0, 0, z0);

      planets.push({ name: planet.name, mesh, orbit, orbitRadius, orbitAngularSpeed, angle });
    });

    // ---------- Resize ----------
    const fit = () => {
      const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
      renderer.setPixelRatio(dpr);
      const width = Math.max(1, container.clientWidth | 0);
      const height = Math.max(1, container.clientHeight | 0);
      renderer.setSize(width, height, false);

      const frustumSize = maxDistance * 1.3;
      const aspectRatio = width / height || 1;
      camera.left = -frustumSize * aspectRatio;
      camera.right = frustumSize * aspectRatio;
      camera.top = frustumSize;
      camera.bottom = -frustumSize;
      camera.updateProjectionMatrix();
    };

    const ro = new ResizeObserver(fit);
    ro.observe(container);
    window.addEventListener('resize', fit, { passive: true });
    fit();

    // ---------- Animation ----------
    const clock = new THREE.Clock();
    let rafId = 0;

    const loop = () => {
      // Always tick the clock so time never accumulates
      const rawDt = clock.getDelta();      // seconds since last frame
      const dt = pausedRef.current ? 0 : Math.min(rawDt, 0.05);
      const deltaDays = dt * cfg.daysPerSecond;

      // Advance only when not paused
      if (dt > 0) {
        planets.forEach((planet) => {
          planet.angle += planet.orbitAngularSpeed * deltaDays;
          const x = Math.cos(planet.angle) * planet.orbitRadius;
          const z = Math.sin(planet.angle) * planet.orbitRadius;
          planet.mesh.position.set(x, 0, z);
        });
      }

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(loop);
    };

    clock.start();
    rafId = requestAnimationFrame(loop);

    return () => {
      try { ro.disconnect(); } catch {}
      window.removeEventListener('resize', fit);
      if (rafId) cancelAnimationFrame(rafId);

      planets.forEach((planet) => {
        planet.mesh.geometry.dispose();
        planet.mesh.material.dispose();
        planet.orbit.geometry.dispose();
        planet.orbit.material.dispose();
      });

      sunGeo.dispose();
      sunMat.dispose();
      eclipticGeo.dispose();
      eclipticMat.dispose();

      renderer.dispose();
      Object.values(textures).forEach((tex) => tex?.dispose?.());
    };
  }, [dprCap, opts]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const onToggle = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
    if (!pausedRef.current && !hasPlayedRef.current) {
      hasPlayedRef.current = true;
      const el = containerRef.current?.closest('.sim-stage') ?? containerRef.current;
      if (el && !el.classList.contains('is-visible')) el.classList.add('is-visible');
    }
  };

  return (
    <div
      className="sim-stage centered_flex"
      id={`stage-${id}`}
      ref={containerRef}
      style={{ aspectRatio: aspect, width: '100%', position: 'relative' }}
    >
      <canvas id={id} ref={canvasRef} />
      {showPause && (
        <button
          id={`pause-${id}`}
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
