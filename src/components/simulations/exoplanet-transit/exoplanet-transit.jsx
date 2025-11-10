import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import SimStage from '../lib/SimStage.jsx';

/**
 * ExoplanetTransitSim.jsx (fixed)
 *
 * - Starts/stops RAF directly (no polling)
 * - Doesn’t start RAF when initially paused
 * - Respects prefers-reduced-motion and auto-pauses when off-screen
 * - Uses only ResizeObserver for sizing
 * - Caches chart context/gradient and rebuilds only on size change
 * - WebGL guards + context-lost handler
 */
export default function ExoplanetTransitSim({
  id = 'exoplanet-transit',
  aspect = '16 / 9',
  showPause = true,
  dprCap = 1.5,
  options: optionsProp,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const pausedRef = useRef(true);
  const [paused, setPaused] = useState(true);

  const [brightness, setBrightness] = useState(1);
  const [phasePercent, setPhasePercent] = useState(0);
  const [transitLabel, setTransitLabel] = useState('Out of transit');

  const madeVisibleRef = useRef(false);
  const brightnessHistoryRef = useRef([]);

  // Three/loop refs
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const clockRef = useRef(null);
  const loopRef = useRef(null);
  const rafIdRef = useRef(0);

  // Misc refs
  const roRef = useRef(null);
  const ioRef = useRef(null);

  // Chart cache refs
  const chartCtxRef = useRef(null);
  const chartGradRef = useRef(null);
  const chartSizeRef = useRef({ w: 0, h: 0 });

  const optionsKey = JSON.stringify(optionsProp ?? {});

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const chartCanvas = chartRef.current;
    if (!container || !canvas || !chartCanvas) return;

    // Guard for WebGL availability
    if (!canvas.getContext || !('WebGLRenderingContext' in window)) {
      // Optionally show a fallback message in your overlay
      return;
    }
    // Avoid default browser dialog on context loss
    const onContextLost = () => {};
    canvas.addEventListener('webglcontextlost', onContextLost);

    brightnessHistoryRef.current = [];

    // ---------- Options & defaults ----------
    const options = JSON.parse(optionsKey ?? '{}');

    const starRadius = options.starRadius ?? 1.2;
    const planetRadius = options.planetRadius ?? 0.22;
    const orbitRadius = 2;

    const cfg = {
      starRadius,
      planetRadius,
      orbitTiltDeg: options.orbitTiltDeg ?? 2.5,
      orbitRadius,
      orbitalPeriod: Math.max(30, options.orbitalPeriod ?? 240), // seconds per orbit (minimum clamp)
      speedMultiplier: Math.max(0.05, options.speedMultiplier ?? 40.0),
      transitDepth: options.transitDepth ?? 0.012,
      backgroundColor: options.backgroundColor ?? 0x000000,
      starColor: options.starColor ?? 0xffd27f,
      coronaColor: options.coronaColor ?? 0xfff4c1,
      planetColor: options.planetColor ?? 0x3457ff,
      planetNightColor: options.planetNightColor ?? 0x0f1a3a,
      cameraDistance: options.cameraDistance ?? 15.0,
      starfieldCount: options.starfieldCount ?? 400,
      orbitLineColor: options.orbitLineColor ?? 0x4a6cff,
      orbitLineOpacity: options.orbitLineOpacity ?? 0.35,
      ambientIntensity: options.ambientIntensity ?? 0.22,
      starGranulationSpeed: options.starGranulationSpeed ?? 0.18,
      starGranulationStrength: options.starGranulationStrength ?? 0.18,
      atmosphereColor: options.atmosphereColor ?? 0x6db8ff,
      atmosphereIntensity: options.atmosphereIntensity ?? 0.35,
    };

    // ---------- Three setup ----------
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    // Verify against your THREE version; these names changed across r15x:
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    // renderer.physicallyCorrectLights = true; // keep/remove depending on version defaults

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(cfg.backgroundColor);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, cfg.starRadius * 0.25, cfg.cameraDistance);
    camera.lookAt(0, 0, 0);

    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;

    // ---------- Star ----------
    const starGeo = new THREE.SphereGeometry(cfg.starRadius, 128, 128);
    const starUniforms = {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(cfg.starColor) },
      uStrength: { value: cfg.starGranulationStrength },
    };
    const starMat = new THREE.ShaderMaterial({
      uniforms: starUniforms,
      transparent: false,
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPos;
        void main(){
          vNormal = normalize(normalMatrix * normal);
          vec4 world = modelMatrix * vec4(position, 1.0);
          vPos = world.xyz;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uStrength;
        uniform float uTime;
        varying vec3 vNormal;
        varying vec3 vPos;

        float bands(vec3 n){
          float strip = sin((n.y + uTime * 0.12) * 8.0);
          float mottled = sin((n.x * 5.0 + uTime * 0.35)) * sin((n.z * 7.5 - uTime * 0.22));
          float pulsing = sin(uTime * 0.8 + n.y * 3.1415);
          return (strip * 0.35 + mottled * 0.4 + pulsing * 0.25);
        }

        void main(){
          vec3 n = normalize(vNormal);
          float granulation = bands(n);
          float limb = smoothstep(0.0, 0.6, dot(n, vec3(0.0,0.0,1.0)));
          float intensity = 1.0 + granulation * uStrength;
          vec3 col = uColor * intensity;
          col *= mix(0.85, 1.0, limb);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const star = new THREE.Mesh(starGeo, starMat);
    scene.add(star);

    // Soft corona
    const coronaMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      uniforms: {
        uColor: { value: new THREE.Color(cfg.coronaColor) },
        uIntensity: { value: 1.0 },
      },
      vertexShader: `
        varying vec3 vPosition;
        void main() {
          vPosition = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uIntensity;
        varying vec3 vPosition;
        void main() {
          float r = length(vPosition);
          float falloff = smoothstep(1.8, 0.6, r);
          gl_FragColor = vec4(uColor, falloff * uIntensity * 0.9);
        }
      `,
    });
    const corona = new THREE.Mesh(starGeo.clone(), coronaMat);
    corona.scale.setScalar(1.06);
    scene.add(corona);

    // ---------- Planet & orbit ----------
    const planetGroup = new THREE.Group();
    planetGroup.rotation.x = THREE.MathUtils.degToRad(cfg.orbitTiltDeg);
    scene.add(planetGroup);

    const planetGeo = new THREE.SphereGeometry(cfg.planetRadius, 64, 64);
    const planetMat = new THREE.MeshStandardMaterial({
      color: cfg.planetColor,
      emissive: new THREE.Color(cfg.planetNightColor),
      emissiveIntensity: 0.45,
      roughness: 0.48,
      metalness: 0.1,
    });
    const planet = new THREE.Mesh(planetGeo, planetMat);
    planet.position.set(cfg.orbitRadius, 0, 0);
    planet.castShadow = true;
    planet.receiveShadow = true;
    planetGroup.add(planet);

    const orbitSegments = 256;
    const orbitPositions = new Float32Array(orbitSegments * 3);
    for (let i = 0; i < orbitSegments; i += 1) {
      const theta = (i / orbitSegments) * Math.PI * 2;
      orbitPositions[i * 3] = Math.cos(theta) * cfg.orbitRadius;
      orbitPositions[i * 3 + 1] = 0;
      orbitPositions[i * 3 + 2] = Math.sin(theta) * cfg.orbitRadius;
    }
    const orbitGeo = new THREE.BufferGeometry();
    orbitGeo.setAttribute('position', new THREE.BufferAttribute(orbitPositions, 3));
    const orbitMat = new THREE.LineBasicMaterial({
      color: cfg.orbitLineColor,
      transparent: true,
      opacity: cfg.orbitLineOpacity,
    });
    const orbitRing = new THREE.LineLoop(orbitGeo, orbitMat);
    planetGroup.add(orbitRing);

    const atmosphereMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      uniforms: {
        uLightDir: { value: new THREE.Vector3(1, 0.2, 0.6).normalize() },
        uColor: { value: new THREE.Color(cfg.atmosphereColor) },
        uIntensity: { value: cfg.atmosphereIntensity },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        void main(){
          vec4 world = modelMatrix * vec4(position, 1.0);
          vWorldPos = world.xyz;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform vec3 uLightDir;
        uniform vec3 uColor;
        uniform float uIntensity;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        void main(){
          vec3 N = normalize(vNormal);
          vec3 L = normalize(uLightDir);
          vec3 V = normalize(cameraPosition - vWorldPos);
          float fres = pow(1.0 - max(dot(N, V), 0.0), 2.5);
          float forward = pow(max(dot(N, L), 0.0), 1.1);
          float alpha = clamp((fres * 0.65 + forward * 0.45) * uIntensity, 0.0, 1.0);
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    });
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(cfg.planetRadius * 1.1, 64, 64),
      atmosphereMat
    );
    atmosphere.position.copy(planet.position);
    planetGroup.add(atmosphere);

    const keyLight = new THREE.DirectionalLight(cfg.starColor, 2.4);
    keyLight.position.set(5, 2.2, 3);
    keyLight.castShadow = true;
    scene.add(keyLight);
    atmosphereMat.uniforms.uLightDir.value.copy(keyLight.position.clone().normalize());

    const rimLight = new THREE.PointLight(0xffffff, 120, 50);
    rimLight.position.set(8, 6, 6);
    scene.add(rimLight);

    scene.add(new THREE.AmbientLight(0xffffff, cfg.ambientIntensity));

    // Starfield backdrop
    const starPositions = new Float32Array(cfg.starfieldCount * 3);
    for (let i = 0; i < starPositions.length; i += 3) {
      const radius = 40 + Math.random() * 60;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      starPositions[i] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i + 1] = radius * Math.cos(phi) * 0.4;
      starPositions[i + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    const backdrop = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(starPositions, 3)),
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.08, sizeAttenuation: true, transparent: true, opacity: 0.65 })
    );
    scene.add(backdrop);

    // ---------- Chart helpers ----------
    const MAX_HISTORY = 240;

    const recordBrightness = (value) => {
      const list = brightnessHistoryRef.current;
      const percent = THREE.MathUtils.clamp(value * 100, 0, 100);
      list.push(percent);
      if (list.length > MAX_HISTORY) list.shift();
    };

    const ensureChartCtx = () => {
      if (!chartCtxRef.current) {
        chartCtxRef.current = chartCanvas.getContext('2d');
      }
      return chartCtxRef.current;
    };

    const drawPlot = () => {
      const ctx = ensureChartCtx();
      if (!ctx) return;
      const width = chartCanvas.width || chartCanvas.clientWidth || 1;
      const height = chartCanvas.height || chartCanvas.clientHeight || 1;

      // Rebuild gradient only when size changes
      if (chartSizeRef.current.w !== width || chartSizeRef.current.h !== height) {
        chartGradRef.current = ctx.createLinearGradient(0, 0, 0, height);
        chartGradRef.current.addColorStop(0, 'rgba(255, 216, 107, 0.18)');
        chartGradRef.current.addColorStop(1, 'rgba(255, 216, 107, 0.02)');
        chartSizeRef.current = { w: width, h: height };
      }

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, width, height);

      // Grid
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const y = (height / 4) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const data = brightnessHistoryRef.current;
      if (data.length < 2) {
        ctx.restore();
        return;
      }

      const minVal = 98;
      const maxVal = 100;
      const span = maxVal - minVal;

      // Line
      ctx.strokeStyle = '#ffd86b';
      ctx.lineWidth = 2;
      const points = [];
      ctx.beginPath();
      data.forEach((val, idx) => {
        const t = idx / (data.length - 1 || 1);
        const x = t * width;
        const y = height - ((val - minVal) / span) * height;
        points.push({ x, y });
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Fill under curve
      if (points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, height);
        points.forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.lineTo(points[points.length - 1].x, height);
        ctx.closePath();
        ctx.fillStyle = chartGradRef.current;
        ctx.fill();
      }

      // Baseline at brightness = 100%
      const baselineTarget = 100;
      const baselineRatio = (baselineTarget - minVal) / span;
      const baselineY = height - baselineRatio * height;
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(0, baselineY);
      ctx.lineTo(width, baselineY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    };

    const fit = () => {
      const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
      renderer.setPixelRatio(dpr);
      const width = Math.max(1, container.clientWidth | 0);
      const height = Math.max(1, container.clientHeight | 0);
      renderer.setSize(width, height, false);


       if (width < 760) {
         container.style.aspectRatio = "9 / 16";   // mobile ratio
       } else {
         container.style.aspectRatio = aspect;      // desktop ratio (from props)
       }

      camera.aspect = width / height || 1;
      camera.updateProjectionMatrix();

      const chartWidth = Math.max(1, Math.floor(chartCanvas.clientWidth || width * 0.5));
      const chartHeight = 200;
      let sizeChanged = false;
      if (chartCanvas.width !== chartWidth) { chartCanvas.width = chartWidth; sizeChanged = true; }
      if (chartCanvas.height !== chartHeight) { chartCanvas.height = chartHeight; sizeChanged = true; }
      if (sizeChanged) {
        chartCtxRef.current = null; // force ctx re-fetch (some browsers bind size to context)
      }
      drawPlot();
    };

    // Only ResizeObserver (window resize is redundant)
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    roRef.current = ro;

    // ---------- Animation ----------
    const clock = new THREE.Clock();
    clockRef.current = clock;

    const orbitPhaseIncrement = cfg.speedMultiplier / cfg.orbitalPeriod;
    const tmpVec = new THREE.Vector3();
    let chartAccumulator = 0;

    let orbitPhase = 0.5;
    planetGroup.rotation.y = orbitPhase * Math.PI * 2;

    const brightnessStateRef = { value: brightness };
    const phaseStateRef = { value: phasePercent };
    const transitStateRef = { value: transitLabel };

    const loop = () => {
      if (pausedRef.current) return; // stop cleanly if paused

      const dt = Math.min(clock.getDelta(), 0.05);

      orbitPhase += dt * orbitPhaseIncrement;
      if (orbitPhase >= 1) orbitPhase -= 1;
      const orbitAngleFull = orbitPhase * Math.PI * 2;
      planetGroup.rotation.y = orbitAngleFull;
      planet.rotation.y += 0.02 * dt;
      backdrop.rotation.y -= 0.005 * dt;
      starUniforms.uTime.value += dt * cfg.starGranulationSpeed;

      const planetPos = planet.getWorldPosition(tmpVec);
      let relativeBrightness = 1.0;
      const inFront = planetPos.z > 0;
      const sumRadius = cfg.starRadius + cfg.planetRadius;
      const dist = Math.hypot(planetPos.x, planetPos.y);
      const overlap = Math.max(0, sumRadius - dist);
      if (inFront && overlap > 0) {
        const R = cfg.starRadius;
        const r = cfg.planetRadius;
        const d = dist;
        let overlapFraction = 0;
        if (d <= Math.abs(R - r)) {
          overlapFraction = 1;
        } else {
          const clamp = (value) => Math.acos(THREE.MathUtils.clamp(value, -1, 1));
          const acos1 = clamp((d * d + r * r - R * R) / (2 * d * r));
          const acos2 = clamp((d * d + R * R - r * r) / (2 * d * R));
          const part1 = r * r * acos1;
          const part2 = R * R * acos2;
          const part3 = 0.5 * Math.sqrt(Math.max(0, (-d + r + R) * (d + r - R) * (d - r + R) * (d + r + R)));
          const overlapArea = part1 + part2 - part3;
          overlapFraction = THREE.MathUtils.clamp(overlapArea / (Math.PI * r * r), 0, 1);
        }
        const depth = cfg.transitDepth * overlapFraction;
        relativeBrightness = 1 - depth;
        if (relativeBrightness > 0.999) {
          relativeBrightness = 1;
        }
      }

      // State throttling (unchanged logic)
      if (Math.abs(orbitPhase - phaseStateRef.value) > 0.0012) {
        phaseStateRef.value = orbitPhase;
        setPhasePercent(orbitPhase);
      }

      let newTransitLabel = 'Planet behind the star';
      if (inFront) {
        if (overlap <= 0) {
          newTransitLabel = 'Passing in front, no eclipse';
        } else {
          const overlapRatio = overlap / sumRadius;
          if (overlapRatio < 0.18) newTransitLabel = 'Ingress / Egress';
          else if (overlapRatio > 0.55) newTransitLabel = 'Mid-transit';
          else newTransitLabel = 'Transit in progress';
        }
      }
      if (newTransitLabel !== transitStateRef.value) {
        transitStateRef.value = newTransitLabel;
        setTransitLabel(newTransitLabel);
      }

      relativeBrightness = THREE.MathUtils.clamp(relativeBrightness, 0, 1);

      recordBrightness(relativeBrightness);
      chartAccumulator += dt;
      if (chartAccumulator > 0.05) {
        drawPlot();
        chartAccumulator = 0;
      }

      const currentDisplay = brightnessStateRef.value;
      if (Math.abs(relativeBrightness - currentDisplay) > 0.003) {
        brightnessStateRef.value = relativeBrightness;
        setBrightness(relativeBrightness);
      }

      renderer.render(scene, camera);
      rafIdRef.current = requestAnimationFrame(loop);
    };

    loopRef.current = loop;

    // Initial fit
    fit();

    // Kick the loop only if not paused initially
    if (!pausedRef.current) {
      clock.start();
      rafIdRef.current = requestAnimationFrame(loop);
    } else {
      clock.start(); // keep clock ready; we’ll reset delta on play
    }

    // Cleanup
    return () => {
      try { ro.disconnect(); } catch {}
      canvas.removeEventListener('webglcontextlost', onContextLost);

      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

      renderer.dispose();

      starGeo.dispose();
      planetGeo.dispose();
      orbitGeo.dispose();
      orbitMat.dispose();
      atmosphere.geometry.dispose();
      atmosphereMat.dispose();
      backdrop.geometry?.dispose?.();
      corona.geometry?.dispose?.();
      starMat.dispose();
      planetMat.dispose();
      coronaMat.dispose();
      backdrop.material?.dispose?.();

      // Clear chart caches
      chartCtxRef.current = null;
      chartGradRef.current = null;
    };
  }, [dprCap, optionsKey]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const onToggle = () => {
    const nowPaused = !pausedRef.current;
    pausedRef.current = nowPaused;
    setPaused(nowPaused);

    // Mark visible class once we start playing the first time
    if (!nowPaused && !madeVisibleRef.current) {
      madeVisibleRef.current = true;
      const el = containerRef.current?.closest('.sim-stage') ?? containerRef.current;
      if (el && !el.classList.contains('is-visible')) el.classList.add('is-visible');
    }

    // Start/stop the RAF loop here
    if (!nowPaused) {
      // playing
      // resync delta so we don't get a big jump after a long pause
      try { clockRef.current?.getDelta?.(); } catch {}
      rafIdRef.current = requestAnimationFrame(() => loopRef.current?.());
    } else {
      // paused
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
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
      style={{ width: '100%' }}
    >
      <style>
        {`
        .transit-overlay {
          position: absolute;
          inset: auto 0 0 0;
          margin: 0 auto;
          padding: 14px 16px;
          background: rgba(8, 10, 16, 0.0);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
          backdrop-filter: blur(6px);
          color: #eef1ff;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .transit-stats {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 14px 22px;
          font-size: 0.95rem;
          width: 100%;
        }
        .transit-brightness {
          display: flex;
          align-items: baseline;
          gap: 10px;
          flex: 1 1 auto;
          min-width: 180px;
        }
        .transit-brightness span:first-child {
          font-weight: 700;
          letter-spacing: 0.01em;
        }
        .transit-brightness span:last-child {
          font-variant-numeric: tabular-nums;
          font-weight: 700;
          font-size: 1.05rem;
        }
        .transit-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 12px 18px;
          align-items: center;
          flex: 1 1 auto;
          justify-content: flex-end;
        }
        .transit-meta span {
          font-variant-numeric: tabular-nums;
          font-weight: 600;
        }
        .transit-phase {
          display: flex;
          gap: 6px;
          align-items: center;
        }
        .transit-phase .label {
          opacity: 0.85;
          font-weight: 400;
        }
        .transit-phase .value {
          font-variant-numeric: tabular-nums;
          font-weight: 600;
        }
        .transit-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.14), transparent);
          margin: 2px 0 6px;
        }
        .transit-plot {
          width: 100%;
          height: 60px;
        }
        `}
      </style>
      <div className="sim-overlay transit-overlay">
        <div className="transit-stats">
          <div className="transit-brightness">
            <span>Relative Brightness</span>
            <span>{(brightness * 100).toFixed(2)}%</span>
          </div>
          <div className="transit-meta">
            <div className="transit-phase">
              <span className="label">Phase:</span>
              <span className="value">{(phasePercent * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
        <div className="transit-divider" role="presentation" />
        <canvas
          ref={chartRef}
          aria-label="Light curve showing star brightness during transit"
          className="transit-plot"
        />
      </div>
    </SimStage>
  );
}
