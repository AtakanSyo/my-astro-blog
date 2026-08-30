import { useEffect, useMemo, useState } from "react";
import {
  MASS_UNITS,
  MASS_UNIT_ORDER,
  LUMINOSITY_UNITS,
  LUMINOSITY_UNIT_ORDER,
  massToKg,
  luminosityToSI,
  luminosityFromSI,
  eddingtonLuminosityWatts,
  eddingtonRatio,
  classifyRatio,
} from "./eddington";
import "../../../styles/eddingtonLuminosityCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";

// Every preset is self-consistent (L, if given, really is that fraction
// of L_Edd for that mass) so applying one and reading the result never
// shows a jarring mismatch.
const PRESETS = [
  { label: "10 M☉ black hole at 50% Eddington", mass: 10, massUnit: "msun", L: "6.3e38", LUnit: "ergs" },
  { label: "1.4 M☉ neutron star at the limit", mass: 1.4, massUnit: "msun", L: "1.76e38", LUnit: "ergs" },
  { label: "10⁸ M☉ SMBH at 10% Eddington", mass: 1e8, massUnit: "msun", L: "1.26e45", LUnit: "ergs" },
  { label: "20 M☉ ULX candidate at 5× Eddington", mass: 20, massUnit: "msun", L: "1.26e40", LUnit: "ergs" },
  { label: "30 M☉ black hole, luminosity unknown", mass: 30, massUnit: "msun", L: "", LUnit: "ergs" },
];

const SUPERSCRIPT_MAP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
function toSuperscript(n) {
  return String(n).split("").map((ch) => SUPERSCRIPT_MAP[ch] ?? ch).join("");
}
function trimTrailingZeros(s) {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}
function formatNumber(n) {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n === 0) return "0";
  if (n >= 1e5 || n < 1e-3) {
    const exp = Math.floor(Math.log10(n));
    const mantissa = n / Math.pow(10, exp);
    return `${trimTrailingZeros(mantissa.toFixed(3))} × 10${toSuperscript(exp)}`;
  }
  if (n >= 100) return trimTrailingZeros(n.toFixed(1));
  if (n >= 1) return trimTrailingZeros(n.toFixed(3));
  return trimTrailingZeros(n.toFixed(5));
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const m = params.get("m");
  if (m === null || !Number.isFinite(parseFloat(m))) return null;
  return {
    mass: m,
    massUnit: MASS_UNITS[params.get("mu")] ? params.get("mu") : "msun",
    L: params.get("l") ?? "",
    LUnit: LUMINOSITY_UNITS[params.get("lu")] ? params.get("lu") : "ergs",
  };
}

