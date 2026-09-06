import { useEffect, useMemo, useRef, useState } from "react";
import {
  makeGrid,
  potentialFree,
  potentialInfiniteWell,
  potentialFiniteWell,
  potentialHarmonic,
  potentialStep,
  potentialBarrier,
  absorbingLayer,
  gaussianWavePacket,
  buildHamiltonianCoeffs,
  createSolverScratch,
  crankNicolsonStep,
  computeNorm,
  computeExpectationX,
  computeExpectationP,
  computeExpectationKinetic,
  computeExpectationV,
  computeSplitProbabilities,
} from "./physics";
import "../../../styles/quantumParticleSimulator.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";
import Katex from "../../Katex.jsx";

// --- grid & integration constants ---------------------------------------
const XMIN = -20;
const XMAX = 20;
const N = 500;
const DT = 0.02;
const BASE_STEPS_PER_FRAME = 2;
const CAP_WIDTH_FRAC = 0.1;
const CAP_STRENGTH = 15;
const INFINITE_WALL_HEIGHT = 1000;
const SPEED_OPTIONS = [0.5, 1, 2, 4];

// --- potential library ----------------------------------------------------
// Each entry owns its own default parameters and default wave-packet
// starting point, so switching potentials resets to a sensible, clearly
// demonstrative configuration rather than an arbitrary carry-over state.
const POTENTIAL_CONFIGS = {
  free: {
    label: "Free particle",
    fields: [],
    defaults: {},
    packetDefaults: { x0: -10, p0: 4, sigma: 1 },
    buildV: (grid) => potentialFree(grid),
  },
  infiniteWell: {
    label: "Infinite well",
    fields: [{ key: "halfWidth", label: "Well half-width", min: 3, max: 15, step: 0.5 }],
    defaults: { halfWidth: 8 },
    packetDefaults: { x0: 0, p0: 3, sigma: 1 },
    buildV: (grid, p) => potentialInfiniteWell(grid, p.halfWidth, INFINITE_WALL_HEIGHT),
  },
  finiteWell: {
    label: "Finite well",
    fields: [
      { key: "halfWidth", label: "Well half-width", min: 1, max: 8, step: 0.25 },
      { key: "depth", label: "Well depth", min: 1, max: 20, step: 0.5 },
    ],
    defaults: { halfWidth: 3, depth: 6 },
    packetDefaults: { x0: 0, p0: 0, sigma: 1 },
    buildV: (grid, p) => potentialFiniteWell(grid, p.halfWidth, p.depth),
  },
  harmonic: {
    label: "Harmonic oscillator",
    fields: [{ key: "k", label: "Stiffness k", min: 0.05, max: 1.5, step: 0.01 }],
    defaults: { k: 0.3 },
    // sigma=1 with k=0.3 sits close to the oscillator's coherent-state
    // width (ħ/2mω)^1/2 ≈ 0.96, so this packet oscillates back and forth
    // with almost no spreading — a classic, striking demo.
    packetDefaults: { x0: -4, p0: 0, sigma: 1 },
    buildV: (grid, p) => potentialHarmonic(grid, p.k),
  },
  step: {
    label: "Potential step",
    fields: [{ key: "height", label: "Step height", min: -10, max: 20, step: 0.5 }],
    defaults: { height: 5, location: 0 },
    packetDefaults: { x0: -10, p0: 4, sigma: 1 },
    buildV: (grid, p) => potentialStep(grid, p.height, p.location),
    dividerX: (p) => p.location,
  },
  barrier: {
    label: "Barrier (tunneling)",
    fields: [
      { key: "height", label: "Barrier height", min: 0, max: 20, step: 0.5 },
      { key: "width", label: "Barrier width", min: 0.5, max: 6, step: 0.25 },
    ],
    defaults: { height: 8, width: 2, location: 5 },
    // KE = p0²/2m = 8, right around the barrier height — a mix of
    // classical transmission and genuine tunneling in one run.
    packetDefaults: { x0: -10, p0: 4, sigma: 1 },
    buildV: (grid, p) => potentialBarrier(grid, p.height, p.width, p.location),
    dividerX: (p) => p.location,
  },
};

