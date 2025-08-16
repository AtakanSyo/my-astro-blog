import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function SimpleSim({ defaultPaused = false, dprCap = 1.5 }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const pausedRef = useRef(!!defaultPaused);
  const [paused, setPaused] = useState(!!defaultPaused); // for button label

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // Ensure visible size
    if (!container.clientHeight) container.style.minHeight = '400px';

    // ---- Renderer
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

    // ---- Scene / Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 3);

    // ---- Cube
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshNormalMaterial();
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // ---- Resize observe (with DPR cap)
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    window.addEventListener('resize', fit, { passive: true });
    fit();

    // ---- Keyboard toggle (Space)
    const onKey = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        pausedRef.current = !pausedRef.current;
        setPaused(pausedRef.current);
      }
    };
    window.addEventListener('keydown', onKey);

    // ---- Loop
    renderer.setAnimationLoop(() => {
      if (!pausedRef.current) {
        const s = 0.01;
        cube.rotation.x += s;
        cube.rotation.y += s;
      }
      renderer.render(scene, camera);
    });

    // ---- Cleanup
    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      window.removeEventListener('resize', fit);
      window.removeEventListener('keydown', onKey);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [dprCap]);

  const toggle = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '400px' }}
      aria-label="Rotating cube simulation"
    >
      <button
        onClick={toggle}
        aria-pressed={paused}
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
          font: '12px system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
          cursor: 'pointer',
          opacity: 0.9,
        }}
      >
        {paused ? 'Resume' : 'Pause'}
      </button>

      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}