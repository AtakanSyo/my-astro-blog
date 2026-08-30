import { useEffect, useMemo, useState } from "react";
import {
  MASS_UNITS,
  MASS_UNIT_ORDER,
  massToKg,
  gravitationalRadiusM,
  iscoRadiusRg,
  horizonRadiusRg,
  accretionEfficiency,
} from "./kerr";
import { KERR_TEST_COLUMNS, KERR_TEST_SOURCES, getKerrTestRows } from "./kerrTests";
import "../../../styles/blackHoleISCOCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import CalculatorTests from "../../CalculatorTests.jsx";

// Every preset pairs a real (or pedagogically extreme) spin with a
// plausible mass, so applying one and reading the diagram/table always
// shows a physically sensible combination.
const PRESETS = [
  { label: "Schwarzschild (a* = 0)", mass: 10, massUnit: "msun", aStar: 0 },
  { label: "Sgr A* (a* ≈ 0.9)", mass: 4.3e6, massUnit: "msun", aStar: 0.9 },
  { label: "Cygnus X-1 (a* ≈ 0.998)", mass: 21.2, massUnit: "msun", aStar: 0.998 },
  { label: "Maximal retrograde disk (a* = −1)", mass: 10, massUnit: "msun", aStar: -1 },
  { label: "Extremal Kerr (a* = +1)", mass: 10, massUnit: "msun", aStar: 1 },
];

const SUPERSCRIPT_MAP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
function toSuperscript(n) {
  return String(n).split("").map((ch) => SUPERSCRIPT_MAP[ch] ?? ch).join("");
}
function trimTrailingZeros(s) {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
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
  const a = params.get("a");
  if (a === null || !Number.isFinite(parseFloat(a))) return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  return {
    aStar: a,
    mass: num("m", "10"),
    massUnit: MASS_UNITS[params.get("mu")] ? params.get("mu") : "msun",
  };
}

