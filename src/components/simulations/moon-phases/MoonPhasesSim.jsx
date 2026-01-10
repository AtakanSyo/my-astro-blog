import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { prepareScene, addSpinningPlanet } from '../lib/threeCore';
import SimStage from '../lib/simStage.jsx';

/**
 * Shows Moon phases by keeping the camera and Moon fixed while the "sun" light
 * orbits around, revealing the illuminated fraction.
 */
export default function MoonPhasesSim({
  id = 'moon-phases',
  aspect = '16 / 9',
  dprCap = 1.5,
  moonTextureUrl = '/textures/moon_texture.webp',
  radius = 1.3,
  cycleSeconds = 18,
  lightDistance = 6,
  lightHeight = 0.25,
  phaseOffsetDeg = 90,
  ambientIntensity = 0.08,
  sunIntensity = 2.2,
  moonTiltDeg = 6.7,
  showPause = true,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const pausedRef = useRef(true);
  const [paused, setPaused] = useState(true);
  const madeVisibleRef = useRef(false);
  const phaseAngleRef = useRef(THREE.MathUtils.degToRad(phaseOffsetDeg));

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !container) return;

    const { scene, renderer, textureLoader, start, stop, dispose } = prepareScene({
      canvas,
      container,
      dprCap,
      background: 0x000000,
      cameraConfig: {
        position: { x: 0, y: 0, z: 4 },
      },
    });

    const ambient = new THREE.AmbientLight(0xffffff, ambientIntensity);
    const sunLight = new THREE.DirectionalLight(0xffffff, sunIntensity);
    sunLight.castShadow = false;
    const sunTarget = new THREE.Object3D();
    sunTarget.position.set(0, 0, 0);
    scene.add(sunLight, sunTarget);
    sunLight.target = sunTarget;

    // Small rim so the "new moon" still has a faint outline.
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.08);
    rimLight.position.set(-3, 1.4, -4);
    scene.add(ambient, rimLight);

    const moon = addSpinningPlanet(scene, {
      textureUrl: moonTextureUrl,
      radius,
      spinSpeed: 0, // Moon stays locked toward the camera; only light moves.
      tiltDeg: [0, moonTiltDeg, 0],
      renderer,
      textureLoader,
      materialOptions: {
        roughness: 1,
        metalness: 0,
      },
    });

    const orbitSpeed = (Math.PI * 2) / Math.max(cycleSeconds, 0.001);

    start((delta) => {
      if (pausedRef.current) return;
      phaseAngleRef.current += orbitSpeed * delta;
      if (phaseAngleRef.current > Math.PI * 2) {
        phaseAngleRef.current -= Math.PI * 2;
      }
      const angle = phaseAngleRef.current;
      const x = Math.cos(angle) * lightDistance;
      const z = Math.sin(angle) * lightDistance;
      sunLight.position.set(x, lightHeight, z);
      sunLight.target.position.set(0, 0, 0);
      sunLight.target.updateMatrixWorld();
    });

    return () => {
      stop();
      moon.dispose();
      dispose();
    };
  }, [
    ambientIntensity,
    cycleSeconds,
    dprCap,
    lightDistance,
    lightHeight,
    moonTextureUrl,
    radius,
    sunIntensity,
    moonTiltDeg,
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
