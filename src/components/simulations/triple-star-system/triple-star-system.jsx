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
  stars: [
    {
      key: 'alpha',
      name: 'Alpha',
      radius: 1.1,
      color: 0xffd8a6,
      intensity: 180,
      orbitRadius: 4,
      orbitDays: 180,
      phaseOffset: 0,
      orbitShiftX: 0,
      orbitShiftZ: 3,
    },
    {
      key: 'beta',
      name: 'Beta',
      radius: 0.6,
      color: 0xaad3ff,
      intensity: 120,
      orbitRadius: 2.1,
      orbitDays: 260,
      phaseOffset: (Math.PI * 2) / 3,
      orbitShiftX: -1.5,
      orbitShiftZ: 0,
    },
    {
      key: 'gamma',
      name: 'Gamma',
      radius: 0.6,
      color: 0xff98c8,
      intensity: 100,
      orbitRadius: 4,
      orbitDays: 390,
      phaseOffset: ((Math.PI * 2) / 3) * 2,
      orbitShiftX: 0,
      orbitShiftZ: -2,
    },
  ],
  planet: {
    name: 'Trillia',
    hostKey: 'alpha',
    semiMajor: 9,
    eccentricity: 0.08,
    orbitDays: 210,
    rotationHours: 30,
    tiltDegrees: 19,
    radiusEarth: 1.15,
    color: 0xff3a3b,
  },
});

const CAMERA_DEFAULTS = Object.freeze({
  height: 100,
  up: [0, 0, -1],
  lookAt: [0, 0, 0],
  margin: 1.05,
});

