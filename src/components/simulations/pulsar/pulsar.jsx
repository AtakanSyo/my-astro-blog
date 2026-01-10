import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import SimStage from '../lib/simStage.jsx';

export default function PulsarSim({
  id = 'pulsar-sim',
  aspect = '1 / 1',
  showPause = true,
  dprCap = 1.5,
  options = {},
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const pausedRef = useRef(true);
  const [paused, setPaused] = useState(true);
  const madeVisibleRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // ---------- Options / defaults ----------
    const cfg = {
      modelUrl: options.modelUrl ?? '/models/pulsar.glb',
      autoSpinY: options.autoSpinY ?? 0.006,
      bgColor: options.bgColor ?? 0x000000,
      bloomStrength: options.bloomStrength ?? 1.25,
      bloomRadius: options.bloomRadius ?? 0.4,
      bloomThreshold: options.bloomThreshold ?? 0.2,
      starfield: options.starfield ?? true,
      starRadius: options.starRadius ?? 200,
      starDim: options.starDim ?? 0.05,
      starTexture: options.starTexture ?? '/textures/stars_texture.jpg',
      cameraFov: options.cameraFov ?? 50,
    };

    // ---------- Renderer ----------
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    // ---------- Scene / Camera ----------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(cfg.bgColor);

    const camera = new THREE.PerspectiveCamera(cfg.cameraFov, 1, 0.01, 5000);
    camera.position.set(0, 0.6, 3.2);

    // ---------- Root + lights ----------
    const root = new THREE.Group();
    scene.add(root);

    scene.add(new THREE.AmbientLight(0xffffff, 0.15));
    const key = new THREE.DirectionalLight(0xffffff, 0.6);
    key.position.set(5, 5, 5);
    scene.add(key);

    // ---------- Optional starfield ----------
    let stars = null;
    if (cfg.starfield) {
      const loaderTex = new THREE.TextureLoader();
      const mapStars = loaderTex.load(cfg.starTexture);
      mapStars.colorSpace = THREE.SRGBColorSpace;
      stars = new THREE.Mesh(
        new THREE.SphereGeometry(cfg.starRadius, 64, 64),
        new THREE.MeshBasicMaterial({ map: mapStars, side: THREE.BackSide })
      );
      stars.material.color.setScalar(cfg.starDim);
      scene.add(stars);
    }

    // ---------- Load GLB (with DRACO support) ----------
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://unpkg.com/three@0.165.0/examples/jsm/libs/draco/');
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(draco);

    let glbScene = null;

    const frameObject = (obj, cam) => {
      const box = new THREE.Box3().setFromObject(obj);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size); box.getCenter(center);
      obj.position.sub(center);

      const maxDim = Math.max(size.x, size.y, size.z);
      const dist = (maxDim / (2 * Math.tan((cam.fov * Math.PI / 180) / 2))) * 1.35;
      cam.near = Math.max(dist / 100, 0.01);
      cam.far = dist * 100;
      cam.position.set(0, maxDim * 0.15, dist);
      cam.lookAt(0, 0, 0);
    };

    gltfLoader.load(cfg.modelUrl, (gltf) => {
      glbScene = gltf.scene;
      glbScene.traverse((o) => {
        if (o.isMesh && o.material) {
          // ensure alpha beams look right on web
          o.material.transparent = true;
          o.material.depthWrite = false; // avoids dark edges with alpha
          // if emission exists, keep it strong
          if (o.material.emissive) o.material.emissiveIntensity = 1.0;
        }
      });
      root.add(glbScene);
      frameObject(glbScene, camera);
    });

    // ---------- Postprocessing (Bloom) ----------
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      cfg.bloomStrength,
      cfg.bloomRadius,
      cfg.bloomThreshold
    );
    composer.addPass(bloomPass);

    // ---------- Resize / DPR ----------
    const fit = () => {
      const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
      renderer.setPixelRatio(dpr);
      const w = Math.max(1, container.clientWidth | 0);
      const h = Math.max(1, container.clientHeight | 0);
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      camera.aspect = w / h || 1;
      camera.updateProjectionMatrix();
      bloomPass.setSize(w, h);
    };
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    window.addEventListener('resize', fit, { passive: true });
    requestAnimationFrame(fit);

    // ---------- Animation loop with HARD pause ----------
    const clock = new THREE.Clock();
    let rafId = 0;
    let pollId = 0;
    let wasPaused = false;

    const startPollingForResume = () => {
      if (pollId) return;
      pollId = setInterval(() => {
        if (!pausedRef.current) {
          clearInterval(pollId);
          pollId = 0;
          clock.getDelta();
          rafId = requestAnimationFrame(loop);
        }
      }, 100);
    };

    const loop = () => {
      if (pausedRef.current) {
        wasPaused = true;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
        startPollingForResume();
        return;
      }
      if (wasPaused) {
        wasPaused = false;
        clock.getDelta();
      }
      const dt = clock.getDelta();

      // spin the whole model
      root.rotation.y += cfg.autoSpinY * dt * 60; // framerate-independent

      // subtle starfield drift
      if (stars) stars.rotation.y -= 0.003 * dt;

      composer.render();
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    // ---------- Cleanup ----------
    return () => {
      try { ro.disconnect(); } catch {}
      window.removeEventListener('resize', fit);
      if (rafId) cancelAnimationFrame(rafId);
      if (pollId) clearInterval(pollId);
      composer.dispose();
      renderer.dispose();
      draco.dispose?.();
      // dispose textures/materials if you add any extra here
    };
  }, [dprCap, options]);

  // ---------- Play/Pause ----------
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

  return (
    <SimStage
      id={id}
      aspect={aspect}
      containerRef={containerRef}
      canvasRef={canvasRef}
      paused={paused}
      onToggle={onToggle}
      showPause={showPause}
    />
  );
}
