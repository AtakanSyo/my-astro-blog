import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

type Controls = { button?: HTMLElement | null; stage?: HTMLElement | null };

export default async function init(canvas: HTMLCanvasElement, _controls?: Controls) {
  // Renderer on the provided canvas
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Scene & camera
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0e18);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  camera.position.set(0, 2.2, 6);

  // Orbit controls (inertial)
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  // A soft light
  const light = new THREE.HemisphereLight(0xffffff, 0x223355, 0.8);
  scene.add(light);

  // --- Particles (instanced spheres) ---
  const COUNT = 1200;
  const radiusMin = 0.6, radiusMax = 3.6;
  const geo = new THREE.SphereGeometry(0.03, 8, 8);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffe8a8, metalness: 0.1, roughness: 0.4 });
  const cloud = new THREE.InstancedMesh(geo, mat, COUNT);
  scene.add(cloud);

  // Per-instance state
  const dummy = new THREE.Object3D();
  const speeds: number[] = [];
  const phases: number[] = [];
  const radii: number[]  = [];

  for (let i = 0; i < COUNT; i++) {
    const r = THREE.MathUtils.lerp(radiusMin, radiusMax, Math.random() ** 1.2);
    const phi0 = Math.random() * Math.PI * 2;
    const speed = THREE.MathUtils.lerp(0.1, 0.8, Math.random()) * (Math.random() < 0.5 ? 1 : -1);

    radii[i] = r;
    phases[i] = phi0;
    speeds[i] = speed;

    dummy.position.set(r * Math.cos(phi0), (Math.random() - 0.5) * 0.4, r * Math.sin(phi0));
    dummy.rotation.y = Math.random() * Math.PI * 2;
    dummy.updateMatrix();
    cloud.setMatrixAt(i, dummy.matrix);

    // nice color falloff with radius
    const t = (r - radiusMin) / (radiusMax - radiusMin);
    const c = new THREE.Color().setHSL(0.1 + 0.15 * (1 - t), 0.6, 0.55 + 0.2 * t);
    cloud.setColorAt(i, c);
  }
  cloud.instanceColor!.needsUpdate = true;

  // A faint central glow disk
  const diskGeo = new THREE.RingGeometry(0.08, 0.18, 48);
  const diskMat = new THREE.MeshBasicMaterial({ color: 0xffcc88 });
  const disk = new THREE.Mesh(diskGeo, diskMat);
  disk.rotation.x = -Math.PI / 2;
  scene.add(disk);

  // Resize handling
  const parent = canvas.parentElement as HTMLElement | null;
  function resize() {
    const w = canvas.clientWidth || parent?.clientWidth || 800;
    const h = canvas.clientHeight || parent?.clientHeight || 450;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // Animate
  let running = true;
  let raf = 0;
  const clock = new THREE.Clock();

  function render() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.033); // clamp dt for stability

    for (let i = 0; i < COUNT; i++) {
      phases[i] += speeds[i] * dt;
      dummy.position.set(
        radii[i] * Math.cos(phases[i]),
        (Math.sin(phases[i] * 1.7 + i) * 0.2) * 0.2, // tiny vertical flutter
        radii[i] * Math.sin(phases[i])
      );
      dummy.rotation.y += 0.5 * dt;
      dummy.updateMatrix();
      cloud.setMatrixAt(i, dummy.matrix);
    }
    cloud.instanceMatrix.needsUpdate = true;

    controls.update();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(render);
  }
  raf = requestAnimationFrame(render);

  // Public API
  function start() { if (!running) { running = true; clock.getDelta(); raf = requestAnimationFrame(render); } }
  function stop()  { running = false; cancelAnimationFrame(raf); }
  function dispose() {
    stop();
    ro.disconnect();
    controls.dispose();
    renderer.dispose();
    geo.dispose();
    mat.dispose();
    diskGeo.dispose();
    diskMat.dispose();
  }

  return { start, stop, dispose };
}