export default function EddingtonLuminosityCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [mass, setMass] = useState("10");
  const [massUnit, setMassUnit] = useState("msun");
  const [L, setL] = useState("6.3e38");
  const [LUnit, setLUnit] = useState("ergs");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setMass(initial.mass);
      setMassUnit(initial.massUnit);
      setL(initial.L);
      setLUnit(initial.LUnit);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("m", mass);
      params.set("mu", massUnit);
      if (L) params.set("l", L);
      params.set("lu", LUnit);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, mass, massUnit, L, LUnit]);

  const result = useMemo(() => {
    const M = parseFloat(mass);
    if (!(M > 0)) return { valid: false, reason: "Enter a positive mass." };
    const massKg = massToKg(M, massUnit);
    const eddWatts = eddingtonLuminosityWatts(massKg);
    const massMsun = massToKg(M, massUnit) / MASS_UNITS.msun.toKg;

    const LRaw = parseFloat(L);
    const hasL = L.trim() !== "" && Number.isFinite(LRaw) && LRaw > 0;
    let lambda = null;
    let LWatts = null;
    if (hasL) {
      LWatts = luminosityToSI(LRaw, LUnit);
      lambda = eddingtonRatio(LWatts, eddWatts);
    }

    return {
      valid: true,
      massMsun,
      eddWatts,
      hasL,
      LWatts,
      lambda,
      classification: hasL ? classifyRatio(lambda) : null,
    };
  }, [mass, massUnit, L, LUnit]);

  // --- Eddington ratio meter ---
  // A fixed log scale from 0.01x to 100x with three coloured zones
  // (sub-, near-, and super-Eddington) and a marker at the current ratio
  // — turns "λ = 0.5" into a position you can see relative to the limit,
  // rather than a bare number you have to interpret yourself.
  const meter = useMemo(() => {
    if (!result.valid || !result.hasL || !(result.lambda > 0)) return null;
    const domainMin = -3;
    const domainMax = 2;
    const width = 640;
    const height = 108;
    const marginLeft = 44;
    const marginRight = 44;
    const barY = 30;
    const barHeight = 22;
    const plotWidth = width - marginLeft - marginRight;
    const xScale = (logL) => marginLeft + ((logL - domainMin) / (domainMax - domainMin)) * plotWidth;

    const goodEnd = Math.log10(0.3);
    const warnEnd = Math.log10(1.5);
    const zones = [
      { from: domainMin, to: goodEnd, cls: "edd-zone--good" },
      { from: goodEnd, to: warnEnd, cls: "edd-zone--warn" },
      { from: warnEnd, to: domainMax, cls: "edd-zone--bad" },
    ].map((z) => ({ x1: xScale(z.from), x2: xScale(z.to), cls: z.cls }));

    const ticks = [];
    for (let e = domainMin; e <= domainMax; e++) ticks.push(e);

    const logLambda = Math.log10(result.lambda);
    const clampedLog = Math.min(domainMax, Math.max(domainMin, logLambda));
    const offScale = logLambda !== clampedLog;

    return { width, height, marginLeft, marginRight, plotWidth, barY, barHeight, xScale, zones, ticks, markerX: xScale(clampedLog), offScale };
  }, [result]);

  // --- log-log L vs. M chart ---
  // L_Edd = k*M is a pure power law with exponent 1, so it's exactly a
  // straight line of slope +1 in log-log space, regardless of mass. The
  // object's Eddington limit always sits on that line; if an observed
  // luminosity is given, its point falls above or below the line by
  // exactly how far its Eddington ratio departs from 1.
  const chart = useMemo(() => {
    if (!result.valid) return null;
    const { massMsun, eddWatts, hasL, LWatts } = result;
    const logM = Math.log10(massMsun);
    const eddErgS = eddWatts * 1e7;
    const logEdd = Math.log10(eddErgS);
    const logK = logEdd - logM; // log10(erg/s per solar mass), slope 1 line: logL = logK + logM

    const xPad = 1.3;
    const xMin = logM - xPad;
    const xMax = logM + xPad;
    const lineAt = (x) => logK + x;

    const obsErgS = hasL ? LWatts * 1e7 : null;
    const logObs = hasL ? Math.log10(obsErgS) : null;

    const yFromLine = [lineAt(xMin), lineAt(xMax)];
    const yVals = hasL ? [...yFromLine, logObs] : yFromLine;
    const yPad = Math.max((Math.max(...yVals) - Math.min(...yVals)) * 0.15, 0.3);
    const yMin = Math.min(...yVals) - yPad;
    const yMax = Math.max(...yVals) + yPad;

    const width = 640;
    const height = 320;
    const marginLeft = 74;
    const marginRight = 20;
    const marginTop = 24;
    const marginBottom = 40;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;

    const xScale = (x) => marginLeft + ((x - xMin) / (xMax - xMin)) * plotWidth;
    const yScale = (y) => marginTop + (1 - (y - yMin) / (yMax - yMin)) * plotHeight;

    const decadeTicks = (lo, hi) => {
      const start = Math.ceil(lo);
      const end = Math.floor(hi);
      const ticks = [];
      for (let e = start; e <= end; e++) ticks.push(e);
      return ticks;
    };

    return {
      width, height, marginLeft, marginRight, marginTop, marginBottom, plotWidth, plotHeight,
      xScale, yScale,
      x1: xScale(xMin), y1: yScale(lineAt(xMin)),
      x2: xScale(xMax), y2: yScale(lineAt(xMax)),
      eddPoint: { x: xScale(logM), y: yScale(logEdd) },
      obsPoint: hasL ? { x: xScale(logM), y: yScale(logObs) } : null,
      xTicks: decadeTicks(xMin, xMax),
      yTicks: decadeTicks(yMin, yMax),
    };
  }, [result]);

  const applyPreset = (preset) => {
    setMass(String(preset.mass));
    setMassUnit(preset.massUnit);
    setL(preset.L);
    setLUnit(preset.LUnit);
  };

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
    <div className="edd" aria-label="Eddington luminosity and Eddington ratio calculator">
      <div className="edd-header">
        <p className="edd-title">Eddington luminosity / ratio calculator</p>
        <div className="edd-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="edd-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="edd-explainer">
        The <strong>Eddington limit</strong> is the luminosity at which outward radiation pressure
        on ionized gas balances the inward pull of gravity: <code>L_Edd = 4πGMm_p c / σ_T ≈ 1.26 ×
        10³⁸ (M/M☉) erg/s</code>. Enter a mass to get L_Edd; optionally add an observed or estimated
        luminosity to get the Eddington ratio, λ_Edd = L/L_Edd.
      </p>

      <div className="edd-fields">
        <div className="edd-field">
          <label htmlFor="edd-mass">Mass (M)</label>
          <div className="edd-input-row">
            <input
              id="edd-mass"
              className="edd-input"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={mass}
              onChange={(e) => setMass(e.target.value)}
            />
            <select className="edd-unit-select" value={massUnit} onChange={(e) => setMassUnit(e.target.value)}>
              {MASS_UNIT_ORDER.map((u) => (
                <option key={u} value={u}>{MASS_UNITS[u].short}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="edd-field">
          <label htmlFor="edd-l">Observed / estimated luminosity (L) — optional</label>
          <div className="edd-input-row">
            <input
              id="edd-l"
              className="edd-input"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              placeholder="leave blank to skip"
              value={L}
              onChange={(e) => setL(e.target.value)}
            />
            <select className="edd-unit-select" value={LUnit} onChange={(e) => setLUnit(e.target.value)}>
              {LUMINOSITY_UNIT_ORDER.map((u) => (
                <option key={u} value={u}>{LUMINOSITY_UNITS[u].short}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!result.valid ? (
        <p className="edd-note edd-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="edd-table" role="table" aria-label="Eddington luminosity in every unit">
            {LUMINOSITY_UNIT_ORDER.map((key) => (
              <div className={key === LUnit ? "edd-row edd-row--active" : "edd-row"} role="row" key={key}>
                <span className="edd-row-label" role="cell">L_Edd, {LUMINOSITY_UNITS[key].label}</span>
                <span className="edd-row-value" role="cell">
                  {formatNumber(luminosityFromSI(result.eddWatts, key))}{" "}
                  <span className="edd-row-unit">{LUMINOSITY_UNITS[key].short}</span>
                </span>
              </div>
            ))}
          </div>

          {result.hasL && (
            <div className="edd-ratio-card">
              <div className="edd-ratio-value">
                λ_Edd = {formatNumber(result.lambda)}
                {result.classification && (
                  <span className={`edd-badge edd-badge--${result.classification.tone}`}>{result.classification.label}</span>
                )}
              </div>
              <p className="edd-ratio-sub">
                Radiating at about {formatNumber(result.lambda * 100)}% of its Eddington luminosity.
              </p>
            </div>
          )}

          {meter && (
            <div className="edd-chart-wrap">
              <svg
                className="edd-chart-svg"
                viewBox={`0 0 ${meter.width} ${meter.height}`}
                role="img"
                aria-label={`Eddington ratio meter; current ratio ${formatNumber(result.lambda)}`}
              >
                {meter.zones.map((z, i) => (
                  <rect key={i} x={z.x1} y={meter.barY} width={Math.max(z.x2 - z.x1, 0)} height={meter.barHeight} className={z.cls} />
                ))}
                {meter.ticks.map((e) => (
                  <g key={e}>
                    <line x1={meter.xScale(e)} x2={meter.xScale(e)} y1={meter.barY} y2={meter.barY + meter.barHeight} className="edd-meter-tick" />
                    <text x={meter.xScale(e)} y={meter.barY + meter.barHeight + 16} className="edd-chart-axis-label" textAnchor="middle">
                      10{toSuperscript(e)}×
                    </text>
                  </g>
                ))}
                <polygon
                  points={`${meter.markerX - 7},${meter.barY - 10} ${meter.markerX + 7},${meter.barY - 10} ${meter.markerX},${meter.barY - 1}`}
                  className="edd-meter-needle"
                />
                <text x={meter.markerX} y={meter.barY - 15} className="edd-meter-needle-label" textAnchor="middle">
                  {meter.offScale ? "off scale — " : ""}λ ≈ {formatNumber(result.lambda)}
                </text>
              </svg>
              <p className="edd-chart-caption">
                Log scale from 0.01× to 100×. Green = sub-Eddington, amber = near the limit, red =
                super-Eddington (routinely seen in real ULXs, via mechanisms this idealized limit
                doesn't capture).
              </p>
            </div>
          )}

          {chart && (
            <div className="edd-chart-wrap">
              <svg
                className="edd-chart-svg"
                viewBox={`0 0 ${chart.width} ${chart.height}`}
                role="img"
                aria-label="Log-log plot of luminosity versus mass; the Eddington limit is a straight line of slope 1"
              >
                {chart.xTicks.map((e) => (
                  <g key={`x${e}`}>
                    <line x1={chart.xScale(e)} x2={chart.xScale(e)} y1={chart.marginTop} y2={chart.marginTop + chart.plotHeight} className="edd-chart-gridline" />
                    <text x={chart.xScale(e)} y={chart.height - 12} className="edd-chart-axis-label" textAnchor="middle">
                      10{toSuperscript(e)} M☉
                    </text>
                  </g>
                ))}
                {chart.yTicks.map((e) => (
                  <g key={`y${e}`}>
                    <line x1={chart.marginLeft} x2={chart.marginLeft + chart.plotWidth} y1={chart.yScale(e)} y2={chart.yScale(e)} className="edd-chart-gridline" />
                    <text x={chart.marginLeft - 8} y={chart.yScale(e) + 4} className="edd-chart-axis-label" textAnchor="end">
                      10{toSuperscript(e)} erg/s
                    </text>
                  </g>
                ))}
                <line x1={chart.marginLeft} x2={chart.marginLeft} y1={chart.marginTop} y2={chart.marginTop + chart.plotHeight} className="edd-chart-axis-line" />
                <line x1={chart.marginLeft} x2={chart.marginLeft + chart.plotWidth} y1={chart.marginTop + chart.plotHeight} y2={chart.marginTop + chart.plotHeight} className="edd-chart-axis-line" />

                <line x1={chart.x1} y1={chart.y1} x2={chart.x2} y2={chart.y2} className="edd-chart-fit-line" />

                {chart.obsPoint && (
                  <line x1={chart.eddPoint.x} y1={chart.eddPoint.y} x2={chart.obsPoint.x} y2={chart.obsPoint.y} className="edd-chart-connector" />
                )}

                <circle cx={chart.eddPoint.x} cy={chart.eddPoint.y} r="5" className="edd-chart-point edd-chart-point--edd" />
                <text x={chart.eddPoint.x + 9} y={chart.eddPoint.y - 8} className="edd-chart-point-label">Eddington limit</text>

                {chart.obsPoint && (
                  <>
                    <circle cx={chart.obsPoint.x} cy={chart.obsPoint.y} r="5" className="edd-chart-point edd-chart-point--obs" />
                    <text x={chart.obsPoint.x + 9} y={chart.obsPoint.y - 8} className="edd-chart-point-label edd-chart-point-label--obs">observed</text>
                  </>
                )}
              </svg>
              <p className="edd-chart-caption">
                Log-log plot — L_Edd ∝ M is a straight line of slope 1 here. The observed point
                (if given) sits above the line when super-Eddington, below it when sub-Eddington.
              </p>
            </div>
          )}
        </>
      )}

      <div className="edd-footer-row">
        <CalculatorVote slug="eddington-luminosity-calculator" />
        <button type="button" className="edd-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
