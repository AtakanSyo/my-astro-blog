// /public/interactive/nebula/runtime.js
// WebGL2 (Three.js) — Nebula burst with curl-noise filaments.
// - Colorful “cosmic gradient” (cyan→magenta→amber)
// - Slow expansion (~30 s), single instanced draw, additive blending
// - No GLSL bitwise ops (WebGL2-safe)

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161/build/three.module.js';

export async function run(canvas, { pausedRef }) {
  // ---- renderer / scene / camera ----
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x0a0f16, 1);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 4.0);

  // DPR cap + fit
  const DPR_CAP = Math.min(1.5, window.devicePixelRatio || 1);
  function fit() {
    const w = Math.max(1, Math.floor(canvas.clientWidth  * DPR_CAP));
    const h = Math.max(1, Math.floor(canvas.clientHeight * DPR_CAP));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(fit);
  ro.observe(canvas); fit();

  // ---- background stars ----
  const stars = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.MeshBasicMaterial({
      map: makeStarTex(900, 600),
      transparent: true,
      depthTest: false,
      depthWrite: false,
    })
  );
  stars.position.z = -2.5;
  scene.add(stars);

  // ---- instanced burst ----
  const N    = 30000;  // particle count
  const LIFE = 30.0;   // seconds to full radius
  const RMAX = 1.4;    // final shell radius (world units)

  // Quad for soft-disc sprite
  const quad = new Float32Array([
    -1,-1,0,  1,-1,0,  1, 1,0,
    -1,-1,0,  1, 1,0, -1, 1,0
  ]);

  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(quad, 3));
  geo.instanceCount = N;

  // Instance attributes
  const iDir   = new Float32Array(N * 3);
  const iBirth = new Float32Array(N);
  const iHue   = new Float32Array(N);

  // Uniform-on-sphere (Marsaglia)
  function sphereDir() {
    let u, v, s;
    do { u = Math.random()*2-1; v = Math.random()*2-1; s = u*u+v*v; } while (s === 0 || s >= 1);
    const k = Math.sqrt(1 - s);
    return [2*u*k, 2*v*k, 1 - 2*s];
  }

  for (let i = 0; i < N; i++) {
    const [x,y,z] = sphereDir();
    iDir[i*3+0] = x; iDir[i*3+1] = y; iDir[i*3+2] = z;
    iBirth[i]    = Math.random() * (LIFE * 0.85);                // staggered emission
    const base   = Math.random();
    const bias   = 0.35 + 0.65 * Math.random();                  // cosmic gradient bias
    iHue[i]      = (base * 0.25 + bias * 0.75) % 1.0;
  }

  geo.setAttribute('iDir',   new THREE.InstancedBufferAttribute(iDir,   3));
  geo.setAttribute('iBirth', new THREE.InstancedBufferAttribute(iBirth, 1));
  geo.setAttribute('iHue',   new THREE.InstancedBufferAttribute(iHue,   1));

  const burstMat = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uRes:  { value: new THREE.Vector2(1,1) },
      uTime: { value: 0 },
      uLife: { value: LIFE },
      uRmax: { value: RMAX },

      // flow
      uNoiseScale: { value: 1.6 },
      uCurlAmp:    { value: 0.28 },
      uDrift:      { value: 0.18 },
      uTwirl:      { value: 0.5 },

      // size/brightness
      uHeadGain:   { value: 1.6 },
      uSizePx:     { value: 1.8 },
    },
    vertexShader: /* glsl */`
      precision highp float;
      // DO NOT redeclare 'position' in ShaderMaterial (Three injects it)
      attribute vec3 iDir;
      attribute float iBirth;
      attribute float iHue;

      uniform vec2  uRes;
      uniform float uTime, uLife, uRmax;
      uniform float uNoiseScale, uCurlAmp, uDrift, uTwirl, uHeadGain, uSizePx;

      varying vec2  vCorner;
      varying float vAge01;
      varying float vHue;
      varying float vFade;

      // ---- value noise (no bitwise ops) ----
      float hash1(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }

      float valueNoise(vec3 p){
        vec3 i = floor(p);
        vec3 f = fract(p);
        vec3 u = f*f*(3.0-2.0*f);

        float n000 = hash1(i + vec3(0,0,0));
        float n100 = hash1(i + vec3(1,0,0));
        float n010 = hash1(i + vec3(0,1,0));
        float n110 = hash1(i + vec3(1,1,0));
        float n001 = hash1(i + vec3(0,0,1));
        float n101 = hash1(i + vec3(1,0,1));
        float n011 = hash1(i + vec3(0,1,1));
        float n111 = hash1(i + vec3(1,1,1));

        float nx00 = mix(n000, n100, u.x);
        float nx10 = mix(n010, n110, u.x);
        float nx01 = mix(n001, n101, u.x);
        float nx11 = mix(n011, n111, u.x);

        float nxy0 = mix(nx00, nx10, u.y);
        float nxy1 = mix(nx01, nx11, u.y);

        return mix(nxy0, nxy1, u.z);
      }

      float fbm(vec3 p){
        float v = 0.0, a = 0.5;
        for (int k = 0; k < 5; ++k) {
          v += a * valueNoise(p);
          p *= 2.03;
          a *= 0.55;
        }
        return v;
      }

      vec3 curl(vec3 p){
        float e = 0.15;
        float n1 = fbm(p + vec3(0.0, e, 0.0));
        float n2 = fbm(p - vec3(0.0, e, 0.0));
        float n3 = fbm(p + vec3(0.0, 0.0, e));
        float n4 = fbm(p - vec3(0.0, 0.0, e));
        float n5 = fbm(p + vec3(e, 0.0, 0.0));
        float n6 = fbm(p - vec3(e, 0.0, 0.0));
        return normalize(vec3(n2 - n1, n5 - n6, n3 - n4));
      }

      vec3 rotY(vec3 p, float a){ float s=sin(a), c=cos(a); return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z); }

      void main(){
        float age  = clamp(uTime - iBirth, 0.0, uLife);
        float a01  = age / uLife;
        vAge01 = a01;

        // radial growth
        float r = uRmax * (1.0 - pow(1.0 - a01, 1.6));

        vec3 d = normalize(iDir);
        vec3 p = d * (a01 * uNoiseScale + 0.5);

        vec3 w   = curl(p + vec3(0.0, 0.7*uTime, 0.0));
        float wob = uCurlAmp * (0.2 + 0.8 * smoothstep(0.15, 1.0, a01));

        vec3 spun = rotY(d, uTwirl * a01);
        vec3 tangent = normalize(cross(spun, vec3(0.0,1.0,0.0)));
        vec3 off = wob * w + uDrift * tangent * (0.6 + 0.4 * fbm(p + 2.7));

        vec3 P = spun * r + off;

        // fade: bright core + slight rim lift
        float core = smoothstep(0.0, 0.25, a01);
        float rim  = smoothstep(0.65, 1.0, a01) * 0.35;
        vFade = (1.2 - core) + rim;

        // hue with tiny noise shift
        vHue = fract(iHue + 0.12 * fbm(p + 4.3));

        // sprite size (px)
        float sizePx = uSizePx * (1.0 + 2.4 * (1.0 - a01));

        // project to clip, then offset by pixel-sized quad corners
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(P, 1.0);
        vec2 ndcOffset = position.xy * sizePx / (0.5 * uRes);
        clip.xy += ndcOffset * clip.w;
        gl_Position = clip;

        vCorner = position.xy;
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2  vCorner;
      varying float vAge01;
      varying float vHue;
      varying float vFade;

      vec3 hsv2rgb(float h, float s, float v){
        h = fract(h);
        float r = abs(h*6.0 - 3.0) - 1.0;
        float g = 2.0 - abs(h*6.0 - 2.0);
        float b = 2.0 - abs(h*6.0 - 4.0);
        vec3 rgb = clamp(vec3(r,g,b), 0.0, 1.0);
        return v * mix(vec3(1.0), rgb, s);
      }

      vec3 cosmic(float h, float v){
        float s = 0.9;
        return hsv2rgb(h, s, v);
      }

      void main(){
        float d = length(vCorner);
        if (d > 1.0) discard;

        float disc = 1.0 - d*d;

        // brightness vs age
        float v = clamp(0.25 + 0.85 * vFade, 0.0, 1.0);

        // desaturate hot core a touch
        float satDrop = smoothstep(0.0, 0.25, vAge01);
        float sat = mix(0.2, 1.0, 1.0 - satDrop);

        vec3 col = cosmic(vHue, v);
        col = mix(col, vec3(1.0, 0.8, 0.55), smoothstep(0.7, 1.0, vAge01) * 0.35);

        float alpha = disc * (0.55 + 0.45 * v) * (0.9 - 0.3 * vAge01);
        gl_FragColor = vec4(col * alpha, alpha);
      }
    `,
  });

  const burst = new THREE.Mesh(geo, burstMat);
  burst.frustumCulled = false;
  scene.add(burst);

  // ---- vignette ----
  const vignette = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`,
      fragmentShader: `
        precision highp float; varying vec2 vUv;
        void main(){
          vec2 p = vUv*2.0 - 1.0;
          float a = smoothstep(0.6, 1.25, length(p));
          gl_FragColor = vec4(0.0,0.0,0.0, a*0.55);
        }
      `,
    })
  );
  vignette.renderOrder = 10;
  scene.add(vignette);

  // ---- loop ----
  const start = performance.now();
  function tick() {
    if (pausedRef && pausedRef()) return renderer.setAnimationLoop(tick);

    const t = (performance.now() - start) / 1000;
    const w = renderer.domElement.width, h = renderer.domElement.height;

    burstMat.uniforms.uRes.value.set(w, h);
    burstMat.uniforms.uTime.value = t;

    stars.rotation.z = 0.02 * t;

    renderer.render(scene, camera);
    renderer.setAnimationLoop(tick);
  }
  renderer.setAnimationLoop(tick);

  // ---- helpers ----
  function makeStarTex(w, h){
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const c = document.createElement('canvas');
    c.width  = Math.floor(w * dpr);
    c.height = Math.floor(h * dpr);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0a0f16';
    ctx.fillRect(0,0,c.width,c.height);

    const N = Math.floor(420 + 0.00035 * w * h);
    for (let i=0;i<N;i++){
      const x = Math.random()*c.width, y = Math.random()*c.height;
      const m = Math.random();
      const s = 0.7 + 2.8 * Math.pow(m,3.2);
      const hue = 200 + Math.floor(70*Math.random());
      const a = 0.35 + 0.55*Math.random();
      ctx.fillStyle = `hsla(${hue},35%,85%,${a})`;
      ctx.beginPath(); ctx.arc(x,y,s,0,Math.PI*2); ctx.fill();
      if (m > 0.93) {
        ctx.fillStyle = `rgba(230,230,255,${0.25+0.5*Math.random()})`;
        ctx.fillRect(x-s*1.4, y-0.4, s*2.8, 0.8);
        ctx.fillRect(x-0.4, y-s*1.4, 0.8, s*2.8);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 2;
    return tex;
  }
}