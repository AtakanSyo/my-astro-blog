import { useEffect, useMemo, useState } from "react";
import {
  luminosityFromMass,
  massFromLuminosity,
  luminosityToWatts,
  absoluteBolometricMagnitude,
  localExponent,
  classifyByMass,
  REAL_STAR_LANDMARKS,
} from "./massLuminosity";
import "../../../styles/stellarMassLuminosityCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";

const PRESETS = [
  { label: "Proxima Centauri", solveFor: "luminosity", mass: 0.122, luminosity: 0.0017 },
  { label: "The Sun", solveFor: "luminosity", mass: 1, luminosity: 1 },
  { label: "Sirius A", solveFor: "luminosity", mass: 2.063, luminosity: 25.4 },
  { label: "Rigel (very massive)", solveFor: "luminosity", mass: 21, luminosity: 120000 },
  { label: "Reverse: L = 1000 L☉", solveFor: "mass", mass: 6.5, luminosity: 1000 },
];

function trimTrailingZeros(s) {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}
const SUPERSCRIPT_MAP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
function toSuperscript(n) {
  return String(n).split("").map((ch) => SUPERSCRIPT_MAP[ch] ?? ch).join("");
}
function formatNumber(n, digits = 3) {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n === 0) return "0";
  if (n >= 1e5 || n < 1e-3) {
    const exp = Math.floor(Math.log10(n));
    const mantissa = n / Math.pow(10, exp);
    return `${trimTrailingZeros(mantissa.toFixed(digits))} × 10${toSuperscript(exp)}`;
  }
  if (n >= 100) return trimTrailingZeros(n.toFixed(1));
  if (n >= 1) return trimTrailingZeros(n.toFixed(digits));
  return trimTrailingZeros(n.toFixed(digits + 2));
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const solveFor = params.get("solve");
  if (solveFor !== "luminosity" && solveFor !== "mass") return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  return { solveFor, mass: num("m", "1"), luminosity: num("l", "1") };
}