const POTENTIAL_ORDER = ["barrier", "step", "free", "infiniteWell", "finiteWell", "harmonic"];

// --- canvas geometry (fixed logical resolution; CSS scales it down) -----
const CANVAS_W = 1200;
const CANVAS_H = 680;
const MARGIN_L = 54;
const MARGIN_R = 20;
const PANEL_GAP = 26;
const PANEL1_H = 380;
const PANEL2_H = CANVAS_H - PANEL1_H - PANEL_GAP - 70; // leaves room for x-axis labels
const PANEL1_TOP = 16;
const PANEL1_BASE_Y = PANEL1_TOP + PANEL1_H * 0.62; // zero-line, leaves more room above (positive V) than below
const PANEL2_TOP = PANEL1_TOP + PANEL1_H + PANEL_GAP;
const PANEL2_BASE_Y = PANEL2_TOP + PANEL2_H;
const PLOT_W = CANVAS_W - MARGIN_L - MARGIN_R;

const ENERGY_DISPLAY_MAX = 26; // fixed energy-axis half-scale (natural units)

function xToPx(x) {
  return MARGIN_L + ((x - XMIN) / (XMAX - XMIN)) * PLOT_W;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function formatNum(n, digits = 3) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const pot = params.get("v");
  if (!pot || !POTENTIAL_CONFIGS[pot]) return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    const n = raw === null ? NaN : parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  };
  const config = POTENTIAL_CONFIGS[pot];
  const potentialParams = { ...config.defaults };
  for (const key of Object.keys(potentialParams)) {
    potentialParams[key] = num(key, potentialParams[key]);
  }
  return {
    potentialKey: pot,
    potentialParams,
    x0: num("x0", config.packetDefaults.x0),
    p0: num("p0", config.packetDefaults.p0),
    sigma: num("sigma", config.packetDefaults.sigma),
    mass: num("mass", 1),
    speed: SPEED_OPTIONS.includes(num("sp", 1)) ? num("sp", 1) : 1,
  };
}

