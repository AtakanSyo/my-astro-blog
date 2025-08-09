// Minimal Three.js bootstrap with DPR cap + ResizeObserver + helpers.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161/build/three.module.js';

export function createThree(canvas, { dprCap = 1.5, fov = 32, z = 6, clear = 0x0a0f16 } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: false, alpha: true, powerPreference: 'high-performance'
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(clear, 1);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  camera.position.set(0, 0, z);

  const fit = () => {
    const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(fit);
  ro.observe(canvas);
  fit();

  const dispose = () => ro.disconnect();
  return { THREE, renderer, scene, camera, fit, dispose };
}

// Convert a desired pixel radius (~fraction of shorter side) to world units.
export function planetRadiusWorld(renderer, camera, fraction = 0.33) {
  const w = renderer.domElement.width, h = renderer.domElement.height;
  const Rpx = Math.min(w, h) * fraction;
  const halfFov = camera.fov * Math.PI / 180 * 0.5;
  const halfWorldH = Math.tan(halfFov) * camera.position.z;
  return (Rpx / (0.5 * h)) * halfWorldH;
}

// Fullscreen quad helpers shared by post-process passes.
export function fullscreen() {
  const geo = new THREE.PlaneGeometry(2, 2);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return { geo, cam };
}