export default function BlackHoleISCOCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [mass, setMass] = useState("10");
  const [massUnit, setMassUnit] = useState("msun");
  const [aStar, setAStar] = useState("0");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setMass(initial.mass);
      setMassUnit(initial.massUnit);
      setAStar(initial.aStar);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("m", mass);
      params.set("mu", massUnit);
      params.set("a", aStar);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, mass, massUnit, aStar]);

  const result = useMemo(() => {
    const M = parseFloat(mass);
    const a = parseFloat(aStar);
    if (!(M > 0) || !Number.isFinite(a) || a < -1 || a > 1) {
      return { valid: false, reason: "Enter a positive mass and a spin a* between −1 and +1." };
    }
    const massKg = massToKg(M, massUnit);
    const rgM = gravitationalRadiusM(massKg);
    const rIscoRg = iscoRadiusRg(a);
    const rHorizonRg = horizonRadiusRg(a);
    const efficiency = accretionEfficiency(a);
    return {
      valid: true,
      aStar: a,
      rgM,
      rIscoRg,
      rHorizonRg,
      efficiency,
      rIscoKm: (rIscoRg * rgM) / 1000,
      rHorizonKm: (rHorizonRg * rgM) / 1000,
      rIscoRs: rIscoRg / 2,
      rHorizonRs: rHorizonRg / 2,
      // informational: what ISCO would be for the same |a*| the other way around
      proIfRg: iscoRadiusRg(Math.abs(a)),
      retroIfRg: iscoRadiusRg(-Math.abs(a)),
    };
  }, [mass, massUnit, aStar]);

  // --- horizon / ISCO / disk schematic ---
  // Fixed pixels-per-r_g scale (not auto-fit) is the whole point: as the
  // slider moves, the horizon and ISCO circles visibly grow or shrink
  // relative to the frame, honestly showing the ISCO closing in on the
  // horizon at high prograde spin rather than an always-the-same-size
  // picture that would hide it.
  const diagram = useMemo(() => {
    if (!result.valid) return null;
    const size = 440;
    const cx = size / 2;
    const cy = size / 2;
    const maxRg = 9.5; // covers the full range: horizon in [1,2], ISCO in [1,9]
    const maxPlotPx = 200;
    const pxPerRg = maxPlotPx / maxRg;
    const outerDiskRg = 9.3;
    const horizonPx = result.rHorizonRg * pxPerRg;
    const iscoPx = result.rIscoRg * pxPerRg;
    const diskOuterPx = outerDiskRg * pxPerRg;
    const innerFrac = Math.min(0.96, iscoPx / diskOuterPx);
    return { size, cx, cy, horizonPx, iscoPx, diskOuterPx, innerFrac, spinMag: Math.abs(result.aStar), prograde: result.aStar >= 0 };
  }, [result]);

  // --- r_ISCO vs. spin curve ---
  // The textbook plot: a single continuous curve from 9 r_g at a*=-1
  // through 6 r_g at a*=0 down to 1 r_g at a*=+1, with the current
  // spin's point marked on it.
  const curve = useMemo(() => {
    if (!result.valid) return null;
    const N = 100;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const a = -1 + (2 * i) / N;
      pts.push({ a, r: iscoRadiusRg(a) });
    }
    const width = 640;
    const height = 300;
    const marginLeft = 50;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 40;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;
    const xScale = (a) => marginLeft + ((a + 1) / 2) * plotWidth;
    const yScale = (r) => marginTop + (1 - r / 9) * plotHeight;
    const linePoints = pts.map((p) => `${xScale(p.a)},${yScale(p.r)}`).join(" ");
    const xTicks = [-1, -0.5, 0, 0.5, 1];
    const yTicks = [1, 3, 6, 9];
    return {
      width, height, marginLeft, marginRight, marginTop, marginBottom, plotWidth, plotHeight,
      xScale, yScale, linePoints, xTicks, yTicks,
      point: { x: xScale(result.aStar), y: yScale(result.rIscoRg) },
    };
  }, [result]);

  const applyPreset = (preset) => {
    setMass(String(preset.mass));
    setMassUnit(preset.massUnit);
    setAStar(String(preset.aStar));
  };

  // Self-check rows: runs the real kerrTests.js functions against

  // identities, edge cases, and (where cited) real reference data.

  const testRows = useMemo(() => getKerrTestRows(), []);


  const copyLink = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API can fail silently — no-op.
    }
  };

  return (
    <div className="bhi" aria-label="Black hole ISCO calculator">
      <div className="bhi-header">
        <p className="bhi-title">Black hole ISCO calculator</p>
        <div className="bhi-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="bhi-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="bhi-explainer">
        The <strong>innermost stable circular orbit (ISCO)</strong> is the smallest radius where
        orbiting gas can stay on a stable circular path before plunging into the black hole. For a
        non-spinning (Schwarzschild) hole it's exactly <code>6 GM/c²</code>; spin things up and it
        depends strongly on direction — prograde spin drags the ISCO in toward the horizon, all the
        way down to just <code>1 GM/c²</code> at maximal spin, while retrograde spin pushes it out
        to <code>9 GM/c²</code>.
      </p>

      <div className="bhi-fields">
        <div className="bhi-field">
          <label htmlFor="bhi-mass">Mass (M)</label>
          <div className="bhi-input-row">
            <input
              id="bhi-mass"
              className="bhi-input"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={mass}
              onChange={(e) => setMass(e.target.value)}
            />
            <select className="bhi-unit-select" value={massUnit} onChange={(e) => setMassUnit(e.target.value)}>
              {MASS_UNIT_ORDER.map((u) => (
                <option key={u} value={u}>{MASS_UNITS[u].short}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bhi-spin-field">
        <div className="bhi-spin-label-row">
          <label htmlFor="bhi-spin-range">Dimensionless spin a* (−1 retrograde … +1 prograde)</label>
          <input
            className="bhi-spin-number"
            type="number"
            min="-1"
            max="1"
            step="0.001"
            inputMode="decimal"
            value={aStar}
            onChange={(e) => setAStar(e.target.value)}
          />
        </div>
        <input
          id="bhi-spin-range"
          className="bhi-spin-range"
          type="range"
          min="-1"
          max="1"
          step="0.001"
          value={Number.isFinite(parseFloat(aStar)) ? aStar : 0}
          onChange={(e) => setAStar(e.target.value)}
        />
        <div className="bhi-spin-scale">
          <span>−1 (max retrograde)</span>
          <span>0 (Schwarzschild)</span>
          <span>+1 (max prograde)</span>
        </div>
      </div>

      {!result.valid ? (
        <p className="bhi-note bhi-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="bhi-headline-card">
            <div className="bhi-headline">
              r_ISCO = {formatNumber(result.rIscoRg)} r_g = {formatNumber(result.rIscoRs)} r_s
            </div>
            <div className="bhi-headline-sub">
              Event horizon at {formatNumber(result.rHorizonRg)} r_g · accretion efficiency η ≈{" "}
              {(result.efficiency * 100).toFixed(1)}%
            </div>
          </div>

          {diagram && (
            <div className="bhi-chart-wrap">
              <svg
                className="bhi-diagram-svg"
                viewBox={`0 0 ${diagram.size} ${diagram.size}`}
                role="img"
                aria-label={`Schematic of the event horizon at ${formatNumber(result.rHorizonRg)} gravitational radii, ISCO at ${formatNumber(result.rIscoRg)} gravitational radii, and accretion disk`}
              >
                <defs>
                  <radialGradient id="bhi-disk-gradient" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ffb84d" stopOpacity="0" />
                    <stop offset={`${diagram.innerFrac * 100}%`} stopColor="#ffb84d" stopOpacity="0" />
                    <stop offset={`${Math.min(99, diagram.innerFrac * 100 + 3)}%`} stopColor="#ffd479" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#c2622a" stopOpacity="0.25" />
                  </radialGradient>
                </defs>

                <circle cx={diagram.cx} cy={diagram.cy} r={diagram.diskOuterPx} fill="url(#bhi-disk-gradient)" />

                <circle cx={diagram.cx} cy={diagram.cy} r={diagram.iscoPx} className="bhi-isco-ring" />

                <circle cx={diagram.cx} cy={diagram.cy} r={diagram.horizonPx} className="bhi-horizon" />

                {diagram.spinMag > 0.02 && (
                  <text
                    x={diagram.cx}
                    y={diagram.cy + 5}
                    textAnchor="middle"
                    className="bhi-spin-glyph"
                    style={{ fontSize: `${14 + 26 * diagram.spinMag}px`, opacity: 0.35 + 0.65 * diagram.spinMag }}
                  >
                    {diagram.prograde ? "↻" : "↺"}
                  </text>
                )}

                <text x={diagram.cx} y={diagram.cy - diagram.horizonPx - 8} textAnchor="middle" className="bhi-diagram-label bhi-diagram-label--horizon">
                  event horizon
                </text>
                <text x={diagram.cx} y={diagram.cy - diagram.iscoPx - 8} textAnchor="middle" className="bhi-diagram-label bhi-diagram-label--isco">
                  ISCO / disk inner edge
                </text>
              </svg>
              <p className="bhi-chart-caption">
                Drawn to a fixed scale in gravitational radii, so the circles genuinely shrink or
                grow as spin changes. The disk is truncated for illustration — real accretion disks
                extend much farther out than shown.
              </p>
            </div>
          )}

          {curve && (
            <div className="bhi-chart-wrap">
              <svg
                className="bhi-curve-svg"
                viewBox={`0 0 ${curve.width} ${curve.height}`}
                role="img"
                aria-label="Plot of ISCO radius versus spin parameter, from 9 gravitational radii at maximal retrograde spin to 1 at maximal prograde spin"
              >
                {curve.yTicks.map((t) => (
                  <g key={`y${t}`}>
                    <line x1={curve.marginLeft} x2={curve.marginLeft + curve.plotWidth} y1={curve.yScale(t)} y2={curve.yScale(t)} className="bhi-chart-gridline" />
                    <text x={curve.marginLeft - 8} y={curve.yScale(t) + 4} className="bhi-chart-axis-label" textAnchor="end">{t} r_g</text>
                  </g>
                ))}
                {curve.xTicks.map((t) => (
                  <g key={`x${t}`}>
                    <line x1={curve.xScale(t)} x2={curve.xScale(t)} y1={curve.marginTop} y2={curve.marginTop + curve.plotHeight} className="bhi-chart-gridline" />
                    <text x={curve.xScale(t)} y={curve.height - 12} className="bhi-chart-axis-label" textAnchor="middle">{t}</text>
                  </g>
                ))}
                <line x1={curve.marginLeft} x2={curve.marginLeft} y1={curve.marginTop} y2={curve.marginTop + curve.plotHeight} className="bhi-chart-axis-line" />
                <line x1={curve.marginLeft} x2={curve.marginLeft + curve.plotWidth} y1={curve.marginTop + curve.plotHeight} y2={curve.marginTop + curve.plotHeight} className="bhi-chart-axis-line" />

                <polyline points={curve.linePoints} className="bhi-curve-line" />
                <circle cx={curve.point.x} cy={curve.point.y} r="5.5" className="bhi-curve-point" />
              </svg>
              <p className="bhi-chart-caption">
                ISCO radius as a function of spin a* (positive = prograde). A single continuous
                curve — a* &lt; 0 uses the retrograde branch, a* &gt; 0 the prograde branch.
              </p>
            </div>
          )}

          <div className="bhi-table" role="table" aria-label="ISCO and horizon in every unit">
            <div className="bhi-row" role="row">
              <span className="bhi-row-label" role="cell">ISCO radius</span>
              <span className="bhi-row-value" role="cell">
                {formatNumber(result.rIscoKm)} <span className="bhi-row-unit">km</span>
              </span>
            </div>
            <div className="bhi-row" role="row">
              <span className="bhi-row-label" role="cell">Event horizon radius</span>
              <span className="bhi-row-value" role="cell">
                {formatNumber(result.rHorizonKm)} <span className="bhi-row-unit">km</span> ({formatNumber(result.rHorizonRs)} r_s)
              </span>
            </div>
            <div className="bhi-row" role="row">
              <span className="bhi-row-label" role="cell">If this spin were prograde</span>
              <span className="bhi-row-value" role="cell">{formatNumber(result.proIfRg)} <span className="bhi-row-unit">r_g</span></span>
            </div>
            <div className="bhi-row" role="row">
              <span className="bhi-row-label" role="cell">If this spin were retrograde</span>
              <span className="bhi-row-value" role="cell">{formatNumber(result.retroIfRg)} <span className="bhi-row-unit">r_g</span></span>
            </div>
          </div>
        </>
      )}

      <div className="bhi-footer-row">
        <CalculatorVote slug="black-hole-isco-calculator" />
        <CalculatorTests
          title="Black Hole ISCO Calculator — Tests"
          columns={KERR_TEST_COLUMNS}
          rows={testRows}
          sources={KERR_TEST_SOURCES}
        />
        <button type="button" className="bhi-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
