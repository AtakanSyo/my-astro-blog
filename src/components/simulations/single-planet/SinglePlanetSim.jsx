import { useMemo, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { prepareScene, addSpinningPlanet, addSaturn } from '../lib/threeCore';
import SimStage from '../lib/SimStage.jsx';

const PLANET_CONFIG = {
  mercury: {
    textureUrl: '/textures/mercury_texture.webp',
    spinDegPerSec: 5,
  },
  venus: {
    textureUrl: '/textures/2k_venus_atmosphere.webp',
    spinDegPerSec: -2,
  },
  earth: {
    textureUrl: '/textures/earth_daytime_texture.webp',
    spinDegPerSec: 12,
  },
  mars: {
    textureUrl: '/textures/mars_texture.webp',
    spinDegPerSec: 10,
  },
  jupiter: {
    textureUrl: '/textures/8k_jupiter.webp',
    spinDegPerSec: 28,
  },
  saturn: {
    textureUrl: '/textures/saturn_texture.webp',
    ringTextureUrl: '/textures/saturns_rings_texture.webp',
    spinDegPerSec: 26,
    ringsSpin: false,
    ringInnerScale: 1.4,
    ringOuterScale: 2.6,
    tiltDeg: [0, 10.0, 26.7],
    spinAxis: [0, -0.9, 0],
  },
  uranus: {
    textureUrl: '/textures/uranus_texture.webp',
    spinDegPerSec: -24,
  },
  neptune: {
    textureUrl: '/textures/neptune_texture.webp',
    spinDegPerSec: 20,
  },
};

export default function SinglePlanetSim({
  id = 'single-planet',
  aspect = '16 / 9',
  dprCap = 1.5,
  planet = 'earth',
  radius = 1,
  showPause = true,
  ringsSpin = true,
  ringAngle = 0,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const pausedRef = useRef(true);
  const [paused, setPaused] = useState(true);
  const madeVisibleRef = useRef(false);

  const planetKey = planet.toLowerCase();
  const config = useMemo(() => PLANET_CONFIG[planetKey], [planetKey]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !container || !config) return;

    const { scene, renderer, textureLoader, start, stop, dispose } = prepareScene({
      canvas,
      container,
      dprCap,
      cameraConfig: {
        position: { x: 0, y: 0, z: 4 },
      },
    });

    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(3, 2, 4);
    scene.add(ambient, keyLight);

    const spinSpeed = THREE.MathUtils.degToRad(config.spinDegPerSec);

    const saturnSpecific = planetKey === 'saturn'
      ? addSaturn(scene, {
          textureUrl: config.textureUrl,
          ringTextureUrl: config.ringTextureUrl,
          radius,
          position: [0, 0, 0],
          spinSpeed,
          spinAxis: config.spinAxis,
          renderer,
          textureLoader,
          ringsSpin,
          ringAngle,
          ringInnerScale: config.ringInnerScale,
          ringOuterScale: config.ringOuterScale,
          tiltDeg: Array.isArray(config.tiltDeg)
            ? config.tiltDeg
            : [0, 0.0,  26.7],
        })
      : addSpinningPlanet(scene, {
          textureUrl: config.textureUrl,
          radius,
          position: [0, 0, 0],
          spinSpeed,
          renderer,
          textureLoader,
        });

    start((delta) => {
      if (pausedRef.current) return;
      saturnSpecific.update(delta);
    });

    return () => {
      stop();
      saturnSpecific.dispose();
      dispose();
    };
  }, [config, dprCap, planetKey, radius, ringsSpin, ringAngle]);

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

  if (!config) {
    return (
      <div className="sim-stage centered_flex" id={`stage-${id}`}>
        <p>Unknown planet: {planet}</p>
      </div>
    );
  }

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
