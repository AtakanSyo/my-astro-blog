import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import SimStage from '../lib/SimStage.jsx';

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
      ambientIntensity: opts.ambientIntensity ?? 0.05,
      planetColor: opts.planetColor ?? merged.planet.color ?? 0x4fb3ff,
      primaryRadius: opts.primaryRadius ?? merged.primary.radius ?? 2.1,
      companionRadius: opts.companionRadius ?? merged.companion.radius ?? 1.4,
      primaryOrbitShift: opts.primaryOrbitShift ?? baseSeparation * 0.15,
      companionOrbitShift: opts.companionOrbitShift ?? baseSeparation * 0.15,
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
    const camera = new THREE.OrthographicCamera(-24, 24, 24, -24, 0.1, 200);
    camera.position.set(0, 48, 0);
    camera.lookAt(scene.position);

    if (cfg.ambientIntensity > 0) {
      const ambient = new THREE.AmbientLight(0xffffff, cfg.ambientIntensity);
      scene.add(ambient);
    }

    // ---------- Stars ----------
    const starGroup = new THREE.Group();
    scene.add(starGroup);

    const createStar = ({ color, intensity }, radius, initialPosition = new THREE.Vector3()) => {
      const geo = new THREE.SphereGeometry(radius, 48, 24);
      const mat = new THREE.MeshStandardMaterial({
        emissive: new THREE.Color(color ?? 0xffffff),
        emissiveIntensity: cfg.glowStrength,
        color: color ?? 0xffffff,
        roughness: 0.35,
        metalness: 0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(initialPosition);
      const light = new THREE.PointLight(color ?? 0xffffff, intensity ?? 10, 0, 2);
      mesh.add(light);
      starGroup.add(mesh);
      return { mesh };
    };

    const primaryStar = createStar(merged.primary, cfg.primaryRadius);
    const companionStar = createStar(merged.companion, cfg.companionRadius);

    const buildShiftedOrbit = (radius, shift, invertPhase = 1) => {
      const geo = new THREE.BufferGeometry();
      const segs = 160;
      const positions = new Float32Array(segs * 3);
      for (let i = 0; i < segs; i += 1) {
        const t = (i / segs) * Math.PI * 2;
        const cosT = Math.cos(t);
        const sinT = Math.sin(t);
        const x = invertPhase * cosT * radius + shift;
        const z = invertPhase * sinT * radius;
        positions[i * 3] = x;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = z;
      }
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      return geo;
    };

    const compOrbitGeo = buildShiftedOrbit(companionOrbitRadius, companionShift, -1);
    const compOrbitMat = new THREE.LineDashedMaterial({
      color: 0xffffff,
      dashSize: 0.8,
      gapSize: 0.5,
      transparent: true,
      opacity: 0.4,
    });
    const companionOrbit = new THREE.LineLoop(compOrbitGeo, compOrbitMat);
    companionOrbit.computeLineDistances();
    scene.add(companionOrbit);

    const primaryOrbitGeo = buildShiftedOrbit(primaryOrbitRadius, primaryShift, 1);
    const primaryOrbitMat = compOrbitMat.clone();
    const primaryOrbit = new THREE.LineLoop(primaryOrbitGeo, primaryOrbitMat);
    primaryOrbit.computeLineDistances();
    scene.add(primaryOrbit);

    // Planet orbit path around the primary
    const orbitPositions = new Float32Array(cfg.orbitSegments * 3);
    for (let i = 0; i < cfg.orbitSegments; i += 1) {
      const t = (i / cfg.orbitSegments) * Math.PI * 2;
      orbitPositions[i * 3] = Math.cos(t) * semiMajor - planetFocus;
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
      opacity: 0.7,
    });
    const planetOrbit = new THREE.LineLoop(orbitGeo, orbitMat);
    planetOrbit.computeLineDistances();
    const planetOrbitAnchor = new THREE.Object3D();
    planetOrbitAnchor.add(planetOrbit);
    scene.add(planetOrbitAnchor);

    // Planet mesh
    const planetGeo = new THREE.SphereGeometry(planetRadius, 64, 32);
    const planetMat = new THREE.MeshStandardMaterial({
      color: cfg.planetColor,
      roughness: 0.55,
      metalness: 0.1,
    });
    const planetMesh = new THREE.Mesh(planetGeo, planetMat);
    const atmoGeo = new THREE.SphereGeometry(planetRadius * 1.04, 32, 16);
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

    const binaryAngularSpeed = (Math.PI * 2) / (companionOrbitDays || 1);
    const planetAngularSpeed = (Math.PI * 2) / (merged.planet.orbitDays || 1);

    const fit = () => {
      const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
      renderer.setPixelRatio(dpr);
      const width = Math.max(1, container.clientWidth | 0);
      const height = Math.max(1, container.clientHeight | 0);
      renderer.setSize(width, height, false);

      const maxDistance =
        baseSeparation + semiMajor + Math.abs(primaryShift) + Math.abs(companionShift);
      const frustumSize = maxDistance * 0.8;
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

    const applyBodyTransforms = () => {
      const cosB = Math.cos(state.binaryAngle);
      const sinB = Math.sin(state.binaryAngle);
      primaryStar.mesh.position.set(
        cosB * primaryOrbitRadius + primaryShift,
        0,
        sinB * primaryOrbitRadius,
      );
      const cosOpp = Math.cos(state.binaryAngle + Math.PI);
      const sinOpp = Math.sin(state.binaryAngle + Math.PI);
      companionStar.mesh.position.set(
        cosOpp * companionOrbitRadius + companionShift,
        0,
        sinOpp * companionOrbitRadius,
      );
      planetOrbitAnchor.position.copy(primaryStar.mesh.position);

      const cosP = Math.cos(state.planetAngle);
      const sinP = Math.sin(state.planetAngle);
      const px = cosP * semiMajor - planetFocus;
      const pz = sinP * semiMinor;
      planetMesh.position.set(
        primaryStar.mesh.position.x + px,
        0,
        primaryStar.mesh.position.z + pz,
      );
    };

    const loop = () => {
      const rawDt = clock.getDelta();
      const dt = pausedRef.current ? 0 : Math.min(rawDt, 0.05);
      const deltaDays = dt * cfg.daysPerSecond;

      if (dt > 0) {
        state.binaryAngle += binaryAngularSpeed * deltaDays;
        state.planetAngle += planetAngularSpeed * deltaDays;
        planetMesh.rotation.y += rotationSpeed * deltaDays;
      }

      applyBodyTransforms();

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(loop);
    };

    applyBodyTransforms();
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
      compOrbitGeo.dispose();
      compOrbitMat.dispose();
      primaryOrbitGeo.dispose();
      primaryOrbitMat.dispose();
      orbitGeo.dispose();
      orbitMat.dispose();
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