export default function QuantumParticleSimulator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [potentialKey, setPotentialKey] = useState("barrier");
  const [potentialParams, setPotentialParams] = useState({ ...POTENTIAL_CONFIGS.barrier.defaults });
  const [x0, setX0] = useState(POTENTIAL_CONFIGS.barrier.packetDefaults.x0);
  const [p0, setP0] = useState(POTENTIAL_CONFIGS.barrier.packetDefaults.p0);
  const [sigma, setSigma] = useState(POTENTIAL_CONFIGS.barrier.packetDefaults.sigma);
  const [mass, setMass] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [readouts, setReadouts] = useState({
    t: 0,
    norm: 1,
    meanX: 0,
    meanP: 0,
    meanT: 0,
    meanV: 0,
    meanE: 0,
    left: 0,
    right: 0,
  });

  const canvasRef = useRef(null);
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  const massRef = useRef(mass);
  const engineRef = useRef(null); // grid, buffers, coeffs, scale factors — mutated outside React state
  const rafRef = useRef(null);
  const frameCountRef = useRef(0);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);
  useEffect(() => {
    massRef.current = mass;
  }, [mass]);

  // Rebuild the simulation engine (grid arrays, potential, Hamiltonian,
  // fresh wave packet) whenever the potential, its parameters, or the
  // wave-packet parameters change. Cheap (all O(N)), so it's fine to do
  // this on every slider tick — the running animation just picks up the
  // new state on its next frame.
  useEffect(() => {
    const grid = makeGrid(XMIN, XMAX, N);
    const config = POTENTIAL_CONFIGS[potentialKey];
    const Vreal = config.buildV(grid, potentialParams);
    const eta = absorbingLayer(grid, CAP_WIDTH_FRAC, CAP_STRENGTH);
    const coeffs = buildHamiltonianCoeffs(grid, Vreal, eta, mass, DT);
    const scratch = createSolverScratch(N);
    const { re, im } = gaussianWavePacket(grid, x0, p0, sigma);

    // Fixed display scales derived from the initial packet, so spreading,
    // tunneling loss, and bound-state beating all show up as real changes
    // in plotted height rather than being auto-normalized away. Panel 1's
    // baseline sits off-center (more room above than below), so both the
    // energy curve and the ± wavefunction traces use the smaller of the
    // two headrooms to avoid clipping on the tighter side.
    const aboveRoom = PANEL1_BASE_Y - PANEL1_TOP - 20;
    const belowRoom = PANEL1_TOP + PANEL1_H - PANEL1_BASE_Y - 10;
    const tightRoom = Math.min(aboveRoom, belowRoom);
    const ampMax0 = Math.pow(2 * Math.PI * sigma * sigma, -0.25);
    const probMax0 = ampMax0 * ampMax0;
    const waveScale = tightRoom / (ampMax0 * 1.3);
    const probScale = (PANEL2_H - 10) / (probMax0 * 1.3);
    const energyScale = tightRoom / ENERGY_DISPLAY_MAX;

    const dividerX = config.dividerX ? config.dividerX(potentialParams) : null;

    engineRef.current = {
      grid,
      Vreal,
      eta,
      coeffs,
      scratch,
      re,
      im,
      waveScale,
      probScale,
      energyScale,
      dividerX,
      potentialKey,
    };
    frameCountRef.current = 0;
    setReadouts((r) => ({ ...r, t: 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [potentialKey, potentialParams, x0, p0, sigma, mass]);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setPotentialKey(initial.potentialKey);
      setPotentialParams(initial.potentialParams);
      setX0(initial.x0);
      setP0(initial.p0);
      setSigma(initial.sigma);
      setMass(initial.mass);
      setSpeed(initial.speed);
    }
    setHydrated(true);
  }, []);

  // Debounced shareable-link sync — see the blackbody generator's fix for
  // why this must not fire on every slider tick (browsers throttle
  // history.replaceState and an uncaught throw there would unmount the
  // whole component).
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("v", potentialKey);
      for (const [key, value] of Object.entries(potentialParams)) {
        params.set(key, String(value));
      }
      params.set("x0", String(x0));
      params.set("p0", String(p0));
      params.set("sigma", String(sigma));
      params.set("mass", String(mass));
      params.set("sp", String(speed));
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, potentialKey, potentialParams, x0, p0, sigma, mass, speed]);

  // Main animation loop: always scheduled (so a paused sim still redraws
  // after a slider-triggered reset), but only advances the physics while
  // `playing`. Canvas drawing is imperative — putting per-frame data in
  // React state would be both slow and pointless here.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");

    const tick = () => {
      const engine = engineRef.current;
      if (engine) {
        if (playingRef.current) {
          const steps = Math.max(1, Math.round(BASE_STEPS_PER_FRAME * speedRef.current));
          for (let s = 0; s < steps; s++) {
            crankNicolsonStep(engine.re, engine.im, engine.coeffs, engine.scratch);
          }
          engine.t = (engine.t || 0) + steps * DT;
        }
        drawFrame(ctx, engine);

        frameCountRef.current += 1;
        if (frameCountRef.current % 6 === 0) {
          const { re, im, grid } = engine;
          const norm = Math.max(computeNorm(re, im, grid.dx), 1e-9);
          const meanX = computeExpectationX(re, im, grid.x, grid.dx) / norm;
          const meanP = computeExpectationP(re, im, grid.dx) / norm;
          const meanT = computeExpectationKinetic(re, im, massRef.current, grid.dx) / norm;
          const meanV = computeExpectationV(re, im, engine.Vreal, grid.dx) / norm;
          let left = 0;
          let right = 0;
          if (engine.dividerX !== null) {
            const split = computeSplitProbabilities(re, im, grid.x, engine.dividerX, grid.dx);
            left = split.left;
            right = split.right;
          }
          setReadouts({
            t: engine.t || 0,
            norm,
            meanX,
            meanP,
            meanT,
            meanV,
            meanE: meanT + meanV,
            left,
            right,
          });
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // Runs once on mount: everything it reads (play state, speed, mass,
    // and the simulation engine itself) comes through refs so the loop
    // never needs to be torn down and rescheduled just because a slider
    // moved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const config = POTENTIAL_CONFIGS[potentialKey];

  const selectPotential = (key) => {
    const nextConfig = POTENTIAL_CONFIGS[key];
    setPotentialKey(key);
    setPotentialParams({ ...nextConfig.defaults });
    setX0(nextConfig.packetDefaults.x0);
    setP0(nextConfig.packetDefaults.p0);
    setSigma(nextConfig.packetDefaults.sigma);
  };

  const resetRun = () => {
    // Re-triggers the build effect with identical params by nudging a
    // dependency-free rebuild: simplest is to reapply the same packet
    // params, which the effect already treats as "build a fresh packet".
    setPotentialParams((p) => ({ ...p }));
  };

  const copyLink = async () => {
    trackEvent("calculator-copy-link");
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API can fail silently — no-op.
    }
  };

  const showSplit = Boolean(config.dividerX);

  return (
    <div className="qps" aria-label="Quantum particle simulator">
      <div className="qps-header">
        <p className="qps-title">Quantum particle simulator</p>
        <div className="qps-toolbar">
          <button type="button" className="qps-tool-btn" onClick={() => setPlaying((p) => !p)}>
            {playing ? "Pause" : "Play"}
          </button>
          <button type="button" className="qps-tool-btn" onClick={resetRun}>
            Reset
          </button>
          <select
            className="qps-speed-select"
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            aria-label="Playback speed"
          >
            {SPEED_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="qps-potential-toggle" role="group" aria-label="Potential">
        {POTENTIAL_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            className={key === potentialKey ? "qps-potential-btn active" : "qps-potential-btn"}
            onClick={() => selectPotential(key)}
          >
            {POTENTIAL_CONFIGS[key].label}
          </button>
        ))}
      </div>

      {config.fields.length > 0 && (
        <div className="qps-param-row">
          {config.fields.map((field) => (
            <div className="qps-field" key={field.key}>
              <div className="qps-field-label-row">
                <label htmlFor={`qps-${field.key}`}>{field.label}</label>
                <span className="qps-field-value">{formatNum(potentialParams[field.key], 2)}</span>
              </div>
              <input
                id={`qps-${field.key}`}
                type="range"
                min={field.min}
                max={field.max}
                step={field.step}
                value={potentialParams[field.key]}
                onChange={(e) =>
                  setPotentialParams((p) => ({ ...p, [field.key]: parseFloat(e.target.value) }))
                }
              />
            </div>
          ))}
        </div>
      )}

      <div className="qps-param-row qps-param-row--packet">
        <div className="qps-field">
          <div className="qps-field-label-row">
            <label htmlFor="qps-x0">Initial position x₀</label>
            <span className="qps-field-value">{formatNum(x0, 1)}</span>
          </div>
          <input
            id="qps-x0"
            type="range"
            min={-15}
            max={15}
            step={0.5}
            value={x0}
            onChange={(e) => setX0(parseFloat(e.target.value))}
          />
        </div>
        <div className="qps-field">
          <div className="qps-field-label-row">
            <label htmlFor="qps-p0">Mean momentum p₀</label>
            <span className="qps-field-value">{formatNum(p0, 1)}</span>
          </div>
          <input
            id="qps-p0"
            type="range"
            min={-10}
            max={10}
            step={0.5}
            value={p0}
            onChange={(e) => setP0(parseFloat(e.target.value))}
          />
        </div>
        <div className="qps-field">
          <div className="qps-field-label-row">
            <label htmlFor="qps-sigma">Width <Katex tex="\sigma" /></label>
            <span className="qps-field-value">{formatNum(sigma, 2)}</span>
          </div>
          <input
            id="qps-sigma"
            type="range"
            min={0.3}
            max={3}
            step={0.1}
            value={sigma}
            onChange={(e) => setSigma(parseFloat(e.target.value))}
          />
        </div>
        <div className="qps-field">
          <div className="qps-field-label-row">
            <label htmlFor="qps-mass">Mass m</label>
            <span className="qps-field-value">{formatNum(mass, 2)}</span>
          </div>
          <input
            id="qps-mass"
            type="range"
            min={0.3}
            max={3}
            step={0.1}
            value={mass}
            onChange={(e) => setMass(parseFloat(e.target.value))}
          />
        </div>
      </div>

      <div className="qps-canvas-wrap">
        <canvas ref={canvasRef} className="qps-canvas" width={CANVAS_W} height={CANVAS_H} />
      </div>

      <dl className="qps-readouts">
        <div className="qps-readout">
          <dt>t</dt>
          <dd>{formatNum(readouts.t, 2)}</dd>
        </div>
        <div className="qps-readout">
          <dt>Norm remaining</dt>
          <dd>{formatNum(readouts.norm, 3)}</dd>
        </div>
        <div className="qps-readout">
          <dt>⟨x⟩</dt>
          <dd>{formatNum(readouts.meanX, 2)}</dd>
        </div>
        <div className="qps-readout">
          <dt>⟨p⟩</dt>
          <dd>{formatNum(readouts.meanP, 2)}</dd>
        </div>
        <div className="qps-readout">
          <dt>⟨E⟩</dt>
          <dd>{formatNum(readouts.meanE, 2)}</dd>
        </div>
        {showSplit && (
          <>
            <div className="qps-readout">
              <dt>Reflected P(left)</dt>
              <dd>{formatNum(readouts.left, 3)}</dd>
            </div>
            <div className="qps-readout">
              <dt>Transmitted P(right)</dt>
              <dd>{formatNum(readouts.right, 3)}</dd>
            </div>
          </>
        )}
      </dl>

      {showSplit && (
        <p className="qps-note">
          Reflected/transmitted probabilities are read live as the fraction of |ψ|² currently on
          each side of the barrier — they settle to the true reflection and transmission
          probabilities once the packet has fully cleared the interaction region.
        </p>
      )}

      <div className="qps-footer-row">
        <CalculatorVote slug="quantum-particle-simulator" />
        <button type="button" className="qps-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}

// --- rendering -----------------------------------------------------------

function drawFrame(ctx, engine) {
  const { grid, Vreal, re, im, waveScale, probScale, energyScale, dividerX } = engine;

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  const styles = getComputedStyle(ctx.canvas);
  const textColor = styles.getPropertyValue("--qps-text-dim").trim() || "#9aa0aa";
  const gridColor = styles.getPropertyValue("--qps-border").trim() || "rgba(255,255,255,0.1)";
  const potColor = styles.getPropertyValue("--qps-v-color").trim() || "#8b93ff";
  const reColor = styles.getPropertyValue("--qps-re-color").trim() || "#5ce0c6";
  const imColor = styles.getPropertyValue("--qps-im-color").trim() || "#ff8a5c";
  const probColor = styles.getPropertyValue("--qps-prob-color").trim() || "#c9a9ff";

  // --- panel 1: V(x), Re(ψ), Im(ψ) ---
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN_L, PANEL1_BASE_Y);
  ctx.lineTo(CANVAS_W - MARGIN_R, PANEL1_BASE_Y);
  ctx.stroke();

  if (dividerX !== null) {
    ctx.save();
    ctx.strokeStyle = gridColor;
    ctx.setLineDash([4, 4]);
    const px = xToPx(dividerX);
    ctx.beginPath();
    ctx.moveTo(px, PANEL1_TOP);
    ctx.lineTo(px, PANEL1_TOP + PANEL1_H);
    ctx.stroke();
    ctx.restore();
  }

  // potential curve
  ctx.strokeStyle = potColor;
  ctx.fillStyle = potColor;
  ctx.globalAlpha = 0.16;
  ctx.beginPath();
  ctx.moveTo(MARGIN_L, PANEL1_BASE_Y);
  for (let j = 0; j < grid.n; j++) {
    const py = clamp(
      PANEL1_BASE_Y - Vreal[j] * energyScale,
      PANEL1_TOP,
      PANEL1_TOP + PANEL1_H
    );
    ctx.lineTo(xToPx(grid.x[j]), py);
  }
  ctx.lineTo(CANVAS_W - MARGIN_R, PANEL1_BASE_Y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let j = 0; j < grid.n; j++) {
    const py = clamp(
      PANEL1_BASE_Y - Vreal[j] * energyScale,
      PANEL1_TOP,
      PANEL1_TOP + PANEL1_H
    );
    const px = xToPx(grid.x[j]);
    if (j === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Re(ψ), Im(ψ)
  drawLine(ctx, grid, re, PANEL1_BASE_Y, waveScale, reColor, 2);
  drawLine(ctx, grid, im, PANEL1_BASE_Y, waveScale, imColor, 2);

  ctx.fillStyle = textColor;
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText("V(x)  —  Re(ψ), Im(ψ)", MARGIN_L, PANEL1_TOP + 12);

  // --- panel 2: |ψ|² ---
  ctx.strokeStyle = gridColor;
  ctx.beginPath();
  ctx.moveTo(MARGIN_L, PANEL2_BASE_Y);
  ctx.lineTo(CANVAS_W - MARGIN_R, PANEL2_BASE_Y);
  ctx.stroke();

  if (dividerX !== null) {
    ctx.save();
    ctx.strokeStyle = gridColor;
    ctx.setLineDash([4, 4]);
    const px = xToPx(dividerX);
    ctx.beginPath();
    ctx.moveTo(px, PANEL2_TOP);
    ctx.lineTo(px, PANEL2_BASE_Y);
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = probColor;
  ctx.strokeStyle = probColor;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.moveTo(MARGIN_L, PANEL2_BASE_Y);
  for (let j = 0; j < grid.n; j++) {
    const prob = re[j] * re[j] + im[j] * im[j];
    const py = clamp(PANEL2_BASE_Y - prob * probScale, PANEL2_TOP, PANEL2_BASE_Y);
    ctx.lineTo(xToPx(grid.x[j]), py);
  }
  ctx.lineTo(CANVAS_W - MARGIN_R, PANEL2_BASE_Y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let j = 0; j < grid.n; j++) {
    const prob = re[j] * re[j] + im[j] * im[j];
    const py = clamp(PANEL2_BASE_Y - prob * probScale, PANEL2_TOP, PANEL2_BASE_Y);
    const px = xToPx(grid.x[j]);
    if (j === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.fillText("|ψ(x,t)|²", MARGIN_L, PANEL2_TOP - 8);

  // x-axis ticks (shared)
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  for (let xv = Math.ceil(XMIN / 5) * 5; xv <= XMAX; xv += 5) {
    const px = xToPx(xv);
    ctx.fillText(String(xv), px, PANEL2_BASE_Y + 20);
  }
  ctx.textAlign = "left";
}

function drawLine(ctx, grid, arr, baseY, scale, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let j = 0; j < grid.n; j++) {
    const py = baseY - arr[j] * scale;
    const px = xToPx(grid.x[j]);
    if (j === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}
