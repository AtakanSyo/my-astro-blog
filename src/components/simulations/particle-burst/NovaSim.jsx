import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { prepareScene, createParticleBurst, addSpinningPlanet } from '../lib/threeCore';
import SimStage from '../lib/SimStage.jsx';
import { RotateCcw } from 'lucide-react';

export default function NovaSim({
  id = 'nova-sim',
  aspect = '21 / 9',
  dprCap = 1.5,
  // explosionType options:
  // 'typeIa', 'typeII', 'hypernova', 'pairInstability', 'electronCapture',
  // 'lbv' (aliases: 'lbvGiantEruption', 'giant'), 'kilonova', 'custom'
  explosionType = 'kilonova',
  showPause = true,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const pausedRef = useRef(true);
  const [paused, setPaused] = useState(true);
  const madeVisibleRef = useRef(false);
  const burstRef = useRef(null);
  const sceneRef = useRef(null);

  const burstConfig = useMemo(
    () => ({
      count: 18000,
      initialSpread: [0.1, 0.1, 0.1],
      lifeRange: [2, 3],
      size: 0.08,
      color: 0xffccaa,
      explosionType,
    }),
    [explosionType],
  );

  const recreateBurst = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return null;
    const prev = burstRef.current;
    burstRef.current = null;
    prev?.dispose?.();
    const fresh = createParticleBurst(scene, burstConfig);
    burstRef.current = fresh;
    return fresh;
  }, [burstConfig]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !container) return;

    const { scene, start, stop, dispose } = prepareScene({
      canvas,
      container,
      dprCap,
      background: 0x02030a,
      cameraConfig: {
        position: { x: 0, y: 0, z: 9 },
      },
    });

    const ambient = new THREE.AmbientLight(0xffffff, 0.25);
    const pointLight = new THREE.PointLight(0xffaa88, 1.2, 10);
    scene.add(ambient, pointLight);

    sceneRef.current = scene;
    recreateBurst();

    let coreGlow = null;
    const typeKey = explosionType.toLowerCase();
    if (typeKey === 'typeii') {
      coreGlow = addSpinningPlanet(scene, {
        radius: 0.18,
        color: '#FFEBD1',
        luminosity: 1.5,
        spinSpeed: 0.1,
      });
    } else if (typeKey === 'kilonova') {
      coreGlow = addSpinningPlanet(scene, {
        radius: 0.2,
        color: '#FFB5A1',
        luminosity: 1.8,
        spinSpeed: 0.12,
      });
    }

    start((delta) => {
      if (pausedRef.current) return;
      burstRef.current?.update(delta);
      pointLight.intensity = 1.0 + Math.sin(performance.now() * 0.004) * 0.3;
    });

    return () => {
      stop();
      burstRef.current?.dispose?.();
      burstRef.current = null;
      coreGlow?.dispose?.();
      dispose();
      sceneRef.current = null;
    };
  }, [dprCap, recreateBurst, explosionType]);

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

  const onReset = useCallback(() => {
    recreateBurst();
  }, [recreateBurst]);

  return (
    <SimStage
      id={id}
      aspect={aspect}
      containerRef={containerRef}
      canvasRef={canvasRef}
      paused={paused}
      onToggle={onToggle}
      showPause={showPause}
      extraControls={
        <button className="pill sim-controls-inline" type="button" onClick={onReset}>
          <RotateCcw size={16} strokeWidth={1.8} aria-hidden="true" />
        </button>
      }
    />
  );
}
