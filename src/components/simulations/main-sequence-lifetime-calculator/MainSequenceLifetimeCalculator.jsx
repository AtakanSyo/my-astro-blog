import { useEffect, useMemo, useState } from "react";
import {
  lifetimeFromMass,
  massFromLifetime,
  naiveLifetimeFromMass,
  classifyByMass,
  pickYearUnitKey,
  yearsToUnit,
  yearsFromUnit,
  YEAR_UNITS,
  YEAR_UNIT_ORDER,
  UNIVERSE_AGE_YR,
  REPRESENTATIVE_STARS,
} from "./mainSequenceLifetime";
import "../../../styles/mainSequenceLifetimeCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";

const PRESETS = [
  { label: "Red dwarf (0.2 M☉)", solveFor: "lifetime", mass: 0.2 },
  { label: "The Sun (1 M☉)", solveFor: "lifetime", mass: 1 },
  { label: "Sirius-like A-type (2 M☉)", solveFor: "lifetime", mass: 2 },
  { label: "Massive O-type (40 M☉)", solveFor: "lifetime", mass: 40 },
  { label: "Reverse: t = 1 Gyr", solveFor: "mass", lifetimeValue: 1, lifetimeUnit: "gyr" },
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
function formatYears(yr) {
  if (!Number.isFinite(yr) || yr <= 0) return "—";
  const unitKey = pickYearUnitKey(yr);
  return `${formatNumber(yearsToUnit(yr, unitKey), 2)} ${YEAR_UNITS[unitKey].short}`;
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const solveFor = params.get("solve");
  if (solveFor !== "lifetime" && solveFor !== "mass") return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  const unit = params.get("u");
  return {
    solveFor,
    mass: num("m", "1"),
    lifetimeValue: num("t", "10"),
    lifetimeUnit: unit && YEAR_UNIT_ORDER.includes(unit) ? unit : "gyr",
  };
}

export default function MainSequenceLifetimeCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [solveFor, setSolveFor] = useState("lifetime");
  const [mass, setMass] = useState("1");
  const [lifetimeValue, setLifetimeValue] = useState("10");
  const [lifetimeUnit, setLifetimeUnit] = useState("gyr");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setSolveFor(initial.solveFor);
      setMass(initial.mass);
      setLifetimeValue(initial.lifetimeValue);
      setLifetimeUnit(initial.lifetimeUnit);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("solve", solveFor);
      params.set("m", mass);
      params.set("t", lifetimeValue);
      params.set("u", lifetimeUnit);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, solveFor, mass, lifetimeValue, lifetimeUnit]);

  const result = useMemo(() => {
    if (solveFor === "lifetime") {
      const m = parseFloat(mass);
      if (!(m > 0)) return { valid: false, reason: "Enter a positive mass." };
      const t = lifetimeFromMass(m);
      return { valid: true, mSolar: m, tYr: t };
    }
    const rawValue = parseFloat(lifetimeValue);
    if (!(rawValue > 0)) return { valid: false, reason: "Enter a positive lifetime." };
    const t = yearsFromUnit(rawValue, lifetimeUnit);
    const m = massFromLifetime(t);
    return { valid: true, mSolar: m, tYr: t };
  }, [solveFor, mass, lifetimeValue, lifetimeUnit]);

  // --- log-log chart: actual (M^-2.5) vs naive (1/M) scaling ---
  const chart = useMemo(() => {
    if (!result.valid) return null;
    const xMin = Math.log10(0.08);
    const xMax = Math.log10(150);
    const N = 200;
    const actualPts = [];
    const naivePts = [];
    for (let i = 0; i <= N; i++) {
      const logM = xMin + ((xMax - xMin) * i) / N;
      const m = Math.pow(10, logM);
      actualPts.push({ x: logM, y: Math.log10(lifetimeFromMass(m)) });
      naivePts.push({ x: logM, y: Math.log10(naiveLifetimeFromMass(m)) });
    }
    const yVals = [...actualPts, ...naivePts].map((p) => p.y);
    const yMin = Math.min(...yVals) - 0.5;
    const yMax = Math.max(...yVals) + 0.5;

    const width = 640;
    const height = 340;
    const marginLeft = 68;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 40;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;
    const xScale = (x) => marginLeft + ((x - xMin) / (xMax - xMin)) * plotWidth;
    const yScale = (y) => marginTop + (1 - (y - yMin) / (yMax - yMin)) * plotHeight;

    const toPoints = (pts) => pts.map((p) => `${xScale(p.x)},${yScale(p.y)}`).join(" ");
    const decadeTicks = (lo, hi) => {
      const ticks = [];
      for (let e = Math.ceil(lo); e <= hi; e++) ticks.push(e);
      return ticks;
    };

    return {
      width, height, marginLeft, marginRight, marginTop, marginBottom, plotWidth, plotHeight,
      xScale, yScale,
      actualLine: toPoints(actualPts),
      naiveLine: toPoints(naivePts),
      point: { x: xScale(Math.log10(result.mSolar)), y: yScale(Math.log10(lifetimeFromMass(result.mSolar))) },
      landmarks: REPRESENTATIVE_STARS.map((s) => ({
        ...s,
        x: xScale(Math.log10(s.mSolar)),
        y: yScale(Math.log10(lifetimeFromMass(s.mSolar))),
      })),
      xTicks: decadeTicks(xMin, xMax),
      yTicks: decadeTicks(yMin, yMax),
    };
  }, [result]);

  // --- horizontal lifetime-comparison bars across representative masses ---
  const bars = useMemo(() => {
    const rows = REPRESENTATIVE_STARS.map((s) => ({ ...s, tYr: lifetimeFromMass(s.mSolar) }));
    const logs = rows.map((r) => Math.log10(r.tYr));
    const logMin = Math.min(...logs);
    const logMax = Math.max(...logs);
    return rows.map((r) => ({
      ...r,
      widthPct: logMax === logMin ? 100 : ((Math.log10(r.tYr) - logMin) / (logMax - logMin)) * 100,
      exceedsUniverseAge: r.tYr > UNIVERSE_AGE_YR,
    }));
  }, []);

  const applyPreset = (preset) => {
    setSolveFor(preset.solveFor);
    if (preset.solveFor === "lifetime") {
      setMass(String(preset.mass));
    } else {
      setLifetimeValue(String(preset.lifetimeValue));
      setLifetimeUnit(preset.lifetimeUnit);
    }
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
  const exceedsUniverseAge = result.valid && result.tYr > UNIVERSE_AGE_YR;

  return (
    <div className="msl" aria-label="Main-sequence lifetime estimator">
      <div className="msl-header">
        <p className="msl-title">Main-sequence lifetime estimator</p>
        <div className="msl-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="msl-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="msl-explainer">
        Fuel available scales roughly with mass, but the rate a star burns it scales with{" "}
        <strong>luminosity</strong> — and luminosity rises steeply with mass. So{" "}
        <code>t_MS ∝ M/L</code>, commonly approximated near Sun-like masses as{" "}
        <code>t_MS ≈ 10¹⁰ (M/M☉)⁻²·⁵ yr</code>. This is an{" "}
        <strong>order-of-magnitude estimate</strong>, not a stellar-evolution model — it departs
        most from reality at the very low- and very high-mass ends.
      </p>

      <div className="msl-solve-toggle" role="group" aria-label="Solve for">
        <button type="button" className={solveFor === "lifetime" ? "msl-solve-btn active" : "msl-solve-btn"} onClick={() => setSolveFor("lifetime")}>
          Mass → Lifetime
        </button>
        <button type="button" className={solveFor === "mass" ? "msl-solve-btn active" : "msl-solve-btn"} onClick={() => setSolveFor("mass")}>
          Lifetime → Mass
        </button>
      </div>

      <div className="msl-fields">
        <div className="msl-field">
          <label htmlFor="msl-mass">Mass (M☉)</label>
          {solveFor === "mass" ? (
            <div className="msl-computed">{result.valid ? formatNumber(result.mSolar) : "—"}</div>
          ) : (
            <input id="msl-mass" className="msl-input" type="number" min="0" step="any" inputMode="decimal" value={mass} onChange={(e) => setMass(e.target.value)} />
          )}
        </div>
        <div className="msl-field">
          <label htmlFor="msl-lifetime">Main-sequence lifetime</label>
          {solveFor === "lifetime" ? (
            <div className="msl-computed">{result.valid ? formatYears(result.tYr) : "—"}</div>
          ) : (
            <div className="msl-input-row">
              <input
                id="msl-lifetime"
                className="msl-input"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={lifetimeValue}
                onChange={(e) => setLifetimeValue(e.target.value)}
              />
              <select className="msl-unit-select" value={lifetimeUnit} onChange={(e) => setLifetimeUnit(e.target.value)}>
                {YEAR_UNIT_ORDER.map((u) => <option key={u} value={u}>{YEAR_UNITS[u].short}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {!result.valid ? (
        <p className="msl-note msl-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="msl-headline-card">
            <div className="msl-headline">
              t_MS ≈ {formatYears(result.tYr)} ({formatNumber(result.tYr)} yr)
            </div>
            <div className="msl-headline-sub">
              M ≈ {formatNumber(result.mSolar)} M☉
              {classification && (
                <span className={`msl-badge msl-badge--${classification.tone}`}>{classification.label}</span>
              )}
              {exceedsUniverseAge && (
                <span className="msl-badge msl-badge--warn">Longer than the age of the universe (~13.8 Gyr)</span>
              )}
            </div>
          </div>

          {chart && (
            <div className="msl-chart-wrap">
              <svg
                className="msl-diagram-svg"
                viewBox={`0 0 ${chart.width} ${chart.height}`}
                role="img"
                aria-label="Log-log plot of main-sequence mass versus lifetime, showing the steep actual scaling against a naive 1-over-mass comparison"
              >
                {chart.xTicks.map((e) => (
                  <g key={`x${e}`}>
                    <line x1={chart.xScale(e)} x2={chart.xScale(e)} y1={chart.marginTop} y2={chart.marginTop + chart.plotHeight} className="msl-chart-gridline" />
                    <text x={chart.xScale(e)} y={chart.height - 12} className="msl-chart-axis-label" textAnchor="middle">10{toSuperscript(e)} M☉</text>
                  </g>
                ))}
                {chart.yTicks.map((e) => (
                  <g key={`y${e}`}>
                    <line x1={chart.marginLeft} x2={chart.marginLeft + chart.plotWidth} y1={chart.yScale(e)} y2={chart.yScale(e)} className="msl-chart-gridline" />
                    <text x={chart.marginLeft - 8} y={chart.yScale(e) + 4} className="msl-chart-axis-label" textAnchor="end">10{toSuperscript(e)} yr</text>
                  </g>
                ))}
                <line x1={chart.marginLeft} x2={chart.marginLeft} y1={chart.marginTop} y2={chart.marginTop + chart.plotHeight} className="msl-chart-axis-line" />
                <line x1={chart.marginLeft} x2={chart.marginLeft + chart.plotWidth} y1={chart.marginTop + chart.plotHeight} y2={chart.marginTop + chart.plotHeight} className="msl-chart-axis-line" />

                <polyline points={chart.naiveLine} className="msl-naive-line" />
                <polyline points={chart.actualLine} className="msl-curve-line" />

                {chart.landmarks.map((lm) => (
                  <g key={lm.label}>
                    <circle cx={lm.x} cy={lm.y} r="4" className="msl-chart-landmark" />
                    <text x={lm.x} y={lm.y - 8} className="msl-chart-landmark-label" textAnchor="middle">{lm.label}</text>
                  </g>
                ))}

                <circle cx={chart.point.x} cy={chart.point.y} r="6" className="msl-chart-point" />
              </svg>
              <p className="msl-chart-caption">
                <span className="msl-legend-swatch msl-legend-swatch--actual" /> Actual (t ∝ M⁻²·⁵) —{" "}
                <span className="msl-legend-swatch msl-legend-swatch--naive" /> naive 1:1 fuel-to-burn-rate
                scaling (t ∝ 1/M). The gap between the two lines is luminosity's own steep rise with
                mass, doing double duty: more fuel, burned disproportionately faster.
              </p>
            </div>
          )}

          <div className="msl-chart-wrap">
            <div className="msl-bars">
              {bars.map((b) => (
                <div className="msl-bar-row" key={b.label}>
                  <span className="msl-bar-label">{b.label} ({formatNumber(b.mSolar)} M☉)</span>
                  <div className="msl-bar-track">
                    <div
                      className={`msl-bar-fill${b.exceedsUniverseAge ? " msl-bar-fill--eon" : ""}`}
                      style={{ width: `${Math.max(2, b.widthPct)}%` }}
                    />
                  </div>
                  <span className="msl-bar-value">{formatYears(b.tYr)}</span>
                </div>
              ))}
            </div>
            <p className="msl-chart-caption">
              Bar length is on a <strong>log scale</strong> — the actual span between a red dwarf and a
              massive O-type star covers roughly six orders of magnitude, from far longer than the
              current age of the universe down to just a few million years.
            </p>
          </div>
        </>
      )}

      <div className="msl-footer-row">
        <CalculatorVote slug="main-sequence-lifetime-calculator" />
        <button type="button" className="msl-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
