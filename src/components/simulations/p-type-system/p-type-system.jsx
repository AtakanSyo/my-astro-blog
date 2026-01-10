import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import SimStage from '../lib/simStage.jsx';
import { prepareScene } from '../lib/threeCore.js';
import {
  createAtmosphereShell,
  createBarycentricDisc,
  createEllipticalOrbit,
  createOrbitRing,
  createOrthoTopDownCamera,
  createStar,
  computeBinaryPositions,
  computeEllipticalPosition,
} from '../lib/starSystemCore.js';

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
  const coreHandleRef = useRef(null);
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
      ambientIntensity: opts.ambientIntensity ?? 0.15,
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

    const frustumExtent =
      semiMajor + sep * 1.5 + Math.max(cfg.starARadius, cfg.starBRadius) * 2;

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
          height: 60,
          margin: 1.2,
          up: [0, 0, -1],
        }),
    });

    const { scene, start, stop, renderOnce, dispose: disposeCore } = core;

    if (cfg.ambientIntensity > 0) {
      const ambient = new THREE.AmbientLight(0xffffff, cfg.ambientIntensity);
      scene.add(ambient);
    }

    const starAEntry = createStar({
      radius: cfg.starARadius,
      color: merged.starA.color,
      intensity: merged.starA.intensity ?? 12,
      glowStrength: cfg.glowStrength,
    });
    const starBEntry = createStar({
      radius: cfg.starBRadius,
      color: merged.starB.color,
      intensity: merged.starB.intensity ?? 12,
      glowStrength: cfg.glowStrength,
    });
    scene.add(starAEntry.mesh);
    scene.add(starBEntry.mesh);

    const orbitAEntry = createOrbitRing({
      radius: radiusA,
      dashSize: 0.8,
      gapSize: 0.5,
      opacity: 0.35,
    });
    const orbitBEntry = createOrbitRing({
      radius: radiusB,
      dashSize: 0.8,
      gapSize: 0.5,
      opacity: 0.35,
    });
    scene.add(orbitAEntry.line);
    scene.add(orbitBEntry.line);

    const diskEntry = createBarycentricDisc({ outer: semiMajor + 2, opacity: 0.07 });
    scene.add(diskEntry.mesh);

    // Planet orbit path
    const planetOrbitEntry = createEllipticalOrbit({
      semiMajor,
      semiMinor,
      offsetX: -planetFocus,
      dashed: true,
      dashSize: 1.2,
      gapSize: 0.8,
      opacity: 0.7,
      segments: cfg.orbitSegments,
    });
    scene.add(planetOrbitEntry.line);

    // Planet mesh
    const planetGeo = new THREE.SphereGeometry(planetRadius, 64, 32);
    const planetMat = new THREE.MeshStandardMaterial({
      color: cfg.planetColor,
      roughness: 0.55,
      metalness: 0.08,
    });
    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    const atmosphereEntry = createAtmosphereShell({
      radius: planetRadius * 1.06,
      color: cfg.atmosphereColor,
      opacity: 0.2,
    });
    planetMesh.add(atmosphereEntry.mesh);
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

    const state = {
      binaryAngle: 0,
      planetAngle: 0,
    };

    const updateTransforms = () => {
      const { starA: posA, starB: posB } = computeBinaryPositions({
        angle: state.binaryAngle,
        radiusA,
        radiusB,
      });
      starAEntry.mesh.position.copy(posA);
      starBEntry.mesh.position.copy(posB);

      const planetPos = computeEllipticalPosition({
        angle: state.planetAngle,
        semiMajor,
        semiMinor,
        focusOffset: planetFocus,
      });
      planetMesh.position.set(planetPos.x, 0, planetPos.z);
    };

    updateTransforms();

    const tick = (delta) => {
      if (pausedRef.current) return;
      const dt = Math.min(delta ?? 0, 0.05);
      const deltaDays = dt * cfg.daysPerSecond;

      state.binaryAngle += binaryAngularSpeed * deltaDays;
      state.planetAngle += planetAngularSpeed * deltaDays;

      planetMesh.rotation.y += rotationSpeed * deltaDays;
      updateTransforms();
    };

    coreHandleRef.current = { api: core, tick };

    if (pausedRef.current) {
      renderOnce();
    } else {
      start(tick);
    }

    return () => {
      stop();
      disposeCore();
      coreHandleRef.current = null;
      atmosphereEntry.geometry.dispose();
      atmosphereEntry.material.dispose();
      scene.remove(starAEntry.mesh);
      scene.remove(starBEntry.mesh);
      starAEntry.dispose();
      starBEntry.dispose();
      orbitAEntry.geometry.dispose();
      orbitAEntry.material.dispose();
      orbitBEntry.geometry.dispose();
      orbitBEntry.material.dispose();
      planetOrbitEntry.geometry.dispose();
      planetOrbitEntry.material.dispose();
      diskEntry.geometry.dispose();
      diskEntry.material.dispose();
      scene.remove(orbitAEntry.line);
      scene.remove(orbitBEntry.line);
      scene.remove(planetOrbitEntry.line);
      scene.remove(diskEntry.mesh);
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
