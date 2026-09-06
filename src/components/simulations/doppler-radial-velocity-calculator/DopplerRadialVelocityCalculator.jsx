import { useEffect, useMemo, useState } from "react";
import {
  C,
  WAVELENGTH_UNITS,
  WAVELENGTH_UNIT_ORDER,
  VELOCITY_UNITS,
  VELOCITY_UNIT_ORDER,
  wavelengthToMeters,
  metersToWavelength,
  velocityToMs,
  msToVelocity,
  velocityClassical,
  velocityRelativistic,
  observedWavelengthClassical,
  observedWavelengthRelativistic,
  ratioClassical,
  ratioRelativistic,
} from "./doppler";
import { DOPPLER_RADIAL_VELOCITY_TEST_COLUMNS, DOPPLER_RADIAL_VELOCITY_TEST_SOURCES, getDopplerRadialVelocityTestRows } from "./dopplerTests";
import "../../../styles/dopplerRadialVelocityCalculator.css";
import "../../../styles/calculators.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import CalculatorTests from "../../CalculatorTests.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";
import Katex from "../../Katex.jsx";

// Every preset is self-consistent under both solve directions and both
// modes, so switching either after applying one never shows a jarring
// mismatch.
const PRESETS = [
  { label: "Hα, receding star (worked example)", solveFor: "velocity", mode: "classical", lamRest: 656.28, lamRestUnit: "nm", lamObs: 656.5, lamObsUnit: "nm", v: 100, vUnit: "kms" },
  { label: "Andromeda (approaching, blueshift)", solveFor: "velocity", mode: "classical", lamRest: 656.28, lamRestUnit: "nm", lamObs: 655.621, lamObsUnit: "nm", v: -301, vUnit: "kms" },
  { label: "Exoplanet-search precision (55 m/s)", solveFor: "velocity", mode: "classical", lamRest: 5500, lamRestUnit: "angstrom", lamObs: 5500.001, lamObsUnit: "angstrom", v: 55, vUnit: "ms" },
  { label: "Relativistic jet clump (0.3c)", solveFor: "wavelength", mode: "relativistic", lamRest: 656.28, lamRestUnit: "nm", lamObs: 894.359, lamObsUnit: "nm", v: 89937.7, vUnit: "kms" },
  { label: "Binary star orbital motion (Na D)", solveFor: "wavelength", mode: "classical", lamRest: 589, lamRestUnit: "nm", lamObs: 589.236, lamObsUnit: "nm", v: 120, vUnit: "kms" },
];

function trimTrailingZeros(s) {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}
const SUPERSCRIPT_MAP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
function toSuperscript(n) {
  return String(n).split("").map((ch) => SUPERSCRIPT_MAP[ch] ?? ch).join("");
}
function formatNumber(n, { forceSign = false } = {}) {
  if (!Number.isFinite(n)) return "—";
  const sign = forceSign && n >= 0 ? "+" : "";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e6 || abs < 1e-3) {
    const exp = Math.floor(Math.log10(abs));
    const mantissa = n / Math.pow(10, exp);
    return `${sign}${trimTrailingZeros(mantissa.toFixed(3))} × 10${toSuperscript(exp)}`;
  }
  if (abs >= 100) return `${sign}${trimTrailingZeros(n.toFixed(2))}`;
  if (abs >= 1) return `${sign}${trimTrailingZeros(n.toFixed(4))}`;
  return `${sign}${trimTrailingZeros(n.toFixed(6))}`;
}
function niceStep(span, targetCount = 5) {
  if (!(span > 0)) return 1;
  const raw = span / targetCount;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
  return step * mag;
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const solveFor = params.get("solve");
  if (solveFor !== "velocity" && solveFor !== "wavelength") return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  return {
    solveFor,
    mode: params.get("mode") === "relativistic" ? "relativistic" : "classical",
    lamRest: num("lr", "656.28"),
    lamRestUnit: WAVELENGTH_UNITS[params.get("lru")] ? params.get("lru") : "nm",
    lamObs: num("lo", "656.5"),
    lamObsUnit: WAVELENGTH_UNITS[params.get("lou")] ? params.get("lou") : "nm",
    v: num("v", "100"),
    vUnit: VELOCITY_UNITS[params.get("vu")] ? params.get("vu") : "kms",
  };
}

