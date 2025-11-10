import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { prepareScene, addSpinningPlanet, addSaturn, createTopDownOrthoCamera } from '../lib/threeCore';
import SimStage from '../lib/SimStage.jsx';

const PLANETS = [
  {
    name: 'Mercury',
    textureUrl: '/textures/mercury_texture.webp',
    spinDegPerSec: 5,
  },
  {
    name: 'Venus',
    textureUrl: '/textures/2k_venus_atmosphere.webp',
    spinDegPerSec: -2,
  },
  {
    name: 'Earth',
    textureUrl: '/textures/earth_daytime_texture.webp',
    spinDegPerSec: 12,
  },
  {
    name: 'Mars',
    textureUrl: '/textures/mars_texture.webp',
    spinDegPerSec: 10,
  },
  {
    name: 'Jupiter',
    textureUrl: '/textures/8k_jupiter.webp',
    spinDegPerSec: 28,
  },
  {
    name: 'Saturn',
    textureUrl: '/textures/saturn_texture.jpg',
    ringTextureUrl: '/textures/saturns_rings_texture.webp',
    spinDegPerSec: 26,
  },
  {
    name: 'Uranus',
    textureUrl: '/textures/uranus_texture.jpg',
    spinDegPerSec: -24,
  },
  {
    name: 'Neptune',
    textureUrl: '/textures/neptune_texture.jpg',
    spinDegPerSec: 20,
  },
];

export default function SolarSystemPlanetsInOrder({
  id = 'solar-system-planets-in-order',
  aspect = '21 / 9',
  dprCap = 1.5,
  planetRadius = 0.3,
  spacingMultiplier = 3.9,
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

    const spacing = planetRadius * spacingMultiplier;
    const extent = 2.3;

    const { scene, renderer, textureLoader, start, stop, dispose } = prepareScene({
      canvas,
      container,
      dprCap,
      background: 0x000000,
      cameraFactory: () =>
        createTopDownOrthoCamera({
          extent,
          height: 6,
          margin: 1.1,
          position: [0, 0, 6],
          up: [0, 1, 0],
          lookAt: [0, 0, 0],
        }),
    });

    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.3);
    keyLight.position.set(3, 2, 4);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
    fillLight.position.set(-2, 1, -2);
    scene.add(ambient, keyLight, fillLight);

    const offset = ((PLANETS.length - 1) * spacing) / 2;

    const createdPlanets = PLANETS.map((planet, index) => {
      const position = [index * spacing - offset, 0, 0];
      const common = {
        textureUrl: planet.textureUrl,
        position,
        radius: planetRadius,
        spinSpeed: THREE.MathUtils.degToRad(planet.spinDegPerSec),
        renderer,
        textureLoader,
      };

      if (planet.name === 'Saturn') {
        return addSaturn(scene, {
          ...common,
          ringTextureUrl: planet.ringTextureUrl,
          ringInnerScale: 1.4,
          ringOuterScale: 2.6,
          tiltDeg: 26.7,
          ringAngle: 45,
          ringsSpin: false,
        });
      }

      return addSpinningPlanet(scene, common);
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
  }, [dprCap, planetRadius, spacingMultiplier]);

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
