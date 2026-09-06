import { useEffect, useMemo, useState } from "react";
import { DRAKE_FACTORS, computeN, decadeSpan, plausibleRangeN, interpretN } from "./drakeEquation";
import { DRAKE_EQUATION_TEST_COLUMNS, DRAKE_EQUATION_TEST_SOURCES, getDrakeEquationTestRows } from "./drakeEquationTests";
import "../../../styles/drakeEquationCalculator.css";
import "../../../styles/calculators.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import CalculatorTests from "../../CalculatorTests.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";
import Katex from "../../Katex.jsx";

// Every preset is a real, citable position, not an arbitrary slider
// arrangement — Drake's own 1961 numbers give the famous N≈10; the other
// three show that a small or large N can come from genuinely different
// stories (biology is rare vs. civilizations are short-lived), which is
// the whole reason a single output number is misleading on its own.
const PRESETS = [
  { label: "Drake's 1961 estimate (N ≈ 10)", values: { rStar: 10, fp: 0.5, ne: 2, fl: 1, fi: 0.01, fc: 0.01, L: 10000 } },
  { label: "Optimistic: life is common", values: { rStar: 3, fp: 1, ne: 1, fl: 0.5, fi: 0.5, fc: 0.5, L: 1e6 } },
  { label: "Rare Earth: life itself is the bottleneck", values: { rStar: 1.5, fp: 0.9, ne: 0.2, fl: 1e-6, fi: 1e-4, fc: 0.1, L: 200 } },
  { label: "Great Filter: civilizations don't last", values: { rStar: 1.5, fp: 0.9, ne: 0.4, fl: 0.5, fi: 0.1, fc: 0.2, L: 50 } },
];

const TIER_LABEL = { measured: "roughly measured", unconstrained: "essentially a guess" };

function trimTrailingZeros(s) {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}
const SUPERSCRIPT_MAP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
function toSuperscript(n) {
  return String(n).split("").map((ch) => SUPERSCRIPT_MAP[ch] ?? ch).join("");
}
function formatVal(n) {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n === 0) return "0";
  if (n >= 1e5 || n < 1e-3) {
    const exp = Math.floor(Math.log10(n));
    const mantissa = n / Math.pow(10, exp);
    return `${trimTrailingZeros(mantissa.toFixed(2))} × 10${toSuperscript(exp)}`;
  }
  if (n >= 100) return trimTrailingZeros(n.toFixed(1));
  if (n >= 1) return trimTrailingZeros(n.toFixed(2));
  return trimTrailingZeros(n.toFixed(4));
}

function defaultLogValues() {
  return Object.fromEntries(DRAKE_FACTORS.map((f) => [f.key, String(Math.log10(f.default))]));
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const has = DRAKE_FACTORS.every((f) => params.get(f.key) !== null && Number.isFinite(parseFloat(params.get(f.key))));
  if (!has) return null;
  const logValues = {};
  for (const f of DRAKE_FACTORS) {
    const raw = parseFloat(params.get(f.key));
    const clamped = Math.min(Math.log10(f.max), Math.max(Math.log10(f.min), raw));
    logValues[f.key] = String(clamped);
  }
  return logValues;
}

