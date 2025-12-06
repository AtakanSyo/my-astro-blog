import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import SimStage from '../lib/SimStage.jsx';
import { prepareScene } from '../lib/threeCore.js';
import { createParticlePoints } from '../lib/particles.js';
import { initCompute } from '../lib/gpu.js';
import { spiralGalaxy } from "../lib/shaders.js";

/**
 * GPU-based particle vortex simulation using Three.js and GPUComputationRenderer.
 * Particles orbit and spiral inward, then respawn into the outer ring.
 */
export default function SpiralGalaxySim({
  id = 'particle-vortex',
  aspect = '16 / 9',
  showPause = true,
  dprCap = 1.5,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const pausedRef = useRef(true);
  const hasPlayedRef = useRef(false);
  const coreHandleRef = useRef(null);
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const core = prepareScene({
      canvas,
      container,
      dprCap,
      background: 0x000000,
      cameraConfig: {
        fov: 60,
        near: 0.1,
        far: 1000,
        position: { x: 0, y: 30, z: 40 },
        lookAt: { x: 0, y: 0, z: 0 },
      },
    });

    const { scene, renderer, start, stop, renderOnce, dispose } = core;

    const TEXTURE_WIDTH = 512;
    const initParticlePosIdx = 1;

    const { gpuCompute, posVar } = initCompute(renderer, spiralGalaxy, initParticlePosIdx, TEXTURE_WIDTH);
    const { points, material } = createParticlePoints();

    // Subtle base color tint via fog for depth.
    scene.fog = new THREE.FogExp2(0x020712, 0.02);
    scene.add(points);

    const tick = () => {
      if (pausedRef.current) return;
      gpuCompute.compute();
      material.uniforms.uPositionTexture.value =
        gpuCompute.getCurrentRenderTarget(posVar).texture;
    };

    coreHandleRef.current = {
      api: core,
      tick,
      gpuCompute,
      points,
      material,
    };

    if (pausedRef.current) {
      renderOnce();
    } else {
      start(tick);
    }

    return () => {
      stop();
      scene.remove(points);
      points.geometry?.dispose?.();
      material.dispose?.();
      gpuCompute.dispose?.();
      dispose();
      coreHandleRef.current = null;
    };
  }, [dprCap]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const handle = coreHandleRef.current;
    if (!handle) return;
    if (paused) {
      handle.api.stop();
      handle.api.renderOnce();
    } else {
      handle.api.start(handle.tick);
    }
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
