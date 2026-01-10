// GravityLens.jsx
import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import SimStage from "./lib/simStage.jsx";

/**
 * Thin-lens gravitational lens (Einstein ring) with a lensed background star texture.
 *
 * Props
 * - id:             string  canvas id
 * - aspect:         CSS aspect ratio (e.g., "16 / 9")
 * - dprCap:         number  max devicePixelRatio (default 2)
 * - options:        object  lens/background params (see defaults below)
 * - showPause:      boolean show a pause button (default true)
 * - pausedInitially:boolean start paused (default false)
 * - pausedGetter:   () => boolean  optional external pause fn; if provided, overrides internal state
 *
 * Usage in MDX/Astro:
 *   import GravityLens from "../../components/GravityLens.jsx";
 *   <GravityLens client:only="react" />
 */
export default function GravityLens({
  id = "gravity-lens",
  aspect = "16 / 9",
  dprCap = 2,
  options,
  showPause = true,
  pausedInitially = false,
  pausedGetter = null,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const pausedRef = useRef(!!pausedInitially);
  const [paused, setPaused] = useState(!!pausedInitially);
  const [ready, setReady] = useState(false);
  const madeVisibleRef = useRef(false);
  const opts = useMemo(() => options ?? {}, [options]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // ---- Options / defaults ----
    const CFG = {
      // Lens look
      thetaE: opts.thetaE ?? 0.24, // Einstein radius (NDC-ish)
      gamma: opts.gamma ?? 0.05, // weak external shear strength
      phi: opts.phi ?? 0.25, // shear angle (radians)
      lensGlow: opts.lensGlow ?? 0.1,
      exposure: opts.exposure ?? 5.25,

      // Background stars texture (will be lensed)
      bgUrl:
        opts.bgUrl ?? "/interactive/gravity-lens/stars_texture.jpg",
      bgScale: opts.bgScale ?? 1.0, // how “zoomed” the background appears
      bgGain: opts.bgGain ?? 0.0, // brightness multiplier

      // Source galaxy (adds a clear arc/ring on top of the star field)
      srcR: opts.srcR ?? 0.085,
      srcQ: opts.srcQ ?? 0.7,
      srcAngle: opts.srcAngle ?? 0.4,

      // Gentle auto-orbit (set orbitSpeed: 0 for static)
      orbitRadius: opts.orbitRadius ?? 0.16,
      orbitSpeed: opts.orbitSpeed ?? 0.06,
    };

    // ---- Renderer / scene / camera ----
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setClearColor(0x000000, 0); // transparent bg if page is black anyway

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const quadGeo = new THREE.PlaneGeometry(2, 2);

    // ---- Background stars texture ----
    const loader = new THREE.TextureLoader();
    const bgTex = loader.load(CFG.bgUrl, () => {
      setReady(true);
    });
    bgTex.flipY = false;
    bgTex.premultiplyAlpha = false;   // keep alpha straight
    bgTex.wrapS = bgTex.wrapT = THREE.RepeatWrapping;
    bgTex.anisotropy =
      Math.min(8, renderer.capabilities.getMaxAnisotropy?.() || 1);
    bgTex.colorSpace = THREE.SRGBColorSpace;
    bgTex.minFilter = THREE.LinearMipmapLinearFilter;
    bgTex.magFilter = THREE.LinearFilter;
    bgTex.generateMipmaps = true;

    // ---- Shader uniforms/material ----
    const uniforms = {
      uTime: { value: 0.0 },
      uResolution: { value: new THREE.Vector2(1, 1) },

      // Lens params
      uThetaE: { value: CFG.thetaE },
      uGamma: { value: CFG.gamma },
      uPhi: { value: CFG.phi },
      uLensGlow: { value: CFG.lensGlow },
      uExposure: { value: CFG.exposure },

      // Source galaxy
      uSrcR: { value: CFG.srcR },
      uSrcQ: { value: CFG.srcQ },
      uSrcAngle: { value: CFG.srcAngle },

      // Orbit
      uOrbitRadius: { value: CFG.orbitRadius },
      uOrbitSpeed: { value: CFG.orbitSpeed },

      // Background
      uBgTex: { value: bgTex },
      uBgScale: { value: CFG.bgScale },
      uBgGain: { value: CFG.bgGain },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;

        uniform vec2  uResolution;
        uniform float uTime;

        // Lens
        uniform float uThetaE;
        uniform float uGamma;
        uniform float uPhi;
        uniform float uLensGlow;
        uniform float uExposure;

        // Source galaxy
        uniform float uSrcR;
        uniform float uSrcQ;
        uniform float uSrcAngle;

        // Orbit of source center
        uniform float uOrbitRadius;
        uniform float uOrbitSpeed;

        // Background stars
        uniform sampler2D uBgTex;
        uniform float uBgScale;
        uniform float uBgGain;


        
        mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

        vec3 aces(vec3 x){
          const float a=2.51, b=0.03, c=2.43, d=0.59, e=0.14;
          return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
        }

        void main() {
          // Image-plane coords with aspect correction so circles look round
          vec2 uv = vUv * 2.0 - 1.0; // [-1,1]
          float aspect = uResolution.x / uResolution.y;
          vec2 theta = vec2(uv.x * aspect, uv.y);

          // Source center does a slow orbit (set uOrbitSpeed=0 for static)
          float t = uTime * uOrbitSpeed * 6.28318530718;
          vec2 beta0 = uOrbitRadius * vec2(cos(t), 0.7 * sin(t));

          // --- Thin-lens deflection: point mass + external shear ---
          float r2 = dot(theta, theta) + 1e-8;
          vec2 alpha_point = (uThetaE*uThetaE) * theta / r2;

          float c2=cos(2.0*uPhi), s2=sin(2.0*uPhi);
          mat2 G = mat2(c2, s2, s2, -c2);
          vec2 alpha_shear = uGamma * (G * theta);

          vec2 alpha = alpha_point + alpha_shear;
          vec2 beta  = theta - alpha; // source-plane coordinate

          // --- Lensed background: sample star texture in source plane ---
          // Keep stars roughly isotropic regardless of aspect by scaling x.
          vec2 betaN = vec2(beta.x / max(1e-6, aspect), beta.y);
          vec2 bgUv = 0.5 + uBgScale * betaN; // center on 0.5, allow wrap
          vec3 bg = texture2D(uBgTex, bgUv).rgb * uBgGain;

          // --- Simple elliptical Gaussian galaxy in source plane ---
          vec2 x = beta - beta0;
          x = rot(uSrcAngle) * x;
          x.y /= max(0.05, uSrcQ);
          float Igal = exp(-0.5 * dot(x,x) / (uSrcR*uSrcR));
          vec3 galCol = vec3(20.15, 0.3, 0.12) * Igal;

          // Foreground lens galaxy glow in image plane (unlensed)
          float r = length(theta);
          vec3 lensGlow = vec3(1.0, 0.96, 1.06) * (uLensGlow * exp(-3.0 * r));

          // Compose
          vec3 col = bg + galCol + lensGlow;

          // Vignette + exposure
          float vign = smoothstep(1.35, 0.2, length(uv));
          col *= uExposure * vign;

          // Tonemap to sRGB
          col = aces(col);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
      transparent: false,
    });

    const quad = new THREE.Mesh(quadGeo, material);
    scene.add(quad);

    // ---- Resize ----
    const resize = () => {
      const w = Math.max(1, container.clientWidth | 0);
      const h = Math.max(1, container.clientHeight | 0);
      renderer.setSize(w, h, false);
      uniforms.uResolution.value.set(w, h);
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    requestAnimationFrame(resize);
    const onOrient = () => resize();
    window.addEventListener("orientationchange", onOrient);

    // ---- Animation with HARD PAUSE ----
    let rafId = 0;
    let pollId = 0;

    const getPaused =
      typeof pausedGetter === "function"
        ? pausedGetter
        : () => pausedRef.current;

    function startPollingForResume() {
      if (pollId) return;
      pollId = window.setInterval(() => {
        if (!getPaused()) {
          clearInterval(pollId);
          pollId = 0;
          rafId = requestAnimationFrame(loop);
        }
      }, 100);
    }

    const clock = new THREE.Clock(false);
    clock.start();
    let t = 0;

    function loop() {
      if (getPaused()) {
        if (clock.running) clock.stop();
        // no t increment, no render = stays frozen at initial frame
      } else {
        if (!clock.running) clock.start();
        const dt = Math.min(clock.getDelta(), 0.05);
        t += dt;
        uniforms.uTime.value = t;
        renderer.render(scene, camera);
      }
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);

    // ---- Cleanup ----
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (pollId) clearInterval(pollId);
      ro.disconnect();
      window.removeEventListener("orientationchange", onOrient);
      quad.geometry?.dispose?.();
      material.dispose();
      bgTex?.dispose?.();
      renderer.dispose();
    };
  }, [dprCap, opts, pausedGetter]);

  // keep refs in sync with React state
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const onToggle = () => {
    setPaused((p) => {
      const next = !p;
      if (next === false && !madeVisibleRef.current) {
        madeVisibleRef.current = true;
        const el = containerRef.current;
        if (el && !el.classList.contains('is-visible')) el.classList.add('is-visible');
      }
      return next;
    });
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
    >
      {!ready && (
        <div className="pill sim-controls-inline" style={{ position: "absolute" }} />
      )}
    </SimStage>
  );
}
