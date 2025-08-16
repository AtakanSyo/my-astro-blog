import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function SimpleSim({
  id = 'cube',
  aspect = '16 / 9',
  showPause = true,
  dprCap = 1.5,
}) {
  const containerRef = useRef(null); // <div id={`stage-${id}`}> (sim-stage)
  const canvasRef = useRef(null);    // <canvas id={id}>
  const btnRef = useRef(null);       // <button id={`pause-${id}`}>
  const pausedRef = useRef(true);    // start paused
  const [paused, setPaused] = useState(true);
  const madeVisibleRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // --- Three.js setup
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 3);

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshNormalMaterial();
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // --- Fit to container with DPR cap
    const fit = () => {
      const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.floor(container.clientWidth * dpr));
      const h = Math.max(1, Math.floor(container.clientHeight * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      renderer.setSize(w, h, false);
      camera.aspect = w / h || 1;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    window.addEventListener('resize', fit, { passive: true });
    fit();

    // --- Animation loop
    renderer.setAnimationLoop(() => {
      if (!pausedRef.current) {
        const s = 0.01;
        cube.rotation.x += s;
        cube.rotation.y += s;
      }
      renderer.render(scene, camera);
    });

    // --- Cleanup
    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      window.removeEventListener('resize', fit);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [dprCap]);

  // --- Pause/Play button behavior
  const onToggle = () => {
    pausedRef.current = !pausedRef.current;
    const nowPaused = pausedRef.current;
    setPaused(nowPaused);

    // First time we go from paused -> playing, mark the outer figure as visible
    if (!nowPaused && !madeVisibleRef.current) {
      madeVisibleRef.current = true;
      const figure = containerRef.current?.closest('figure.sim-stage');
      if (figure && !figure.classList.contains('is-visible')) {
        figure.classList.add('is-visible');
      }
    }
  };

  return (
    <div
      className="sim-stage centered_flex"
      id={`stage-${id}`}
      ref={containerRef}
      style={{ aspectRatio: aspect }}
    >
      <canvas id={id} ref={canvasRef}></canvas>

      {showPause && (
        <button
          id={`pause-${id}`}
          ref={btnRef}
          className="pill sim-controls-inline"
          type="button"
          aria-pressed={!paused}
          onClick={onToggle}
        >
          {paused ? 'Play' : 'Pause'}
        </button>
      )}
    </div>
  );
}