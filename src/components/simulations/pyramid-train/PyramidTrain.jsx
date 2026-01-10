import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import SimStage from '../lib/simStage.jsx';
import { prepareScene } from '../lib/threeCore.js';
import { createParticlePoints } from '../lib/particles.js';
import { initCompute } from '../lib/gpu.js';
import { pyramidTrainShader } from "../lib/shaders.js";


export default function PyramidTrainSim({
  id = 'pyramid-train',
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

    // 1. Setup Clock
    const clock = new THREE.Clock();

    const core = prepareScene({
      canvas,
      container,
      dprCap,
      background: 0x000000,
      cameraConfig: {
        fov: 60,
        near: 0.1,
        far: 1000,
        position: { x: 0, y: 30, z: 60 },
        lookAt: { x: 0, y: 10, z: 0 },
      },
    });

    const { scene, renderer, start, stop, renderOnce, dispose } = core;

    // 2. Initialize Compute
    const { gpuCompute, posVar } = initCompute(renderer, pyramidTrainShader);

    // 3. Create & Inject the Path Texture
    const pathTexture = createPyramidPathTexture(gpuCompute);
    
    // Check if the uniform exists, if not, create it
    if (!posVar.material.uniforms.texturePath) {
        posVar.material.uniforms.texturePath = { value: pathTexture };
    } else {
        posVar.material.uniforms.texturePath.value = pathTexture;
    }

    // Inject Time Uniform
    if (!posVar.material.uniforms.uTime) {
        posVar.material.uniforms.uTime = { value: 0.0 };
    }

    // 4. Create the Visual Particles (Points Mesh)
    const { points, material } = createParticlePoints();

    scene.fog = new THREE.FogExp2(0x020712, 0.02);
    scene.add(points);

    const tick = () => {
      if (pausedRef.current) return;
      
      const time = clock.getElapsedTime();
      
      // Update Simulation Shader Time
      posVar.material.uniforms.uTime.value = time;

      gpuCompute.compute();
      
      // Update Render Material with new positions
      // FIXED: Using 'uPositionTexture' to match your createParticlePoints definition
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
        gpuCompute.compute();
        // FIXED: uPositionTexture here too
        material.uniforms.uPositionTexture.value = gpuCompute.getCurrentRenderTarget(posVar).texture;
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

  // ... rest of logic ...
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
