import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import SimStage from '../lib/simStage.jsx';

/**
 * GLBViewer.jsx — drop-in React component for Astro posts
 *
 * Features
 * - Loads .glb/.gltf (DRACO, Meshopt, KTX2)
 * - Optional HDRI environment (PMREM) to match Blender World
 * - Uses exported camera if present, else auto-frames model bounds
 * - Optional OrbitControls
 * - Bloom postprocess (UnrealBloom)
 * - DPR cap + demand rendering + Pause/Play
 * - Shadows ready
 *
 * Usage (in .astro/.mdx):
 *   import GLBViewer from "../../components/simulations/common/GLBViewer.jsx";
 *   <GLBViewer
 *     id="jup-earth"
 *     aspect="16 / 9"
 *     showPause
 *     dprCap={2}
 *     options={{
 *       modelUrl: "/models/jupiter_earth.glb",
 *       hdriUrl: "/hdris/studio_small_09_2k.hdr",
 *       useOrbit: true,
 *       bgColor: 0x000000,
 *       exposure: 1.0,
 *       autoSpinY: 0.0,
 *       bloom: { strength: 1.1, radius: 0.35, threshold: 0.18 },
 *     }}
 *   />
 */
export default function GLBViewer({
  id = 'glb-viewer',
  aspect = '16 / 9',
  showPause = true,
  dprCap = 2,
  className = '',
  options = {},
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const pausedRef = useRef(true);
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const cfg = {
      modelUrl: options.modelUrl ?? '/models/model.glb',
      hdriUrl: options.hdriUrl ?? null,
      useOrbit: options.useOrbit ?? true,
      bgColor: options.bgColor ?? 0x000000,
      exposure: options.exposure ?? 1.0,
      autoSpinY: options.autoSpinY ?? 0.0, // radians per frame @60fps scaled
      cameraFov: options.cameraFov ?? 50,
      shadows: options.shadows ?? true,
      bloom: {
        strength: options.bloom?.strength ?? 1.0,
        radius: options.bloom?.radius ?? 0.35,
        threshold: options.bloom?.threshold ?? 0.2,
        enabled: options.bloom?.enabled ?? true,
      },
    };

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = cfg.exposure;
    if (cfg.shadows) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    // Scene and Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(cfg.bgColor);
    const camera = new THREE.PerspectiveCamera(cfg.cameraFov, 1, 0.01, 5000);
    camera.position.set(0, 0.6, 3.2);

    // Controls (optional)
    let controls = null;
    if (cfg.useOrbit) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.06;
      controls.addEventListener('change', () => (needsRender = true));
    }

    // Lights (simple, you can remove if using only HDRI)
    const amb = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(amb);
    const key = new THREE.DirectionalLight(0xffffff, 0.8);
    key.position.set(5, 5, 5);
    key.castShadow = !!cfg.shadows;
    scene.add(key);

    // Root group
    const root = new THREE.Group();
    scene.add(root);

    // HDRI environment
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    if (cfg.hdriUrl) {
      new RGBELoader().load(cfg.hdriUrl, (tex) => {
        const envMap = pmrem.fromEquirectangular(tex).texture;
        scene.environment = envMap;
        tex.dispose();
        needsRender = true;
      });
    }

    // Loaders
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://unpkg.com/three@0.165.0/examples/jsm/libs/draco/');

    const ktx2 = new KTX2Loader()
      .setTranscoderPath('https://unpkg.com/three@0.165.0/examples/jsm/libs/basis/')
      .detectSupport(renderer);

    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(draco);
    gltfLoader.setKTX2Loader(ktx2);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    // Postprocessing
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), cfg.bloom.strength, cfg.bloom.radius, cfg.bloom.threshold);
    bloomPass.enabled = !!cfg.bloom.enabled;
    composer.addPass(bloomPass);

    // Helpers
    let needsRender = true; // demand rendering flag
    const onChange = () => (needsRender = true);

    // Auto-frame to bounds or use exported camera
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
      cam.updateProjectionMatrix();
      needsRender = true;
    };

    // Load GLB
    let mixer = null;
    gltfLoader.load(cfg.modelUrl, (gltf) => {
      const glb = gltf.scene;
      glb.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = !!cfg.shadows;
          o.receiveShadow = !!cfg.shadows;
          const m = o.material;
          if (m) {
            if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
            if (m.emissiveMap) m.emissiveMap.colorSpace = THREE.SRGBColorSpace;
            if (m.normalMap) m.normalMap.flipY = false; // glTF normal maps
            // Transparent emissive beams look nicer with depthWrite off
            if (m.transparent) m.depthWrite = false;
          }
        }
      });
      root.add(glb);

      // Prefer exported camera if present
      const camNode = gltf.cameras?.[0] || glb.getObjectByProperty('isCamera', true);
      if (camNode && camNode.isCamera) {
        camera.copy(camNode);
        camera.updateProjectionMatrix();
      } else {
        frameObject(glb, camera);
      }

      // Animations
      if (gltf.animations && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(glb);
        gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
      }

      needsRender = true;
    });

    // Resize / DPR
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
      needsRender = true;
    };
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    window.addEventListener('resize', fit, { passive: true });
    requestAnimationFrame(fit);

    // Render loop (with hard pause + demand)
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
      const dt = clock.getDelta();
      if (wasPaused) {
        wasPaused = false;
      }

      if (cfg.autoSpinY) {
        root.rotation.y += cfg.autoSpinY * dt * 60; // fps-independent
        needsRender = true;
      }
      if (mixer) {
        mixer.update(dt);
        needsRender = true;
      }
      if (controls) controls.update();

      if (needsRender) {
        composer.render();
        needsRender = false;
      }
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    // Cleanup
    return () => {
      try { ro.disconnect(); } catch {}
      window.removeEventListener('resize', fit);
      if (rafId) cancelAnimationFrame(rafId);
      if (pollId) clearInterval(pollId);
      composer?.dispose();
      renderer?.dispose();
      ktx2?.dispose?.();
      draco?.dispose?.();
      pmrem?.dispose?.();
      // dispose textures/materials if you created any extra
    };
  }, [dprCap, options]);

  const onToggle = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
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
      className={className}
      style={{ width: '100%', position: 'relative' }}
    />
  );
}
