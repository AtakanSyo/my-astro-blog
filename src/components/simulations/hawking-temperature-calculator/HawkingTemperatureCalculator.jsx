import { useEffect, useMemo, useState } from "react";
import {
  MASS_UNITS,
  MASS_UNIT_ORDER,
  massToKg,
  massFromKg,
  hawkingTemperature,
  CMB_TEMPERATURE_K,
} from "./hawkingTemperature";
import {
  HAWKING_TEMPERATURE_TEST_COLUMNS,
  HAWKING_TEMPERATURE_TEST_SOURCES,
  getHawkingTemperatureTestRows,
} from "./hawkingTemperatureTests";
import "../../../styles/hawkingTemperatureCalculator.css";
import "../../../styles/calculators.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import CalculatorTests from "../../CalculatorTests.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";
import Katex from "../../Katex.jsx";

// Every preset is a "mass" value the user can drop straight into the mass
// field — chosen to span the full range this tool is built to show, from
// an ordinary stellar remnant up to a dramatically hotter hypothetical.
const PRESETS = [
  { label: "Sun-mass BH", mass: 1, massUnit: "msun" },
  { label: "Sgr A*-mass BH (~4.3M M☉)", mass: 4.3e6, massUnit: "msun" },
  { label: "Stellar-mass BH (~10 M☉)", mass: 10, massUnit: "msun" },
  { label: "Hypothetical asteroid-mass BH (1e12 kg)", mass: 1e12, massUnit: "kg" },
];

// Fixed reference points always shown on the chart, independent of the
// user's current input — for orientation.
const REFERENCE_POINTS = [
  { label: "Sun-mass BH", massKg: massToKg(1, "msun") },
  { label: "Sgr A* (~4.3M M☉)", massKg: massToKg(4.3e6, "msun") },
  { label: "Smallest known stellar BH (~3 M☉)", massKg: massToKg(3, "msun") },
];

// Plot domain: from a Planck-mass-scale hypothetical black hole up through
// extreme supermassive scales.
const PLOT_MIN_MASS_KG = 1e-8;
const PLOT_MAX_MASS_KG = massToKg(1e10, "msun");

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
  if (n >= 1e6 || n < 1e-4) {
    const exp = Math.floor(Math.log10(n));
    const mantissa = n / Math.pow(10, exp);
    return `${trimTrailingZeros(mantissa.toFixed(digits))} × 10${toSuperscript(exp)}`;
  }
  if (n >= 100) return trimTrailingZeros(n.toFixed(1));
  if (n >= 1) return trimTrailingZeros(n.toFixed(digits));
  return trimTrailingZeros(n.toFixed(digits + 2));
}
function formatPow10(exp) {
  return `10${toSuperscript(exp)}`;
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("m");
  if (raw === null || !Number.isFinite(parseFloat(raw))) return null;
  return {
    mass: raw,
    massUnit: MASS_UNITS[params.get("mu")] ? params.get("mu") : "msun",
  };
}