export default function DrakeEquationCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders
  // these (each factor's own stated default, a deliberately neutral
  // starting point rather than any one named scenario). Any URL-encoded
  // state is applied client-side, after mount, below.
  const [logValues, setLogValues] = useState(defaultLogValues);
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) setLogValues(initial);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      for (const f of DRAKE_FACTORS) params.set(f.key, logValues[f.key]);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, logValues]);

  const values = useMemo(
    () => Object.fromEntries(DRAKE_FACTORS.map((f) => [f.key, Math.pow(10, parseFloat(logValues[f.key]) || Math.log10(f.default))])),
    [logValues]
  );
  const N = useMemo(() => computeN(values), [values]);
  const range = useMemo(() => plausibleRangeN(), []);

  // --- tornado chart: each factor's own plausible range, in orders of
  // magnitude — the direct visual proof that fl/fi/fc/L, not R*/fp/ne,
  // are what actually decide where N can land.
  const tornado = useMemo(() => {
    const rows = DRAKE_FACTORS.map((f) => ({ f, span: decadeSpan(f) })).sort((a, b) => b.span - a.span);
    const maxSpan = Math.max(...rows.map((r) => r.span));
    const width = 640;
    const rowHeight = 34;
    const height = rows.length * rowHeight + 10;
    const labelWidth = 130;
    const plotWidth = width - labelWidth - 60;
    return { rows, maxSpan, width, height, rowHeight, labelWidth, plotWidth };
  }, []);

  // --- output range bar: the full plausible range for N (from every
  // factor's own min/max), log-scaled, with the current slider-derived N
  // marked inside it.
  const rangeBar = useMemo(() => {
    const logMin = Math.log10(range.min);
    const logMax = Math.log10(range.max);
    const pad = (logMax - logMin) * 0.04;
    const xMin = logMin - pad;
    const xMax = logMax + pad;
    const width = 640;
    const height = 130;
    const marginLeft = 14;
    const marginRight = 14;
    const y = 56;
    const plotWidth = width - marginLeft - marginRight;
    const xScale = (logN) => marginLeft + ((logN - xMin) / (xMax - xMin)) * plotWidth;

    const span = xMax - xMin;
    const step = Math.max(5, Math.ceil(span / 7 / 5) * 5);
    const start = Math.ceil(xMin / step) * step;
    const ticks = [];
    for (let t = start; t <= xMax; t += step) ticks.push(t);

    const logN = Math.log10(N);
    return {
      width, height, marginLeft, plotWidth, y,
      startX: xScale(logMin), endX: xScale(logMax),
      pointX: xScale(Math.min(xMax, Math.max(xMin, logN))),
      oneX: xMin <= 0 && 0 <= xMax ? xScale(0) : null,
      ticks: ticks.map((t) => ({ t, x: xScale(t) })),
    };
  }, [range, N]);

  const applyPreset = (preset) => {
    const next = {};
    for (const f of DRAKE_FACTORS) next[f.key] = String(Math.log10(preset.values[f.key]));
    setLogValues(next);
  };

  const testRows = useMemo(() => getDrakeEquationTestRows(), []);

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

  return (
    <div className="dre" aria-label="Drake equation calculator">
      <div className="dre-header">
        <p className="dre-title">Drake equation calculator</p>
        <div className="dre-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="dre-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="dre-explainer">
        <Katex tex={String.raw`N = R_* \cdot f_p \cdot n_e \cdot f_l \cdot f_i \cdot f_c \cdot L`} /> — the estimated number of currently
        detectable communicating civilizations in the Milky Way. Move any slider; the last four
        factors are colored differently on purpose — nobody has ever measured them.
      </p>

      <div className="dre-sliders">
        {DRAKE_FACTORS.map((f) => (
          <div key={f.key} className={`dre-slider-row dre-tier-${f.tier}`}>
            <div className="dre-slider-top">
              <span className="dre-slider-label">
                <span className="dre-symbol">{f.symbol}</span> {f.label}
              </span>
              <span className="dre-slider-value">
                {formatVal(values[f.key])} {f.unit}
              </span>
            </div>
            <input
              type="range"
              className="dre-slider"
              min={Math.log10(f.min)}
              max={Math.log10(f.max)}
              step="any"
              value={logValues[f.key]}
              onChange={(e) => setLogValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
            />
            <div className="dre-slider-bottom">
              <span className={`dre-tier-badge dre-tier-badge--${f.tier}`}>{TIER_LABEL[f.tier]}</span>
              <span className="dre-slider-note">{f.note}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dre-headline-card">
        <div className="dre-headline"><Katex tex="N" /> ≈ {formatVal(N)}</div>
        <div className="dre-headline-sub">{interpretN(N)}</div>
      </div>

      <div className="chart-wrap">
        <p className="dre-chart-title">Where your guess sits in the full plausible range</p>
        <svg
          className="dre-range-svg"
          viewBox={`0 0 ${rangeBar.width} ${rangeBar.height}`}
          role="img"
          aria-label={`N could plausibly range from ${formatVal(range.min)} to ${formatVal(range.max)}; your current inputs give ${formatVal(N)}`}
        >
          <line x1={rangeBar.startX} x2={rangeBar.endX} y1={rangeBar.y} y2={rangeBar.y} className="dre-range-track" />
          {rangeBar.ticks.map(({ t, x }) => (
            <g key={t}>
              <line x1={x} x2={x} y1={rangeBar.y - 6} y2={rangeBar.y + 6} className="dre-range-tick" />
              <text x={x} y={rangeBar.y + 22} className="dre-range-tick-label" textAnchor="middle">10{toSuperscript(Math.round(t))}</text>
            </g>
          ))}
          {rangeBar.oneX !== null && (
            <>
              <line x1={rangeBar.oneX} x2={rangeBar.oneX} y1={rangeBar.y - 16} y2={rangeBar.y + 16} className="dre-range-one-line" />
              <text x={rangeBar.oneX} y={rangeBar.y - 22} className="dre-range-one-label" textAnchor="middle">N = 1 (just us)</text>
            </>
          )}
          <polygon
            points={`${rangeBar.pointX - 7},${rangeBar.y - 30} ${rangeBar.pointX + 7},${rangeBar.y - 30} ${rangeBar.pointX},${rangeBar.y - 17}`}
            className="dre-range-marker"
          />
          <text x={rangeBar.pointX} y={rangeBar.y + 44} className="dre-range-here-label" textAnchor="middle">your inputs</text>
        </svg>
        <p className="dre-chart-caption">
          The full bar is the range of N implied by every factor's own plausible bounds —
          {" "}{formatVal(range.min)} to {formatVal(range.max)}, roughly{" "}
          {formatVal(Math.log10(range.max) - Math.log10(range.min))} orders of magnitude. That
          span isn't a bug in this calculator; it's the honest state of the science.
        </p>
      </div>

      <div className="chart-wrap">
        <p className="dre-chart-title">Which factors actually drive that range</p>
        <svg
          className="dre-tornado-svg"
          viewBox={`0 0 ${tornado.width} ${tornado.height}`}
          role="img"
          aria-label="Bar chart of each Drake equation factor's own plausible range, in orders of magnitude, longest first"
        >
          {tornado.rows.map((row, i) => {
            const y = i * tornado.rowHeight;
            const barWidth = (row.span / tornado.maxSpan) * tornado.plotWidth;
            return (
              <g key={row.f.key}>
                <text x={tornado.labelWidth - 8} y={y + tornado.rowHeight / 2 + 4} className="dre-tornado-label" textAnchor="end">
                  {row.f.symbol}
                </text>
                <rect x={tornado.labelWidth} y={y + 6} width={Math.max(2, barWidth)} height={tornado.rowHeight - 14} className={`dre-tornado-bar dre-tornado-bar--${row.f.tier}`} />
                <text x={tornado.labelWidth + Math.max(2, barWidth) + 8} y={y + tornado.rowHeight / 2 + 4} className="dre-tornado-value">
                  {formatVal(row.span)} decades
                </text>
              </g>
            );
          })}
        </svg>
        <p className="dre-chart-caption">
          Sorted longest to shortest. The bars for <Katex tex="f_l" />, <Katex tex="f_i" />, <Katex tex="f_c" />, and{" "}
          <Katex tex="L" /> dwarf <Katex tex="R_*" />, <Katex tex="f_p" />, and <Katex tex="n_e" /> — the
          output range comes almost entirely from four terms nobody has ever measured.
        </p>
      </div>

      <div className="dre-footer-row">
        <CalculatorVote slug="drake-equation-calculator" />
        <CalculatorTests
          title="Drake Equation Calculator — Tests"
          columns={DRAKE_EQUATION_TEST_COLUMNS}
          rows={testRows}
          sources={DRAKE_EQUATION_TEST_SOURCES}
        />
        <button type="button" className="dre-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
