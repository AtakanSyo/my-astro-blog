import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import SimStage from '../lib/SimStage.jsx';

const EMPTY_OPTS = Object.freeze({});
const DEFAULT_SYSTEM = Object.freeze({
  stars: [
    {
      key: 'alpha',
      name: 'Alpha',
      radius: 1.1,
      color: 0xffd8a6,
      intensity: 180,
      orbitRadius: 5.5,
      orbitDays: 180,
      phaseOffset: 0,
      orbitShiftX: 0,
      orbitShiftZ: 3.5,
    },
    {
      key: 'beta',
      name: 'Beta',
      radius: 0.6,
      color: 0xaad3ff,
      intensity: 120,
      orbitRadius: 4.2,
      orbitDays: 260,
      phaseOffset: (Math.PI * 2) / 3,
      orbitShiftX: -4,
      orbitShiftZ: 0,
    },
    {
      key: 'gamma',
      name: 'Gamma',
      radius: 0.6,
      color: 0xff98c8,
      intensity: 100,
      orbitRadius: 5,
      orbitDays: 390,
      phaseOffset: ((Math.PI * 2) / 3) * 2,
      orbitShiftX: 0,
      orbitShiftZ: -3.5,
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

export default function TripleStarSystem({
  id = 'triple-star-system',
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

    const mergedStars = DEFAULT_SYSTEM.stars.map((star) => ({
      ...star,
      ...(opts.stars?.[star.key] ?? EMPTY_OPTS),
    }));

    const mergedPlanet = {
      ...DEFAULT_SYSTEM.planet,
      ...(opts.planet ?? EMPTY_OPTS),
    };

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

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-28, 28, 28, -28, 0.1, 300);
    camera.position.set(0, 56, 0);
    camera.lookAt(scene.position);

    if (cfg.ambientIntensity > 0) {
      scene.add(new THREE.AmbientLight(0xffffff, cfg.ambientIntensity));
    }

    const starGroup = new THREE.Group();
    scene.add(starGroup);

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

      const geo = new THREE.SphereGeometry(star.radius ?? 1.2, 48, 24);
      const mat = new THREE.MeshStandardMaterial({
        emissive: new THREE.Color(star.color ?? 0xffffff),
        emissiveIntensity: cfg.glowStrength,
        color: star.color ?? 0xffffff,
        roughness: 0.35,
        metalness: 0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const light = new THREE.PointLight(star.color ?? 0xffffff, star.intensity ?? 10, 0, 2);
      mesh.add(light);
      starGroup.add(mesh);

      const orbitGeo = new THREE.BufferGeometry();
      const segs = 160;
      const positions = new Float32Array(segs * 3);
      for (let i = 0; i < segs; i += 1) {
        const t = (i / segs) * Math.PI * 2;
        const cosT = Math.cos(t);
        const sinT = Math.sin(t);
        positions[i * 3] = cosT * orbitRadius + orbitShift.x;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = sinT * orbitRadius + orbitShift.z;
      }
      orbitGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const orbitMat = new THREE.LineDashedMaterial({
        color: 0xffffff,
        dashSize: 0.8,
        gapSize: 0.6,
        transparent: true,
        opacity: 0.4,
      });
      const orbitLoop = new THREE.LineLoop(orbitGeo, orbitMat);
      orbitLoop.computeLineDistances();
      scene.add(orbitLoop);

      return {
        key: star.key,
        mesh,
        geo,
        mat,
        orbitGeo,
        orbitMat,
        orbitRadius,
        orbitShift,
        angularSpeed,
        angle: phaseOffset,
        phaseOffset,
      };
    });

    const orbitRadii = starData.map((s) => s.orbitRadius);
    const discInner = Math.max(0.2, Math.min(...orbitRadii) * 0.35);
    const discOuter = Math.max(discInner + 0.1, Math.max(...orbitRadii) * cfg.baryDiscThickness);
    const baryDiscGeo = new THREE.RingGeometry(0.001, discOuter, 128, 1);
    const baryDiscMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: THREE.MathUtils.clamp(cfg.baryDiscOpacity, 0, 1),
      side: THREE.DoubleSide,
    });
    const baryDisc = new THREE.Mesh(baryDiscGeo, baryDiscMat);
    baryDisc.rotation.x = Math.PI / 2;
    scene.add(baryDisc);

    const orbitAnchor = new THREE.Object3D();
    scene.add(orbitAnchor);

    const hostIndex =
      starData.findIndex((star) => star.key === mergedPlanet.hostKey) !== -1
        ? starData.findIndex((star) => star.key === mergedPlanet.hostKey)
        : 0;
    const hostStar = starData[hostIndex];

    const planetSemiMajor =
      opts.orbitSemiMajor ?? mergedPlanet.semiMajor ?? DEFAULT_SYSTEM.planet.semiMajor;
    const planetEcc = THREE.MathUtils.clamp(
      opts.orbitEccentricity ?? mergedPlanet.eccentricity ?? DEFAULT_SYSTEM.planet.eccentricity ?? 0,
      0,
      0.85,
    );
    const semiMajor = Math.max(0.5, planetSemiMajor);
    const semiMinor = semiMajor * Math.sqrt(1 - planetEcc * planetEcc);
    const planetFocus = Math.sqrt(Math.max(0, semiMajor * semiMajor - semiMinor * semiMinor));
    const planetRadius = Math.max(
      hostStar?.mesh?.geometry?.parameters?.radius ?? 1,
      (hostStar?.mesh?.geometry?.parameters?.radius ?? 1) * cfg.planetScale * (mergedPlanet.radiusEarth ?? 1),
    );

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
      dashSize: 1,
      gapSize: 0.8,
      transparent: true,
      opacity: 0.65,
    });
    const planetOrbit = new THREE.LineLoop(planetOrbitGeo, planetOrbitMat);
    planetOrbit.computeLineDistances();
    orbitAnchor.add(planetOrbit);

    const planetGeo = new THREE.SphereGeometry(planetRadius, 64, 32);
    const planetMat = new THREE.MeshStandardMaterial({
      color: cfg.planetColor,
      roughness: 0.5,
      metalness: 0.08,
    });
    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    const atmoGeo = new THREE.SphereGeometry(planetRadius * 1.04, 32, 16);
    const atmoMat = new THREE.MeshBasicMaterial({
      color: cfg.atmosphereColor,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    planetMesh.add(atmoMesh);
    scene.add(planetMesh);

    planetMesh.rotation.z = THREE.MathUtils.degToRad(mergedPlanet.tiltDegrees ?? 0);

    const rotationPeriodDays =
      mergedPlanet.rotationHours && mergedPlanet.rotationHours !== 0
        ? mergedPlanet.rotationHours / 24
        : 1;
    const rotationSpeed =
      ((Math.PI * 2) / Math.abs(rotationPeriodDays || 1)) * Math.sign(rotationPeriodDays || 1);
    const planetAngularSpeed = (Math.PI * 2) / Math.max(1, mergedPlanet.orbitDays ?? 200);

    const fit = () => {
      const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
      renderer.setPixelRatio(dpr);
      const width = Math.max(1, container.clientWidth | 0);
      const height = Math.max(1, container.clientHeight | 0);
      renderer.setSize(width, height, false);

      const maxOrbit = Math.max(...orbitRadii, semiMajor);
      const frustumSize = maxOrbit * 2.2;
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

    const state = {
      starAngles: starData.map((star) => star.phaseOffset ?? 0),
      planetAngle: 0,
    };
    const clock = new THREE.Clock();
    let rafId = 0;

    const updateTransforms = () => {
      starData.forEach((star, idx) => {
        const angle = state.starAngles[idx];
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        star.mesh.position.set(
          cosA * star.orbitRadius + star.orbitShift.x,
          0,
          sinA * star.orbitRadius + star.orbitShift.z,
        );
      });

      const hostPos = hostStar?.mesh?.position ?? new THREE.Vector3();
      orbitAnchor.position.copy(hostPos);

      const cosP = Math.cos(state.planetAngle);
      const sinP = Math.sin(state.planetAngle);
      const px = cosP * semiMajor - planetFocus;
      const pz = sinP * semiMinor;
      planetMesh.position.set(hostPos.x + px, 0, hostPos.z + pz);
    };

    const loop = () => {
      const rawDt = clock.getDelta();
      const dt = pausedRef.current ? 0 : Math.min(rawDt, 0.05);
      const deltaDays = dt * cfg.daysPerSecond;

      if (dt > 0) {
        starData.forEach((star, idx) => {
          state.starAngles[idx] += star.angularSpeed * deltaDays;
        });
        state.planetAngle += planetAngularSpeed * deltaDays;
        planetMesh.rotation.y += rotationSpeed * deltaDays;
      }

      updateTransforms();
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(loop);
    };

    updateTransforms();
    clock.start();
    rafId = requestAnimationFrame(loop);

    return () => {
      try {
        ro?.disconnect();
      } catch {}
      window.removeEventListener('resize', fit);
      if (rafId) cancelAnimationFrame(rafId);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.isMesh || obj.type === 'LineLoop') {
          obj.geometry?.dispose?.();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((mat) => mat?.dispose?.());
          } else {
            obj.material?.dispose?.();
          }
        }
      });
      starData.forEach((star) => {
        star.geo.dispose();
        star.mat.dispose();
        star.orbitGeo.dispose();
        star.orbitMat.dispose();
      });
      baryDiscGeo.dispose();
      baryDiscMat.dispose();
      planetOrbitGeo.dispose();
      planetOrbitMat.dispose();
      planetGeo.dispose();
      planetMat.dispose();
      atmoGeo.dispose();
      atmoMat.dispose();
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
