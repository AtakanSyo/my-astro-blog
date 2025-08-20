// JWSTSpin.jsx
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export default function JWSTSpin({
  id = 'jwst-spin',
  modelUrl = '/models/JWST_B.glb',
  autoSpinY = 0.006,
  startPaused = true,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const pausedRef = useRef(startPaused);
  const [paused, setPaused] = useState(startPaused);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
    camera.position.set(0, 0.8, 3.5);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x101010, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 5.0);
    key.position.set(5, 5, 5);
    scene.add(key);

    const root = new THREE.Group();
    scene.add(root);

    // DRACO
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://unpkg.com/three@0.165.0/examples/jsm/libs/draco/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    loader.load(modelUrl, (gltf) => {
      root.add(gltf.scene);
      frameObject(gltf.scene, camera);
    });

    const fit = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    new ResizeObserver(fit).observe(container);
    fit();

    renderer.setAnimationLoop(() => {
      if (!pausedRef.current) root.rotation.y += autoSpinY;
      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      renderer.dispose();
    };
  }, [modelUrl, autoSpinY, startPaused]);

  const onToggle = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);

    // add .is-visible to .sim-stage on first play
    if (!pausedRef.current) {
      const fig = containerRef.current;
      if (fig && !fig.classList.contains('is-visible')) {
        fig.classList.add('is-visible');
      }
    }
  };

  return (
    <div
      className="sim-stage centered_flex"
      ref={containerRef}
      style={{ aspectRatio: '16/9', width: '100%', minHeight: 320 }}
    >
      <canvas id={id} ref={canvasRef} />
      <button
        className="pill sim-controls-inline"
        onClick={onToggle}
      >
        {paused ? 'Play' : 'Pause'}
      </button>
    </div>
  );
}

function frameObject(obj, cam) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size); box.getCenter(center);
  obj.position.sub(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = (maxDim / (2 * Math.tan((cam.fov * Math.PI / 180) / 2))) * 1.35;
  cam.near = dist / 100; cam.far = dist * 100;
  cam.position.set(0, maxDim * 0.15, dist);
  cam.lookAt(0, 0, 0);
}