export default function DopplerRadialVelocityCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [solveFor, setSolveFor] = useState("velocity");
  const [mode, setMode] = useState("classical");
  const [lamRest, setLamRest] = useState("656.28");
  const [lamRestUnit, setLamRestUnit] = useState("nm");
  const [lamObs, setLamObs] = useState("656.5");
  const [lamObsUnit, setLamObsUnit] = useState("nm");
  const [v, setV] = useState("100");
  const [vUnit, setVUnit] = useState("kms");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setSolveFor(initial.solveFor);
      setMode(initial.mode);
      setLamRest(initial.lamRest);
      setLamRestUnit(initial.lamRestUnit);
      setLamObs(initial.lamObs);
      setLamObsUnit(initial.lamObsUnit);
      setV(initial.v);
      setVUnit(initial.vUnit);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("solve", solveFor);
      params.set("mode", mode);
      params.set("lr", lamRest);
      params.set("lru", lamRestUnit);
      params.set("lo", lamObs);
      params.set("lou", lamObsUnit);
      params.set("v", v);
      params.set("vu", vUnit);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, solveFor, mode, lamRest, lamRestUnit, lamObs, lamObsUnit, v, vUnit]);

  const result = useMemo(() => {
    const lamRestM = wavelengthToMeters(parseFloat(lamRest), lamRestUnit);
    if (!(lamRestM > 0)) return { valid: false, reason: "Enter a positive rest wavelength." };

    if (solveFor === "velocity") {
      const lamObsM = wavelengthToMeters(parseFloat(lamObs), lamObsUnit);
      if (!(lamObsM > 0)) return { valid: false, reason: "Enter a positive observed wavelength." };
      const vClassical = velocityClassical(lamRestM, lamObsM);
      const vRel = velocityRelativistic(lamRestM, lamObsM);
      const vActive = mode === "relativistic" ? vRel : vClassical;
      return {
        valid: true, quantity: "velocity", lamRestM, lamObsM,
        vClassical, vRel, vActive,
        deltaLam: lamObsM - lamRestM,
      };
    }

    const vNum = parseFloat(v);
    if (!Number.isFinite(vNum)) return { valid: false, reason: "Enter a radial velocity." };
    const vMs = velocityToMs(vNum, vUnit);
    if (Math.abs(vMs) >= C) return { valid: false, reason: "Radial velocity must be less than the speed of light." };
    const lamObsClassical = observedWavelengthClassical(lamRestM, vMs);
    const lamObsRel = observedWavelengthRelativistic(lamRestM, vMs);
    const lamObsActive = mode === "relativistic" ? lamObsRel : lamObsClassical;
    return {
      valid: true, quantity: "wavelength", lamRestM, vMs,
      lamObsClassical, lamObsRel, lamObsActive,
      deltaLam: lamObsActive - lamRestM,
    };
  }, [solveFor, mode, lamRest, lamRestUnit, lamObs, lamObsUnit, v, vUnit]);

  const vActiveMs = result.valid ? (result.quantity === "velocity" ? result.vActive : result.vMs) : null;
  const beta = vActiveMs !== null ? vActiveMs / C : null;
  const receding = vActiveMs !== null ? vActiveMs > 0 : null;

  // --- radial velocity gauge ---
  // A linear scale auto-fit to the current velocity, colored blue
  // (approaching) to red (receding), with a shaded zone marking where
  // relativistic corrections exceed 0.5% (|v| > 0.1c) — visible only
  // when the current velocity is actually in that regime.
  const gauge = useMemo(() => {
    if (vActiveMs === null) return null;
    const vKms = msToVelocity(vActiveMs, "kms");
    const domain = Math.max(Math.abs(vKms) * 1.4, 20);
    const width = 640;
    const height = 130;
    const marginLeft = 40;
    const marginRight = 40;
    const y = 58;
    const plotWidth = width - marginLeft - marginRight;
    const xScale = (kms) => marginLeft + ((kms + domain) / (2 * domain)) * plotWidth;
    const step = niceStep(domain * 2, 6);
    const ticks = [];
    for (let t = Math.ceil(-domain / step) * step; t <= domain + 1e-9; t += step) ticks.push(Math.round(t / step) * step);

    const relThresholdKms = msToVelocity(0.1 * C, "kms");
    const showRelZone = relThresholdKms <= domain;

    return { width, height, marginLeft, plotWidth, y, xScale, ticks, domain, markerX: xScale(vKms), showRelZone, relThresholdKms };
  }, [vActiveMs]);

  // --- classical vs. relativistic divergence curve ---
  // Plots λ_obs/λ0 against β = v/c for both formulas across the whole
  // physically meaningful range, so it's visible exactly where — and by
  // how much — the classical approximation starts to fail, not just
  // asserted in prose.
  const curve = useMemo(() => {
    if (beta === null) return null;
    const domainBeta = Math.min(0.98, Math.max(0.9, Math.abs(beta) * 1.15));
    const N = 100;
    const classicalPts = [];
    const relPts = [];
    for (let k = 0; k <= N; k++) {
      const b = -domainBeta + (2 * domainBeta * k) / N;
      classicalPts.push({ b, r: ratioClassical(b) });
      const rr = ratioRelativistic(b);
      if (rr !== null) relPts.push({ b, r: rr });
    }
    const allR = [...classicalPts.map((p) => p.r), ...relPts.map((p) => p.r)];
    const yMin = Math.min(...allR) * 0.98;
    const yMax = Math.max(...allR) * 1.02;

    const width = 640;
    const height = 300;
    const marginLeft = 56;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 40;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;
    const xScale = (b) => marginLeft + ((b + domainBeta) / (2 * domainBeta)) * plotWidth;
    const yScale = (r) => marginTop + (1 - (r - yMin) / (yMax - yMin)) * plotHeight;

    const classicalLine = classicalPts.map((p) => `${xScale(p.b)},${yScale(p.r)}`).join(" ");
    const relLine = relPts.map((p) => `${xScale(p.b)},${yScale(p.r)}`).join(" ");

    const activeR = mode === "relativistic" ? ratioRelativistic(beta) : ratioClassical(beta);
    const point = activeR !== null ? { x: xScale(beta), y: yScale(activeR) } : null;

    const xTicks = [-domainBeta, -domainBeta / 2, 0, domainBeta / 2, domainBeta].map((t) => Math.round(t * 100) / 100);
    const yStep = niceStep(yMax - yMin, 4);
    const yTicks = [];
    for (let t = Math.ceil(yMin / yStep) * yStep; t <= yMax; t += yStep) yTicks.push(Math.round(t / yStep) * yStep);

    return { width, height, marginLeft, marginRight, marginTop, marginBottom, plotWidth, plotHeight, xScale, yScale, classicalLine, relLine, point, xTicks, yTicks };
  }, [beta, mode]);

  // Self-check rows: runs the real doppler.js functions against known
  // reference cases and edge cases — independent of the fields above.
  const testRows = useMemo(() => getDopplerRadialVelocityTestRows(), []);

  const applyPreset = (preset) => {
    setSolveFor(preset.solveFor);
    setMode(preset.mode);
    setLamRest(String(preset.lamRest));
    setLamRestUnit(preset.lamRestUnit);
    setLamObs(String(preset.lamObs));
    setLamObsUnit(preset.lamObsUnit);
    setV(String(preset.v));
    setVUnit(preset.vUnit);
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
    <div className="drv" aria-label="Doppler shift and radial velocity calculator">
      <div className="drv-header">
        <p className="drv-title">Doppler shift / radial velocity calculator</p>
        <div className="drv-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="drv-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="drv-explainer">
        A spectral line's known rest wavelength <Katex tex="\lambda_0" />, compared to where it's actually observed,
        gives the radial velocity toward or away from us:{" "}
        <Katex tex={String.raw`v_r/c \approx (\lambda_{\rm obs} - \lambda_0)/\lambda_0`} /> at low speed, or the exact relativistic relation{" "}
        <Katex tex={String.raw`\lambda_{\rm obs}/\lambda_0 = \sqrt{\dfrac{1+\beta}{1-\beta}}`} /> at any speed. Solve either direction, and switch
        modes to see exactly when the approximation starts to matter.
      </p>

      <div className="drv-toggle-row">
        <div className="drv-toggle-group" role="group" aria-label="Solve for">
          <button type="button" className={solveFor === "velocity" ? "drv-toggle-btn active" : "drv-toggle-btn"} onClick={() => setSolveFor("velocity")}>
            <Katex tex="\lambda_{\rm obs} \to v_r" />
          </button>
          <button type="button" className={solveFor === "wavelength" ? "drv-toggle-btn active" : "drv-toggle-btn"} onClick={() => setSolveFor("wavelength")}>
            <Katex tex="v_r \to \lambda_{\rm obs}" />
          </button>
        </div>
        <div className="drv-toggle-group" role="group" aria-label="Calculation mode">
          <button type="button" className={mode === "classical" ? "drv-toggle-btn active" : "drv-toggle-btn"} onClick={() => setMode("classical")}>
            Classical
          </button>
          <button type="button" className={mode === "relativistic" ? "drv-toggle-btn active" : "drv-toggle-btn"} onClick={() => setMode("relativistic")}>
            Relativistic
          </button>
        </div>
      </div>

      <div className="drv-fields">
        <div className="drv-field">
          <label htmlFor="drv-lrest">Rest wavelength (<Katex tex="\lambda_0" />)</label>
          <div className="drv-input-row">
            <input id="drv-lrest" className="drv-input" type="number" min="0" step="any" inputMode="decimal" value={lamRest} onChange={(e) => setLamRest(e.target.value)} />
            <select className="drv-unit-select" value={lamRestUnit} onChange={(e) => setLamRestUnit(e.target.value)}>
              {WAVELENGTH_UNIT_ORDER.map((u) => <option key={u} value={u}>{WAVELENGTH_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>

        {solveFor === "velocity" ? (
          <div className="drv-field">
            <label htmlFor="drv-lobs">Observed wavelength (<Katex tex="\lambda_{\rm obs}" />)</label>
            <div className="drv-input-row">
              <input id="drv-lobs" className="drv-input" type="number" min="0" step="any" inputMode="decimal" value={lamObs} onChange={(e) => setLamObs(e.target.value)} />
              <select className="drv-unit-select" value={lamObsUnit} onChange={(e) => setLamObsUnit(e.target.value)}>
                {WAVELENGTH_UNIT_ORDER.map((u) => <option key={u} value={u}>{WAVELENGTH_UNITS[u].short}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="drv-field">
            <label htmlFor="drv-v">Radial velocity (<Katex tex="v_r" />)</label>
            <div className="drv-input-row">
              <input id="drv-v" className="drv-input" type="number" step="any" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} />
              <select className="drv-unit-select" value={vUnit} onChange={(e) => setVUnit(e.target.value)}>
                {VELOCITY_UNIT_ORDER.map((u) => <option key={u} value={u}>{VELOCITY_UNITS[u].short}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {!result.valid ? (
        <p className="drv-note drv-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className={receding ? "drv-headline-card drv-headline-card--red" : "drv-headline-card drv-headline-card--blue"}>
            {result.quantity === "velocity" ? (
              <div className="drv-headline">
                <Katex tex="v_r" /> = {formatNumber(msToVelocity(result.vActive, vUnit), { forceSign: true })} {VELOCITY_UNITS[vUnit].short}
              </div>
            ) : (
              <div className="drv-headline">
                <Katex tex="\lambda_{\rm obs}" /> = {formatNumber(metersToWavelength(result.lamObsActive, lamObsUnit))} {WAVELENGTH_UNITS[lamObsUnit].short}
              </div>
            )}
            <div className="drv-headline-sub">
              {receding ? "Redshifted — receding from the observer" : "Blueshifted — approaching the observer"}
              {" · "}<Katex tex="\Delta\lambda" /> = {formatNumber(metersToWavelength(Math.abs(result.deltaLam), lamRestUnit))} {WAVELENGTH_UNITS[lamRestUnit].short}
              {" · "}<Katex tex="\beta = v/c" /> = {formatNumber(beta, { forceSign: true })}
            </div>
            <div className="drv-headline-compare">
              {result.quantity === "velocity" ? (
                <>Classical: {formatNumber(msToVelocity(result.vClassical, vUnit), { forceSign: true })} {VELOCITY_UNITS[vUnit].short} · Relativistic: {formatNumber(msToVelocity(result.vRel, vUnit), { forceSign: true })} {VELOCITY_UNITS[vUnit].short}</>
              ) : (
                <>Classical: {formatNumber(metersToWavelength(result.lamObsClassical, lamObsUnit))} {WAVELENGTH_UNITS[lamObsUnit].short} · Relativistic: {result.lamObsRel !== null ? `${formatNumber(metersToWavelength(result.lamObsRel, lamObsUnit))} ${WAVELENGTH_UNITS[lamObsUnit].short}` : "—"}</>
              )}
            </div>
          </div>

          {gauge && (
            <div className="chart-wrap">
              <svg
                className="drv-gauge-svg"
                viewBox={`0 0 ${gauge.width} ${gauge.height}`}
                role="img"
                aria-label={`Radial velocity gauge; ${receding ? "receding" : "approaching"} at ${formatNumber(Math.abs(msToVelocity(vActiveMs, "kms")))} kilometers per second`}
              >
                <defs>
                  <linearGradient id="drv-gauge-gradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#5b8dff" />
                    <stop offset="48%" stopColor="#6f7a9a" />
                    <stop offset="52%" stopColor="#9a6f6f" />
                    <stop offset="100%" stopColor="#ff6b5b" />
                  </linearGradient>
                </defs>
                <rect x={gauge.marginLeft} y={gauge.y - 9} width={gauge.plotWidth} height="18" rx="9" fill="url(#drv-gauge-gradient)" opacity="0.6" />

                {gauge.showRelZone && (
                  <>
                    <rect x={gauge.xScale(gauge.relThresholdKms)} y={gauge.y - 14} width={gauge.marginLeft + gauge.plotWidth - gauge.xScale(gauge.relThresholdKms)} height="28" className="drv-gauge-relzone" />
                    <rect x={gauge.marginLeft} y={gauge.y - 14} width={gauge.xScale(-gauge.relThresholdKms) - gauge.marginLeft} height="28" className="drv-gauge-relzone" />
                  </>
                )}

                {gauge.ticks.map((t) => (
                  <g key={t}>
                    <line x1={gauge.xScale(t)} x2={gauge.xScale(t)} y1={gauge.y - 12} y2={gauge.y + 12} className="drv-gauge-tick" />
                    <text x={gauge.xScale(t)} y={gauge.y + 30} className="drv-chart-axis-label" textAnchor="middle">{formatNumber(t)}</text>
                  </g>
                ))}

                <polygon
                  points={`${gauge.markerX},${gauge.y - 22} ${gauge.markerX - 7},${gauge.y - 34} ${gauge.markerX + 7},${gauge.y - 34}`}
                  className="drv-gauge-marker"
                />
                <text x={gauge.markerX} y={gauge.y - 40} className="drv-gauge-marker-label" textAnchor="middle">
                  {formatNumber(Math.abs(msToVelocity(vActiveMs, "kms")))} km/s
                </text>

                <text x={gauge.marginLeft} y={gauge.height - 6} className="drv-gauge-end-label" textAnchor="start">← approaching (blueshift)</text>
                <text x={gauge.marginLeft + gauge.plotWidth} y={gauge.height - 6} className="drv-gauge-end-label" textAnchor="end">receding (redshift) →</text>
              </svg>
              <p className="drv-chart-caption">
                {gauge.showRelZone
                  ? "The shaded zones mark |v| > 0.1c, where relativistic corrections exceed about 0.5% — squarely relevant here."
                  : "At this speed, relativistic corrections are far below 0.5% — the classical approximation is essentially exact."}
              </p>
            </div>
          )}

          {curve && (
            <div className="chart-wrap">
              <svg
                className="drv-curve-svg"
                viewBox={`0 0 ${curve.width} ${curve.height}`}
                role="img"
                aria-label="Plot of observed-to-rest wavelength ratio versus v/c, comparing the classical and relativistic Doppler formulas"
              >
                {curve.yTicks.map((t) => (
                  <g key={`y${t}`}>
                    <line x1={curve.marginLeft} x2={curve.marginLeft + curve.plotWidth} y1={curve.yScale(t)} y2={curve.yScale(t)} className="drv-chart-gridline" />
                    <text x={curve.marginLeft - 8} y={curve.yScale(t) + 4} className="drv-chart-axis-label" textAnchor="end">{formatNumber(t)}</text>
                  </g>
                ))}
                {curve.xTicks.map((t) => (
                  <g key={`x${t}`}>
                    <line x1={curve.xScale(t)} x2={curve.xScale(t)} y1={curve.marginTop} y2={curve.marginTop + curve.plotHeight} className="drv-chart-gridline" />
                    <text x={curve.xScale(t)} y={curve.height - 12} className="drv-chart-axis-label" textAnchor="middle">{formatNumber(t)}</text>
                  </g>
                ))}
                <line x1={curve.marginLeft} x2={curve.marginLeft} y1={curve.marginTop} y2={curve.marginTop + curve.plotHeight} className="drv-chart-axis-line" />
                <line x1={curve.marginLeft} x2={curve.marginLeft + curve.plotWidth} y1={curve.marginTop + curve.plotHeight} y2={curve.marginTop + curve.plotHeight} className="drv-chart-axis-line" />

                <polyline points={curve.classicalLine} className="drv-curve-classical" strokeDasharray="6 5" />
                <polyline points={curve.relLine} className="drv-curve-relativistic" />

                {curve.point && <circle cx={curve.point.x} cy={curve.point.y} r="5.5" className="drv-curve-point" />}
              </svg>
              <p className="drv-chart-caption">
                Dashed = classical <Katex tex="(1+\beta)" />, solid = exact relativistic. They agree closely near <Katex tex="\beta = 0" />
                {" "}and diverge visibly as |v| becomes a real fraction of c.
              </p>
            </div>
          )}
        </>
      )}

      <div className="drv-footer-row">
        <CalculatorVote slug="doppler-radial-velocity-calculator" />
        <CalculatorTests
          title="Doppler Shift / Radial Velocity Calculator — Tests"
          columns={DOPPLER_RADIAL_VELOCITY_TEST_COLUMNS}
          rows={testRows}
          sources={DOPPLER_RADIAL_VELOCITY_TEST_SOURCES}
        />
        <button type="button" className="drv-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
