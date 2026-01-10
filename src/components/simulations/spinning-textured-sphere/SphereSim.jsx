import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { prepareScene, addSpinningPlanet } from '../lib/threeCore';
import SimStage from '../lib/simStage.jsx';

export default function SphereSim({
  id = 'spinning-textured-sphere',
  aspect = '16 / 9',
  dprCap = 1.5,
  textureUrl = '/textures/8k_jupiter.webp',
  spinSpeedDeg = 12,
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

    const {
      scene,
      renderer,
      textureLoader,
      start,
      stop,
      dispose,
    } = prepareScene({
      canvas,
      container,
      dprCap,
      cameraConfig: {
        position: { x: 0, y: 0, z: 4 },
      },
    });

    const ambient = new THREE.AmbientLight(0xffffff, 0.3);
    const directional = new THREE.DirectionalLight(0xffffff, 1.4);
    directional.position.set(3, 2, 4);
    scene.add(ambient, directional);

    const planet = addSpinningPlanet(scene, {
      textureUrl,
      radius: 1,
      spinSpeed: THREE.MathUtils.degToRad(spinSpeedDeg),
      renderer,
      textureLoader,
    });

    start((delta) => {
      if (!pausedRef.current) {
        planet.update(delta);
      }
    });

    return () => {
      stop();
      planet.dispose();
      dispose();
    };
  }, [dprCap, textureUrl, spinSpeedDeg]);

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
