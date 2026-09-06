import { useEffect, useMemo, useState } from "react";
import {
  FREQ_UNITS,
  FREQ_UNIT_ORDER,
  FLUX_DENSITY_UNITS,
  FLUX_DENSITY_UNIT_ORDER,
  freqToHz,
  fluxToJy,
  computeAlpha,
  alphaUncertainty,
  extrapolateFlux,
  extrapolatedFluxUncertainty,
  classifySpectrum,
} from "./spectral";
import "../../../styles/spectralIndexCalculator.css";
import "../../../styles/calculators.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";
import Katex from "../../Katex.jsx";

const PRESETS = [
  {
    label: "Steep-spectrum radio galaxy",
    nu1: 178, nu1Unit: "mhz", S1: 10500, S1Unit: "jy", S1Sigma: "",
    nu2: 1400, nu2Unit: "mhz", S2: 2016.61, S2Unit: "jy", S2Sigma: "",
    nu3: 5000, nu3Unit: "mhz",
  },
  {
    label: "Flat-spectrum blazar core",
    nu1: 1.4, nu1Unit: "ghz", S1: 1, S1Unit: "jy", S1Sigma: "0.05",
    nu2: 5, nu2Unit: "ghz", S2: 0.8805, S2Unit: "jy", S2Sigma: "0.05",
    nu3: 15, nu3Unit: "ghz",
  },
  {
    label: "Ultra-steep-spectrum source",
    nu1: 150, nu1Unit: "mhz", S1: 1, S1Unit: "jy", S1Sigma: "",
    nu2: 1400, nu2Unit: "mhz", S2: 54.82, S2Unit: "mjy", S2Sigma: "",
    nu3: 3000, nu3Unit: "mhz",
  },
  {
    label: "Inverted / self-absorbed source",
    nu1: 1, nu1Unit: "ghz", S1: 100, S1Unit: "mjy", S1Sigma: "",
    nu2: 5, nu2Unit: "ghz", S2: 223.6, S2Unit: "mjy", S2Sigma: "",
    nu3: 15, nu3Unit: "ghz",
  },
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
  if (abs >= 1e5 || abs < 1e-3) {
    const exp = Math.floor(Math.log10(abs));
    const mantissa = n / Math.pow(10, exp);
    return `${sign}${trimTrailingZeros(mantissa.toFixed(4))} × 10${toSuperscript(exp)}`;
  }
  if (abs >= 100) return `${sign}${trimTrailingZeros(n.toFixed(2))}`;
  if (abs >= 1) return `${sign}${trimTrailingZeros(n.toFixed(4))}`;
  return `${sign}${trimTrailingZeros(n.toFixed(6))}`;
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const n1 = params.get("n1");
  if (n1 === null || !Number.isFinite(parseFloat(n1))) return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  const unit = (key, table, fallback) => (table[params.get(key)] ? params.get(key) : fallback);
  return {
    nu1: num("n1", "178"), nu1Unit: unit("n1u", FREQ_UNITS, "mhz"),
    S1: num("s1", "10500"), S1Unit: unit("s1u", FLUX_DENSITY_UNITS, "jy"), S1Sigma: params.get("s1s") ?? "",
    nu2: num("n2", "1400"), nu2Unit: unit("n2u", FREQ_UNITS, "mhz"),
    S2: num("s2", "2016.61"), S2Unit: unit("s2u", FLUX_DENSITY_UNITS, "jy"), S2Sigma: params.get("s2s") ?? "",
    nu3: num("n3", "5000"), nu3Unit: unit("n3u", FREQ_UNITS, "mhz"),
  };
}

