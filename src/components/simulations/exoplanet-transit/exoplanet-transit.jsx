import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

/**
 * ExoplanetTransitSim.jsx
 *
 * Renders a stylised exoplanet transit: a glowing star, an orbiting planet,
 * and an accompanying light-curve readout showing the dip in brightness when
 * the planet crosses in front of the star. Designed for Astro posts using the
 * shared sim-stage styles.
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
  const optionsKey = JSON.stringify(optionsProp ?? {});

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const chartCanvas = chartRef.current;
    if (!container || !canvas || !chartCanvas) return;
    brightnessHistoryRef.current = [];

    // ---------- Options & defaults ----------
    const options = JSON.parse(optionsKey ?? '{}');

    const starRadius = options.starRadius ?? 1.2;
    const planetRadius = options.planetRadius ?? 0.22;
    const orbitRadius =
      options.orbitRadius ??
      Math.max(starRadius + planetRadius * 0.2, starRadius * 1.05);

    const cfg = {
      starRadius,
      planetRadius,
      orbitTiltDeg: options.orbitTiltDeg ?? 2.5,
      orbitRadius,
      orbitalPeriod: Math.max(30, options.orbitalPeriod ?? 240), // seconds per orbit (minimum clamp)
      speedMultiplier: Math.max(0.05, options.speedMultiplier ?? 8.0),
      transitDepth: options.transitDepth ?? 0.012,
      backgroundColor: options.backgroundColor ?? 0x060914,
      starColor: options.starColor ?? 0xffd27f,
      coronaColor: options.coronaColor ?? 0xfff4c1,
      planetColor: options.planetColor ?? 0x3457ff,
      planetNightColor: options.planetNightColor ?? 0x0f1a3a,
      cameraDistance: options.cameraDistance ?? 7.0,
      starfieldCount: options.starfieldCount ?? 400,
      orbitLineColor: options.orbitLineColor ?? 0x4a6cff,
      orbitLineOpacity: options.orbitLineOpacity ?? 0.35,
      ambientIntensity: options.ambientIntensity ?? 0.22,
      starGranulationSpeed: options.starGranulationSpeed ?? 0.18,
      starGranulationStrength: options.starGranulationStrength ?? 0.18,
      atmosphereColor: options.atmosphereColor ?? 0x6db8ff,
      atmosphereIntensity: options.atmosphereIntensity ?? 0.35,
    };

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.physicallyCorrectLights = true;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(cfg.backgroundColor);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, cfg.starRadius * 0.25, cfg.cameraDistance);
    camera.lookAt(0, 0, 0);

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

    // Soft corona for the star
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
          gl_FragColor = vec4(uColor, falloff * uIntensity * 0.6);
        }
      `,
    });
    const corona = new THREE.Mesh(starGeo.clone(), coronaMat);
    corona.scale.setScalar(1.8);
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
      new THREE.SphereGeometry(cfg.planetRadius * 1.35, 64, 64),
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

    const drawPlot = () => {
      const ctx = chartCanvas.getContext('2d');
      if (!ctx) return;
      const width = chartCanvas.width || chartCanvas.clientWidth || 1;
      const height = chartCanvas.height || chartCanvas.clientHeight || 1;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#050812ee';
      ctx.fillRect(0, 0, width, height);
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
      const minVal = 0;
      const maxVal = 100;
      const span = maxVal - minVal;

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

      if (points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, height);
        points.forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.lineTo(points[points.length - 1].x, height);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, 'rgba(255, 216, 107, 0.18)');
        grad.addColorStop(1, 'rgba(255, 216, 107, 0.02)');
        ctx.fillStyle = grad;
        ctx.fill();
      }

      // Baseline at brightness = 1
      const baselineTarget = 99;
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
      camera.aspect = width / height || 1;
      camera.updateProjectionMatrix();

      const chartWidth = Math.max(1, Math.floor(chartCanvas.clientWidth || width * 0.5));
      const chartHeight = Math.max(1, Math.floor(chartCanvas.clientHeight || height * 0.25));
      if (chartCanvas.width !== chartWidth) chartCanvas.width = chartWidth;
      if (chartCanvas.height !== chartHeight) chartCanvas.height = chartHeight;
      drawPlot();
    };

    const ro = new ResizeObserver(fit);
    ro.observe(container);
    window.addEventListener('resize', fit, { passive: true });
    fit();

    // ---------- Animation ----------
    const clock = new THREE.Clock();
    const orbitPhaseIncrement = cfg.speedMultiplier / cfg.orbitalPeriod;
    const tmpVec = new THREE.Vector3();
    let rafId = 0;
    let pollId = 0;
    let wasPaused = false;
    let chartAccumulator = 0;
    const brightnessStateRef = { value: brightness };
    const phaseStateRef = { value: phasePercent };
    const transitStateRef = { value: transitLabel };

    const startPollingForResume = () => {
      if (pollId) return;
      pollId = window.setInterval(() => {
        if (!pausedRef.current) {
          clearInterval(pollId);
          pollId = 0;
          clock.getDelta();
          rafId = requestAnimationFrame(loop);
        }
      }, 100);
    };

    let orbitPhase = 0;
    planetGroup.rotation.y = orbitPhase * Math.PI * 2;

    const loop = () => {
      if (pausedRef.current) {
        wasPaused = true;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
        startPollingForResume();
        return;
      }

      const dt = Math.min(clock.getDelta(), 0.05);
      if (wasPaused) {
        wasPaused = false;
      }

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
      }

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
      rafId = requestAnimationFrame(loop);
    };

    clock.start();
    rafId = requestAnimationFrame(loop);

    return () => {
      try { ro.disconnect(); } catch {}
      window.removeEventListener('resize', fit);
      if (rafId) cancelAnimationFrame(rafId);
      if (pollId) clearInterval(pollId);

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
    };
  }, [dprCap, optionsKey]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

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
    <div
      className="sim-stage centered_flex"
      id={`stage-${id}`}
      ref={containerRef}
      style={{ aspectRatio: aspect, width: '100%', position: 'relative' }}
    >
      <canvas id={id} ref={canvasRef} />

      <div
        className="sim-overlay transit-readout"
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 12,
          padding: '12px 14px',
          background: 'rgba(5, 8, 18, 0.75)',
          borderRadius: 8,
          backdropFilter: 'blur(6px)',
          color: '#eef1ff',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>Relative Brightness</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {(brightness * 100).toFixed(2)}%
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            fontSize: '0.9rem',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span>
            <strong>Phase:</strong> {(phasePercent * 100).toFixed(1)}%
          </span>
          <span>
            <strong>Depth:</strong> {Math.max(0, (1 - brightness) * 100).toFixed(2)}%
          </span>
          <span style={{ flex: '1 1 auto', minWidth: 160 }}>
            <strong>Transit:</strong> {transitLabel}
          </span>
        </div>
        <canvas
          ref={chartRef}
          aria-label="Light curve showing star brightness during transit"
          style={{ width: '100%', height: 120 }}
        />
      </div>

      {showPause && (
        <button
          id={`pause-${id}`}
          className="pill sim-controls-inline"
          type="button"
          aria-pressed={!paused}
          onClick={onToggle}
        >
          {paused ? 'Play' : 'Pause'}
        </button>
      )}
    </div>
  );
}
