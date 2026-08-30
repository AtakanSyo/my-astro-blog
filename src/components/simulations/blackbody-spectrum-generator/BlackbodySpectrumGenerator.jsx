import { useEffect, useId, useMemo, useState } from "react";
import {
  planckRadiance,
  wienPeakNm,
  stefanBoltzmannFlux,
  blackbodyColor,
  rgbToCss,
  rgbToHex,
} from "./physics";
import { BLACKBODY_TEST_COLUMNS, BLACKBODY_TEST_SOURCES, getBlackbodyTestRows } from "./physicsTests";
import "../../../styles/blackbodySpectrumGenerator.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import CalculatorTests from "../../CalculatorTests.jsx";

const TEMP_MIN = 300;
const TEMP_MAX = 50000;
const LAMBDA_MIN_NM = 10;
const LAMBDA_MAX_NM = 100000;
const SAMPLE_COUNT = 260;
const LOG_DECADES = 5; // dynamic range shown in "log" y-mode
const SLIDER_STEPS = 1000;

const PRESETS = [
  { label: "Liquid nitrogen", temp: 77 },
  { label: "Antarctic winter", temp: 220 },
  { label: "Freezer", temp: 255 },
  { label: "Room temperature", temp: 293 },
  { label: "Human body", temp: 310 },
  { label: "Hot coffee", temp: 350 },
  { label: "Boiling water", temp: 373 },

  { label: "Wood-fired pizza oven", temp: 750 },
  { label: "Glowing red metal", temp: 1000 },
  { label: "Campfire", temp: 1100 },
  { label: "Molten lava", temp: 1500 },
  { label: "Candle flame", temp: 1700 },
  { label: "Steel melting point", temp: 1800 },
  { label: "Incandescent light bulb", temp: 2700 },

  { label: "Red dwarf star", temp: 3000 },
  { label: "Sunspot", temp: 3800 },
  { label: "Earth's core", temp: 5700 },
  { label: "Surface of the Sun", temp: 5778 },
  { label: "Sirius A", temp: 9940 },

  { label: "Lightning bolt", temp: 30000 },
  { label: "O-type star", temp: 40000 },
  { label: "Hottest known stars", temp: 200000 },
];

const VISIBLE_MIN_NM = 380;
const VISIBLE_MAX_NM = 750;

const AXIS_TICKS_NM = [10, 100, 1000, 10000, 100000];

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function clamp01(v) {
  return clamp(v, 0, 1);
}

const logMinT = Math.log10(TEMP_MIN);
const logMaxT = Math.log10(TEMP_MAX);

function posFromTemp(tempK) {
  const t = clamp(tempK, TEMP_MIN, TEMP_MAX);
  return ((Math.log10(t) - logMinT) / (logMaxT - logMinT)) * SLIDER_STEPS;
}

function tempFromPos(pos) {
  const frac = pos / SLIDER_STEPS;
  return Math.pow(10, logMinT + frac * (logMaxT - logMinT));
}

function formatWavelength(nm) {
  if (nm < 1000) return `${nm.toFixed(nm < 10 ? 2 : 1)} nm`;
  return `${(nm / 1000).toFixed(nm / 1000 < 10 ? 2 : 1)} µm`;
}

function formatFlux(wPerM2) {
  const units = [
    [1e9, "GW"],
    [1e6, "MW"],
    [1e3, "kW"],
  ];
  for (const [scale, unit] of units) {
    if (wPerM2 >= scale) return `${(wPerM2 / scale).toFixed(2)} ${unit}/m²`;
  }
  return `${wPerM2.toFixed(wPerM2 < 1 ? 3 : 1)} W/m²`;
}

function formatTemp(tempK) {
  return `${Math.round(tempK).toLocaleString()} K`;
}

function sampleSpectrum(tempK) {
  const points = new Array(SAMPLE_COUNT + 1);
  let max = 0;
  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const frac = i / SAMPLE_COUNT;
    const lambda = Math.pow(
      10,
      Math.log10(LAMBDA_MIN_NM) + frac * (Math.log10(LAMBDA_MAX_NM) - Math.log10(LAMBDA_MIN_NM))
    );
    const radiance = planckRadiance(lambda, tempK);
    if (radiance > max) max = radiance;
    points[i] = { lambda, radiance };
  }
  return { points, max };
}

