// JWSTSpin.jsx
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import SimStage from '../lib/SimStage.jsx';

export default function JWSTSpin({
  id = 'jwst-spin',
  aspect = '16 / 9',
  modelUrl = '/models/JWST_B.glb',
  autoSpinY = 0.006,
  startPaused = true,
  showPause = true,
  // New optional props:
  hdrUrl = '/hdr/venice_sunset_1k.hdr',   // put an .hdr in /public/hdr or pass null to disable
  enableBloom = true,
  bloomThreshold = 0.8,
  bloomStrength = 0.6,
  bloomRadius = 0.2,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const pausedRef = useRef(startPaused);
  const [paused, setPaused] = useState(startPaused);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.physicallyCorrectLights = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 5000);
    camera.position.set(0, 0.8, 3.5);

    // Root for model
    const root = new THREE.Group();
    scene.add(root);

    // Optional: load HDR env (specular/reflection highlights)
    let pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();

    const setEnv = (hdr) => {
      if (!hdrUrl) return;
      new RGBELoader().load(hdr, (tex) => {
        const env = pmrem.fromEquirectangular(tex).texture;
        scene.environment = env;
        tex.dispose();
      });
    };
    if (hdrUrl) setEnv(hdrUrl);

    // If model has no KHR lights, we’ll add a simple key fill:
    const fallbackLights = [];
    const addFallbackLights = () => {
      const hemi = new THREE.HemisphereLight(0xffffff, 0x101010, 0.6);
      const key = new THREE.DirectionalLight(0xffffff, 5.0);
      key.position.set(5, 5, 5);
      key.castShadow = true;
      fallbackLights.push(hemi, key);
      scene.add(hemi, key);
    };

    // Loaders: DRACO + KTX2 + Meshopt
    const draco = new DRACOLoader()
      .setDecoderPath('https://unpkg.com/three@0.165.0/examples/jsm/libs/draco/');

    const ktx2 = new KTX2Loader()
      .setTranscoderPath('https://unpkg.com/three@0.165.0/examples/jsm/libs/basis/')
      .detectSupport(renderer);

    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    loader.setKTX2Loader(ktx2);
    loader.setMeshoptDecoder(MeshoptDecoder);

    // Postprocessing
    let composer, renderPass, bloomPass;
    const initComposer = () => {
      composer = new EffectComposer(renderer);
      renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);
      if (enableBloom) {
        bloomPass = new UnrealBloomPass(
          new THREE.Vector2(container.clientWidth, container.clientHeight),
          bloomStrength, bloomRadius, bloomThreshold
        );
        composer.addPass(bloomPass);
      }
    };

    // Load model
    loader.load(modelUrl, (gltf) => {
      root.add(gltf.scene);

      // If no punctual lights are present in the glTF, add fallback lights
      const hasKHRlights =
        gltf.parser.json.extensions &&
        gltf.parser.json.extensions.KHR_lights_punctual;

      if (!hasKHRlights) addFallbackLights();

      frameObject(gltf.scene, camera);
    });

    // Resize
    const fit = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      if (composer) composer.setSize(w, h);
    };
    new ResizeObserver(fit).observe(container);
    fit();
    initComposer();

    // Animate
    renderer.setAnimationLoop(() => {
      if (!pausedRef.current) root.rotation.y += autoSpinY;
      if (composer) composer.render();
      else renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      composer?.dispose();
      pmrem?.dispose();
      renderer.dispose();
      fallbackLights.forEach(l => scene.remove(l));
    };
  }, [modelUrl, autoSpinY, startPaused, hdrUrl, enableBloom, bloomThreshold, bloomStrength, bloomRadius]);

  const onToggle = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
    if (!pausedRef.current) {
      const fig = containerRef.current;
      if (fig && !fig.classList.contains('is-visible')) fig.classList.add('is-visible');
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
      style={{ minHeight: 320 }}
    />
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