export default function SpectralIndexCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [nu1, setNu1] = useState("178");
  const [nu1Unit, setNu1Unit] = useState("mhz");
  const [S1, setS1] = useState("10500");
  const [S1Unit, setS1Unit] = useState("jy");
  const [S1Sigma, setS1Sigma] = useState("");
  const [nu2, setNu2] = useState("1400");
  const [nu2Unit, setNu2Unit] = useState("mhz");
  const [S2, setS2] = useState("2016.61");
  const [S2Unit, setS2Unit] = useState("jy");
  const [S2Sigma, setS2Sigma] = useState("");
  const [nu3, setNu3] = useState("5000");
  const [nu3Unit, setNu3Unit] = useState("mhz");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setNu1(initial.nu1); setNu1Unit(initial.nu1Unit);
      setS1(initial.S1); setS1Unit(initial.S1Unit); setS1Sigma(initial.S1Sigma);
      setNu2(initial.nu2); setNu2Unit(initial.nu2Unit);
      setS2(initial.S2); setS2Unit(initial.S2Unit); setS2Sigma(initial.S2Sigma);
      setNu3(initial.nu3); setNu3Unit(initial.nu3Unit);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("n1", nu1); params.set("n1u", nu1Unit);
      params.set("s1", S1); params.set("s1u", S1Unit);
      if (S1Sigma) params.set("s1s", S1Sigma);
      params.set("n2", nu2); params.set("n2u", nu2Unit);
      params.set("s2", S2); params.set("s2u", S2Unit);
      if (S2Sigma) params.set("s2s", S2Sigma);
      params.set("n3", nu3); params.set("n3u", nu3Unit);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, nu1, nu1Unit, S1, S1Unit, S1Sigma, nu2, nu2Unit, S2, S2Unit, S2Sigma, nu3, nu3Unit]);

  const result = useMemo(() => {
    const nu1Hz = freqToHz(parseFloat(nu1), nu1Unit);
    const nu2Hz = freqToHz(parseFloat(nu2), nu2Unit);
    const S1Jy = fluxToJy(parseFloat(S1), S1Unit);
    const S2Jy = fluxToJy(parseFloat(S2), S2Unit);
    const alphaResult = computeAlpha(S1Jy, nu1Hz, S2Jy, nu2Hz);
    if (!alphaResult.valid) return { valid: false, reason: alphaResult.reason };

    const relS1 = parseFloat(S1Sigma) > 0 ? parseFloat(S1Sigma) / parseFloat(S1) : 0;
    const relS2 = parseFloat(S2Sigma) > 0 ? parseFloat(S2Sigma) / parseFloat(S2) : 0;
    const sigmaAlpha = alphaUncertainty(relS1, relS2, nu1Hz, nu2Hz);

    let extrapolation = null;
    const nu3Hz = freqToHz(parseFloat(nu3), nu3Unit);
    if (Number.isFinite(nu3Hz) && nu3Hz > 0) {
      const S3Jy = extrapolateFlux(S1Jy, nu1Hz, alphaResult.alpha, nu3Hz);
      const relS3 = extrapolatedFluxUncertainty(relS1, sigmaAlpha, nu1Hz, nu3Hz);
      extrapolation = { S3Jy, relS3 };
    }

    return {
      valid: true,
      alpha: alphaResult.alpha,
      sigmaAlpha,
      classification: classifySpectrum(alphaResult.alpha),
      extrapolation,
      // raw SI-ish values, exposed for the log-log chart below
      nu1Hz, nu2Hz, S1Jy, S2Jy,
      sigmaS1Jy: relS1 > 0 ? relS1 * S1Jy : 0,
      sigmaS2Jy: relS2 > 0 ? relS2 * S2Jy : 0,
    };
  }, [nu1, nu1Unit, S1, S1Unit, S1Sigma, nu2, nu2Unit, S2, S2Unit, S2Sigma, nu3, nu3Unit]);

  // --- log-log spectrum chart geometry ---
  // A power law S ∝ ν^α is exactly a straight line in log-log space, with
  // slope α — plotting it this way makes the spectral index visually
  // self-evident instead of just a printed number.
  const chart = useMemo(() => {
    if (!result.valid) return null;
    const { nu1Hz, nu2Hz, S1Jy, S2Jy, sigmaS1Jy, sigmaS2Jy, alpha, extrapolation } = result;
    const nu3Hz = extrapolation ? freqToHz(parseFloat(nu3), nu3Unit) : null;
    const S3Jy = extrapolation ? extrapolation.S3Jy : null;

    const logNu1 = Math.log10(nu1Hz);
    const logNu2 = Math.log10(nu2Hz);
    const logS1 = Math.log10(S1Jy);
    const logS2 = Math.log10(S2Jy);
    const hasThird = Number.isFinite(nu3Hz) && nu3Hz > 0 && Number.isFinite(S3Jy) && S3Jy > 0;
    const logNu3 = hasThird ? Math.log10(nu3Hz) : null;
    const logS3 = hasThird ? Math.log10(S3Jy) : null;

    const xVals = [logNu1, logNu2, ...(hasThird ? [logNu3] : [])];
    const yVals = [logS1, logS2, ...(hasThird ? [logS3] : [])];
    const xSpan = Math.max(Math.max(...xVals) - Math.min(...xVals), 0.3);
    const ySpan = Math.max(Math.max(...yVals) - Math.min(...yVals), 0.3);
    const xPad = Math.max(0.25, xSpan * 0.2);
    const yPad = Math.max(0.25, ySpan * 0.2);
    const xMin = Math.min(...xVals) - xPad;
    const xMax = Math.max(...xVals) + xPad;
    const yMin = Math.min(...yVals) - yPad;
    const yMax = Math.max(...yVals) + yPad;

    const width = 640;
    const height = 320;
    const marginLeft = 64;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 40;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;

    const xScale = (logNu) => marginLeft + ((logNu - xMin) / (xMax - xMin)) * plotWidth;
    const yScale = (logS) => marginTop + (1 - (logS - yMin) / (yMax - yMin)) * plotHeight;

    // The fitted line: logS = logS1 + alpha*(logNu - logNu1), drawn across
    // the whole domain but solid only between the two measured frequencies
    // (interpolation) and dashed beyond them (extrapolation).
    const lineAt = (logNu) => logS1 + alpha * (logNu - logNu1);
    const measuredLo = Math.min(logNu1, logNu2);
    const measuredHi = Math.max(logNu1, logNu2);
    const segments = [];
    if (xMin < measuredLo) segments.push({ from: xMin, to: measuredLo, dashed: true });
    segments.push({ from: measuredLo, to: measuredHi, dashed: false });
    if (xMax > measuredHi) segments.push({ from: measuredHi, to: xMax, dashed: true });

    const decadeTicks = (lo, hi) => {
      const start = Math.ceil(lo);
      const end = Math.floor(hi);
      const ticks = [];
      for (let e = start; e <= end; e++) ticks.push(e);
      return ticks;
    };

    const errorBar = (logNu, valueJy, sigmaJy) => {
      if (!(sigmaJy > 0)) return null;
      const hiLog = Math.log10(valueJy + sigmaJy);
      const loLog = valueJy - sigmaJy > 0 ? Math.log10(valueJy - sigmaJy) : null;
      return { x: xScale(logNu), y1: yScale(hiLog), y2: loLog !== null ? yScale(loLog) : null };
    };

    return {
      width, height, marginLeft, marginRight, marginTop, marginBottom, plotWidth, plotHeight,
      xScale, yScale, xMin, xMax, yMin, yMax,
      point1: { x: xScale(logNu1), y: yScale(logS1) },
      point2: { x: xScale(logNu2), y: yScale(logS2) },
      point3: hasThird ? { x: xScale(logNu3), y: yScale(logS3) } : null,
      errorBar1: errorBar(logNu1, S1Jy, sigmaS1Jy),
      errorBar2: errorBar(logNu2, S2Jy, sigmaS2Jy),
      segments: segments.map((s) => ({
        x1: xScale(s.from), y1: yScale(lineAt(s.from)),
        x2: xScale(s.to), y2: yScale(lineAt(s.to)),
        dashed: s.dashed,
      })),
      xTicks: decadeTicks(xMin, xMax),
      yTicks: decadeTicks(yMin, yMax),
    };
  }, [result, nu3, nu3Unit]);

  const applyPreset = (preset) => {
    setNu1(String(preset.nu1)); setNu1Unit(preset.nu1Unit);
    setS1(String(preset.S1)); setS1Unit(preset.S1Unit); setS1Sigma(preset.S1Sigma);
    setNu2(String(preset.nu2)); setNu2Unit(preset.nu2Unit);
    setS2(String(preset.S2)); setS2Unit(preset.S2Unit); setS2Sigma(preset.S2Sigma);
    setNu3(String(preset.nu3)); setNu3Unit(preset.nu3Unit);
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
    <div className="sic" aria-label="Spectral index calculator">
      <div className="sic-header">
        <p className="sic-title">Spectral index calculator</p>
        <div className="sic-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="sic-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="sic-explainer">
        Uses the standard radio-astronomy convention{" "}
        <strong><Katex tex={String.raw`S_\nu \propto \nu^\alpha`} /></strong> — a
        negative α means flux density drops with increasing frequency (steep spectrum), positive
        means it rises (inverted). Some literature defines α with the opposite sign; always check
        before comparing quoted values.
      </p>

      <div className="sic-point">
        <p className="sic-point-title">Measurement 1</p>
        <div className="sic-field-row">
          <div className="sic-field">
            <label htmlFor="sic-nu1">Frequency <Katex tex="\nu_1" /></label>
            <div className="sic-input-row">
              <input id="sic-nu1" className="sic-input" type="number" min="0" step="any" inputMode="decimal" value={nu1} onChange={(e) => setNu1(e.target.value)} />
              <select className="sic-unit-select" value={nu1Unit} onChange={(e) => setNu1Unit(e.target.value)}>
                {FREQ_UNIT_ORDER.map((u) => <option key={u} value={u}>{FREQ_UNITS[u].short}</option>)}
              </select>
            </div>
          </div>
          <div className="sic-field">
            <label htmlFor="sic-s1">Flux density <Katex tex="S_1" /></label>
            <div className="sic-input-row">
              <input id="sic-s1" className="sic-input" type="number" min="0" step="any" inputMode="decimal" value={S1} onChange={(e) => setS1(e.target.value)} />
              <select className="sic-unit-select" value={S1Unit} onChange={(e) => setS1Unit(e.target.value)}>
                {FLUX_DENSITY_UNIT_ORDER.map((u) => <option key={u} value={u}>{FLUX_DENSITY_UNITS[u].short}</option>)}
              </select>
            </div>
            <input className="sic-sigma-input" type="number" min="0" step="any" inputMode="decimal" placeholder="± uncertainty (optional)" value={S1Sigma} onChange={(e) => setS1Sigma(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="sic-point">
        <p className="sic-point-title">Measurement 2</p>
        <div className="sic-field-row">
          <div className="sic-field">
            <label htmlFor="sic-nu2">Frequency <Katex tex="\nu_2" /></label>
            <div className="sic-input-row">
              <input id="sic-nu2" className="sic-input" type="number" min="0" step="any" inputMode="decimal" value={nu2} onChange={(e) => setNu2(e.target.value)} />
              <select className="sic-unit-select" value={nu2Unit} onChange={(e) => setNu2Unit(e.target.value)}>
                {FREQ_UNIT_ORDER.map((u) => <option key={u} value={u}>{FREQ_UNITS[u].short}</option>)}
              </select>
            </div>
          </div>
          <div className="sic-field">
            <label htmlFor="sic-s2">Flux density <Katex tex="S_2" /></label>
            <div className="sic-input-row">
              <input id="sic-s2" className="sic-input" type="number" min="0" step="any" inputMode="decimal" value={S2} onChange={(e) => setS2(e.target.value)} />
              <select className="sic-unit-select" value={S2Unit} onChange={(e) => setS2Unit(e.target.value)}>
                {FLUX_DENSITY_UNIT_ORDER.map((u) => <option key={u} value={u}>{FLUX_DENSITY_UNITS[u].short}</option>)}
              </select>
            </div>
            <input className="sic-sigma-input" type="number" min="0" step="any" inputMode="decimal" placeholder="± uncertainty (optional)" value={S2Sigma} onChange={(e) => setS2Sigma(e.target.value)} />
          </div>
        </div>
      </div>

      {!result.valid ? (
        <p className="sic-note sic-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="sic-alpha-card">
            <div className="sic-alpha-value">
              <Katex tex="\alpha" /> = {formatNumber(result.alpha, { forceSign: true })}
              {result.sigmaAlpha > 0 && ` ± ${formatNumber(result.sigmaAlpha)}`}
            </div>
            <span className={`sic-badge sic-badge--${result.classification.tone}`}>{result.classification.label}</span>
          </div>

          {chart && (
            <div className="chart-wrap">
              <svg
                className="sic-chart-svg"
                viewBox={`0 0 ${chart.width} ${chart.height}`}
                role="img"
                aria-label={`Log-log plot of flux density versus frequency; the fitted line's slope is the spectral index, ${formatNumber(result.alpha, { forceSign: true })}`}
              >
                {/* axis gridlines + ticks */}
                {chart.xTicks.map((e) => (
                  <g key={`x${e}`}>
                    <line
                      x1={chart.xScale(e)} x2={chart.xScale(e)}
                      y1={chart.marginTop} y2={chart.marginTop + chart.plotHeight}
                      className="sic-chart-gridline"
                    />
                    <text x={chart.xScale(e)} y={chart.height - 12} className="sic-chart-axis-label" textAnchor="middle">
                      10{toSuperscript(e)} Hz
                    </text>
                  </g>
                ))}
                {chart.yTicks.map((e) => (
                  <g key={`y${e}`}>
                    <line
                      x1={chart.marginLeft} x2={chart.marginLeft + chart.plotWidth}
                      y1={chart.yScale(e)} y2={chart.yScale(e)}
                      className="sic-chart-gridline"
                    />
                    <text x={chart.marginLeft - 8} y={chart.yScale(e) + 4} className="sic-chart-axis-label" textAnchor="end">
                      10{toSuperscript(e)} Jy
                    </text>
                  </g>
                ))}
                <line
                  x1={chart.marginLeft} x2={chart.marginLeft}
                  y1={chart.marginTop} y2={chart.marginTop + chart.plotHeight}
                  className="sic-chart-axis-line"
                />
                <line
                  x1={chart.marginLeft} x2={chart.marginLeft + chart.plotWidth}
                  y1={chart.marginTop + chart.plotHeight} y2={chart.marginTop + chart.plotHeight}
                  className="sic-chart-axis-line"
                />

                {/* fitted power-law line — solid where measured, dashed where extrapolated */}
                {chart.segments.map((s, i) => (
                  <line
                    key={i}
                    x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                    className="sic-chart-fit-line"
                    strokeDasharray={s.dashed ? "6 5" : undefined}
                  />
                ))}

                {/* error bars */}
                {chart.errorBar1 && (
                  <line
                    x1={chart.errorBar1.x} x2={chart.errorBar1.x}
                    y1={chart.errorBar1.y1} y2={chart.errorBar1.y2 ?? chart.point1.y}
                    className="sic-chart-errorbar"
                  />
                )}
                {chart.errorBar2 && (
                  <line
                    x1={chart.errorBar2.x} x2={chart.errorBar2.x}
                    y1={chart.errorBar2.y1} y2={chart.errorBar2.y2 ?? chart.point2.y}
                    className="sic-chart-errorbar"
                  />
                )}

                {/* measured points */}
                <circle cx={chart.point1.x} cy={chart.point1.y} r="5" className="sic-chart-point" />
                <text x={chart.point1.x + 9} y={chart.point1.y - 8} className="sic-chart-point-label">S₁</text>
                <circle cx={chart.point2.x} cy={chart.point2.y} r="5" className="sic-chart-point" />
                <text x={chart.point2.x + 9} y={chart.point2.y - 8} className="sic-chart-point-label">S₂</text>

                {/* predicted point */}
                {chart.point3 && (
                  <>
                    <rect
                      x={chart.point3.x - 5} y={chart.point3.y - 5} width="10" height="10"
                      transform={`rotate(45 ${chart.point3.x} ${chart.point3.y})`}
                      className="sic-chart-point sic-chart-point--predicted"
                    />
                    <text x={chart.point3.x + 9} y={chart.point3.y - 8} className="sic-chart-point-label sic-chart-point-label--predicted">
                      S₃ (predicted)
                    </text>
                  </>
                )}
              </svg>
              <p className="sic-chart-caption">
                Log-log plot — a power law is a straight line here, and its slope <em>is</em> α.
                Solid = between your two measurements; dashed = extrapolated beyond them.
              </p>
            </div>
          )}

          <div className="sic-point">
            <p className="sic-point-title">Predict flux density at a third frequency</p>
            <div className="sic-field-row">
              <div className="sic-field">
                <label htmlFor="sic-nu3">Frequency <Katex tex="\nu_3" /></label>
                <div className="sic-input-row">
                  <input id="sic-nu3" className="sic-input" type="number" min="0" step="any" inputMode="decimal" value={nu3} onChange={(e) => setNu3(e.target.value)} />
                  <select className="sic-unit-select" value={nu3Unit} onChange={(e) => setNu3Unit(e.target.value)}>
                    {FREQ_UNIT_ORDER.map((u) => <option key={u} value={u}>{FREQ_UNITS[u].short}</option>)}
                  </select>
                </div>
              </div>
              <div className="sic-field">
                <span className="sic-predicted-label">Predicted <Katex tex="S_3" /></span>
                {result.extrapolation ? (
                  <div className="sic-computed">
                    {formatNumber(result.extrapolation.S3Jy)}
                    {result.extrapolation.relS3 > 0 &&
                      ` ± ${formatNumber(result.extrapolation.S3Jy * result.extrapolation.relS3)}`}{" "}
                    Jy
                  </div>
                ) : (
                  <div className="sic-computed">—</div>
                )}
              </div>
            </div>
            {result.extrapolation && result.sigmaAlpha > 0 && (
              <p className="sic-note">
                Extrapolation uncertainty grows the farther <Katex tex="\nu_3" /> is from <Katex tex="\nu_1" /> — this is a real feature
                of projecting a power law outward, not a limitation of the calculator.
              </p>
            )}
          </div>
        </>
      )}

      <div className="sic-footer-row">
        <CalculatorVote slug="spectral-index-calculator" />
        <button type="button" className="sic-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