export default function TripleStarSystem({
  id = 'triple-star-system',
  aspect = '3 / 2',
  showPause = true,
  showPlanet = true,
  cameraDistance = 1,
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

    const mergedStars = DEFAULT_SYSTEM.stars.map((star) => ({
      ...star,
      ...(opts.stars?.[star.key] ?? EMPTY_OPTS),
    }));

    const mergedPlanet = {
      ...DEFAULT_SYSTEM.planet,
      ...(opts.planet ?? EMPTY_OPTS),
    };

    const planetEnabled = (opts.showPlanet ?? showPlanet) !== false;

    const cfg = {
      backgroundColor: opts.backgroundColor ?? 0x010207,
      daysPerSecond: opts.daysPerSecond ?? 5,
      orbitSegments: opts.orbitSegments ?? 256,
      planetScale: opts.planetScale ?? 0.9,
      glowStrength: opts.glowStrength ?? 1.8,
      ambientIntensity: opts.ambientIntensity ?? 0.5,
      planetColor: opts.planetColor ?? mergedPlanet.color ?? 0x62dce7,
      atmosphereColor: opts.atmosphereColor ?? 0x7ce7ff,
      baryDiscThickness: opts.baryDiscThickness ?? 1.15,
      baryDiscOpacity: opts.baryDiscOpacity ?? 0.05,
    };

    const distanceFactorRaw = opts.cameraDistance ?? cameraDistance ?? 1;
    const distanceFactor = Number.isFinite(distanceFactorRaw) ? Math.max(0.25, distanceFactorRaw) : 1;

    const largestOrbit = Math.max(...mergedStars.map((star) => star.orbitRadius ?? 1));
    const frustumExtent = largestOrbit * cfg.baryDiscThickness * 1.4 + 10;

    const core = prepareScene({
      canvas,
      container,
      background: cfg.backgroundColor,
      dprCap,
      alpha: true,
      antialias: true,
      cameraFactory: () =>
        createOrthoTopDownCamera({
          extent: () => frustumExtent * distanceFactor,
          height: CAMERA_DEFAULTS.height,
          margin: CAMERA_DEFAULTS.margin,
          up: CAMERA_DEFAULTS.up,
          lookAt: CAMERA_DEFAULTS.lookAt,
        }),
    });

    const { scene, start, stop, renderOnce, dispose: disposeCore } = core;

    if (cfg.ambientIntensity > 0) {
      scene.add(new THREE.AmbientLight(0xffffff, cfg.ambientIntensity));
    }

    const starData = mergedStars.map((star) => {
      const orbitRadius =
        opts.starOrbitRadii?.[star.key] ??
        star.orbitRadius ??
        THREE.MathUtils.clamp(star.orbitRadius ?? 6, 0.5, 60);
      const orbitShiftConfig = opts.starOrbitShifts?.[star.key] ?? {};
      const orbitShift = {
        x: orbitShiftConfig.x ?? star.orbitShiftX ?? 0,
        z: orbitShiftConfig.z ?? star.orbitShiftZ ?? 0,
      };
      const phaseOffset = star.phaseOffset ?? 0;
      const angularSpeed = (Math.PI * 2) / Math.max(1, star.orbitDays ?? 240);

      const starEntry = createStar({
        radius: star.radius ?? 1.2,
        color: star.color,
        intensity: star.intensity ?? 12,
        glowStrength: cfg.glowStrength,
      });
      scene.add(starEntry.mesh);

      const orbitEntry = createOrbitRing({
        radius: orbitRadius,
        dashSize: 0.8,
        gapSize: 0.6,
        opacity: 0.4,
      });
      orbitEntry.line.position.set(orbitShift.x, 0, orbitShift.z);
      scene.add(orbitEntry.line);

      return {
        key: star.key,
        entry: starEntry,
        orbitEntry,
        orbitRadius,
        orbitShift,
        angularSpeed,
        angle: phaseOffset,
      };
    });

    const orbitRadii = starData.map((s) => s.orbitRadius);
    const discEntry = createBarycentricDisc({
      inner: 0,
      outer: Math.max(...orbitRadii) * cfg.baryDiscThickness,
      opacity: cfg.baryDiscOpacity,
    });
    scene.add(discEntry.mesh);

    const orbitAnchor = new THREE.Object3D();
    scene.add(orbitAnchor);

    const hostIndex =
      starData.findIndex((star) => star.key === mergedPlanet.hostKey) !== -1
        ? starData.findIndex((star) => star.key === mergedPlanet.hostKey)
        : 0;
    const hostStar = starData[hostIndex];

    let planetOrbitEntry = null;
    let planetGeo = null;
    let planetMat = null;
    let planetMesh = null;
    let atmosphereEntry = null;
    let semiMajor = 0;
    let semiMinor = 0;
    let planetFocus = 0;
    let rotationSpeed = 0;
    let planetAngularSpeed = 0;

    if (planetEnabled) {
      const planetSemiMajor =
        opts.orbitSemiMajor ?? mergedPlanet.semiMajor ?? DEFAULT_SYSTEM.planet.semiMajor;
      const planetEcc = THREE.MathUtils.clamp(
        opts.orbitEccentricity ?? mergedPlanet.eccentricity ?? DEFAULT_SYSTEM.planet.eccentricity ?? 0,
        0,
        0.85,
      );
      semiMajor = Math.max(0.5, planetSemiMajor);
      semiMinor = semiMajor * Math.sqrt(1 - planetEcc * planetEcc);
      planetFocus = Math.sqrt(Math.max(0, semiMajor * semiMajor - semiMinor * semiMinor));
      const planetRadius = Math.max(
        hostStar?.mesh?.geometry?.parameters?.radius ?? 1,
        (hostStar?.mesh?.geometry?.parameters?.radius ?? 1) * cfg.planetScale * (mergedPlanet.radiusEarth ?? 1),
      );

      planetOrbitEntry = createEllipticalOrbit({
        semiMajor,
        semiMinor,
        offsetX: -planetFocus,
        dashSize: 1,
        gapSize: 0.8,
        opacity: 0.65,
        segments: cfg.orbitSegments,
      });
      orbitAnchor.add(planetOrbitEntry.line);

      planetGeo = new THREE.SphereGeometry(planetRadius, 64, 32);
      planetMat = new THREE.MeshStandardMaterial({
        color: cfg.planetColor,
        roughness: 0.5,
        metalness: 0.08,
      });
      planetMesh = new THREE.Mesh(planetGeo, planetMat);
      atmosphereEntry = createAtmosphereShell({
        radius: planetRadius * 1.04,
        color: cfg.atmosphereColor,
        opacity: 0.18,
      });
      planetMesh.add(atmosphereEntry.mesh);
      scene.add(planetMesh);

      planetMesh.rotation.z = THREE.MathUtils.degToRad(mergedPlanet.tiltDegrees ?? 0);

      const rotationPeriodDays =
        mergedPlanet.rotationHours && mergedPlanet.rotationHours !== 0
          ? mergedPlanet.rotationHours / 24
          : 1;
      rotationSpeed =
        ((Math.PI * 2) / Math.abs(rotationPeriodDays || 1)) * Math.sign(rotationPeriodDays || 1);
      planetAngularSpeed = (Math.PI * 2) / Math.max(1, mergedPlanet.orbitDays ?? 200);
    }

    const state = {
      starAngles: starData.map((star) => star.angle ?? 0),
      planetAngle: 0,
    };

    const updateTransforms = () => {
      starData.forEach((star, idx) => {
        const angle = state.starAngles[idx];
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        star.entry.mesh.position.set(
          cosA * star.orbitRadius + star.orbitShift.x,
          0,
          sinA * star.orbitRadius + star.orbitShift.z,
        );
      });

      const hostMesh = starData.find((star) => star.key === mergedPlanet.hostKey)?.entry.mesh ?? starData[0].entry.mesh;
      const hostPos = hostMesh.position;
      orbitAnchor.position.copy(hostPos);

      if (planetMesh) {
        const planetPos = computeEllipticalPosition({
          angle: state.planetAngle,
          semiMajor,
          semiMinor,
          focusOffset: planetFocus,
        });
        planetMesh.position.set(hostPos.x + planetPos.x, 0, hostPos.z + planetPos.z);
      }
    };

    const tick = (delta) => {
      if (pausedRef.current) return;
      const dt = Math.min(delta ?? 0, 0.05);
      const deltaDays = dt * cfg.daysPerSecond;
      starData.forEach((star, idx) => {
        state.starAngles[idx] += star.angularSpeed * deltaDays;
      });
      if (planetMesh) {
        state.planetAngle += planetAngularSpeed * deltaDays;
        planetMesh.rotation.y += rotationSpeed * deltaDays;
      }
      updateTransforms();
	   };

    updateTransforms();

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
      if (atmosphereEntry) {
        atmosphereEntry.geometry.dispose();
        atmosphereEntry.material.dispose();
      }
      starData.forEach((star) => {
        scene.remove(star.entry.mesh);
        star.entry.dispose();
        star.orbitEntry.geometry.dispose();
        star.orbitEntry.material.dispose();
        scene.remove(star.orbitEntry.line);
      });
      discEntry.geometry.dispose();
      discEntry.material.dispose();
      scene.remove(discEntry.mesh);
      scene.remove(orbitAnchor);
      if (planetOrbitEntry) {
        planetOrbitEntry.geometry.dispose();
        planetOrbitEntry.material.dispose();
        scene.remove(planetOrbitEntry.line);
      }
      if (planetGeo) planetGeo.dispose();
      if (planetMat) planetMat.dispose();
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
