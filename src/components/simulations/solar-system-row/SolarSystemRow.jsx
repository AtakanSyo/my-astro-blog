import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { prepareScene, addSpinningPlanet, addSaturn, createTopDownOrthoCamera } from '../lib/threeCore';
import SimStage from '../lib/SimStage.jsx';

const PLANET_DATA = [
  {
    name: 'Mercury',
    radiusRelativeToEarth: 0.383,
    textureUrl: '/textures/mercury_texture.webp',
    spinDegPerSec: 5,
  },
  {
    name: 'Venus',
    radiusRelativeToEarth: 0.949,
    textureUrl: '/textures/2k_venus_atmosphere.webp',
    spinDegPerSec: -2, // retrograde
  },
  {
    name: 'Earth',
    radiusRelativeToEarth: 1,
    textureUrl: '/textures/earth_daytime_texture.webp',
    spinDegPerSec: 12,
  },
  {
    name: 'Mars',
    radiusRelativeToEarth: 0.532,
    textureUrl: '/textures/mars_texture.webp',
    spinDegPerSec: 10,
  },
  {
    name: 'Jupiter',
    radiusRelativeToEarth: 11.21,
    textureUrl: '/textures/8k_jupiter.webp',
    spinDegPerSec: 14,
  },
  {
    name: 'Saturn',
    radiusRelativeToEarth: 9.45,
    textureUrl: '/textures/saturn_texture.jpg',
    ringTextureUrl: '/textures/saturns_rings_texture.webp',
    spinDegPerSec: 26,
    ringInnerScale: 1.4,
    ringOuterScale: 2.6,
    tiltDeg: [0, 10, 55.7],
    spinAxis: [0, 1.0, 0],
    ringsSpin: false,
    ringAngle: 0,
  },
  {
    name: 'Uranus',
    radiusRelativeToEarth: 4.01,
    textureUrl: '/textures/uranus_texture.jpg',
    spinDegPerSec: -24,
  },
  {
    name: 'Neptune',
    radiusRelativeToEarth: 3.88,
    textureUrl: '/textures/neptune_texture.jpg',
    spinDegPerSec: 20,
  },
];

export default function SolarSystemRow({
  id = 'solar-system-row',
  aspect = '21 / 9',
  dprCap = 1.5,
  sizeScale = 0.085,
  showPause = true,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const pausedRef = useRef(true);
  const [paused, setPaused] = useState(true);
  const madeVisibleRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !container) return;

    const gap = sizeScale * 0.9;
    const roughWidth = PLANET_DATA.reduce((acc, planet, index) => {
      const radius = planet.radiusRelativeToEarth * sizeScale;
      if (index === 0) return radius * 2;
      return acc + radius * 2 + gap;
    }, 0);
    const core = prepareScene({
      canvas,
      container,
      dprCap,
      background: 0x000000,
      cameraFactory: () =>
        createTopDownOrthoCamera({
          extent: 1.8,
          height: 8,
          margin: 1.1,
          position: [0, 0, 8],
          up: [0, 1, 0],
          lookAt: [0, 0, 0],
        }),
    });

    const { scene, renderer, textureLoader, start, stop, dispose } = core;

    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(3, 2, 4);
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.6);
    rimLight.position.set(-2, 1, -3);
    scene.add(ambient, keyLight, rimLight);

    const placements = PLANET_DATA.map((planet, index) => {
      const radius = planet.radiusRelativeToEarth * sizeScale;
      if (index === 0) {
        return {
          ...planet,
          radius,
          position: [radius, 0, 0],
        };
      }
      const previous = PLANET_DATA
        .slice(0, index)
        .reduce((acc, curr) => acc + curr.radiusRelativeToEarth * sizeScale * 2 + gap, 0);
      return {
        ...planet,
        radius,
        position: [radius + previous, 0, 0],
      };
    });

    const totalWidth =
      placements.length > 0
        ? placements[placements.length - 1].position[0] + placements[placements.length - 1].radius
        : 0;
    const centerOffset = totalWidth / 2;
    placements.forEach((placement) => {
      placement.position[0] -= centerOffset;
    });

    const createdPlanets = placements.map((placement) => {
      if (placement.name === 'Saturn' && placement.ringTextureUrl) {
        return addSaturn(scene, {
          textureUrl: placement.textureUrl,
          ringTextureUrl: placement.ringTextureUrl,
          position: placement.position,
          radius: placement.radius,
          spinSpeed: THREE.MathUtils.degToRad(placement.spinDegPerSec),
          spinAxis: placement.spinAxis,
          renderer,
          textureLoader,
          ringInnerScale: placement.ringInnerScale ?? 1.4,
          ringOuterScale: placement.ringOuterScale ?? 2.6,
          ringAngle: placement.ringAngle ?? 0,
          tiltDeg: Array.isArray(placement.tiltDeg)
            ? placement.tiltDeg
            : [0, 0, placement.tiltDeg ?? 26.7],
          ringsSpin: placement.ringsSpin ?? false,
        });
      }

      return addSpinningPlanet(scene, {
        textureUrl: placement.textureUrl,
        position: placement.position,
        radius: placement.radius,
        spinSpeed: THREE.MathUtils.degToRad(placement.spinDegPerSec),
        renderer,
        textureLoader,
      });
    });

    start((delta) => {
      if (pausedRef.current) return;
      createdPlanets.forEach((planet) => planet.update(delta));
    });

    return () => {
      stop();
      createdPlanets.forEach((planet) => planet.dispose());
      dispose();
    };
  }, [dprCap, sizeScale]);

  const onToggle = () => {
    pausedRef.current = !pausedRef.current;
    const nowPaused = pausedRef.current;
    setPaused(nowPaused);

    if (!nowPaused && !madeVisibleRef.current) {
      madeVisibleRef.current = true;
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
    />
  );
}
