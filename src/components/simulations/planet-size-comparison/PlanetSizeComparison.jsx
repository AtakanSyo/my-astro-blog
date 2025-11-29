import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import SimStage from '../lib/SimStage.jsx';
import { prepareScene, createTopDownOrthoCamera } from '../lib/threeCore.js';

export default function PlanetSizeComparison({
  id = 'planet-size-comparison',
  aspect = '16 / 9',
  showPause = true,
  dprCap = 1.5,
  primaryTexture,
  secondaryTexture,
  primaryRadius,
  secondaryRadius,
  planetDistance,
  primaryContrast,
  secondaryContrast,
  orthoExtent,
  options = {},
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const simControlsRef = useRef(null);

  // Memoize options so re-renders (e.g. play/pause) don't recreate the scene unless a field actually changed.
  const memoOptions = useMemo(() => options ?? {}, [
    options?.planetRadius,
    options?.axialTiltDeg,
    options?.rotationHours,
    options?.timeScale,
    options?.starDim,
    options?.secondRadiusScale,
    options?.atmosScale,
    options?.starRadius,
    options?.atmosIntensity,
    options?.planetTexture,
    options?.secondTexture,
    options?.starsTexture,
    options?.planetPosition,
    options?.secondPosition,
    options?.planetSat,
    options?.planetContrast,
    options?.planetBrightness,
    options?.secondSat,
    options?.secondContrast,
    options?.secondBrightness,
    options?.planetDistance,
    options?.distancePadding,
    options?.orthoExtent,
    options?.orthoMargin,
    options?.cameraPosition,
    options?.cameraLookAt,
    options?.cameraUp,
    options?.cameraNear,
    options?.cameraFar,
  ]);

  const pausedRef = useRef(true);
  const [paused, setPaused] = useState(true);
  const madeVisibleRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    if (
      typeof primaryRadius !== 'number' ||
      typeof secondaryRadius !== 'number' ||
      !primaryTexture ||
      !secondaryTexture
    ) {
      console.warn('PlanetSizeComparison requires valid textures and radius values.');
      return undefined;
    }

    const radiusRatio =
      Math.max(secondaryRadius, Number.EPSILON) / Math.max(primaryRadius, Number.EPSILON);

    const planetRadius = memoOptions.planetRadius ?? 1;
    const cfgBase = {
      axialTiltDeg: memoOptions.axialTiltDeg ?? -28.32,
      rotationHours: memoOptions.rotationHours ?? 16.11,
      timeScale: memoOptions.timeScale ?? 2000,
      starDim: memoOptions.starDim ?? 0.05,
      planetRadius,
      secondRadiusScale: memoOptions.secondRadiusScale ?? radiusRatio,
      atmosScale: memoOptions.atmosScale ?? 1.015,
      starRadius: memoOptions.starRadius ?? 200,
      atmosIntensity: memoOptions.atmosIntensity ?? 0.2,
      planetTexture: memoOptions.planetTexture ?? primaryTexture,
      secondTexture: memoOptions.secondTexture ?? secondaryTexture,
      starsTexture: memoOptions.starsTexture ?? '/textures/stars_texture.jpg',
      planetPosition: memoOptions.planetPosition ?? [-1, 0, 0],
      secondPosition: memoOptions.secondPosition ?? [1, 0, 0],
      planetSat: memoOptions.planetSat ?? 1.2,
      planetContrast: memoOptions.planetContrast ?? primaryContrast ?? 1.0,
      planetBrightness: memoOptions.planetBrightness ?? 0.007,
      secondSat: memoOptions.secondSat ?? 1.1,
      secondContrast: memoOptions.secondContrast ?? secondaryContrast ?? 0.6,
      secondBrightness: memoOptions.secondBrightness ?? 0.0,
    };

    const R_PLANET = cfgBase.planetRadius;
    const R_PLANET_2 = R_PLANET * cfgBase.secondRadiusScale;
    const R_ATMOS = R_PLANET * cfgBase.atmosScale;

    const explicitDistance =
      Number.isFinite(memoOptions.planetDistance) && !Number.isNaN(memoOptions.planetDistance)
        ? memoOptions.planetDistance
        : Number.isFinite(planetDistance) && !Number.isNaN(planetDistance)
          ? planetDistance
          : undefined;
    const minDistance =
      R_PLANET * cfgBase.atmosScale +
      R_PLANET_2 * cfgBase.atmosScale +
      (memoOptions.distancePadding ?? 0.25);
    const centerDistance = Math.max(explicitDistance ?? minDistance, minDistance);
    const defaultPositions = {
      a: [-centerDistance / 2, 0, 0],
      b: [centerDistance / 2, 0, 0],
    };

    const planetPosition = memoOptions.planetPosition ?? defaultPositions.a;
    const secondPosition = memoOptions.secondPosition ?? defaultPositions.b;

    const cfg = {
      ...cfgBase,
      planetPosition,
      secondPosition,
    };

    const halfSpan = Math.max(
      Math.abs(cfg.planetPosition[0]) + R_PLANET * cfg.atmosScale,
      Math.abs(cfg.secondPosition[0]) + R_PLANET_2 * cfg.atmosScale,
    );
    const orthoExtentValue =
      memoOptions.orthoExtent ?? orthoExtent ?? Math.max(halfSpan * 1.2, 1.5);

    const sceneCtx = prepareScene({
      canvas,
      container,
      dprCap,
      background: 0x000000,
      cameraFactory: () =>
        createTopDownOrthoCamera({
          extent: () => orthoExtentValue,
          margin: memoOptions.orthoMargin ?? 1.05,
          position: memoOptions.cameraPosition ?? [0, 0, 5],
          lookAt: memoOptions.cameraLookAt ?? [0, 0, 0],
          up: memoOptions.cameraUp ?? [0, 1, 0],
          near: memoOptions.cameraNear ?? 0.01,
          far: memoOptions.cameraFar ?? 50,
        }),
    });

    const { scene, renderer, textureLoader, start, stop, dispose } = sceneCtx;

    function loadMap(url, opts = {}) {
      const t = textureLoader.load(url);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      if (opts.repeatWrap) {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
      }
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      return t;
    }

    function makeSTDMaterial(map, { sat = 1.0, contrast = 1.0, brightness = 0.0 } = {}) {
      const mat = new THREE.MeshStandardMaterial({
        map,
        roughness: 1.0,
        metalness: 0.0,
      });

      mat.userData.uSat = { value: sat };
      mat.userData.uContrast = { value: contrast };
      mat.userData.uBrightness = { value: brightness };

      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uSat = mat.userData.uSat;
        shader.uniforms.uContrast = mat.userData.uContrast;
        shader.uniforms.uBrightness = mat.userData.uBrightness;

        shader.fragmentShader = shader.fragmentShader
          .replace(
            '#include <common>',
            `
            #include <common>
            uniform float uSat;
            uniform float uContrast;
            uniform float uBrightness;
            `
          )
          .replace(
            '#include <map_fragment>',
            `
            #include <map_fragment>
            vec3 c = diffuseColor.rgb;
            float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
            c = mix(vec3(luma), c, uSat);
            c = (c - 0.5) * uContrast + 0.5;
            c += uBrightness;
            diffuseColor.rgb = clamp(c, 0.0, 1.0);
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

    const mapPlanet = loadMap(cfg.planetTexture);
    const mapSecond = loadMap(cfg.secondTexture);
    const mapStars = loadMap(cfg.starsTexture, { repeatWrap: true });

    const matPlanet = makeSTDMaterial(mapPlanet, {
      sat: cfg.planetSat,
      contrast: cfg.planetContrast,
      brightness: cfg.planetBrightness,
    });
    const matSecond = makeSTDMaterial(mapSecond, {
      sat: cfg.secondSat,
      contrast: cfg.secondContrast,
      brightness: cfg.secondBrightness,
    });

    const planetA = makePlanet(R_PLANET, matPlanet, cfg.axialTiltDeg, cfg.planetPosition);
    const planetB = makePlanet(R_PLANET_2, matSecond, cfg.axialTiltDeg, cfg.secondPosition);

    const atmosMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uLightDir: { value: new THREE.Vector3(1, 0.2, 0.7).normalize() },
        uColor: { value: new THREE.Color(0x6db8ff) },
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

    const stars = new THREE.Mesh(
      new THREE.SphereGeometry(cfg.starRadius, 64, 64),
      new THREE.MeshBasicMaterial({ map: mapStars, side: THREE.BackSide })
    );
    stars.material.color.setScalar(cfg.starDim);
    scene.add(stars);

    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(5, 2, 3).normalize();
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffffff, 0.32));

    const syncLightUniforms = () => {
      atmosMat.uniforms.uLightDir.value.copy(sun.position.clone().normalize());
    };
    syncLightUniforms();

    const degPerSec = 360.0 / (cfg.rotationHours * 3600.0);

    let loopActive = false;
    const animate = (delta = 0) => {
      const spinDeg = degPerSec * cfg.timeScale * delta;

      planetA.rotation.y += THREE.MathUtils.degToRad(spinDeg);
      planetB.rotation.y += THREE.MathUtils.degToRad(spinDeg);

      atmosphere.rotation.y = planetA.rotation.y;
      atmosphere.position.copy(planetA.position);

      atmosphereB.rotation.y = planetB.rotation.y;
      atmosphereB.position.copy(planetB.position);

      stars.rotation.y -= 0.003 * delta;
    };

    const startLoop = () => {
      if (loopActive) return;
      loopActive = true;
      start(animate);
    };

    const stopLoop = () => {
      if (!loopActive) return;
      loopActive = false;
      stop();
    };

    simControlsRef.current = { startLoop, stopLoop };

    if (!pausedRef.current) {
      startLoop();
    }

    return () => {
      simControlsRef.current = null;
      stopLoop();

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
      dispose();
    };
  }, [
    dprCap,
    memoOptions,
    primaryRadius,
    secondaryRadius,
    primaryTexture,
    secondaryTexture,
    planetDistance,
    primaryContrast,
    secondaryContrast,
    orthoExtent,
  ]);

  const onToggle = () => {
    pausedRef.current = !pausedRef.current;
    const nowPaused = pausedRef.current;
    setPaused(nowPaused);

    if (!nowPaused && !madeVisibleRef.current) {
      madeVisibleRef.current = true;
      const el = containerRef.current?.closest('.sim-stage') ?? containerRef.current;
      if (el && !el.classList.contains('is-visible')) el.classList.add('is-visible');
    }

    if (nowPaused) {
      simControlsRef.current?.stopLoop?.();
    } else {
      simControlsRef.current?.startLoop?.();
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
      style={{ width: '100%' }}
    />
  );
}
