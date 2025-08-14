// /public/interactive/newton/runtime.js
// Newton's Cradle — floating in space, aesthetic presets, silky motion (CDN)

import * as THREE from 'https://esm.sh/three@0.161';
import { RoomEnvironment } from 'https://esm.sh/three@0.161/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer }  from 'https://esm.sh/three@0.161/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }      from 'https://esm.sh/three@0.161/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://esm.sh/three@0.161/examples/jsm/postprocessing/UnrealBloomPass.js';

export async function run(canvas, { pausedRef, options = {} } = {}) {
  // ---------------- Aesthetic presets ----------------
  const THEMES = {
    noir: {
      bgTop: 0x0c0c0f, bgBottom: 0x000000, vignette: 0.65,
      metalColor: 0xb9c2d0, roughness: 0.18, metalness: 1.0,
      ropeColor: 0x2a2a2a, glow: { strength: 0.25, radius: 0.2, threshold: 0.85 },
      exposure: 1.05
    },
    museum: {
      bgTop: 0x151515, bgBottom: 0x0b0b0b, vignette: 0.55,
      metalColor: 0xd9d9d9, roughness: 0.22, metalness: 0.95,
      ropeColor: 0x3a3a3a, glow: { strength: 0.35, radius: 0.25, threshold: 0.82 },
      exposure: 1.08
    },
    glassGold: {
      bgTop: 0x101014, bgBottom: 0x050508, vignette: 0.6,
      metalColor: 0xf3d29a, roughness: 0.12, metalness: 1.0,
      ropeColor: 0x444444, glow: { strength: 0.45, radius: 0.3, threshold: 0.8 },
      exposure: 1.12, transmission: 0.25 // slight glassy look
    },
    mono: {
      bgTop: 0x121212, bgBottom: 0x121212, vignette: 0.5,
      metalColor: 0xdddddd, roughness: 0.35, metalness: 0.9,
      ropeColor: 0x2a2a2a, glow: { strength: 0.18, radius: 0.18, threshold: 0.9 },
      exposure: 1.0
    },
    tron: {
      bgTop: 0x0b1020, bgBottom: 0x05070d, vignette: 0.65,
      metalColor: 0xa9e1ff, roughness: 0.08, metalness: 1.0,
      ropeColor: 0x6bdcff, glow: { strength: 0.55, radius: 0.35, threshold: 0.75 },
      exposure: 1.15
    }
  };
  const theme = THEMES[options.theme] ?? THEMES.noir;

  // ---------------- Look & physics controls ----------------
  const NUM_BALLS     = options.numBalls      ?? 5;
  const BALL_RADIUS   = options.ballRadius    ?? 0.12;
  const STRING_LEN    = options.stringLength  ?? 0.5;
  const GAP           = options.gap           ?? 0.006;
  const DAMPING       = options.damping       ?? 0.004;
  const RESTITUTION   = options.restitution   ?? 0.99;
  const GRAVITY       = options.gravity       ?? 9.81;
  const INITIAL_ANGLE = options.initialAngle  ?? -0.60;
  const PULL_COUNT    = options.pullCount     ?? 1;

  // ---------------- Scene / Camera / Renderer ----------------
  const scene = new THREE.Scene();
  scene.background = null;

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
  camera.position.set(0.0, 0.35, 3.0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  const getDPR = () => Math.min(2, window.devicePixelRatio || 1);
  renderer.setPixelRatio(getDPR());
  renderer.setSize(canvas.clientWidth || 1, canvas.clientHeight || 1, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = theme.exposure;
  renderer.shadowMap.enabled = false;

  // Environment for nice reflections (but no visible floor/posts)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environment = env;

  // Minimal lights (just to help specular)
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(3.0, 2.0, 2.2);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0xffffff, 0.15));

  // ---------------- Background: gradient + subtle vignette ----------------
  const bg = makeGradientBackground(theme.bgTop, theme.bgBottom, theme.vignette);
  scene.add(bg);

  // ---------------- Post: subtle bloom ----------------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(canvas.clientWidth || 1, canvas.clientHeight || 1),
    theme.glow.strength, theme.glow.radius, theme.glow.threshold
  );
  composer.addPass(bloom);

  // ---------------- Invisible anchors (no bar, no posts) ----------------
  const spacing = (2 * BALL_RADIUS + GAP);
  const x0 = -((NUM_BALLS - 1) * spacing) / 2;
  const anchors = [];
  for (let i = 0; i < NUM_BALLS; i++) {
    anchors.push(new THREE.Vector3(x0 + i * spacing, 0.55, 0)); // floating in space
  }

  // ---------------- Materials ----------------
  const ballMatParams = {
    color: theme.metalColor, metalness: theme.metalness, roughness: theme.roughness, envMap: env
  };
  // Optional glassiness
  if (theme.transmission) {
    Object.assign(ballMatParams, {
      transparent: true, transmission: theme.transmission, thickness: 0.15, ior: 1.25
    });
  }
  const ballMat = new THREE.MeshPhysicalMaterial(ballMatParams);
  const ropeMat = new THREE.LineBasicMaterial({ color: theme.ropeColor });

  // ---------------- Balls + strings ----------------
  const balls = [];
  const strings = [];
  const theta = new Array(NUM_BALLS).fill(0);
  const omega = new Array(NUM_BALLS).fill(0);

  for (let i = 0; i < NUM_BALLS; i++) {
    if (i < PULL_COUNT) theta[i] = INITIAL_ANGLE;

    const geom = new THREE.SphereGeometry(BALL_RADIUS, 48, 48);
    const mesh = new THREE.Mesh(geom, ballMat);
    scene.add(mesh);
    balls.push(mesh);

    const strGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(6);
    strGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const line = new THREE.Line(strGeo, ropeMat);
    scene.add(line);
    strings.push(line);
  }

  function ballPos(i, th) {
    const a = anchors[i];
    return new THREE.Vector3(
      a.x + STRING_LEN * Math.sin(th),
      a.y - STRING_LEN * Math.cos(th),
      0
    );
  }
  function setLine(i, p) {
    const a = anchors[i];
    const arr = strings[i].geometry.attributes.position.array;
    arr[0] = a.x; arr[1] = a.y; arr[2] = a.z;
    arr[3] = p.x; arr[4] = p.y; arr[5] = p.z;
    strings[i].geometry.attributes.position.needsUpdate = true;
  }

  // Initial layout
  for (let i = 0; i < NUM_BALLS; i++) {
    const p = ballPos(i, theta[i]);
    balls[i].position.copy(p);
    setLine(i, p);
  }

  // ---------------- Dynamics ----------------
  const clock = new THREE.Clock();
  let raf = 0;
  let wasPaused = false;

  const PREFERS_REDUCED_MOTION = typeof matchMedia === 'function'
    ? matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  function isPaused() {
    if (pausedRef && pausedRef()) return true;
    if (PREFERS_REDUCED_MOTION) return true;
    if (document.visibilityState === 'hidden') return true;
    return false;
  }

  function integrate(dt) {
    // damped pendulum per ball
    const gOverL = GRAVITY / STRING_LEN;
    for (let i = 0; i < NUM_BALLS; i++) {
      omega[i] += -gOverL * Math.sin(theta[i]) * dt;
      omega[i] *= Math.max(0, 1 - DAMPING * dt);
      theta[i] += omega[i] * dt;
    }

    // positions
    for (let i = 0; i < NUM_BALLS; i++) {
      const p = ballPos(i, theta[i]);
      balls[i].position.copy(p);
      setLine(i, p);
    }

    // collisions (adjacent)
    const bottomThresh = 0.40;
    for (let i = 0; i < NUM_BALLS - 1; i++) {
      const j = i + 1;
      const bi = balls[i], bj = balls[j];
      const dx = bj.position.x - bi.position.x;
      const minDist = 2 * BALL_RADIUS;

      if (dx < minDist - 1e-4) {
        if (Math.abs(theta[i]) < bottomThresh && Math.abs(theta[j]) < bottomThresh) {
          const vxi = STRING_LEN * omega[i] * Math.cos(theta[i]);
          const vxj = STRING_LEN * omega[j] * Math.cos(theta[j]);

          if (vxi > vxj) {
            let vxi2 = vxj * RESTITUTION;
            let vxj2 = vxi * RESTITUTION;

            const ci = Math.max(0.2, Math.abs(Math.cos(theta[i])));
            const cj = Math.max(0.2, Math.abs(Math.cos(theta[j])));
            omega[i] = vxi2 / (STRING_LEN * ci);
            omega[j] = vxj2 / (STRING_LEN * cj);

            const targetDx = minDist;
            const mid = 0.5 * (bi.position.x + bj.position.x);
            bi.position.x = mid - targetDx / 2;
            bj.position.x = mid + targetDx / 2;

            const si = THREE.MathUtils.clamp((bi.position.x - anchors[i].x) / STRING_LEN, -1, 1);
            const sj = THREE.MathUtils.clamp((bj.position.x - anchors[j].x) / STRING_LEN, -1, 1);
            theta[i] = Math.asin(si);
            theta[j] = Math.asin(sj);

            setLine(i, bi.position);
            setLine(j, bj.position);
          }
        }
      }
    }
  }

  // ---------------- Background helper ----------------
  function makeGradientBackground(topHex, bottomHex, vignette) {
    const geom = new THREE.SphereGeometry(20, 32, 32);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTop:    { value: new THREE.Color(topHex) },
        uBottom: { value: new THREE.Color(bottomHex) },
        uVign:   { value: vignette }
      },
      vertexShader: `
        varying vec3 vPos;
        void main(){
          vPos = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec3 vPos;
        uniform vec3 uTop, uBottom;
        uniform float uVign;
        void main(){
          float t = 0.5 + 0.5 * vPos.y;              // vertical blend
          vec3 col = mix(uBottom, uTop, t);
          float vign = smoothstep(1.0, uVign, length(vPos.xz));
          col *= mix(1.0, 0.75, vign);               // subtle vignette
          gl_FragColor = vec4(col, 1.0);
        }
      `
    });
    return new THREE.Mesh(geom, mat);
  }

  // ---------------- Resize & DPR watch ----------------
  function resize() {
    const w = Math.max(1, canvas.clientWidth | 0);
    const h = Math.max(1, canvas.clientHeight | 0);
    renderer.setPixelRatio(getDPR());
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    composer.setSize(w, h);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  let lastDPR = getDPR();
  const dprTick = setInterval(() => {
    const now = getDPR();
    if (now !== lastDPR) { lastDPR = now; resize(); }
  }, 500);

  // ---------------- Loop (hard pause aware) ----------------
  function loop() {
    if (isPaused()) { wasPaused = true; return void (raf = requestAnimationFrame(loop)); }
    if (wasPaused) { wasPaused = false; clock.getDelta(); }

    const dt = Math.min(0.02, clock.getDelta());
    const sub = 2, h = dt / sub;
    for (let s = 0; s < sub; s++) integrate(h);

    composer.render();
    raf = requestAnimationFrame(loop);
  }
  clock.start();
  raf = requestAnimationFrame(loop);

  // ---------------- Cleanup ----------------
  return () => {
    cancelAnimationFrame(raf);
    clearInterval(dprTick);
    ro.disconnect();
    pmrem.dispose();
    env.dispose?.();
    renderer.dispose();
    bg.geometry.dispose(); bg.material.dispose();
    ballMat.dispose(); ropeMat.dispose();
    balls.forEach(b => b.geometry.dispose());
    strings.forEach(s => s.geometry.dispose());
  };
}