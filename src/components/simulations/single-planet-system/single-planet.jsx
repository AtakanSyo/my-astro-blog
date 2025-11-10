import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import SimStage from '../lib/SimStage.jsx';
import { prepareScene } from '../lib/threeCore.js';
import {
  createAtmosphereShell,
  createBarycentricDisc,
  createEllipticalOrbit,
  createOrthoTopDownCamera,
  createStar,
  computeEllipticalPosition,
} from '../lib/starSystemCore.js';

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
  const coreHandleRef = useRef(null);
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
    const semiMajor = cfg.orbitSemiMajor;
    const semiMinor = semiMajor * Math.sqrt(1 - ecc * ecc);
    const focusOffset = Math.sqrt(Math.max(0, semiMajor * semiMajor - semiMinor * semiMinor));
    const planetRadius = Math.max(
      cfg.starRadius * 0.1,
      cfg.starRadius * cfg.planetScale * (system.radiusEarth ?? 1),
    );

    const frustumExtent = semiMajor + cfg.starRadius * 4;
    const core = prepareScene({
      canvas,
      container,
      background: cfg.backgroundColor,
      dprCap,
      alpha: true,
      antialias: true,
      cameraFactory: () =>
        createOrthoTopDownCamera({
          extent: () => frustumExtent,
          height: 40,
          margin: 1.2,
        }),
    });

    const { scene, start, stop, renderOnce, dispose: disposeCore } = core;

    const starEntry = createStar({
      radius: cfg.starRadius,
      color: cfg.starColor,
      intensity: cfg.starIntensity,
      glowStrength: 1.6,
    });
    scene.add(starEntry.mesh);
    const rimLight = new THREE.DirectionalLight(0x3f95ff, 0.6);
    rimLight.position.set(-10, 20, -10);
    scene.add(rimLight);

    const discEntry = createBarycentricDisc({
      inner: 0,
      outer: semiMajor + cfg.starRadius * 0.6,
      opacity: 0.06,
    });
    scene.add(discEntry.mesh);

    const planetOrbitEntry = createEllipticalOrbit({
      semiMajor,
      semiMinor,
      offsetX: -focusOffset,
      dashSize: 1,
      gapSize: 0.8,
      opacity: 0.6,
      segments: cfg.orbitSegments,
    });
    scene.add(planetOrbitEntry.line);

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
    const atmosphereEntry = createAtmosphereShell({
      radius: planetRadius * 1.04,
      color: cfg.atmosphereColor,
      opacity: 0.18,
    });
    planetMesh.add(atmosphereEntry.mesh);
    scene.add(planetMesh);

    const tiltRad = THREE.MathUtils.degToRad(system.tiltDegrees ?? 0);
    planetMesh.rotation.z = tiltRad;

    const rotationPeriodDays =
      system.rotationHours && system.rotationHours !== 0
        ? system.rotationHours / 24
        : 1;
    const rotationSpeed =
      (Math.PI * 2) / Math.abs(rotationPeriodDays || 1) * Math.sign(rotationPeriodDays);

    const planetState = {
      angle: 0,
      orbitSpeed: (Math.PI * 2) / system.orbitDays,
    };

    const updatePlanet = () => {
      const { x, z } = computeEllipticalPosition({
        angle: planetState.angle,
        semiMajor,
        semiMinor,
        focusOffset,
      });
      planetMesh.position.set(x, 0, z);
    };

    const tick = (delta) => {
      if (pausedRef.current) return;
      const dt = Math.min(delta ?? 0, 0.05);
      const deltaDays = dt * cfg.daysPerSecond;
      planetState.angle += planetState.orbitSpeed * deltaDays;
      planetMesh.rotation.y += rotationSpeed * deltaDays;
      updatePlanet();
    };

    updatePlanet();

    coreHandleRef.current = {
      api: core,
      tick,
      disposeTexture: () => texture?.dispose?.(),
    };
    if (pausedRef.current) {
      renderOnce();
    } else {
      start(tick);
    }

    return () => {
      stop();
      disposeCore();
      coreHandleRef.current?.disposeTexture?.();
      coreHandleRef.current = null;
      starEntry.dispose();
      discEntry.geometry.dispose();
      discEntry.material.dispose();
      scene.remove(discEntry.mesh);
      planetOrbitEntry.geometry.dispose();
      planetOrbitEntry.material.dispose();
      scene.remove(planetOrbitEntry.line);
      atmosphereEntry.geometry.dispose();
      atmosphereEntry.material.dispose();
      planetGeo.dispose();
      planetMat.dispose();
    };
  }, [dprCap, opts]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const handle = coreHandleRef.current;
    if (!handle) return;
    if (paused) {
      handle.api.stop();
      handle.api.renderOnce();
    } else {
      handle.api.start(handle.tick);
    }
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