export default function HawkingTemperatureCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [mass, setMass] = useState("1");
  const [massUnit, setMassUnit] = useState("msun");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setMass(initial.mass);
      setMassUnit(initial.massUnit);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("m", mass);
      params.set("mu", massUnit);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, mass, massUnit]);

  const result = useMemo(() => {
    const massNum = parseFloat(mass);
    if (!(massNum > 0)) return { valid: false, reason: "Enter a positive black hole mass." };
    const massKg = massToKg(massNum, massUnit);
    const temperatureK = hawkingTemperature(massKg);
    return { valid: true, massKg, temperatureK, belowCmb: temperatureK < CMB_TEMPERATURE_K };
  }, [mass, massUnit]);

  // --- log-log plot: Hawking temperature vs. black hole mass ---
  // The relation T ∝ 1/M is a pure power law, so in log-log space it is
  // exactly a straight line — two endpoints fully describe it.
  const chart = useMemo(() => {
    const width = 640;
    const height = 340;
    const marginLeft = 60;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 44;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;

    const xMinLog = Math.log10(PLOT_MIN_MASS_KG);
    const xMaxLog = Math.log10(PLOT_MAX_MASS_KG);
    const yAtXMin = Math.log10(hawkingTemperature(PLOT_MIN_MASS_KG));
    const yAtXMax = Math.log10(hawkingTemperature(PLOT_MAX_MASS_KG));
    // temperature decreases as mass increases, so yAtXMin is the max
    const pad = (yAtXMin - yAtXMax) * 0.04;
    const yMinLog = yAtXMax - pad;
    const yMaxLog = yAtXMin + pad;

    const xScale = (logM) => marginLeft + ((logM - xMinLog) / (xMaxLog - xMinLog)) * plotWidth;
    const yScale = (logT) => marginTop + (1 - (logT - yMinLog) / (yMaxLog - yMinLog)) * plotHeight;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

    const linePoints = [
      [xScale(xMinLog), yScale(yAtXMin)],
      [xScale(xMaxLog), yScale(yAtXMax)],
    ].map(([x, y]) => `${x},${y}`).join(" ");

    const referencePoints = REFERENCE_POINTS.map((ref) => {
      const logM = Math.log10(ref.massKg);
      const logT = Math.log10(hawkingTemperature(ref.massKg));
      return { ...ref, x: xScale(logM), y: yScale(logT), temperatureK: Math.pow(10, logT) };
    });

    const cmbLogT = Math.log10(CMB_TEMPERATURE_K);
    const cmbY = yScale(clamp(cmbLogT, yMinLog, yMaxLog));

    let currentPoint = null;
    if (result.valid && result.massKg > 0 && Number.isFinite(result.temperatureK)) {
      const logM = clamp(Math.log10(result.massKg), xMinLog, xMaxLog);
      const logT = clamp(Math.log10(result.temperatureK), yMinLog, yMaxLog);
      const offScale =
        Math.log10(result.massKg) < xMinLog ||
        Math.log10(result.massKg) > xMaxLog;
      currentPoint = { x: xScale(logM), y: yScale(logT), offScale };
    }

    // x-axis ticks: every 8 decades of mass (kg)
    const xTicks = [];
    const xStep = 8;
    for (let e = Math.ceil(xMinLog / xStep) * xStep; e <= xMaxLog + 1e-9; e += xStep) {
      xTicks.push(e);
    }
    // y-axis ticks: every 8 decades of temperature (K)
    const yTicks = [];
    const yStep = 8;
    for (let e = Math.floor(yMaxLog / yStep) * yStep; e >= yMinLog - 1e-9; e -= yStep) {
      yTicks.push(e);
    }

    return {
      width, height, marginLeft, marginRight, marginTop, marginBottom, plotWidth, plotHeight,
      xScale, yScale, linePoints, referencePoints, cmbY, currentPoint, xTicks, yTicks,
    };
  }, [result]);

  // Self-check rows: runs the real hawkingTemperature.js functions against
  // known reference values and edge cases — independent of the fields above.
  const testRows = useMemo(() => getHawkingTemperatureTestRows(), []);

  const applyPreset = (preset) => {
    setMass(String(preset.mass));
    setMassUnit(preset.massUnit);
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

  return (
    <div className="htc" aria-label="Hawking temperature calculator">
      <div className="htc-header">
        <p className="htc-title">Hawking temperature calculator</p>
        <div className="htc-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="htc-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="htc-explainer">
        A black hole isn't perfectly black — quantum effects near its event
        horizon make it emit a faint thermal glow, the Hawking radiation, at a
        temperature set purely by its mass: <Katex tex={String.raw`T_H = \dfrac{\hbar c^3}{8\pi G M k_B}`} />.
        Because temperature scales as 1/M, smaller black holes are far
        hotter — a relationship spanning close to fifty orders of magnitude
        across the masses shown below.
      </p>

      <div className="htc-fields">
        <div className="htc-field">
          <label htmlFor="htc-mass">Black hole mass (<Katex tex="M" />)</label>
          <div className="htc-input-row">
            <input id="htc-mass" className="htc-input" type="number" min="0" step="any" inputMode="decimal" value={mass} onChange={(e) => setMass(e.target.value)} />
            <select className="htc-unit-select" value={massUnit} onChange={(e) => setMassUnit(e.target.value)}>
              {MASS_UNIT_ORDER.map((u) => <option key={u} value={u}>{MASS_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!result.valid ? (
        <p className="htc-note htc-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="htc-headline-card">
            <div className="htc-headline"><Katex tex="T_H" /> ≈ {formatNumber(result.temperatureK)} K</div>
            <div className="htc-headline-sub">
              <Katex tex="M" /> = {formatNumber(massFromKg(result.massKg, "kg"))} kg
            </div>
            <div className={result.belowCmb ? "htc-cmb-tag htc-cmb-tag--cold" : "htc-cmb-tag htc-cmb-tag--hot"}>
              {result.belowCmb
                ? `Colder than the CMB (${CMB_TEMPERATURE_K} K) — net-absorbing today, not yet evaporating`
                : `Hotter than the CMB (${CMB_TEMPERATURE_K} K) — a net emitter, net-evaporating`}
            </div>
          </div>

          <div className="chart-wrap">
            <svg
              className="htc-chart-svg"
              viewBox={`0 0 ${chart.width} ${chart.height}`}
              role="img"
              aria-label={`Log-log plot of Hawking temperature versus black hole mass, from 10 to the minus 8 kilograms to 10 billion solar masses, with the current mass of ${formatNumber(massFromKg(result.massKg, "kg"))} kilograms marked at ${formatNumber(result.temperatureK)} kelvin`}
            >
              {chart.xTicks.map((e, idx) => (
                <line key={`xg-${idx}`} x1={chart.xScale(e)} x2={chart.xScale(e)} y1={chart.marginTop} y2={chart.marginTop + chart.plotHeight} className="htc-chart-gridline" />
              ))}
              {chart.yTicks.map((e, idx) => (
                <line key={`yg-${idx}`} x1={chart.marginLeft} x2={chart.marginLeft + chart.plotWidth} y1={chart.yScale(e)} y2={chart.yScale(e)} className="htc-chart-gridline" />
              ))}

              {/* CMB reference line */}
              <line x1={chart.marginLeft} x2={chart.marginLeft + chart.plotWidth} y1={chart.cmbY} y2={chart.cmbY} className="htc-cmb-line" />
              <text x={chart.marginLeft + chart.plotWidth - 4} y={chart.cmbY - 5} className="htc-cmb-label" textAnchor="end">CMB (2.725 K)</text>

              {/* main T(M) line */}
              <polyline points={chart.linePoints} className="htc-curve-line" />

              {/* fixed reference points */}
              {chart.referencePoints.map((ref) => (
                <g key={ref.label}>
                  <circle cx={ref.x} cy={ref.y} r="4" className="htc-ref-dot" />
                  <text x={ref.x} y={ref.y - 9} className="htc-ref-label" textAnchor="middle">{ref.label}</text>
                </g>
              ))}

              {/* current value marker */}
              {chart.currentPoint && (
                <g>
                  <circle cx={chart.currentPoint.x} cy={chart.currentPoint.y} r="6" className="htc-current-dot" />
                  <circle cx={chart.currentPoint.x} cy={chart.currentPoint.y} r="10" className="htc-current-halo" />
                </g>
              )}

              {/* axes */}
              <line x1={chart.marginLeft} x2={chart.marginLeft} y1={chart.marginTop} y2={chart.marginTop + chart.plotHeight} className="htc-chart-axis-line" />
              <line x1={chart.marginLeft} x2={chart.marginLeft + chart.plotWidth} y1={chart.marginTop + chart.plotHeight} y2={chart.marginTop + chart.plotHeight} className="htc-chart-axis-line" />

              {chart.xTicks.map((e, idx) => (
                <text key={`xl-${idx}`} x={chart.xScale(e)} y={chart.marginTop + chart.plotHeight + 16} className="htc-chart-axis-label" textAnchor="middle">{formatPow10(e)}</text>
              ))}
              {chart.yTicks.map((e, idx) => (
                <text key={`yl-${idx}`} x={chart.marginLeft - 8} y={chart.yScale(e) + 4} className="htc-chart-axis-label" textAnchor="end">{formatPow10(e)}</text>
              ))}

              <text x={chart.marginLeft + chart.plotWidth / 2} y={chart.height - 6} className="htc-chart-axis-label" textAnchor="middle">black hole mass (kg) →</text>
              <text x={16} y={chart.marginTop + chart.plotHeight / 2} className="htc-chart-axis-label htc-ylabel" textAnchor="middle">Hawking temperature (K)</text>
            </svg>
            {chart.currentPoint?.offScale && (
              <p className="htc-note htc-note--warn" role="status">
                The current mass is outside the plotted range, so its marker is shown clamped to the nearest edge.
              </p>
            )}
            <p className="htc-chart-caption">
              Both axes are logarithmic — the straight line is the exact T ∝ 1/M
              relation. The highlighted dot is your current mass; the CMB line
              marks the temperature below which a black hole is currently
              absorbing more radiation than it emits.
            </p>
          </div>
        </>
      )}

      <div className="htc-footer-row">
        <CalculatorVote slug="hawking-temperature-calculator" />
        <CalculatorTests
          title="Hawking Temperature Calculator — Tests"
          columns={HAWKING_TEMPERATURE_TEST_COLUMNS}
          rows={testRows}
          sources={HAWKING_TEMPERATURE_TEST_SOURCES}
        />
        <button type="button" className="htc-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