export default function StellarMassLuminosityCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [solveFor, setSolveFor] = useState("luminosity");
  const [mass, setMass] = useState("1");
  const [luminosity, setLuminosity] = useState("1");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setSolveFor(initial.solveFor);
      setMass(initial.mass);
      setLuminosity(initial.luminosity);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("solve", solveFor);
      params.set("m", mass);
      params.set("l", luminosity);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, solveFor, mass, luminosity]);

  const result = useMemo(() => {
    if (solveFor === "luminosity") {
      const m = parseFloat(mass);
      if (!(m > 0)) return { valid: false, reason: "Enter a positive mass." };
      const l = luminosityFromMass(m);
      return { valid: true, mSolar: m, lSolar: l };
    }
    const l = parseFloat(luminosity);
    if (!(l > 0)) return { valid: false, reason: "Enter a positive luminosity." };
    const m = massFromLuminosity(l);
    return { valid: true, mSolar: m, lSolar: l };
  }, [solveFor, mass, luminosity]);

  // --- log-log mass-luminosity diagram ---
  // The piecewise relation drawn across its full range shows visible
  // kinks where the exponent changes — a genuinely different shape from
  // a single power law's perfectly straight log-log line, which is
  // exactly the point: alpha is NOT constant across the main sequence.
  const diagram = useMemo(() => {
    if (!result.valid) return null;
    const xMin = Math.log10(0.05);
    const xMax = Math.log10(250);
    const N = 300;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const logM = xMin + ((xMax - xMin) * i) / N;
      const m = Math.pow(10, logM);
      pts.push({ x: logM, y: Math.log10(luminosityFromMass(m)) });
    }
    const yVals = pts.map((p) => p.y);
    const yMin = Math.min(...yVals) - 0.5;
    const yMax = Math.max(...yVals) + 0.5;

    const width = 640;
    const height = 340;
    const marginLeft = 64;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 40;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;
    const xScale = (x) => marginLeft + ((x - xMin) / (xMax - xMin)) * plotWidth;
    const yScale = (y) => marginTop + (1 - (y - yMin) / (yMax - yMin)) * plotHeight;

    const linePoints = pts.map((p) => `${xScale(p.x)},${yScale(p.y)}`).join(" ");
    const decadeTicks = (lo, hi) => {
      const ticks = [];
      for (let e = Math.ceil(lo); e <= hi; e++) ticks.push(e);
      return ticks;
    };

    return {
      width, height, marginLeft, marginRight, marginTop, marginBottom, plotWidth, plotHeight,
      xScale, yScale, linePoints,
      point: { x: xScale(Math.log10(result.mSolar)), y: yScale(Math.log10(luminosityFromMass(result.mSolar))) },
      landmarks: REAL_STAR_LANDMARKS.map((s) => ({
        ...s,
        x: xScale(Math.log10(s.mSolar)),
        y: yScale(Math.log10(s.lSolar)),
      })),
      xTicks: decadeTicks(xMin, xMax),
      yTicks: decadeTicks(yMin, yMax),
    };
  }, [result]);

  // --- linear-scaling myth bar comparison ---
  const bars = useMemo(() => {
    if (!result.valid) return null;
    const actualL = luminosityFromMass(result.mSolar);
    const naiveL = result.mSolar; // "if L just scaled 1:1 with M"
    const maxL = Math.max(actualL, naiveL, 1);
    return { actualL, naiveL, maxL, ratio: actualL / naiveL };
  }, [result]);

  const applyPreset = (preset) => {
    setSolveFor(preset.solveFor);
    setMass(String(preset.mass));
    setLuminosity(String(preset.luminosity));
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

  const classification = result.valid ? classifyByMass(result.mSolar) : null;
  const alpha = result.valid ? localExponent(result.mSolar) : null;

  return (
    <div className="sml" aria-label="Stellar mass-luminosity relation calculator">
      <div className="sml-header">
        <p className="sml-title">Mass–luminosity relation calculator</p>
        <div className="sml-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="sml-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="sml-explainer">
        Main-sequence luminosity rises far faster than mass — roughly{" "}
        <code>L/L☉ ≈ (M/M☉)^α</code> — but α itself changes across the mass range: about 2.3 for
        low-mass stars, about 4 near the Sun's mass, and shallower again for very massive stars.
        This is an <strong>empirical fit for main-sequence stars only</strong> — giants, white
        dwarfs, pre-main-sequence stars, and other evolved stars follow completely different
        relations.
      </p>

      <div className="sml-solve-toggle" role="group" aria-label="Solve for">
        <button type="button" className={solveFor === "luminosity" ? "sml-solve-btn active" : "sml-solve-btn"} onClick={() => setSolveFor("luminosity")}>
          Mass → Luminosity
        </button>
        <button type="button" className={solveFor === "mass" ? "sml-solve-btn active" : "sml-solve-btn"} onClick={() => setSolveFor("mass")}>
          Luminosity → Mass
        </button>
      </div>

      <div className="sml-fields">
        <div className="sml-field">
          <label htmlFor="sml-mass">Mass (M☉)</label>
          {solveFor === "mass" ? (
            <div className="sml-computed">{result.valid ? formatNumber(result.mSolar) : "—"}</div>
          ) : (
            <input id="sml-mass" className="sml-input" type="number" min="0" step="any" inputMode="decimal" value={mass} onChange={(e) => setMass(e.target.value)} />
          )}
        </div>
        <div className="sml-field">
          <label htmlFor="sml-lum">Luminosity (L☉)</label>
          {solveFor === "luminosity" ? (
            <div className="sml-computed">{result.valid ? formatNumber(result.lSolar) : "—"}</div>
          ) : (
            <input id="sml-lum" className="sml-input" type="number" min="0" step="any" inputMode="decimal" value={luminosity} onChange={(e) => setLuminosity(e.target.value)} />
          )}
        </div>
      </div>

      {!result.valid ? (
        <p className="sml-note sml-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="sml-headline-card">
            <div className="sml-headline">
              L = {formatNumber(result.lSolar)} L☉ = {formatNumber(luminosityToWatts(result.lSolar))} W
            </div>
            <div className="sml-headline-sub">
              M_bol ≈ {absoluteBolometricMagnitude(result.lSolar).toFixed(2)} · local exponent α ≈ {alpha}
              {classification && (
                <span className={`sml-badge sml-badge--${classification.tone}`}>{classification.label}</span>
              )}
            </div>
          </div>

          {diagram && (
            <div className="sml-chart-wrap">
              <svg className="sml-diagram-svg" viewBox={`0 0 ${diagram.width} ${diagram.height}`} role="img" aria-label="Log-log mass-luminosity diagram, showing the piecewise relation's changing slope">
                {diagram.xTicks.map((e) => (
                  <g key={`x${e}`}>
                    <line x1={diagram.xScale(e)} x2={diagram.xScale(e)} y1={diagram.marginTop} y2={diagram.marginTop + diagram.plotHeight} className="sml-chart-gridline" />
                    <text x={diagram.xScale(e)} y={diagram.height - 12} className="sml-chart-axis-label" textAnchor="middle">10{toSuperscript(e)} M☉</text>
                  </g>
                ))}
                {diagram.yTicks.map((e) => (
                  <g key={`y${e}`}>
                    <line x1={diagram.marginLeft} x2={diagram.marginLeft + diagram.plotWidth} y1={diagram.yScale(e)} y2={diagram.yScale(e)} className="sml-chart-gridline" />
                    <text x={diagram.marginLeft - 8} y={diagram.yScale(e) + 4} className="sml-chart-axis-label" textAnchor="end">10{toSuperscript(e)} L☉</text>
                  </g>
                ))}
                <line x1={diagram.marginLeft} x2={diagram.marginLeft} y1={diagram.marginTop} y2={diagram.marginTop + diagram.plotHeight} className="sml-chart-axis-line" />
                <line x1={diagram.marginLeft} x2={diagram.marginLeft + diagram.plotWidth} y1={diagram.marginTop + diagram.plotHeight} y2={diagram.marginTop + diagram.plotHeight} className="sml-chart-axis-line" />

                <polyline points={diagram.linePoints} className="sml-curve-line" />

                {diagram.landmarks.map((lm) => (
                  <g key={lm.label}>
                    <circle cx={lm.x} cy={lm.y} r="4" className="sml-chart-landmark" />
                    <text x={lm.x} y={lm.y - 8} className="sml-chart-landmark-label" textAnchor="middle">{lm.label}</text>
                  </g>
                ))}

                <circle cx={diagram.point.x} cy={diagram.point.y} r="6" className="sml-chart-point" />
              </svg>
              <p className="sml-chart-caption">
                The visible kinks are the exponent changing between mass ranges — a single power
                law would be perfectly straight here; this deliberately isn't one. Landmark points
                use each real star's actual luminosity, not this formula's prediction, so you can
                see where the fit tracks reality closely (the Sun, by calibration) and where it
                doesn't (real stars have their own age, composition, and evolutionary history this
                simple relation can't capture).
              </p>
            </div>
          )}

          {bars && (
            <div className="sml-chart-wrap">
              <div className="sml-bars">
                <div className="sml-bar-row">
                  <span className="sml-bar-label">If luminosity just scaled 1:1 with mass</span>
                  <div className="sml-bar-track">
                    <div className="sml-bar-fill sml-bar-fill--naive" style={{ width: `${Math.min(100, (bars.naiveL / bars.maxL) * 100)}%` }} />
                  </div>
                  <span className="sml-bar-value">{formatNumber(bars.naiveL)} L☉</span>
                </div>
                <div className="sml-bar-row">
                  <span className="sml-bar-label">Actual (empirical mass-luminosity relation)</span>
                  <div className="sml-bar-track">
                    <div className="sml-bar-fill sml-bar-fill--actual" style={{ width: `${Math.min(100, (bars.actualL / bars.maxL) * 100)}%` }} />
                  </div>
                  <span className="sml-bar-value">{formatNumber(bars.actualL)} L☉</span>
                </div>
              </div>
              <p className="sml-chart-caption">
                This star is {formatNumber(bars.ratio)}× brighter than simple 1:1 mass-scaling would
                suggest — the entire reason the mass-luminosity relation is worth having a formula
                for at all.
              </p>
            </div>
          )}
        </>
      )}

      <div className="sml-footer-row">
        <CalculatorVote slug="stellar-mass-luminosity-calculator" />
        <button type="button" className="sml-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
