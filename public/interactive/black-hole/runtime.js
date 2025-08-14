import * as THREE from 'https://esm.sh/three@0.161';
import { EffectComposer } from 'https://esm.sh/three@0.161/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://esm.sh/three@0.161/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://esm.sh/three@0.161/examples/jsm/postprocessing/UnrealBloomPass.js';

export async function run(canvas, { pausedRef, options = {} } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.PerspectiveCamera(60, canvas.width / canvas.height, 0.1, 1000);
  camera.position.set(0, 5, 12);
  camera.lookAt(0, 0, 0);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.width, canvas.height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.5;

  // Postprocessing composer
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(canvas.width, canvas.height), 1.2, 0.4, 0.1));

  // Black hole core
  const holeGeo = new THREE.SphereGeometry(1, 64, 64);
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const hole = new THREE.Mesh(holeGeo, holeMat);
  scene.add(hole);

  

  // Radial gradient texture for accretion disk
  const diskSize = 512;
  const canvasTex = document.createElement('canvas');
  canvasTex.width = canvasTex.height = diskSize;
  const ctx = canvasTex.getContext('2d');

  const gradient = ctx.createRadialGradient(
    diskSize / 2, diskSize / 2, diskSize * 0.2,  // inner
    diskSize / 2, diskSize / 2, diskSize * 0.5   // outer
  );
  gradient.addColorStop(0.0, '#ffffff'); // inner white-hot
  gradient.addColorStop(0.3, '#ffd27f'); // yellow-orange
  gradient.addColorStop(0.6, '#ff6e3a'); // reddish-orange
  gradient.addColorStop(1.0, '#320000'); // dark outer

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, diskSize, diskSize);

  const diskTexture = new THREE.CanvasTexture(canvasTex);
  diskTexture.wrapS = diskTexture.wrapT = THREE.ClampToEdgeWrapping;
  diskTexture.colorSpace = THREE.SRGBColorSpace;

// --- NEW procedural shader accretion disk ---
const innerRadius = 1.4;
const outerRadius = 5.0;
const diskGeo = new THREE.RingGeometry(innerRadius, outerRadius, 256, 1);

const diskMat = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  transparent: true,
  uniforms: {
    uTime: { value: 0 },
    innerR: { value: innerRadius },
    outerR: { value: outerRadius }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform float innerR;
    uniform float outerR;
    varying vec2 vUv;

    void main() {
      // Shift UV so center is (0,0)
      vec2 uv = vUv - 0.5;
      float r = length(uv) * (outerR - innerR) + innerR;
      float angle = atan(uv.y, uv.x);

      // Swirl effect
      float swirl = sin(angle * 10.0 + uTime * 2.0) * 0.05;

      // Heat color gradient
      float heat = smoothstep(innerR, outerR, r - swirl);
      vec3 col = mix(vec3(1.0, 0.9, 0.6), vec3(1.0, 0.3, 0.0), heat);

      // Fade edges
      float alpha = 1.0 - smoothstep(outerR * 0.8, outerR, r);

      gl_FragColor = vec4(col, alpha);
    }
  `
});

const disk = new THREE.Mesh(diskGeo, diskMat);
disk.rotation.x = Math.PI / 2;
scene.add(disk);

  // Lighting
  const light = new THREE.PointLight(0xffffff, 1);
  light.position.set(10, 10, 10);
  scene.add(light);

  const clock = new THREE.Clock();

  function loop() {
    if (!pausedRef || !pausedRef()) {
      const t = clock.getElapsedTime();
      disk.rotation.z = t * 0.3;
    }
    composer.render();
    requestAnimationFrame(loop);
  }
  loop();
}