function normalizedY(radiance, max, mode) {
  if (max <= 0 || radiance <= 0) return 0;
  if (mode === "linear") return clamp01(radiance / max);
  return clamp01(1 + Math.log10(radiance / max) / LOG_DECADES);
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const t = params.get("t");
  if (t === null) return null;
  return {
    temp: clamp(parseFloat(t), TEMP_MIN, TEMP_MAX) || 5778,
    compareTemp: params.get("t2") ? clamp(parseFloat(params.get("t2")), TEMP_MIN, TEMP_MAX) : null,
    mode: params.get("scale") === "log" ? "log" : "linear",
  };
}

export default function BlackbodySpectrumGenerator() {
  const gradientId = useId().replace(/[:]/g, "");

  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Reading window.location.search into the initial state here would make
  // the client's first render diverge from that static HTML (a React
  // hydration mismatch) whenever the page is loaded with a query string —
  // e.g. via this component's own "shareable link" feature. Any URL-encoded
  // state is applied client-side, after mount, in the effect below instead.
  const [temp, setTemp] = useState(5778);
  const [mode, setMode] = useState("linear");
  const [compareOn, setCompareOn] = useState(false);
  const [compareTemp, setCompareTemp] = useState(3000);
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setTemp(initial.temp);
      setMode(initial.mode);
      if (initial.compareTemp !== null) {
        setCompareOn(true);
        setCompareTemp(initial.compareTemp);
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    // Debounced: dragging the temperature slider fires dozens of updates
    // per second, and each one used to call history.replaceState()
    // immediately. Browsers cap how many times a page may rewrite history
    // in a short window (Chrome/Firefox ~100 calls/10s, Safari ~100/30s) —
    // blow through that while dragging and the next call throws an
    // uncaught SecurityError, which (with no error boundary here) unmounts
    // the whole component. Waiting for a pause in changes keeps the call
    // count trivial regardless of how long someone drags the slider.
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("t", Math.round(temp).toString());
      if (compareOn) params.set("t2", Math.round(compareTemp).toString());
      if (mode === "log") params.set("scale", "log");
      const query = params.toString();
      const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, temp, compareOn, compareTemp, mode]);

  const spectrum1 = useMemo(() => sampleSpectrum(temp), [temp]);
  const spectrum2 = useMemo(() => (compareOn ? sampleSpectrum(compareTemp) : null), [compareOn, compareTemp]);

  const color1 = useMemo(() => blackbodyColor(temp), [temp]);
  const color2 = useMemo(() => (compareOn ? blackbodyColor(compareTemp) : null), [compareOn, compareTemp]);

  // --- chart geometry ---
  const width = 640;
  const height = 320;
  const marginLeft = 46;
  const marginRight = 18;
  const marginTop = 20;
  const marginBottom = 36;
  const plotWidth = width - marginLeft - marginRight;
  const plotHeight = height - marginTop - marginBottom;
  const baselineY = marginTop + plotHeight;

  const logLambdaMin = Math.log10(LAMBDA_MIN_NM);
  const logLambdaMax = Math.log10(LAMBDA_MAX_NM);

  const xScale = (lambdaNm) =>
    marginLeft + ((Math.log10(lambdaNm) - logLambdaMin) / (logLambdaMax - logLambdaMin)) * plotWidth;
  const yScale = (norm) => marginTop + (1 - norm) * plotHeight;

  const buildPaths = (spectrum) => {
    if (!spectrum) return { line: "", area: "" };
    let line = "";
    let area = "";
    spectrum.points.forEach((p, i) => {
      const x = xScale(p.lambda).toFixed(2);
      const y = yScale(normalizedY(p.radiance, spectrum.max, mode)).toFixed(2);
      line += `${i === 0 ? "M" : "L"} ${x},${y} `;
      if (i === 0) area += `M ${x},${baselineY.toFixed(2)} L ${x},${y} `;
      else area += `L ${x},${y} `;
    });
    const lastX = xScale(spectrum.points[spectrum.points.length - 1].lambda).toFixed(2);
    area += `L ${lastX},${baselineY.toFixed(2)} Z`;
    return { line: line.trim(), area };
  };

  const path1 = useMemo(() => buildPaths(spectrum1), [spectrum1, mode]);
  const path2 = useMemo(() => buildPaths(spectrum2), [spectrum2, mode]);

  const visibleBandX1 = xScale(VISIBLE_MIN_NM);
  const visibleBandX2 = xScale(VISIBLE_MAX_NM);

  const applyPreset = (t) => {
    setTemp(t);
  };

  // Self-check rows: runs the real physicsTests.js functions against

  // identities, edge cases, and (where cited) real reference data.

  const testRows = useMemo(() => getBlackbodyTestRows(), []);


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

  const css1 = rgbToCss(color1);
  const css2 = color2 ? rgbToCss(color2) : null;

  return (
    <div className="bsg" aria-label="Blackbody spectrum generator">
      <div className="bsg-header">
        <p className="bsg-title">Blackbody spectrum generator</p>
        <div className="bsg-presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="bsg-preset-btn"
              onClick={() => applyPreset(preset.temp)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bsg-controls">
        <div className="bsg-temp-control">
          <div className="bsg-temp-row">
            <label htmlFor="bsg-temp-num">Temperature</label>
            <input
              id="bsg-temp-num"
              className="bsg-temp-input"
              type="number"
              min={TEMP_MIN}
              max={TEMP_MAX}
              value={Math.round(temp)}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v)) setTemp(clamp(v, TEMP_MIN, TEMP_MAX));
              }}
            />
            <span className="bsg-temp-unit">K</span>
          </div>
          <input
            className="bsg-slider"
            type="range"
            min={0}
            max={SLIDER_STEPS}
            step={1}
            value={posFromTemp(temp)}
            onChange={(e) => setTemp(tempFromPos(parseFloat(e.target.value)))}
            style={{ "--bsg-thumb-color": css1 }}
            aria-label="Temperature in Kelvin (logarithmic)"
          />
        </div>

        <div className="bsg-toggles">
          <div className="bsg-scale-toggle" role="group" aria-label="Intensity scale">
            <button
              type="button"
              className={mode === "linear" ? "bsg-scale-btn active" : "bsg-scale-btn"}
              onClick={() => setMode("linear")}
            >
              Linear
            </button>
            <button
              type="button"
              className={mode === "log" ? "bsg-scale-btn active" : "bsg-scale-btn"}
              onClick={() => setMode("log")}
            >
              Log
            </button>
          </div>

          <label className="bsg-compare-toggle">
            <input
              type="checkbox"
              checked={compareOn}
              onChange={(e) => setCompareOn(e.target.checked)}
            />
            Compare a second temperature
          </label>
        </div>

        {compareOn && (
          <div className="bsg-temp-control bsg-temp-control--compare">
            <div className="bsg-temp-row">
              <label htmlFor="bsg-temp-num-2">Compare to</label>
              <input
                id="bsg-temp-num-2"
                className="bsg-temp-input"
                type="number"
                min={TEMP_MIN}
                max={TEMP_MAX}
                value={Math.round(compareTemp)}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (Number.isFinite(v)) setCompareTemp(clamp(v, TEMP_MIN, TEMP_MAX));
                }}
              />
              <span className="bsg-temp-unit">K</span>
            </div>
            <input
              className="bsg-slider"
              type="range"
              min={0}
              max={SLIDER_STEPS}
              step={1}
              value={posFromTemp(compareTemp)}
              onChange={(e) => setCompareTemp(tempFromPos(parseFloat(e.target.value)))}
              style={{ "--bsg-thumb-color": css2 }}
              aria-label="Second temperature in Kelvin (logarithmic)"
            />
          </div>
        )}
      </div>

      <div className="bsg-main">
        <div className="bsg-chart-wrap">
          {compareOn && (
            <div className="bsg-legend">
              <span className="bsg-legend-item">
                <span className="bsg-legend-dot" style={{ background: css1 }} />
                {formatTemp(temp)}
              </span>
              <span className="bsg-legend-item">
                <span className="bsg-legend-dot bsg-legend-dot--dashed" style={{ background: css2 }} />
                {formatTemp(compareTemp)}
              </span>
            </div>
          )}

          <svg
            className="bsg-svg"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`Blackbody spectral radiance curve at ${formatTemp(temp)}`}
          >
            <defs>
              <filter id={`glow-${gradientId}`} x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="3.2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id={`area-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={css1} stopOpacity="0.38" />
                <stop offset="100%" stopColor={css1} stopOpacity="0" />
              </linearGradient>
              <linearGradient id={`visible-${gradientId}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#7f5cff" />
                <stop offset="25%" stopColor="#4fa8ff" />
                <stop offset="45%" stopColor="#4fe0a8" />
                <stop offset="65%" stopColor="#e7e04f" />
                <stop offset="85%" stopColor="#ff8a4f" />
                <stop offset="100%" stopColor="#ff4f4f" />
              </linearGradient>
            </defs>

            {/* visible-light band */}
            <rect
              x={visibleBandX1}
              y={marginTop}
              width={visibleBandX2 - visibleBandX1}
              height={plotHeight}
              fill={`url(#visible-${gradientId})`}
              opacity="0.1"
            />
            <text
              x={(visibleBandX1 + visibleBandX2) / 2}
              y={marginTop + 12}
              className="bsg-band-label"
              textAnchor="middle"
            >
              visible
            </text>

            {/* axis ticks */}
            {AXIS_TICKS_NM.map((nm) => (
              <g key={nm}>
                <line
                  x1={xScale(nm)}
                  x2={xScale(nm)}
                  y1={marginTop}
                  y2={baselineY}
                  className="bsg-gridline"
                />
                <text x={xScale(nm)} y={height - 12} className="bsg-axis-label" textAnchor="middle">
                  {formatWavelength(nm)}
                </text>
              </g>
            ))}
            <line x1={marginLeft} x2={width - marginRight} y1={baselineY} y2={baselineY} className="bsg-axis-line" />

            {/* comparison curve, drawn first so the primary curve sits on top */}
            {compareOn && spectrum2 && (
              <>
                <path d={path2.line} fill="none" stroke={css2} strokeWidth="2" strokeDasharray="5 4" opacity="0.85" />
              </>
            )}

            {/* primary curve */}
            <path d={path1.area} fill={`url(#area-${gradientId})`} stroke="none" />
            <path
              d={path1.line}
              fill="none"
              stroke={css1}
              strokeWidth="2.5"
              filter={`url(#glow-${gradientId})`}
            />
          </svg>

          <p className="bsg-y-caption">
            {mode === "linear" ? "Spectral radiance, normalized to peak" : `Spectral radiance, log scale (${LOG_DECADES} decades)`}
          </p>
        </div>

        <div className="bsg-readouts">
          <div className="bsg-swatch-card">
            <span
              className="bsg-swatch"
              style={{ background: css1, boxShadow: `0 0 22px 4px ${css1}` }}
              aria-hidden="true"
            />
            <div className="bsg-swatch-info">
              <span className="bsg-swatch-label">Apparent color</span>
              <span className="bsg-swatch-value">{rgbToHex(color1)}</span>
            </div>
          </div>

          <dl className="bsg-stats">
            <div className="bsg-stat">
              <dt>Peak wavelength (Wien)</dt>
              <dd>{formatWavelength(wienPeakNm(temp))}</dd>
            </div>
            <div className="bsg-stat">
              <dt>Total flux (Stefan–Boltzmann)</dt>
              <dd>{formatFlux(stefanBoltzmannFlux(temp))}</dd>
            </div>
          </dl>

          {compareOn && color2 && (
            <>
              <div className="bsg-swatch-card bsg-swatch-card--compare">
                <span
                  className="bsg-swatch"
                  style={{ background: css2, boxShadow: `0 0 22px 4px ${css2}` }}
                  aria-hidden="true"
                />
                <div className="bsg-swatch-info">
                  <span className="bsg-swatch-label">Compare color</span>
                  <span className="bsg-swatch-value">{rgbToHex(color2)}</span>
                </div>
              </div>
              <dl className="bsg-stats">
                <div className="bsg-stat">
                  <dt>Peak wavelength (Wien)</dt>
                  <dd>{formatWavelength(wienPeakNm(compareTemp))}</dd>
                </div>
                <div className="bsg-stat">
                  <dt>Total flux (Stefan–Boltzmann)</dt>
                  <dd>{formatFlux(stefanBoltzmannFlux(compareTemp))}</dd>
                </div>
              </dl>
            </>
          )}
        </div>
      </div>

      <div className="bsg-footer-row">
        <CalculatorVote slug="blackbody-spectrum-generator" />
        <CalculatorTests
          title="Blackbody Spectrum Generator — Tests"
          columns={BLACKBODY_TEST_COLUMNS}
          rows={testRows}
          sources={BLACKBODY_TEST_SOURCES}
        />
        <button type="button" className="bsg-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
