import { useEffect, useMemo, useState } from "react";
import { fluidRocheLimit, rigidRocheLimit, rocheLimit, FLUID_COEFFICIENT, RIGID_COEFFICIENT, REFERENCE_DENSITIES } from "./roche";
import { ROCHE_LIMIT_TEST_COLUMNS, ROCHE_LIMIT_TEST_SOURCES, getRocheLimitTestRows } from "./rocheLimitTests";
import "../../../styles/rocheLimitCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import CalculatorTests from "../../CalculatorTests.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";
import katex from "katex";
import "katex/dist/katex.min.css";
// Every preset is a real (or realistically illustrative) primary +
// satellite pair, several with a real actual orbital distance included
// so the comparison feature has something meaningful to say out of the box.
const PRESETS = [
  { label: "Saturn + icy moon (Enceladus-like)", radius: 58232, densityPrimary: 687, densitySatellite: 1609, actualDistance: 238000 },
  { label: "Earth + Moon", radius: 6371, densityPrimary: 5514, densitySatellite: 3344, actualDistance: 384400 },
  { label: "Jupiter + icy-rocky moon (Europa-like)", radius: 69911, densityPrimary: 1326, densitySatellite: 3013, actualDistance: 671034 },
  { label: "Sun + rocky planet (Mercury-like)", radius: 696000, densityPrimary: 1408, densitySatellite: 5427, actualDistance: 57909000 },
  { label: "Saturn's rings (water ice, at the edge)", radius: 58232, densityPrimary: 687, densitySatellite: 920, actualDistance: 140000 },
  { label: "Comet Shoemaker-Levy 9 at Jupiter (disrupted)", radius: 69911, densityPrimary: 1326, densitySatellite: 500, actualDistance: 96000 },
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
  if (n >= 1e6 || n < 1e-3) {
    const exp = Math.floor(Math.log10(n));
    const mantissa = n / Math.pow(10, exp);
    return `${trimTrailingZeros(mantissa.toFixed(digits))} × 10${toSuperscript(exp)}`;
  }
  if (n >= 100) return trimTrailingZeros(n.toFixed(1));
  if (n >= 1) return trimTrailingZeros(n.toFixed(digits));
  return trimTrailingZeros(n.toFixed(digits + 2));
}
function niceStep(span, targetCount = 5) {
  if (!(span > 0)) return 1;
  const raw = span / targetCount;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
  return step * mag;
}
function roundSvg(n) {
  return Number(n.toFixed(6));
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const radius = params.get("R");
  if (radius === null || !Number.isFinite(parseFloat(radius))) return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  return {
    radius,
    densityPrimary: num("dp", "687"),
    densitySatellite: num("ds", "1609"),
    mode: params.get("mode") === "rigid" ? "rigid" : "fluid",
    actualDistance: params.get("ad") ?? "",
  };
}

