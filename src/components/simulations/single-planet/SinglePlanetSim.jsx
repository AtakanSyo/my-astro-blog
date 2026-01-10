import { useMemo, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { prepareScene, addSpinningPlanet, addSaturn } from '../lib/threeCore';
import SimStage from '../lib/simStage.jsx';

const PLANET_CONFIG = {
  mercury: {
    textureUrl: '/textures/mercury_texture.webp',
    spinDegPerSec: 5,
  },
  venus: {
    textureUrl: '/textures/2k_venus_atmosphere.webp',
    spinDegPerSec: -2,
  },
  mars: {
    textureUrl: '/textures/mars_texture.webp',
    spinDegPerSec: 10,
  },
  jupiter: {
    textureUrl: '/textures/8k_jupiter.webp',
    spinDegPerSec: 5,
  },
  saturn: {
    textureUrl: '/textures/saturn_texture.webp',
    ringTextureUrl: '/textures/saturns_rings_texture.webp',
    spinDegPerSec: 12,
    ringsSpin: true,
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
    spinDegPerSec: 7,
  },
  moon: {
    textureUrl: '/textures/moon_texture.webp',
    spinDegPerSec: 7,
  },
  earth: {
    textureUrl: '/textures/earth-texture-nasa.webp',
    spinDegPerSec: 5,
  },
  pluto: {
    textureUrl: '/textures/plutomap2k.webp',
    spinDegPerSec: 5,
  },
};

function applyContrastMaterial(material, contrast) {
  if (!material || typeof contrast !== 'number') return;
  material.userData.uContrast = { value: contrast };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uContrast = material.userData.uContrast;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `
        #include <common>
        uniform float uContrast;
        `,
      )
      .replace(
        '#include <map_fragment>',
        `
        #include <map_fragment>
        vec3 c = diffuseColor.rgb;
        c = (c - 0.5) * uContrast + 0.5;
        diffuseColor.rgb = clamp(c, 0.0, 1.0);
        `,
      );
  };
  material.needsUpdate = true;
}

export default function SinglePlanetSim({
  id = 'single-planet',
  aspect = '16 / 9',
  dprCap = 1.5,
  planet = 'earth',
  radius = 1,
  showPause = true,
  ringsSpin = true,
  ringAngle = 0,
  cameraPosition,
  cameraLookAt,
  textureContrast,
  tiltDeg,
  lightIntensity = 1.7,
  ambientIntensity = 0.6,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const pausedRef = useRef(showPause);
  const [paused, setPaused] = useState(showPause);
  const madeVisibleRef = useRef(false);

  const planetKey = planet.toLowerCase();
  const config = useMemo(() => PLANET_CONFIG[planetKey], [planetKey]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !container || !config) return;

    const cameraPos = cameraPosition ?? { x: 0, y: 0, z: 4 };
    const { scene, renderer, textureLoader, start, stop, dispose } = prepareScene({
      canvas,
      container,
      dprCap,
      cameraConfig: {
        position: cameraPos,
        lookAt: cameraLookAt,
      },
    });

    const ambient = new THREE.AmbientLight(0xffffff, ambientIntensity);
    const keyLight = new THREE.DirectionalLight(0xffffff, lightIntensity);
    keyLight.position.set(3, 2, 4);
    scene.add(ambient, keyLight);

    const spinSpeed = THREE.MathUtils.degToRad(config.spinDegPerSec);

    const simHandle = planetKey === 'saturn'
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
          tiltDeg:
            tiltDeg ??
            (Array.isArray(config.tiltDeg) ? config.tiltDeg : [0, 0.0, 26.7]),
        })
      : addSpinningPlanet(scene, {
          textureUrl: config.textureUrl,
          radius,
          position: [0, 0, 0],
          spinSpeed,
          renderer,
          textureLoader,
          tiltDeg: tiltDeg ?? config.tiltDeg ?? 0,
        });

    if (typeof textureContrast === 'number') {
      const material =
        planetKey === 'saturn' ? simHandle.planetMaterial : simHandle.material;
      applyContrastMaterial(material, textureContrast);
    }

    start((delta) => {
      if (pausedRef.current) return;
      simHandle.update(delta);
    });

    return () => {
      stop();
      simHandle.dispose();
      dispose();
    };
  }, [
    cameraLookAt,
    cameraPosition,
    config,
    dprCap,
    planetKey,
    radius,
    ringsSpin,
    ringAngle,
    textureContrast,
    tiltDeg,
  ]);

  useEffect(() => {
    if (showPause) return;
    pausedRef.current = false;
    setPaused(false);
    const el = containerRef.current?.closest('.sim-stage') ?? containerRef.current;
    if (el && !el.classList.contains('is-visible')) el.classList.add('is-visible');
    madeVisibleRef.current = true;
  }, [showPause]);

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
