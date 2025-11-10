import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import SimStage from '../lib/SimStage.jsx';

const EMPTY_OPTS = Object.freeze({});
const DEFAULT_BINARY = Object.freeze({
  separation: 8,
  binaryDays: 40,
  starA: {
    name: 'Helios',
    radius: 1.1,
    color: 0xffd398,
    intensity: 300,
    mass: 1,
  },
  starB: {
    name: 'Nyx',
    radius: 1.7,
    color: 0x7dc9ff,
    intensity: 400,
    mass: 0.65,
  },
  planet: {
    name: 'Eclipse',
    semiMajor: 18,
    eccentricity: 0.08,
    orbitDays: 220,
    rotationHours: 19,
    tiltDegrees: 9,
    radiusEarth: 1.2,
  },
});

export default function PTypeSystem({
  id = 'p-type-system',
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

    const merged = {
      separation: opts.separation ?? DEFAULT_BINARY.separation,
      binaryDays: opts.binaryDays ?? DEFAULT_BINARY.binaryDays,
      starA: { ...DEFAULT_BINARY.starA, ...(opts.starA ?? EMPTY_OPTS) },
      starB: { ...DEFAULT_BINARY.starB, ...(opts.starB ?? EMPTY_OPTS) },
      planet: { ...DEFAULT_BINARY.planet, ...(opts.planet ?? EMPTY_OPTS) },
    };

    const cfg = {
      backgroundColor: opts.backgroundColor ?? 0x01040a,
      daysPerSecond: opts.daysPerSecond ?? 5,
      orbitSegments: opts.orbitSegments ?? 256,
      planetScale: opts.planetScale ?? 1.3,
      atmosphereColor: opts.atmosphereColor ?? 0xff3a3b,
      glowStrength: opts.glowStrength ?? 1000.7,
      ambientIntensity: opts.ambientIntensity ?? 0.1,
      planetColor: opts.planetColor ?? merged.planet.color ?? 0xff3a3b,
      starARadius: opts.starARadius ?? merged.starA.radius ?? 2.2,
      starBRadius: opts.starBRadius ?? merged.starB.radius ?? 1.7,
    };

    // Derived binary properties
    const totalMass = Math.max(1e-6, (merged.starA.mass ?? 1) + (merged.starB.mass ?? 1));
    const sep = Math.max(1, merged.separation ?? DEFAULT_BINARY.separation);
    const radiusA = (sep * (merged.starB.mass ?? 1)) / totalMass;
    const radiusB = (sep * (merged.starA.mass ?? 1)) / totalMass;

    const planetSemiMajor =
      opts.orbitSemiMajor ??
      merged.planet.semiMajor ??
      DEFAULT_BINARY.planet.semiMajor;
    const planetEcc = THREE.MathUtils.clamp(
      opts.orbitEccentricity ?? merged.planet.eccentricity ?? 0,
      0,
      0.8,
    );
    const semiMajor = Math.max(sep * 1.2, planetSemiMajor);
    const semiMinor = semiMajor * Math.sqrt(1 - planetEcc * planetEcc);
    const planetFocus = Math.sqrt(Math.max(0, semiMajor * semiMajor - semiMinor * semiMinor));
    const planetRadius = Math.max(
      (cfg.starARadius + cfg.starBRadius) * 0.08,
      Math.max(cfg.starARadius, cfg.starBRadius) * cfg.planetScale * (merged.planet.radiusEarth ?? 1),
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
    const camera = new THREE.OrthographicCamera(-30, 30, 30, -30, 0.1, 400);
    camera.position.set(0, 60, 0);
    camera.lookAt(scene.position);

    if (cfg.ambientIntensity > 0) {
      const ambient = new THREE.AmbientLight(0xffffff, cfg.ambientIntensity);
      scene.add(ambient);
    }

    const starGroup = new THREE.Group();
    scene.add(starGroup);

    const buildStar = (star, radiusOverride) => {
      const geo = new THREE.SphereGeometry(radiusOverride ?? star.radius ?? 2, 48, 24);
      const mat = new THREE.MeshStandardMaterial({
        emissive: new THREE.Color(star.color ?? 0xffffff),
        emissiveIntensity: cfg.glowStrength,
        color: star.color ?? 0xffffff,
        roughness: 0.35,
        metalness: 0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const light = new THREE.PointLight(star.color ?? 0xffffff, star.intensity ?? 8, 0, 2);
      mesh.add(light);
      starGroup.add(mesh);
      return { mesh };
    };

    const starA = buildStar(merged.starA, cfg.starARadius);
    const starB = buildStar(merged.starB, cfg.starBRadius);

    // Orbit rings for stars
    const makeOrbitGeo = (radius) => {
      const segs = 128;
      const positions = new Float32Array(segs * 3);
      for (let i = 0; i < segs; i += 1) {
        const t = (i / segs) * Math.PI * 2;
        positions[i * 3] = Math.cos(t) * radius;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = Math.sin(t) * radius;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      return geo;
    };

    const starRingGeo = makeOrbitGeo(radiusA);
    const starBRingGeo = makeOrbitGeo(radiusB);
    const ringMat = new THREE.LineDashedMaterial({
      color: 0xffffff,
      dashSize: 0.8,
      gapSize: 0.5,
      transparent: true,
      opacity: 0.35,
    });
    const orbitAGeo = starRingGeo;
    const orbitAMat = ringMat.clone();
    const orbitA = new THREE.LineLoop(orbitAGeo, orbitAMat);
    orbitA.computeLineDistances();
    const orbitBGeo = starBRingGeo;
    const orbitBMat = ringMat.clone();
    const orbitB = new THREE.LineLoop(orbitBGeo, orbitBMat);
    orbitB.computeLineDistances();
    scene.add(orbitA);
    scene.add(orbitB);

    // Circumbinary disk
    const diskGeo = new THREE.RingGeometry(sep * 0.3, semiMajor + 2, 64, 1);
    const diskMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.07,
      side: THREE.DoubleSide,
    });
    const disk = new THREE.Mesh(diskGeo, diskMat);
    disk.rotation.x = Math.PI / 2;
    scene.add(disk);

    // Planet orbit path
    const orbitPositions = new Float32Array(cfg.orbitSegments * 3);
    for (let i = 0; i < cfg.orbitSegments; i += 1) {
      const t = (i / cfg.orbitSegments) * Math.PI * 2;
      orbitPositions[i * 3] = Math.cos(t) * semiMajor - planetFocus;
      orbitPositions[i * 3 + 1] = 0;
      orbitPositions[i * 3 + 2] = Math.sin(t) * semiMinor;
    }
    const planetOrbitGeo = new THREE.BufferGeometry();
    planetOrbitGeo.setAttribute('position', new THREE.BufferAttribute(orbitPositions, 3));
    const planetOrbitMat = new THREE.LineDashedMaterial({
      color: 0xffffff,
      dashSize: 1.2,
      gapSize: 0.8,
      transparent: true,
      opacity: 0.7,
    });
    const planetOrbit = new THREE.LineLoop(planetOrbitGeo, planetOrbitMat);
    planetOrbit.computeLineDistances();
    scene.add(planetOrbit);

    // Planet mesh
    const planetGeo = new THREE.SphereGeometry(planetRadius, 64, 32);
    const planetMat = new THREE.MeshStandardMaterial({
      color: cfg.planetColor,
      roughness: 0.55,
      metalness: 0.08,
    });
    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    const atmoGeo = new THREE.SphereGeometry(planetRadius * 1.06, 32, 16);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: cfg.atmosphereColor,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    planetMesh.add(atmoMesh);
    scene.add(planetMesh);

    planetMesh.rotation.z = THREE.MathUtils.degToRad(merged.planet.tiltDegrees ?? 0);

    const rotationPeriodDays =
      merged.planet.rotationHours && merged.planet.rotationHours !== 0
        ? merged.planet.rotationHours / 24
        : 1;
    const rotationSpeed =
      ((Math.PI * 2) / Math.abs(rotationPeriodDays || 1)) * Math.sign(rotationPeriodDays || 1);

    const binaryAngularSpeed = (Math.PI * 2) / (merged.binaryDays || 1);
    const planetAngularSpeed = (Math.PI * 2) / (merged.planet.orbitDays || 1);

    const fit = () => {
      const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
      renderer.setPixelRatio(dpr);
      const width = Math.max(1, container.clientWidth | 0);
      const height = Math.max(1, container.clientHeight | 0);
      renderer.setSize(width, height, false);

      const maxDistance = semiMajor + merged.separation * 1.5;
      const frustumSize = maxDistance * 1.2;
      const aspectRatio = width / height || 1;
      camera.left = -frustumSize * aspectRatio;
      camera.right = frustumSize * aspectRatio;
      camera.top = frustumSize;
      camera.bottom = -frustumSize;
      camera.updateProjectionMatrix();
    };

    const ro =
      typeof ResizeObserver !== 'undefined' && container ? new ResizeObserver(fit) : null;
    ro?.observe(container);
    window.addEventListener('resize', fit, { passive: true });
    fit();

    const clock = new THREE.Clock();
    let rafId = 0;
    const state = {
      binaryAngle: 0,
      planetAngle: 0,
    };

    const loop = () => {
      const rawDt = clock.getDelta();
      const dt = pausedRef.current ? 0 : Math.min(rawDt, 0.05);
      const deltaDays = dt * cfg.daysPerSecond;

      if (dt > 0) {
        state.binaryAngle += binaryAngularSpeed * deltaDays;
        state.planetAngle += planetAngularSpeed * deltaDays;

        const cosB = Math.cos(state.binaryAngle);
        const sinB = Math.sin(state.binaryAngle);
        starA.mesh.position.set(cosB * radiusA, 0, sinB * radiusA);
        starB.mesh.position.set(-cosB * radiusB, 0, -sinB * radiusB);

        const cosP = Math.cos(state.planetAngle);
        const sinP = Math.sin(state.planetAngle);
        const px = cosP * semiMajor - planetFocus;
        const pz = sinP * semiMinor;
        planetMesh.position.set(px, 0, pz);
        planetMesh.rotation.y += rotationSpeed * deltaDays;
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
        if (obj.isMesh || obj.type === 'LineLoop' || obj.type === 'Line') {
          obj.geometry?.dispose?.();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((mat) => mat?.dispose?.());
          } else {
            obj.material?.dispose?.();
          }
        }
      });
      starRingGeo.dispose();
      starBRingGeo.dispose();
      diskGeo.dispose();
      diskMat.dispose();
      planetOrbitGeo.dispose();
      planetOrbitMat.dispose();
      ringMat.dispose();
      orbitAGeo.dispose();
      orbitAMat.dispose();
      orbitBGeo.dispose();
      orbitBMat.dispose();
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
