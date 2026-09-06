import { useEffect, useMemo, useState } from "react";
import {
  FLUX_UNITS,
  FLUX_UNIT_ORDER,
  LUMINOSITY_UNITS,
  LUMINOSITY_UNIT_ORDER,
  DISTANCE_UNITS,
  DISTANCE_UNIT_ORDER,
  fluxToSI,
  fluxFromSI,
  luminosityToSI,
  luminosityFromSI,
  distanceToMeters,
  distanceFromMeters,
  fluxFromLuminosityDistance,
  luminosityFromFluxDistance,
  distanceFromFluxLuminosity,
  relErrorFlux,
  relErrorLuminosity,
  relErrorDistance,
} from "./flux";
import {
  FLUX_LUMINOSITY_DISTANCE_TEST_COLUMNS,
  FLUX_LUMINOSITY_DISTANCE_TEST_SOURCES,
  getFluxLuminosityDistanceTestRows,
} from "./fluxTests";
import "../../../styles/fluxLuminosityDistanceCalculator.css";
import "../../../styles/calculators.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import CalculatorTests from "../../CalculatorTests.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";
import Katex from "../../Katex.jsx";

// Every preset is self-consistent under all three "solve for" choices, so
// switching "solve for" after applying one never shows a jarring mismatch.
const PRESETS = [
  {
    label: "The Sun at 1 AU",
    solveFor: "flux",
    flux: 1361.17,
    fluxUnit: "si",
    fluxSigma: "",
    luminosity: 1,
    luminosityUnit: "lsun",
    luminositySigma: "",
    distance: 1,
    distanceUnit: "au",
    distanceSigma: "",
  },
  {
    label: "Sun-like star at 10 pc",
    solveFor: "flux",
    flux: 3.1993e-10,
    fluxUnit: "si",
    fluxSigma: "",
    luminosity: 1,
    luminosityUnit: "lsun",
    luminositySigma: "",
    distance: 10,
    distanceUnit: "pc",
    distanceSigma: "",
  },
  {
    label: "Type Ia supernova (standard candle)",
    solveFor: "distance",
    flux: 1e-12,
    fluxUnit: "si",
    fluxSigma: "1e-13",
    luminosity: 1e36,
    luminosityUnit: "watt",
    luminositySigma: "",
    distance: 9.142,
    distanceUnit: "mpc",
    distanceSigma: "",
  },
  {
    label: "Cepheid in a nearby galaxy",
    solveFor: "distance",
    flux: 1.2797e-13,
    fluxUnit: "si",
    fluxSigma: "",
    luminosity: 10000,
    luminosityUnit: "lsun",
    luminositySigma: "",
    distance: 50,
    distanceUnit: "kpc",
    distanceSigma: "",
  },
];

const SOLVE_OPTIONS = [
  { key: "flux", label: "Flux" },
  { key: "luminosity", label: "Luminosity" },
  { key: "distance", label: "Distance" },
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
  const abs = Math.abs(n);
  if (abs >= 1e6 || abs < 1e-3) {
    const exp = Math.floor(Math.log10(abs));
    const mantissa = n / Math.pow(10, exp);
    return `${trimTrailingZeros(mantissa.toFixed(4))} × 10${toSuperscript(exp)}`;
  }
  if (abs >= 100) return trimTrailingZeros(n.toFixed(2));
  if (abs >= 1) return trimTrailingZeros(n.toFixed(4));
  return trimTrailingZeros(n.toFixed(6));
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const solveFor = params.get("solve");
  if (!solveFor || !SOLVE_OPTIONS.some((o) => o.key === solveFor)) return null;
  const str = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  return {
    solveFor,
    flux: str("f", "1361.17"),
    fluxUnit: FLUX_UNITS[params.get("fu")] ? params.get("fu") : "si",
    fluxSigma: params.get("fs") ?? "",
    luminosity: str("l", "1"),
    luminosityUnit: LUMINOSITY_UNITS[params.get("lu")] ? params.get("lu") : "lsun",
    luminositySigma: params.get("ls") ?? "",
    distance: str("d", "1"),
    distanceUnit: DISTANCE_UNITS[params.get("du")] ? params.get("du") : "au",
    distanceSigma: params.get("ds") ?? "",
  };
}

export default function FluxLuminosityDistanceCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [solveFor, setSolveFor] = useState("flux");
  const [flux, setFlux] = useState("1361.17");
  const [fluxUnit, setFluxUnit] = useState("si");
  const [fluxSigma, setFluxSigma] = useState("");
  const [luminosity, setLuminosity] = useState("1");
  const [luminosityUnit, setLuminosityUnit] = useState("lsun");
  const [luminositySigma, setLuminositySigma] = useState("");
  const [distance, setDistance] = useState("1");
  const [distanceUnit, setDistanceUnit] = useState("au");
  const [distanceSigma, setDistanceSigma] = useState("");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setSolveFor(initial.solveFor);
      setFlux(initial.flux);
      setFluxUnit(initial.fluxUnit);
      setFluxSigma(initial.fluxSigma);
      setLuminosity(initial.luminosity);
      setLuminosityUnit(initial.luminosityUnit);
      setLuminositySigma(initial.luminositySigma);
      setDistance(initial.distance);
      setDistanceUnit(initial.distanceUnit);
      setDistanceSigma(initial.distanceSigma);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("solve", solveFor);
      params.set("f", flux);
      params.set("fu", fluxUnit);
      if (fluxSigma) params.set("fs", fluxSigma);
      params.set("l", luminosity);
      params.set("lu", luminosityUnit);
      if (luminositySigma) params.set("ls", luminositySigma);
      params.set("d", distance);
      params.set("du", distanceUnit);
      if (distanceSigma) params.set("ds", distanceSigma);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [
    hydrated,
    solveFor,
    flux,
    fluxUnit,
    fluxSigma,
    luminosity,
    luminosityUnit,
    luminositySigma,
    distance,
    distanceUnit,
    distanceSigma,
  ]);

  const result = useMemo(() => {
    const relOf = (raw, value) => {
      const sigma = parseFloat(raw);
      const v = parseFloat(value);
      return Number.isFinite(sigma) && sigma > 0 && v > 0 ? sigma / v : 0;
    };

    if (solveFor === "flux") {
      const L = parseFloat(luminosity);
      const d = parseFloat(distance);
      if (!(L > 0) || !(d > 0)) return { valid: false, reason: "Enter a positive luminosity and distance." };
      const Lsi = luminosityToSI(L, luminosityUnit);
      const dsi = distanceToMeters(d, distanceUnit);
      const F = fluxFromLuminosityDistance(Lsi, dsi);
      const relL = relOf(luminositySigma, luminosity);
      const relD = relOf(distanceSigma, distance);
      const relF = relL > 0 || relD > 0 ? relErrorFlux(relL, relD) : 0;
      return { valid: true, quantity: "flux", exact: F, relError: relF, FSi: F, LSi: Lsi, dSi: dsi };
    }
    if (solveFor === "luminosity") {
      const F = parseFloat(flux);
      const d = parseFloat(distance);
      if (!(F > 0) || !(d > 0)) return { valid: false, reason: "Enter a positive flux and distance." };
      const Fsi = fluxToSI(F, fluxUnit);
      const dsi = distanceToMeters(d, distanceUnit);
      const L = luminosityFromFluxDistance(Fsi, dsi);
      const relF = relOf(fluxSigma, flux);
      const relD = relOf(distanceSigma, distance);
      const relL = relF > 0 || relD > 0 ? relErrorLuminosity(relF, relD) : 0;
      return { valid: true, quantity: "luminosity", exact: L, relError: relL, FSi: Fsi, LSi: L, dSi: dsi };
    }
    const F = parseFloat(flux);
    const L = parseFloat(luminosity);
    if (!(F > 0) || !(L > 0)) return { valid: false, reason: "Enter a positive flux and luminosity." };
    const Fsi = fluxToSI(F, fluxUnit);
    const Lsi = luminosityToSI(L, luminosityUnit);
    const d = distanceFromFluxLuminosity(Fsi, Lsi);
    const relF = relOf(fluxSigma, flux);
    const relL = relOf(luminositySigma, luminosity);
    const relD = relF > 0 || relL > 0 ? relErrorDistance(relF, relL) : 0;
    return { valid: true, quantity: "distance", exact: d, relError: relD, FSi: Fsi, LSi: Lsi, dSi: d };
  }, [solveFor, flux, fluxUnit, fluxSigma, luminosity, luminosityUnit, luminositySigma, distance, distanceUnit, distanceSigma]);

  // --- log-log inverse-square-law chart ---
  // F = L/(4πd²) is a power law in d with a fixed exponent, -2 — exactly a
  // straight line in log-log space, regardless of which quantity was
  // solved for. Plotting it this way makes "inverse-SQUARE" concrete: the
  // line's slope is always -2, and doubling the distance always drops the
  // flux by exactly 4×, visibly.
  const chart = useMemo(() => {
    if (!result.valid) return null;
    const { FSi, LSi, dSi } = result;
    const logD = Math.log10(dSi);
    const logF = Math.log10(FSi);
    const logConst = Math.log10(LSi / (4 * Math.PI)); // logF = logConst - 2*logD

    const xPad = 1.2;
    const xMin = logD - xPad;
    const xMax = logD + xPad;
    const lineAt = (x) => logConst - 2 * x;
    const yAtMin = lineAt(xMin);
    const yAtMax = lineAt(xMax);
    const yPad = Math.abs(yAtMin - yAtMax) * 0.08;
    const yMin = Math.min(yAtMin, yAtMax) - yPad;
    const yMax = Math.max(yAtMin, yAtMax) + yPad;

    const width = 640;
    const height = 320;
    const marginLeft = 70;
    const marginRight = 20;
    const marginTop = 20;
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

    // Reference point at 2x the distance — lands exactly on the same line,
    // 1/4 the flux, since (2d)⁻² = d⁻²/4.
    const logD2 = logD + Math.log10(2);
    const logF2 = lineAt(logD2);

    return {
      width, height, marginLeft, marginRight, marginTop, marginBottom, plotWidth, plotHeight,
      xScale, yScale,
      x1: xScale(xMin), y1: yScale(lineAt(xMin)),
      x2: xScale(xMax), y2: yScale(lineAt(xMax)),
      point: { x: xScale(logD), y: yScale(logF) },
      refPoint: logD2 <= xMax ? { x: xScale(logD2), y: yScale(logF2) } : null,
      xTicks: decadeTicks(xMin, xMax),
      yTicks: decadeTicks(yMin, yMax),
    };
  }, [result]);

  // Self-check rows: runs the real flux.js functions against known
  // reference figures and edge cases — independent of the fields above.
  const testRows = useMemo(() => getFluxLuminosityDistanceTestRows(), []);

  const applyPreset = (preset) => {
    setSolveFor(preset.solveFor);
    setFlux(String(preset.flux));
    setFluxUnit(preset.fluxUnit);
    setFluxSigma(preset.fluxSigma);
    setLuminosity(String(preset.luminosity));
    setLuminosityUnit(preset.luminosityUnit);
    setLuminositySigma(preset.luminositySigma);
    setDistance(String(preset.distance));
    setDistanceUnit(preset.distanceUnit);
    setDistanceSigma(preset.distanceSigma);
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

  const unitTable = result.quantity === "flux" ? FLUX_UNITS : result.quantity === "luminosity" ? LUMINOSITY_UNITS : DISTANCE_UNITS;
  const unitOrder =
    result.quantity === "flux" ? FLUX_UNIT_ORDER : result.quantity === "luminosity" ? LUMINOSITY_UNIT_ORDER : DISTANCE_UNIT_ORDER;
  const toDisplay =
    result.quantity === "flux" ? fluxFromSI : result.quantity === "luminosity" ? luminosityFromSI : distanceFromMeters;
  const headlineUnit = result.quantity === "flux" ? fluxUnit : result.quantity === "luminosity" ? luminosityUnit : distanceUnit;
  const hasUncertainty = result.valid && result.relError > 0;

  return (
    <div className="fld" aria-label="Flux, luminosity, and distance calculator">
      <div className="fld-header">
        <p className="fld-title">Flux / luminosity / distance calculator</p>
        <div className="fld-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="fld-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="fld-explainer">
        Assumes <strong>isotropic emission</strong> — the source radiates equally in every
        direction, so its light dilutes over the surface of an ever-larger sphere as it travels.
        Real observed flux can fall short of this simple prediction due to dust/gas absorption and
        extinction, relativistic beaming, or — at cosmological distances — because "distance"
        itself stops being a single well-defined number. See below for details.
      </p>

      <div className="fld-solve-toggle" role="group" aria-label="Solve for">
        {SOLVE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={opt.key === solveFor ? "fld-solve-btn active" : "fld-solve-btn"}
            onClick={() => setSolveFor(opt.key)}
          >
            Solve for {opt.label}
          </button>
        ))}
      </div>

      <div className="fld-fields">
        <div className="fld-field">
          <label htmlFor="fld-flux">Flux (<Katex tex="F" />)</label>
          {solveFor === "flux" ? (
            <div className="fld-computed">
              {result.valid ? formatNumber(fluxFromSI(result.exact, fluxUnit)) : "—"}
              <select className="fld-unit-select" value={fluxUnit} onChange={(e) => setFluxUnit(e.target.value)}>
                {FLUX_UNIT_ORDER.map((u) => (
                  <option key={u} value={u}>
                    {FLUX_UNITS[u].short}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="fld-input-row">
                <input
                  id="fld-flux"
                  className="fld-input"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={flux}
                  onChange={(e) => setFlux(e.target.value)}
                />
                <select className="fld-unit-select" value={fluxUnit} onChange={(e) => setFluxUnit(e.target.value)}>
                  {FLUX_UNIT_ORDER.map((u) => (
                    <option key={u} value={u}>
                      {FLUX_UNITS[u].short}
                    </option>
                  ))}
                </select>
              </div>
              <input
                className="fld-sigma-input"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                placeholder="± uncertainty (optional)"
                value={fluxSigma}
                onChange={(e) => setFluxSigma(e.target.value)}
              />
            </>
          )}
        </div>

        <div className="fld-field">
          <label htmlFor="fld-luminosity">Luminosity (<Katex tex="L" />)</label>
          {solveFor === "luminosity" ? (
            <div className="fld-computed">
              {result.valid ? formatNumber(luminosityFromSI(result.exact, luminosityUnit)) : "—"}
              <select className="fld-unit-select" value={luminosityUnit} onChange={(e) => setLuminosityUnit(e.target.value)}>
                {LUMINOSITY_UNIT_ORDER.map((u) => (
                  <option key={u} value={u}>
                    {LUMINOSITY_UNITS[u].short}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="fld-input-row">
                <input
                  id="fld-luminosity"
                  className="fld-input"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={luminosity}
                  onChange={(e) => setLuminosity(e.target.value)}
                />
                <select className="fld-unit-select" value={luminosityUnit} onChange={(e) => setLuminosityUnit(e.target.value)}>
                  {LUMINOSITY_UNIT_ORDER.map((u) => (
                    <option key={u} value={u}>
                      {LUMINOSITY_UNITS[u].short}
                    </option>
                  ))}
                </select>
              </div>
              <input
                className="fld-sigma-input"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                placeholder="± uncertainty (optional)"
                value={luminositySigma}
                onChange={(e) => setLuminositySigma(e.target.value)}
              />
            </>
          )}
        </div>

        <div className="fld-field">
          <label htmlFor="fld-distance">Distance (<Katex tex="d" />)</label>
          {solveFor === "distance" ? (
            <div className="fld-computed">
              {result.valid ? formatNumber(distanceFromMeters(result.exact, distanceUnit)) : "—"}
              <select className="fld-unit-select" value={distanceUnit} onChange={(e) => setDistanceUnit(e.target.value)}>
                {DISTANCE_UNIT_ORDER.map((u) => (
                  <option key={u} value={u}>
                    {DISTANCE_UNITS[u].short}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="fld-input-row">
                <input
                  id="fld-distance"
                  className="fld-input"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                />
                <select className="fld-unit-select" value={distanceUnit} onChange={(e) => setDistanceUnit(e.target.value)}>
                  {DISTANCE_UNIT_ORDER.map((u) => (
                    <option key={u} value={u}>
                      {DISTANCE_UNITS[u].short}
                    </option>
                  ))}
                </select>
              </div>
              <input
                className="fld-sigma-input"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                placeholder="± uncertainty (optional)"
                value={distanceSigma}
                onChange={(e) => setDistanceSigma(e.target.value)}
              />
            </>
          )}
        </div>
      </div>

      {!result.valid ? (
        <p className="fld-note fld-note--warn" role="alert">
          {result.reason}
        </p>
      ) : (
        <>
          <div className="fld-table" role="table" aria-label="Result in every unit">
            {unitOrder.map((key) => (
              <div className={key === headlineUnit ? "fld-row fld-row--active" : "fld-row"} role="row" key={key}>
                <span className="fld-row-label" role="cell">
                  {unitTable[key].label}
                </span>
                <span className="fld-row-value" role="cell">
                  {formatNumber(toDisplay(result.exact, key))}
                  {hasUncertainty && ` ± ${formatNumber(toDisplay(result.exact, key) * result.relError)}`}{" "}
                  <span className="fld-row-unit">{unitTable[key].short}</span>
                </span>
              </div>
            ))}
          </div>

          {hasUncertainty && (
            <p className="fld-note">
              Propagated from the input uncertainties via <Katex tex={String.raw`F = L/(4\pi d^2)`} /> (a pure power law): relative
              errors add in quadrature, with distance's error doubled (<Katex tex={String.raw`F \propto d^{-2}`} />) or halved (<Katex tex={String.raw`d \propto F^{-0.5}`} />) as appropriate. Result: {(result.relError * 100).toFixed(2)}% relative
              uncertainty on {SOLVE_OPTIONS.find((o) => o.key === solveFor).label.toLowerCase()}.
            </p>
          )}

          {chart && (
            <div className="chart-wrap">
              <svg
                className="fld-chart-svg"
                viewBox={`0 0 ${chart.width} ${chart.height}`}
                role="img"
                aria-label="Log-log plot of flux versus distance for this luminosity; the inverse-square law is a straight line of slope -2"
              >
                {chart.xTicks.map((e) => (
                  <g key={`x${e}`}>
                    <line
                      x1={chart.xScale(e)} x2={chart.xScale(e)}
                      y1={chart.marginTop} y2={chart.marginTop + chart.plotHeight}
                      className="fld-chart-gridline"
                    />
                    <text x={chart.xScale(e)} y={chart.height - 12} className="fld-chart-axis-label" textAnchor="middle">
                      10{toSuperscript(e)} m
                    </text>
                  </g>
                ))}
                {chart.yTicks.map((e) => (
                  <g key={`y${e}`}>
                    <line
                      x1={chart.marginLeft} x2={chart.marginLeft + chart.plotWidth}
                      y1={chart.yScale(e)} y2={chart.yScale(e)}
                      className="fld-chart-gridline"
                    />
                    <text x={chart.marginLeft - 8} y={chart.yScale(e) + 4} className="fld-chart-axis-label" textAnchor="end">
                      10{toSuperscript(e)} W/m²
                    </text>
                  </g>
                ))}
                <line
                  x1={chart.marginLeft} x2={chart.marginLeft}
                  y1={chart.marginTop} y2={chart.marginTop + chart.plotHeight}
                  className="fld-chart-axis-line"
                />
                <line
                  x1={chart.marginLeft} x2={chart.marginLeft + chart.plotWidth}
                  y1={chart.marginTop + chart.plotHeight} y2={chart.marginTop + chart.plotHeight}
                  className="fld-chart-axis-line"
                />

                <line x1={chart.x1} y1={chart.y1} x2={chart.x2} y2={chart.y2} className="fld-chart-fit-line" />

                <circle cx={chart.point.x} cy={chart.point.y} r="5" className="fld-chart-point" />
                <text x={chart.point.x + 9} y={chart.point.y - 8} className="fld-chart-point-label">
                  this source
                </text>

                {chart.refPoint && (
                  <>
                    <circle cx={chart.refPoint.x} cy={chart.refPoint.y} r="4" className="fld-chart-point fld-chart-point--ref" />
                    <text x={chart.refPoint.x + 8} y={chart.refPoint.y - 6} className="fld-chart-point-label fld-chart-point-label--ref">
                      2× distance → ¼ flux
                    </text>
                  </>
                )}
              </svg>
              <p className="fld-chart-caption">
                Log-log plot — the inverse-square law is a straight line here, with slope exactly
                −2: doubling the distance always divides the flux by 4, regardless of luminosity.
              </p>
            </div>
          )}
        </>
      )}

      <div className="fld-footer-row">
        <CalculatorVote slug="flux-luminosity-distance-calculator" />
        <CalculatorTests
          title="Flux, Luminosity & Distance Calculator — Tests"
          columns={FLUX_LUMINOSITY_DISTANCE_TEST_COLUMNS}
          rows={testRows}
          sources={FLUX_LUMINOSITY_DISTANCE_TEST_SOURCES}
        />
        <button type="button" className="fld-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
