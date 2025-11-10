import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import SimStage from '../lib/SimStage.jsx';

const EMPTY_OPTS = Object.freeze({});
const DEFAULT_SYSTEM = Object.freeze({
  name: 'Aurora',
  orbitDays: 142.3,
  rotationHours: 28.6,
  tiltDegrees: 18,
  color: 0x4aa8ff,
  semiMajor: 14, // scene units
  eccentricity: 0.18,
  radiusEarth: 1.1,
});

export default function SinglePlanetSystem({
  id = 'single-planet-system',
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

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const system = { ...DEFAULT_SYSTEM, ...(opts.planet ?? EMPTY_OPTS) };
    const cfg = {
      backgroundColor: opts.backgroundColor ?? 0x000000,
      starRadius: opts.starRadius ?? 1.2,
      starColor: opts.starColor ?? 0xffd398,
      starIntensity: opts.starIntensity ?? 520,
      orbitSegments: opts.orbitSegments ?? 256,
      daysPerSecond: opts.daysPerSecond ?? 6,
      planetScale: opts.planetScale ?? 1.2,
      planetTexture: opts.planetTexture ?? null,
      atmosphereColor: opts.atmosphereColor ?? 0x74d2ff,
      orbitSemiMajor: Math.max(
        0.1,
        opts.orbitSemiMajor ?? system.semiMajor ?? DEFAULT_SYSTEM.semiMajor,
      ),
      orbitEccentricity: THREE.MathUtils.clamp(
        opts.orbitEccentricity ?? system.eccentricity ?? DEFAULT_SYSTEM.eccentricity ?? 0,
        0,
        0.92,
      ),
    };

    const ecc = cfg.orbitEccentricity;
    const semiMajor = 12;
    const semiMinor = semiMajor * Math.sqrt(1 - ecc * ecc);
    const focusOffset = Math.sqrt(Math.max(0, semiMajor * semiMajor - semiMinor * semiMinor));
    const planetRadius = Math.max(
      cfg.starRadius * 0.1,
      cfg.starRadius * cfg.planetScale * (system.radiusEarth ?? 1),
    );

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
    renderer.setClearColor(cfg.backgroundColor, 1);

    // ---------- Scene & Camera ----------
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 200);
    camera.position.set(0, 40, 0);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    // ---------- Lighting ----------
    const starLight = new THREE.PointLight(cfg.starColor, cfg.starIntensity, 0, 2);
    starLight.position.set(0, 0, 0);
    scene.add(starLight);

    const rimLight = new THREE.DirectionalLight(0x3f95ff, 0.8);
    rimLight.position.set(-10, 20, -10);
    scene.add(rimLight);

    // ---------- Star ----------
    const starGeo = new THREE.SphereGeometry(cfg.starRadius, 64, 32);
    const starMat = new THREE.MeshStandardMaterial({
      emissive: new THREE.Color(cfg.starColor),
      emissiveIntensity: 1.6,
      color: cfg.starColor,
      roughness: 0.4,
      metalness: 0,
    });
    const starMesh = new THREE.Mesh(starGeo, starMat);
    scene.add(starMesh);

    // ---------- Ecliptic ring ----------
    const eclipticGeo = new THREE.RingGeometry(
      semiMajor - cfg.starRadius * 0.6,
      semiMajor + cfg.starRadius * 0.6,
      128,
      1,
    );
    const eclipticMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide,
    });
    const eclipticMesh = new THREE.Mesh(eclipticGeo, eclipticMat);
    eclipticMesh.rotation.x = Math.PI / 2;
    scene.add(eclipticMesh);

    // ---------- Orbit path ----------
    const orbitPositions = new Float32Array(cfg.orbitSegments * 3);
    for (let i = 0; i < cfg.orbitSegments; i += 1) {
      const t = (i / cfg.orbitSegments) * Math.PI * 2;
      orbitPositions[i * 3] = Math.cos(t) * semiMajor - focusOffset;
      orbitPositions[i * 3 + 1] = 0;
      orbitPositions[i * 3 + 2] = Math.sin(t) * semiMinor;
    }
    const orbitGeo = new THREE.BufferGeometry();
    orbitGeo.setAttribute('position', new THREE.BufferAttribute(orbitPositions, 3));
    const orbitMat = new THREE.LineDashedMaterial({
      color: 0xffffff,
      dashSize: 1,
      gapSize: 0.8,
      transparent: true,
      opacity: 0.6,
    });
    const orbitLine = new THREE.LineLoop(orbitGeo, orbitMat);
    orbitLine.computeLineDistances();
    scene.add(orbitLine);

    // ---------- Planet ----------
    const planetGeo = new THREE.SphereGeometry(planetRadius, 64, 32);
    const planetMat = new THREE.MeshStandardMaterial({
      color: system.color,
      roughness: 0.55,
      metalness: 0.1,
      map: null,
    });
    let texture;
    if (cfg.planetTexture) {
      texture = new THREE.TextureLoader().load(cfg.planetTexture, () => {
        texture.colorSpace = THREE.SRGBColorSpace;
        planetMat.map = texture;
        planetMat.needsUpdate = true;
      });
    }

    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    const atmosphereGeo = new THREE.SphereGeometry(planetRadius * 1.04, 32, 16);
    const atmosphereMat = new THREE.MeshBasicMaterial({
      color: cfg.atmosphereColor,
      transparent: true,
      opacity: 0.18,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    planetMesh.add(atmosphereMesh);
    scene.add(planetMesh);

    const tiltRad = THREE.MathUtils.degToRad(system.tiltDegrees ?? 0);
    planetMesh.rotation.z = tiltRad;

    const rotationPeriodDays =
      system.rotationHours && system.rotationHours !== 0
        ? system.rotationHours / 24
        : 1;
    const rotationSpeed =
      (Math.PI * 2) / Math.abs(rotationPeriodDays || 1) * Math.sign(rotationPeriodDays);

    const planet = {
      mesh: planetMesh,
      orbitAngularSpeed: (Math.PI * 2) / system.orbitDays,
      rotationSpeed,
      angle: 0,
    };

    // ---------- Resize ----------
    const fit = () => {
      const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
      renderer.setPixelRatio(dpr);
      const width = Math.max(1, container.clientWidth | 0);
      const height = Math.max(1, container.clientHeight | 0);
      renderer.setSize(width, height, false);

      const maxDistance = semiMajor + cfg.starRadius * 4;
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
      const rawDt = clock.getDelta();
      const dt = pausedRef.current ? 0 : Math.min(rawDt, 0.05);
      const deltaDays = dt * cfg.daysPerSecond;

      if (dt > 0) {
        planet.angle += planet.orbitAngularSpeed * deltaDays;
        const cosT = Math.cos(planet.angle);
        const sinT = Math.sin(planet.angle);
        const px = cosT * semiMajor - focusOffset;
        const pz = sinT * semiMinor;
        planet.mesh.position.set(px, 0, pz);
        planet.mesh.rotation.y += planet.rotationSpeed * deltaDays;
      }

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(loop);
    };

    clock.start();
    rafId = requestAnimationFrame(loop);

    return () => {
      try {
        ro.disconnect();
      } catch {}
      window.removeEventListener('resize', fit);
      if (rafId) cancelAnimationFrame(rafId);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry?.dispose?.();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((mat) => mat?.dispose?.());
          } else {
            obj.material?.dispose?.();
          }
        }
      });
      texture?.dispose?.();
      planetMat.map?.dispose?.();
      starGeo.dispose();
      starMat.dispose();
      eclipticGeo.dispose();
      eclipticMat.dispose();
      orbitGeo.dispose();
      orbitMat.dispose();
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
    <SimStage
      id={id}
      aspect={aspect}
      containerRef={containerRef}
      canvasRef={canvasRef}
      paused={paused}
      onToggle={onToggle}
      showPause={showPause}
      style={{ width: '100%', position: 'relative' }}
    />
  );
}
