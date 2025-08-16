import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Stats from 'stats.js';
import GUI from 'lil-gui';

export default function SimpleSim() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    // Ensure visible size
    if (!container.clientHeight) container.style.minHeight = '400px';

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Scene / Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 3);

    // Orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Mesh
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshNormalMaterial();
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // Stats (FPS)
    const stats = new Stats();
    stats.showPanel(0); // 0: fps
    Object.assign(stats.dom.style, {
      position: 'absolute', left: '0', top: '0', zIndex: 10,
    });
    container.appendChild(stats.dom);

    // GUI (play/pause + speed)
    const params = { rotate: true, speed: 1.0 };
    const gui = new GUI({ title: 'Controls' });
    gui.add(params, 'rotate').name('Rotate');
    gui.add(params, 'speed', 0.1, 5.0, 0.1).name('Speed');

    // Resize
    const resize = () => {
      const w = container.clientWidth || 600;
      const h = container.clientHeight || 400;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    window.addEventListener('resize', resize);

    // Loop
    renderer.setAnimationLoop(() => {
      stats.begin();

      if (params.rotate) {
        const s = 0.01 * params.speed;
        cube.rotation.x += s;
        cube.rotation.y += s;
      }

      controls.update();
      renderer.render(scene, camera);
      stats.end();
    });

    // Cleanup
    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      window.removeEventListener('resize', resize);
      controls.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      gui.destroy();
      stats.dom.remove();
    };
  }, []);

  // Container must be position:relative so stats panel overlays nicely
  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '400px' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}