export default function RocheLimitCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [radius, setRadius] = useState("58232");
  const [densityPrimary, setDensityPrimary] = useState("687");
  const [densitySatellite, setDensitySatellite] = useState("1609");
  const [mode, setMode] = useState("fluid");
  const [actualDistance, setActualDistance] = useState("238000");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setRadius(initial.radius);
      setDensityPrimary(initial.densityPrimary);
      setDensitySatellite(initial.densitySatellite);
      setMode(initial.mode);
      setActualDistance(initial.actualDistance);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("R", radius);
      params.set("dp", densityPrimary);
      params.set("ds", densitySatellite);
      params.set("mode", mode);
      if (actualDistance) params.set("ad", actualDistance);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, radius, densityPrimary, densitySatellite, mode, actualDistance]);

  const result = useMemo(() => {
    const R = parseFloat(radius);
    const dp = parseFloat(densityPrimary);
    const ds = parseFloat(densitySatellite);
    if (!(R > 0) || !(dp > 0) || !(ds > 0)) {
      return { valid: false, reason: "Enter a positive primary radius and positive densities for both bodies." };
    }
    const dFluid = fluidRocheLimit(R, dp, ds);
    const dRigid = rigidRocheLimit(R, dp, ds);
    const active = mode === "fluid" ? dFluid : dRigid;

    const adNum = parseFloat(actualDistance);
    const hasActual = actualDistance.trim() !== "" && Number.isFinite(adNum) && adNum > 0;

    return {
      valid: true, R, dp, ds, dFluid, dRigid, active,
      hasActual, actual: hasActual ? adNum : null,
      ratio: hasActual ? adNum / active : null,
    };
  }, [radius, densityPrimary, densitySatellite, mode, actualDistance]);

  // --- orbital disruption diagram ---
  // The primary, the Roche limit as a dashed boundary, and a satellite
  // marker whose shape stretches into debris the closer it sits to (or
  // inside) that boundary — using the actual orbital distance if given,
  // or the Roche limit itself (maximally disrupted) if not.
  const diagram = useMemo(() => {
    if (!result.valid) return null;
    // With no actual distance to plot, default to a representative
    // position just inside the limit so the diagram always shows the
    // disruption effect it's here to illustrate.
    const markerKm = result.hasActual ? result.actual : result.active * 0.75;
    const maxKm = Math.max(result.active, markerKm) * 1.25;
    const maxPx = 100;
    const scale = maxPx / maxKm;
    const primaryPx = Math.max(4, result.R * scale);
    const rochePx = result.active * scale;
    const markerPx = markerKm * scale;
    const proximity = markerKm / result.active; // 1 = right at the limit, <1 = inside (disrupted)
    const stretch = proximity >= 1 ? 1 : 1 + Math.min(2.2, (1 - proximity) * 4);
    const disrupted = proximity < 1;
    const debrisCount = disrupted ? Math.round(Math.min(6, (1 - proximity) * 10)) : 0;

    return { primaryPx, rochePx, markerPx, stretch, disrupted, debrisCount, insideLabel: disrupted };
  }, [result]);

  // --- Roche limit vs. satellite density curve ---
  // d ∝ ρ_m^(-1/3) is a pure power law, hence a straight line in log-log
  // space (this site's established convention for showing that a
  // relation is exactly a power law) — here it shows directly why icy
  // bodies survive much farther out than iron-rich ones at the same
  // primary.
  const curve = useMemo(() => {
    if (!result.valid) return null;
    const coefficient = mode === "fluid" ? FLUID_COEFFICIENT : RIGID_COEFFICIENT;
    const allDensities = [...REFERENCE_DENSITIES.map((d) => d.kgm3), result.ds];
    const xPad = 0.15;
    const xMin = Math.log10(Math.min(...allDensities)) - xPad;
    const xMax = Math.log10(Math.max(...allDensities)) + xPad;
    const lineAt = (logRho) => Math.log10(rocheLimit(result.R, result.dp, Math.pow(10, logRho), coefficient));

    const width = 640;
    const height = 300;
    const marginLeft = 66;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 40;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;
    const yAtMin = lineAt(xMin);
    const yAtMax = lineAt(xMax);
    const yPad = Math.abs(yAtMin - yAtMax) * 0.12;
    const yMin = Math.min(yAtMin, yAtMax) - yPad;
    const yMax = Math.max(yAtMin, yAtMax) + yPad;

const xScale = (x) =>
  roundSvg(
    marginLeft + ((x - xMin) / (xMax - xMin)) * plotWidth
  );

const yScale = (y) =>
  roundSvg(
    marginTop + (1 - (y - yMin) / (yMax - yMin)) * plotHeight
  );

    const xStep = niceStep(xMax - xMin, 4);
    const xTicks = [];
    for (let t = Math.ceil(xMin / xStep) * xStep; t <= xMax; t += xStep) xTicks.push(Math.round(t / xStep) * xStep);
    const yStep = niceStep(yMax - yMin, 5);
    const yTicks = [];
    for (let t = Math.ceil(yMin / yStep) * yStep; t <= yMax; t += yStep) yTicks.push(Math.round(t / yStep) * yStep);

    return {
      width, height, marginLeft, marginRight, marginTop, marginBottom, plotWidth, plotHeight,
      xScale, yScale, xTicks, yTicks,
      x1: xScale(xMin), y1: yScale(yAtMin), x2: xScale(xMax), y2: yScale(yAtMax),
      point: { x: xScale(Math.log10(result.ds)), y: yScale(Math.log10(result.active)) },
      landmarks: REFERENCE_DENSITIES.map((d) => ({
        ...d,
        x: xScale(Math.log10(d.kgm3)),
        y: yScale(lineAt(Math.log10(d.kgm3))),
      })),
    };
  }, [result, mode]);

  // Self-check rows: runs the real roche.js functions against known
  // reference bodies and edge cases — independent of the fields above.
  const testRows = useMemo(() => getRocheLimitTestRows(), []);

  const applyPreset = (preset) => {
    setRadius(String(preset.radius));
    setDensityPrimary(String(preset.densityPrimary));
    setDensitySatellite(String(preset.densitySatellite));
    setActualDistance(String(preset.actualDistance));
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
  const rigidRoche = katex.renderToString(
    String.raw`d_{\rm rigid} = R_M\left(\frac{2\rho_M}{\rho_m}\right)^{1/3} \approx 1.26\, R_M \left(\frac{\rho_M}{\rho_m}\right)^{1/3}`,
    { throwOnError: false }
  );
  const fluidRoche = katex.renderToString(
    String.raw`d_{\rm fluid} \approx 2.44\, R_M \left(\frac{\rho_M}{\rho_m}\right)^{1/3}`,
    { throwOnError: false }
  );

  const densityRelation = katex.renderToString(
  String.raw`d \propto \rho_m^{-1/3}`,
  { throwOnError: false }
);
  return (
    <div className="rlc" aria-label="Roche limit calculator">
      <div className="rlc-header">
        <p className="rlc-title">Roche limit calculator</p>
        <div className="rlc-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="rlc-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>
      <p className="rlc-explainer">
        Inside the Roche limit, tidal forces from the primary body stretch a satellite harder than
        its own gravity can hold it together.
        <br /><br />

        Fluid model (a satellite with little internal strength, deforming as it's pulled apart):{" "}
        <span dangerouslySetInnerHTML={{ __html: fluidRoche }} />.
        <br /><br />

        Rigid-body model (an idealized perfectly stiff satellite):{" "}
        <span dangerouslySetInnerHTML={{ __html: rigidRoche }} /> — a smaller, more optimistic limit.
      </p>

      

      <div className="rlc-mode-toggle" role="group" aria-label="Satellite model">
        <button type="button" className={mode === "fluid" ? "rlc-mode-btn active" : "rlc-mode-btn"} onClick={() => setMode("fluid")}>
          Fluid satellite
        </button>
        <button type="button" className={mode === "rigid" ? "rlc-mode-btn active" : "rlc-mode-btn"} onClick={() => setMode("rigid")}>
          Rigid body
        </button>
      </div>

      <div className="rlc-fields">
        <div className="rlc-field">
          <label htmlFor="rlc-radius">Primary radius (R_M)</label>
          <div className="rlc-input-row">
            <input id="rlc-radius" className="rlc-input" type="number" min="0" step="any" inputMode="decimal" value={radius} onChange={(e) => setRadius(e.target.value)} />
            <span className="rlc-static-unit">km</span>
          </div>
        </div>
        <div className="rlc-field">
          <label htmlFor="rlc-dp">Primary density (ρ_M)</label>
          <div className="rlc-input-row">
            <input id="rlc-dp" className="rlc-input" type="number" min="0" step="any" inputMode="decimal" value={densityPrimary} onChange={(e) => setDensityPrimary(e.target.value)} />
            <span className="rlc-static-unit">kg/m³</span>
          </div>
        </div>
        <div className="rlc-field">
          <label htmlFor="rlc-ds">Satellite density (ρ_m)</label>
          <div className="rlc-input-row">
            <input id="rlc-ds" className="rlc-input" type="number" min="0" step="any" inputMode="decimal" value={densitySatellite} onChange={(e) => setDensitySatellite(e.target.value)} />
            <span className="rlc-static-unit">kg/m³</span>
          </div>
        </div>
        <div className="rlc-field">
          <label htmlFor="rlc-actual">Actual orbital distance — optional</label>
          <div className="rlc-input-row">
            <input id="rlc-actual" className="rlc-input" type="number" min="0" step="any" inputMode="decimal" placeholder="leave blank to skip" value={actualDistance} onChange={(e) => setActualDistance(e.target.value)} />
            <span className="rlc-static-unit">km</span>
          </div>
        </div>
      </div>

      {!result.valid ? (
        <p className="rlc-note rlc-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="rlc-headline-card">
            <div className="rlc-headline">
              Roche limit ({mode === "fluid" ? "fluid" : "rigid"}) ≈ {formatNumber(result.active)} km = {formatNumber(result.active / result.R)} R_M
            </div>
            <div className="rlc-headline-sub">
              Fluid: {formatNumber(result.dFluid)} km · Rigid: {formatNumber(result.dRigid)} km
            </div>
            {result.hasActual && (
              <div className={result.ratio >= 1 ? "rlc-headline-compare rlc-headline-compare--safe" : "rlc-headline-compare rlc-headline-compare--danger"}>
                Actual distance {formatNumber(result.actual)} km is {formatNumber(result.ratio)}× the {mode} Roche limit.{" "}
                {result.ratio >= 1 ? "Outside it, a stable orbit is plausible" : "inside it, tidal disruption is expected"}
              </div>
            )}
          </div>

          {diagram && (
            <div className="rlc-chart-wrap">
              <svg className="rlc-diagram-svg" viewBox="0 0 240 240" role="img" aria-label={diagram.disrupted ? "Satellite stretched into debris inside the Roche limit" : "Intact satellite outside the Roche limit"}>
                <circle cx="120" cy="120" r={diagram.rochePx} className="rlc-roche-circle" />
                <circle cx="120" cy="120" r={diagram.primaryPx} className="rlc-primary-disk" />

                <g transform={`translate(120 ${120 - diagram.markerPx})`}>
                  <ellipse rx="7" ry={7 * diagram.stretch} className={diagram.disrupted ? "rlc-satellite rlc-satellite--disrupted" : "rlc-satellite"} />
                  {Array.from({ length: diagram.debrisCount }).map((_, i) => (
                    <circle
                      key={i}
                      cx={(i % 2 === 0 ? -1 : 1) * (6 + i * 3)}
                      cy={-10 - i * 6}
                      r={Math.max(1, 2.4 - i * 0.2)}
                      className="rlc-debris"
                    />
                  ))}
                </g>
              </svg>
              <p className="rlc-chart-caption">
                {result.hasActual
                  ? "Marker placed at the actual orbital distance you entered."
                  : "No actual distance given — marker shown just inside the Roche limit, for illustration."}{" "}
                Dashed circle is the Roche limit boundary.
              </p>
            </div>
          )}

          {curve && (
            <div className="rlc-chart-wrap">
              <svg
                className="rlc-curve-svg"
                viewBox={`0 0 ${curve.width} ${curve.height}`}
                role="img"
                aria-label="Log-log plot of Roche limit distance versus satellite density"
              >
                {curve.yTicks.map((t) => (
                  <g key={`y${t}`}>
                    <line x1={curve.marginLeft} x2={curve.marginLeft + curve.plotWidth} y1={curve.yScale(t)} y2={curve.yScale(t)} className="rlc-chart-gridline" />
                    <text x={curve.marginLeft - 8} y={curve.yScale(t) + 4} className="rlc-chart-axis-label" textAnchor="end">10{toSuperscript(Number(t.toFixed(2)))} km</text>
                  </g>
                ))}
                {curve.xTicks.map((t) => (
                  <g key={`x${t}`}>
                    <line x1={curve.xScale(t)} x2={curve.xScale(t)} y1={curve.marginTop} y2={curve.marginTop + curve.plotHeight} className="rlc-chart-gridline" />
                    <text x={curve.xScale(t)} y={curve.height - 12} className="rlc-chart-axis-label" textAnchor="middle">10{toSuperscript(t)}</text>
                  </g>
                ))}
                <line x1={curve.marginLeft} x2={curve.marginLeft} y1={curve.marginTop} y2={curve.marginTop + curve.plotHeight} className="rlc-chart-axis-line" />
                <line x1={curve.marginLeft} x2={curve.marginLeft + curve.plotWidth} y1={curve.marginTop + curve.plotHeight} y2={curve.marginTop + curve.plotHeight} className="rlc-chart-axis-line" />

                <line x1={curve.x1} y1={curve.y1} x2={curve.x2} y2={curve.y2} className="rlc-chart-fit-line" />

                {curve.landmarks.map((lm) => (
                  <g key={lm.label}>
                    <circle cx={lm.x} cy={lm.y} r="3.5" className="rlc-chart-landmark" />
                  </g>
                ))}

                <circle cx={curve.point.x} cy={curve.point.y} r="6" className="rlc-chart-point" />
                <text x={curve.point.x} y={curve.point.y - 12} className="rlc-chart-point-label" textAnchor="middle">this satellite</text>

                <text x={curve.marginLeft + curve.plotWidth / 2} y={curve.height - 26} className="rlc-chart-axis-label" textAnchor="middle">satellite density (kg/m³)</text>
              </svg>
              <p className="rlc-chart-caption">
                The Roche limit decreases as satellite density increases: low-density icy satellites are
                disrupted farther from the primary than denser rocky or iron-rich satellites. The straight
                line reflects the{" "}
                <span dangerouslySetInnerHTML={{ __html: densityRelation }} /> power-law relation.
              </p>
            </div>
          )}
        </>
      )}

      <div className="rlc-footer-row">
        <CalculatorVote slug="roche-limit-calculator" />
        <CalculatorTests
          title="Roche Limit Calculator — Tests"
          columns={ROCHE_LIMIT_TEST_COLUMNS}
          rows={testRows}
          sources={ROCHE_LIMIT_TEST_SOURCES}
        />
        <button type="button" className="rlc-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
