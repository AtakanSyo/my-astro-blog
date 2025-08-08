// /public/scripts/nebula-webgl2_three.js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161/build/three.module.js';

export async function run(canvas, { pausedRef }) {
  console.log('[nebula-three] starting WebGL2 fallback');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x0a0f16, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

  // Resize
  const DPR = Math.min(1.5, window.devicePixelRatio || 1);
  const fit = () => {
    const w = Math.max(1, Math.floor(canvas.clientWidth * DPR));
    const h = Math.max(1, Math.floor(canvas.clientHeight * DPR));
    renderer.setSize(w, h, false);
  };
  new ResizeObserver(fit).observe(canvas); fit();

  // ---------- Instanced geometry ----------
  const N = 48000;

  const geo = new THREE.InstancedBufferGeometry();
  // Unit quad with standard 'position' (vec3) so Three is happy
  const quad = new Float32Array([
    -1, -1, 0,   1, -1, 0,   1,  1, 0,
    -1, -1, 0,   1,  1, 0,  -1,  1, 0
  ]);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(quad, 3));
  geo.instanceCount = N;                // <- important

  // Instance attributes
  const dir    = new Float32Array(N * 3);
  const jitter = new Float32Array(N);
  const len    = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    // sample unit sphere (Marsaglia)
    let u = 0, v = 0, s = 2;
    while (s >= 1 || s === 0) { u = Math.random()*2-1; v = Math.random()*2-1; s = u*u + v*v; }
    let x = 2*u*Math.sqrt(1-s), y = 1-2*s, z = 2*v*Math.sqrt(1-s);

    // torus / jets bias
    const r = Math.random();
    if (r < 0.22) { y *= 0.22; const n = 1/Math.hypot(x,y,z); x*=n;y*=n;z*=n; }
    else if (r < 0.28) { const sgn = (i&1)?1:-1; x*=0.25; z*=0.25; y = sgn*Math.abs(y);
      const n = 1/Math.hypot(x,y,z); x*=n;y*=n;z*=n; }

    dir[i*3+0] = x; dir[i*3+1] = y; dir[i*3+2] = z;
    jitter[i]  = (Math.random()-0.5)*0.05; // static radial jitter
    len[i]     = Math.pow(Math.random(), 0.8);
  }

  geo.setAttribute('iDir',    new THREE.InstancedBufferAttribute(dir, 3));
  geo.setAttribute('iJitter', new THREE.InstancedBufferAttribute(jitter, 1));
  geo.setAttribute('iLen',    new THREE.InstancedBufferAttribute(len, 1));

  // ---------- Material ----------
  const mat = new THREE.RawShaderMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime:  { value: 0 },
      uRes:   { value: new THREE.Vector2(1,1) },
      uRin:   { value: 0 },
      uRout:  { value: 0 },
      uSpinY: { value: 0.0 },
      uSpinX: { value: 0.0 }
    },
    vertexShader: `
      precision highp float;
      attribute vec3 position;     // quad corner (-1..1, z ignored)
      attribute vec3 iDir;         // unit direction
      attribute float iJitter;     // static radial jitter
      attribute float iLen;        // sprite size variance

      uniform vec2  uRes;
      uniform float uRin, uRout;
      uniform float uTime, uSpinY, uSpinX;

      varying float vE;
      varying vec2  vCorner;

      vec3 rotY(vec3 p, float a){ float s=sin(a), c=cos(a); return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z); }
      vec3 rotX(vec3 p, float a){ float s=sin(a), c=cos(a); return vec3(p.x, c*p.y - s*p.z, s*p.y + c*p.z); }

      // small animated tangent offset (stable, no flicker)
      vec3 tangentOffset(vec3 d, float t){
        vec3 t1 = normalize(cross(d, vec3(0.0,1.0,0.0)));
        vec3 t2 = normalize(cross(d, t1));
        float a = sin(dot(d, vec3(0.7,0.3,0.5)) + t*0.6);
        float b = cos(dot(d, vec3(0.2,0.8,0.4)) - t*0.4);
        return normalize(t1*a + t2*b);
      }

      void main(){
        // Shell radius with static jitter
        float eJ = clamp(0.65 + 0.35 * (0.5 + 0.5*iJitter), 0.0, 1.0);
        float r  = mix(uRin, uRout, eJ);

        // slow world drift
        vec3 d = rotX(rotY(iDir, uSpinY), uSpinX);

        // subtle filament wobble
        vec3 off = tangentOffset(d, uTime) * r * 0.12;

        vec3 P = d * r + off;

        // edge metric (0 inner → 1 outer)
        vE = clamp((r - uRin) / max(1e-3, (uRout - uRin)), 0.0, 1.0);
        vCorner = position.xy;

        float size = 1.2 + 2.1 * iLen * (0.6 + 0.6*vE);
        vec2 pixel = position.xy * size / (0.5 * uRes);

        vec2 ndc = vec2(P.x/(0.5*uRes.x), -P.y/(0.5*uRes.y));
        gl_Position = vec4(ndc + pixel, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying float vE;
      varying vec2  vCorner;

      void main(){
        float d = length(vCorner);
        if (d > 1.0) discard;

        vec3 core = vec3(0.35, 0.90, 1.0);
        vec3 fil  = vec3(1.00, 0.63, 0.31);
        float t = clamp(vE*1.1 - 0.05, 0.0, 1.0);
        vec3 col = mix(core, fil, t);

        float inner = exp(-pow(vE/0.22, 2.0));
        float outer = exp(-pow((1.0-vE)/0.40, 2.0));
        float alpha = (0.10 + 0.75*inner + 0.35*outer) * (1.0 - d*d);

        gl_FragColor = vec4(col * alpha, alpha);
      }
    `
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; // avoid needing bounding volumes
  scene.add(mesh);

  // ---------- Timeline ----------
  const start = performance.now();
  function tick() {
    if (pausedRef && pausedRef()) return renderer.setAnimationLoop(tick);

    const t = Math.min(30, (performance.now() - start)/1000);
    const grow = 1.0 - Math.pow(1.0 - t/30.0, 3.0); // easeOutCubic

    const w = renderer.domElement.width, h = renderer.domElement.height;
    mat.uniforms.uRes.value.set(w, h);

    const R = Math.min(w, h) * 0.45 * grow;
    mat.uniforms.uRin.value  = R * (1.0 - 0.10);
    mat.uniforms.uRout.value = R;
    mat.uniforms.uTime.value = t;
    mat.uniforms.uSpinY.value = 0.12 * t;
    mat.uniforms.uSpinX.value = 0.07 * t;

    renderer.clear();
    renderer.render(scene, camera);
    renderer.setAnimationLoop(tick);
  }
  renderer.setAnimationLoop(tick);
}