import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function SimpleSim({ dprCap = 1.5 }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const pausedRef = useRef(true);             // start paused
  const [paused, setPaused] = useState(true); // button label
  const madeVisibleRef = useRef(false);       // ensure we add the class only once

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    if (!container.clientHeight) container.style.minHeight = '400px';

    // Renderer + DPR-capped sizing
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    const fit = () => {
      const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.floor((container.clientWidth || 600) * dpr));
      const h = Math.max(1, Math.floor((container.clientHeight || 400) * dpr));
      if (canvas.width !== w)  canvas.width  = w;
      if (canvas.height !== h) canvas.height = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };

    // Scene / Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 3);

    // Cube
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshNormalMaterial();
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // Resize observe
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    window.addEventListener('resize', fit, { passive: true });
    fit();

    // Loop
    renderer.setAnimationLoop(() => {
      if (!pausedRef.current) {
        const s = 0.01;
        cube.rotation.x += s;
        cube.rotation.y += s;
      }
      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      window.removeEventListener('resize', fit);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [dprCap]);

  const onPlayPause = () => {
    pausedRef.current = !pausedRef.current;
    const nowPaused = pausedRef.current;
    setPaused(nowPaused);

    // On first transition to playing, add "is-visible" to the nearest figure.sim-stage
    if (!nowPaused && !madeVisibleRef.current) {
      madeVisibleRef.current = true;
      const container = containerRef.current;
      const figure = container?.closest('figure.sim-stage');
      if (figure && !figure.classList.contains('is-visible')) {
        figure.classList.add('is-visible');
      }
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '400px' }}
      aria-label="Rotating cube simulation"
    >
      <button
        onClick={onPlayPause}
        aria-pressed={!paused}
        style={{
          position: 'absolute',
          right: '12px',
          top: '12px',
          zIndex: 5,
          padding: '6px 10px',
          borderRadius: '10px',
          border: '1px solid #2b2f36',
          background: '#0b0f16',
          color: '#e8eef9',
          font: '12px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial',
          cursor: 'pointer',
          opacity: 0.9,
        }}
      >
        {paused ? 'Play' : 'Pause'}
      </button>

      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}