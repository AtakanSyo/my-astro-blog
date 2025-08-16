// src/interactive/gpu-demo/loader.ts
import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';

type Controls = { button?: HTMLElement | null; stage?: HTMLElement | null };

export default async function init(canvas: HTMLCanvasElement, _controls?: Controls) {
  // --- renderer / scene / camera ---
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Fullscreen quad that will show the compute texture
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  scene.add(quad);

  // --- GPU Compute setup ---
  const WIDTH = 128, HEIGHT = 128;
  const gpu = new GPUComputationRenderer(WIDTH, HEIGHT, renderer);

  // Seed texture (RGBA float32)
  const initTex = gpu.createTexture();
  {
    const data = initTex.image.data;
    for (let i = 0; i < data.length; i += 4) {
      const x = (i / 4) % WIDTH;
      const y = Math.floor((i / 4) / WIDTH);
      data[i + 0] = x / WIDTH;   // R
      data[i + 1] = y / HEIGHT;  // G
      data[i + 2] = 0.0;         // B
      data[i + 3] = 1.0;         // A
    }
  }

  // NOTE:
  // - Avoid 'texture' (reserved function in WebGL2) → use 'uTexture'
  // - Avoid 'resolution' (can collide) → use 'uResolution'
  // - Use texture(uTexture, uv) (WebGL2)
  const computeShader = /* glsl */`
    precision highp float;

    // DO NOT redeclare 'uniform sampler2D uTexture;' — GPUComputationRenderer injects it.
    uniform vec2  uResolution;
    uniform float uTime;

    void main() {
      vec2 uv = gl_FragCoord.xy / uResolution;

      // 'uTexture' is available automatically because we named the variable 'uTexture'
      vec4 texel = texture(uTexture, uv);

      float wave = 0.5 + 0.5 * sin(uTime + uv.x * 10.0 + uv.y * 6.0);
      texel.g = mix(texel.g, wave, 0.05);

      gl_FragColor = texel;
    }
  `;

  // Create the compute variable; the sampler uniform name == variable name
  const variable = gpu.addVariable('uTexture', computeShader, initTex);

  // Declare dependencies
  gpu.setVariableDependencies(variable, [variable]);

  // Provide uniforms BEFORE init()
  (variable.material.uniforms as any).uTime       = { value: 0.0 };
  (variable.material.uniforms as any).uResolution = { value: new THREE.Vector2(WIDTH, HEIGHT) };

  // Init pipeline
  const err = gpu.init();
  if (err) throw new Error(err);

  // Visualize the compute texture
  const visMat = new THREE.ShaderMaterial({
    uniforms: { map: { value: gpu.getCurrentRenderTarget(variable).texture } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform sampler2D map;
      varying vec2 vUv;
      void main() { gl_FragColor = texture(map, vUv); }
    `
  });
  quad.material = visMat;

  // --- sizing ---
  function resize() {
    const parent = canvas.parentElement as HTMLElement | null;
    const w = canvas.clientWidth || parent?.clientWidth || 800;
    const h = canvas.clientHeight || parent?.clientHeight || 450;
    renderer.setSize(w, h, false);
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // --- animate ---
  let running = true;
  let raf = 0;
  function render(t: number) {
    if (!running) return;

    (variable.material.uniforms as any).uTime.value = t * 0.001;

    gpu.compute();
    visMat.uniforms.map.value = gpu.getCurrentRenderTarget(variable).texture;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(render);
  }
  raf = requestAnimationFrame(render);

  // Public API
  function start() { if (!running) { running = true; raf = requestAnimationFrame(render); } }
  function stop()  { running = false; cancelAnimationFrame(raf); }
  function dispose() {
    stop(); ro.disconnect(); gpu.dispose(); renderer.dispose();
    (quad.geometry as THREE.BufferGeometry).dispose(); visMat.dispose();
  }

  return { start, stop, dispose };
}