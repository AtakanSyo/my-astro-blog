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
const DEFAULT_SYSTEM = Object.freeze({
  primary: {
    name: 'Aster',
    radius: 0.5,
    color: 0xffe0b0,
    intensity: 120,
    mass: 1,
    orbitRadius: 1.7,
  },
  companion: {
    name: 'Umbra',
    radius: 0.8,
    color: 0x9fc7ff,
    intensity: 240,
    mass: 0.5,
    separation: 10,
    orbitDays: 120,
    orbitRadius: 3.2,
  },
  planet: {
    name: 'Solace',
    orbiting: 'primary',
    semiMajor: 12,
    eccentricity: 0.05,
    orbitDays: 240,
    radiusEarth: 1.1,
    rotationHours: 26,
    tiltDegrees: 14,
    color: 0xff3a3b,
  },
});

export default function STypeSystem({
  id = 's-type-system',
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
      primary: { ...DEFAULT_SYSTEM.primary, ...(opts.primary ?? EMPTY_OPTS) },
      companion: { ...DEFAULT_SYSTEM.companion, ...(opts.companion ?? EMPTY_OPTS) },
      planet: { ...DEFAULT_SYSTEM.planet, ...(opts.planet ?? EMPTY_OPTS) },
    };

    const baseSeparation = Math.max(
      2,
      opts.separation ?? merged.companion.separation ?? DEFAULT_SYSTEM.companion.separation,
    );

    const cfg = {
      backgroundColor: opts.backgroundColor ?? 0x020308,
      daysPerSecond: opts.daysPerSecond ?? 5,
      orbitSegments: opts.orbitSegments ?? 256,
      planetScale: opts.planetScale ?? 2.0,
      atmosphereColor: opts.atmosphereColor ?? 0x73d2ff,
      glowStrength: opts.glowStrength ?? 1.8,
      ambientIntensity: opts.ambientIntensity ?? 0.2,
      planetColor: opts.planetColor ?? merged.planet.color ?? 0x4fb3ff,
      primaryRadius: opts.primaryRadius ?? merged.primary.radius ?? 2.1,
      companionRadius: opts.companionRadius ?? merged.companion.radius ?? 1.4,
      primaryOrbitShift: opts.primaryOrbitShift ?? baseSeparation * 0.15,
      companionOrbitShift: opts.companionOrbitShift ?? baseSeparation * 0.15,
      baryDiscThickness: opts.baryDiscThickness ?? 1.2,
      baryDiscOpacity: opts.baryDiscOpacity ?? 0.05,
    };

    const totalMass = Math.max(
      1e-6,
      (merged.primary.mass ?? 1) + (merged.companion.mass ?? 1),
    );
    const primaryOrbitRadius =
      opts.primaryOrbitRadius ??
      merged.primary.orbitRadius ??
      Math.max(0.5, (baseSeparation * (merged.companion.mass ?? 1)) / totalMass);
    const companionOrbitRadius =
      opts.companionOrbitRadius ??
      merged.companion.orbitRadius ??
      Math.max(0.5, (baseSeparation * (merged.primary.mass ?? 1)) / totalMass);
    const primaryShift = cfg.primaryOrbitShift;
    const companionShift = -cfg.companionOrbitShift;
    const companionOrbitDays = merged.companion.orbitDays ?? DEFAULT_SYSTEM.companion.orbitDays;

    const planetSemiMajor =
      opts.orbitSemiMajor ?? merged.planet.semiMajor ?? DEFAULT_SYSTEM.planet.semiMajor;
    const planetEcc = THREE.MathUtils.clamp(
      opts.orbitEccentricity ?? merged.planet.eccentricity ?? DEFAULT_SYSTEM.planet.eccentricity ?? 0,
      0,
      0.85,
    );
    const semiMajor = Math.max(baseSeparation * 0.4, planetSemiMajor);
    const semiMinor = semiMajor * Math.sqrt(1 - planetEcc * planetEcc);
    const planetFocus = Math.sqrt(Math.max(0, semiMajor * semiMajor - semiMinor * semiMinor));
    const planetRadius = Math.max(
      cfg.primaryRadius * 0.1,
      cfg.primaryRadius * cfg.planetScale * (merged.planet.radiusEarth ?? 1),
    );

    const frustumExtent =
      primaryOrbitRadius + companionOrbitRadius + semiMajor + Math.abs(primaryShift) + Math.abs(companionShift);

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
          height: 48,
          margin: 1.05,
        }),
    });

    const { scene, start, stop, renderOnce, dispose: disposeCore } = core;

    if (cfg.ambientIntensity > 0) {
      const ambient = new THREE.AmbientLight(0xffffff, cfg.ambientIntensity);
      scene.add(ambient);
    }

    const primaryStarEntry = createStar({
      radius: cfg.primaryRadius,
      color: merged.primary.color,
      intensity: merged.primary.intensity ?? 18,
      glowStrength: cfg.glowStrength,
    });
    const companionStarEntry = createStar({
      radius: cfg.companionRadius,
      color: merged.companion.color,
      intensity: merged.companion.intensity ?? 12,
      glowStrength: cfg.glowStrength,
    });
    scene.add(primaryStarEntry.mesh);
    scene.add(companionStarEntry.mesh);

    const companionOrbitEntry = createOrbitRing({
      radius: companionOrbitRadius,
      dashSize: 0.8,
      gapSize: 0.5,
      opacity: 0.4,
    });
    companionOrbitEntry.line.position.x = companionShift;
    scene.add(companionOrbitEntry.line);

    const primaryOrbitEntry = createOrbitRing({
      radius: primaryOrbitRadius,
      dashSize: 0.8,
      gapSize: 0.5,
      opacity: 0.4,
    });
    primaryOrbitEntry.line.position.x = primaryShift;
    scene.add(primaryOrbitEntry.line);

    // Shared barycentric disc
    const discEntry = createBarycentricDisc({
      inner: 0,
      outer: Math.max(primaryOrbitRadius, companionOrbitRadius) * cfg.baryDiscThickness,
      opacity: cfg.baryDiscOpacity,
    });
    scene.add(discEntry.mesh);


    const planetOrbitEntry = createEllipticalOrbit({
      semiMajor,
      semiMinor,
      offsetX: -planetFocus,
      dashed: true,
      dashSize: 1,
      gapSize: 0.8,
      opacity: 0.7,
      segments: cfg.orbitSegments,
    });
    const planetOrbitAnchor = new THREE.Object3D();
    planetOrbitAnchor.add(planetOrbitEntry.line);
    scene.add(planetOrbitAnchor);

    // Planet mesh
    const planetGeo = new THREE.SphereGeometry(planetRadius, 64, 32);
    const planetMat = new THREE.MeshStandardMaterial({
      color: cfg.planetColor,
      roughness: 0.55,
      metalness: 0.1,
    });
    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    const atmosphereEntry = createAtmosphereShell({
      radius: planetRadius * 1.04,
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

    const binaryAngularSpeed = (Math.PI * 2) / (companionOrbitDays || 1);
    const planetAngularSpeed = (Math.PI * 2) / (merged.planet.orbitDays || 1);

    const state = {
      binaryAngle: 0,
      planetAngle: 0,
    };

    const applyTransforms = () => {
      const { starA: posPrimary, starB: posCompanion } = computeBinaryPositions({
        angle: state.binaryAngle,
        radiusA: primaryOrbitRadius,
        radiusB: companionOrbitRadius,
      });
      primaryStarEntry.mesh.position.set(posPrimary.x + primaryShift, posPrimary.y, posPrimary.z);
      companionStarEntry.mesh.position.set(posCompanion.x + companionShift, posCompanion.y, posCompanion.z);
      planetOrbitAnchor.position.copy(primaryStarEntry.mesh.position);

      const planetPos = computeEllipticalPosition({
        angle: state.planetAngle,
        semiMajor,
        semiMinor,
        focusOffset: planetFocus,
      });
      planetMesh.position.set(
        primaryStarEntry.mesh.position.x + planetPos.x,
        0,
        primaryStarEntry.mesh.position.z + planetPos.z,
      );
    };

    const tick = (delta) => {
      if (pausedRef.current) return;
      const dt = Math.min(delta ?? 0, 0.05);
      const deltaDays = dt * cfg.daysPerSecond;
      state.binaryAngle += binaryAngularSpeed * deltaDays;
      state.planetAngle += planetAngularSpeed * deltaDays;
      planetMesh.rotation.y += rotationSpeed * deltaDays;
      applyTransforms();
    };

    applyTransforms();

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
      scene.remove(atmosphereEntry.mesh);
      atmosphereEntry.geometry.dispose();
      atmosphereEntry.material.dispose();
      scene.remove(primaryStarEntry.mesh);
      scene.remove(companionStarEntry.mesh);
      primaryStarEntry.dispose();
      companionStarEntry.dispose();
      companionOrbitEntry.geometry.dispose();
      companionOrbitEntry.material.dispose();
      primaryOrbitEntry.geometry.dispose();
      primaryOrbitEntry.material.dispose();
      scene.remove(companionOrbitEntry.line);
      scene.remove(primaryOrbitEntry.line);
      scene.remove(planetOrbitAnchor);
      planetOrbitEntry.geometry.dispose();
      planetOrbitEntry.material.dispose();
      scene.remove(planetOrbitEntry.line);
      diskEntry.geometry.dispose();
      diskEntry.material.dispose();
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
