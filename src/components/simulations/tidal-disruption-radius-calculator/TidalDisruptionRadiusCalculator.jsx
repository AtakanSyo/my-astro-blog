import { useEffect, useMemo, useState } from "react";
import {
  MASS_UNITS,
  MASS_UNIT_ORDER,
  RADIUS_UNITS,
  RADIUS_UNIT_ORDER,
  M_SUN,
  STAR_PRESETS,
  SCENARIO_PRESETS,
  massToKg,
  massFromKg,
  radiusToMeters,
  radiusFromMeters,
  tidalDisruptionRadiusM,
  schwarzschildRadiusM,
  crossoverMassKg,
} from "./tidalDisruption";
import {
  TIDAL_DISRUPTION_TEST_COLUMNS,
  TIDAL_DISRUPTION_TEST_SOURCES,
  getTidalDisruptionTestRows,
} from "./tidalDisruptionTests";
import "../../../styles/tidalDisruptionRadiusCalculator.css";
import "../../../styles/calculators.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import CalculatorTests from "../../CalculatorTests.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";
import Katex from "../../Katex.jsx";

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
function decadeTicks(lo, hi, step) {
  const ticks = [];
  for (let e = Math.ceil(lo / step) * step; e <= hi; e += step) ticks.push(Math.round(e));
  return ticks;
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const bhMass = params.get("bm");
  if (bhMass === null || !Number.isFinite(parseFloat(bhMass))) return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  return {
    bhMass,
    bhMassUnit: MASS_UNITS[params.get("bmu")] ? params.get("bmu") : "msun",
    starMass: num("sm", "1"),
    starMassUnit: MASS_UNITS[params.get("smu")] ? params.get("smu") : "msun",
    starRadius: num("sr", "1"),
    starRadiusUnit: RADIUS_UNITS[params.get("sru")] ? params.get("sru") : "rsun",
  };
}

export default function TidalDisruptionRadiusCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  // The default scenario is a Sun-like star near Sgr A* — a real,
  // observed-TDE-scale black hole — so the page opens on a genuinely
  // interesting, real case rather than an arbitrary one.
  const [bhMass, setBhMass] = useState("4.297e6");
  const [bhMassUnit, setBhMassUnit] = useState("msun");
  const [starMass, setStarMass] = useState("1");
  const [starMassUnit, setStarMassUnit] = useState("msun");
  const [starRadius, setStarRadius] = useState("1");
  const [starRadiusUnit, setStarRadiusUnit] = useState("rsun");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setBhMass(initial.bhMass);
      setBhMassUnit(initial.bhMassUnit);
      setStarMass(initial.starMass);
      setStarMassUnit(initial.starMassUnit);
      setStarRadius(initial.starRadius);
      setStarRadiusUnit(initial.starRadiusUnit);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("bm", bhMass);
      params.set("bmu", bhMassUnit);
      params.set("sm", starMass);
      params.set("smu", starMassUnit);
      params.set("sr", starRadius);
      params.set("sru", starRadiusUnit);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, bhMass, bhMassUnit, starMass, starMassUnit, starRadius, starRadiusUnit]);

  const result = useMemo(() => {
    const Mbh = parseFloat(bhMass);
    const Mstar = parseFloat(starMass);
    const Rstar = parseFloat(starRadius);
    if (!(Mbh > 0) || !(Mstar > 0) || !(Rstar > 0)) {
      return { valid: false, reason: "Enter a positive black hole mass, star mass, and star radius." };
    }
    const MbhKg = massToKg(Mbh, bhMassUnit);
    const MstarKg = massToKg(Mstar, starMassUnit);
    const RstarM = radiusToMeters(Rstar, starRadiusUnit);
    const rtM = tidalDisruptionRadiusM(RstarM, MbhKg, MstarKg);
    const rsM = schwarzschildRadiusM(MbhKg);
    const swallowed = rtM < rsM;
    const crossMbhKg = crossoverMassKg(RstarM, MstarKg);

    return {
      valid: true, MbhKg, MstarKg, RstarM, rtM, rsM, swallowed,
      ratio: rtM / rsM,
      crossMbhKg,
    };
  }, [bhMass, bhMassUnit, starMass, starMassUnit, starRadius, starRadiusUnit]);

  // --- disruption diagram ---
  // The black hole's Schwarzschild radius as a solid dark horizon disk,
  // the tidal disruption radius as a dashed boundary, and the star drawn
  // where the physics actually places it: stretched into a debris stream
  // right at the tidal radius when that boundary sits outside the
  // horizon (a real, observable disruption), or intact and disappearing
  // straight into the horizon when the tidal radius would sit *inside*
  // it (there is nothing to draw at the tidal radius in that case — the
  // star already crossed the horizon before tides could act).
  const diagram = useMemo(() => {
    if (!result.valid) return null;
    const maxM = Math.max(result.rtM, result.rsM) * 1.25;
    const maxPx = 100;
    const scale = maxPx / maxM;
    const rsPx = Math.max(3, result.rsM * scale);
    const rtPx = result.rtM * scale;
    const markerPx = result.swallowed ? rsPx : rtPx;
    const debrisCount = result.swallowed ? 0 : 5;

    return { rsPx, rtPx, markerPx, swallowed: result.swallowed, debrisCount };
  }, [result]);

  // --- r_t and r_s vs. black hole mass, log-log ---
  // r_t ∝ M_BH^(1/3) and r_s ∝ M_BH are both pure power laws (exponents
  // 1/3 and 1 respectively), hence straight lines in log-log space with
  // different slopes — they cross exactly once, at the derived
  // "swallowed whole" threshold mass for this star.
  const chart = useMemo(() => {
    if (!result.valid || !(result.crossMbhKg > 0)) return null;
    const { MstarKg, RstarM } = result;

    const rtAtLogMsun = (logMsun) => {
      const MbhKg = Math.pow(10, logMsun) * M_SUN;
      return Math.log10(radiusFromMeters(tidalDisruptionRadiusM(RstarM, MbhKg, MstarKg), "km"));
    };
    const rsAtLogMsun = (logMsun) => {
      const MbhKg = Math.pow(10, logMsun) * M_SUN;
      return Math.log10(radiusFromMeters(schwarzschildRadiusM(MbhKg), "km"));
    };

    const currentLogMsun = Math.log10(massFromKg(result.MbhKg, "msun"));
    const crossLogMsun = Math.log10(massFromKg(result.crossMbhKg, "msun"));
    const presetLogs = SCENARIO_PRESETS.map((p) => Math.log10(p.bhMassSolar));
    const allLogM = [currentLogMsun, crossLogMsun, ...presetLogs];
    const xPad = 1;
    const xMin = Math.min(...allLogM) - xPad;
    const xMax = Math.max(...allLogM) + xPad;

    const width = 640;
    const height = 320;
    const marginLeft = 66;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 40;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;

    const rtYMin = rtAtLogMsun(xMin);
    const rtYMax = rtAtLogMsun(xMax);
    const rsYMin = rsAtLogMsun(xMin);
    const rsYMax = rsAtLogMsun(xMax);
    const allY = [rtYMin, rtYMax, rsYMin, rsYMax];
    const yPad = (Math.max(...allY) - Math.min(...allY)) * 0.1;
    const yMin = Math.min(...allY) - yPad;
    const yMax = Math.max(...allY) + yPad;

    const xScale = (x) => marginLeft + ((x - xMin) / (xMax - xMin)) * plotWidth;
    const yScale = (y) => marginTop + (1 - (y - yMin) / (yMax - yMin)) * plotHeight;

    const xStep = xMax - xMin > 12 ? 3 : xMax - xMin > 6 ? 2 : 1;
    const yStep = yMax - yMin > 12 ? 3 : yMax - yMin > 6 ? 2 : 1;

    const crossY = rtAtLogMsun(crossLogMsun);

    return {
      width, height, marginLeft, marginRight, marginTop, marginBottom, plotWidth, plotHeight,
      xScale, yScale,
      xTicks: decadeTicks(xMin, xMax, xStep),
      yTicks: decadeTicks(yMin, yMax, yStep),
      rtLine: { x1: xScale(xMin), y1: yScale(rtYMin), x2: xScale(xMax), y2: yScale(rtYMax) },
      rsLine: { x1: xScale(xMin), y1: yScale(rsYMin), x2: xScale(xMax), y2: yScale(rsYMax) },
      crossover: { x: xScale(crossLogMsun), y: yScale(crossY) },
      point: { x: xScale(currentLogMsun), y: yScale(rtAtLogMsun(currentLogMsun)) },
    };
  }, [result]);

  // Self-check rows: runs the real tidalDisruption.js functions against
  // known reference figures and edge cases — independent of the fields above.
  const testRows = useMemo(() => getTidalDisruptionTestRows(), []);

  const applyStarPreset = (preset) => {
    setStarMass(String(preset.massSolar));
    setStarMassUnit("msun");
    setStarRadius(String(preset.radiusSolar));
    setStarRadiusUnit("rsun");
  };

  const applyScenarioPreset = (preset) => {
    setBhMass(String(preset.bhMassSolar));
    setBhMassUnit("msun");
    setStarMass(String(preset.starMassSolar));
    setStarMassUnit("msun");
    setStarRadius(String(preset.starRadiusSolar));
    setStarRadiusUnit("rsun");
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
    <div className="tdr" aria-label="Tidal disruption radius calculator">
      <div className="tdr-header">
        <p className="tdr-title">Tidal disruption radius calculator</p>
      </div>

      <div className="tdr-preset-group">
        <p className="tdr-preset-group-label">Black hole scenarios (Sun-like star)</p>
        <div className="tdr-presets">
          {SCENARIO_PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="tdr-preset-btn" onClick={() => applyScenarioPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tdr-preset-group">
        <p className="tdr-preset-group-label">Star type</p>
        <div className="tdr-presets">
          {STAR_PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="tdr-preset-btn" onClick={() => applyStarPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="tdr-explainer">
        The simple, non-relativistic tidal disruption radius:{" "}
        <Katex tex={String.raw`r_t = R_\star \left(\frac{M_{\rm BH}}{M_\star}\right)^{1/3}`} />.
        <br /><br />
        Because <Katex tex="r_t" /> grows only as the <strong>cube root</strong> of black hole mass while the
        Schwarzschild radius <Katex tex="r_s = 2GM_{\rm BH}/c^2" /> grows <strong>linearly</strong> with it, a
        massive enough black hole has <Katex tex="r_s > r_t" /> — the star is swallowed whole, crossing the
        event horizon before tidal forces ever get the chance to shred it. No debris stream forms outside the
        horizon, so no observable flare results.
      </p>

      <div className="tdr-fields">
        <div className="tdr-field">
          <label htmlFor="tdr-bh-mass">Black hole mass (<Katex tex="M_{\rm BH}" />)</label>
          <div className="tdr-input-row">
            <input id="tdr-bh-mass" className="tdr-input" type="number" min="0" step="any" inputMode="decimal" value={bhMass} onChange={(e) => setBhMass(e.target.value)} />
            <select className="tdr-unit-select" value={bhMassUnit} onChange={(e) => setBhMassUnit(e.target.value)} aria-label="Black hole mass unit">
              {MASS_UNIT_ORDER.map((u) => <option key={u} value={u}>{MASS_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
        <div className="tdr-field">
          <label htmlFor="tdr-star-mass">Star mass (<Katex tex="M_\star" />)</label>
          <div className="tdr-input-row">
            <input id="tdr-star-mass" className="tdr-input" type="number" min="0" step="any" inputMode="decimal" value={starMass} onChange={(e) => setStarMass(e.target.value)} />
            <select className="tdr-unit-select" value={starMassUnit} onChange={(e) => setStarMassUnit(e.target.value)} aria-label="Star mass unit">
              {MASS_UNIT_ORDER.map((u) => <option key={u} value={u}>{MASS_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
        <div className="tdr-field tdr-field--wide">
          <label htmlFor="tdr-star-radius">Star radius (<Katex tex="R_\star" />)</label>
          <div className="tdr-input-row">
            <input id="tdr-star-radius" className="tdr-input" type="number" min="0" step="any" inputMode="decimal" value={starRadius} onChange={(e) => setStarRadius(e.target.value)} />
            <select className="tdr-unit-select" value={starRadiusUnit} onChange={(e) => setStarRadiusUnit(e.target.value)} aria-label="Star radius unit">
              {RADIUS_UNIT_ORDER.map((u) => <option key={u} value={u}>{RADIUS_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!result.valid ? (
        <p className="tdr-note tdr-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="tdr-headline-card">
            <div className="tdr-headline">
              <Katex tex="r_t" /> ≈ {formatNumber(radiusFromMeters(result.rtM, "km"))} km · <Katex tex="r_s" /> ≈ {formatNumber(radiusFromMeters(result.rsM, "km"))} km
            </div>
            <div className="tdr-headline-sub">
              <Katex tex="r_t / r_s" /> ≈ {formatNumber(result.ratio)} · swallowed-whole threshold for this star ≈{" "}
              {formatNumber(massFromKg(result.crossMbhKg, "msun"))} M☉
            </div>
            <div className={result.swallowed ? "tdr-verdict tdr-verdict--swallowed" : "tdr-verdict tdr-verdict--flare"}>
              {result.swallowed
                ? "Swallowed whole — the tidal radius sits inside the event horizon, so no observable disruption flare is produced."
                : "Real, observable tidal disruption — the star is shredded outside the event horizon, producing a debris stream and flare."}
            </div>
          </div>

          {diagram && (
            <div className="chart-wrap">
              <svg
                className="tdr-diagram-svg"
                viewBox="0 0 240 240"
                role="img"
                aria-label={diagram.swallowed ? "Star swallowed whole inside the black hole's event horizon" : "Star stretched into debris at the tidal disruption radius, outside the event horizon"}
              >
                <circle cx="120" cy="120" r={diagram.rsPx} className="tdr-horizon-disk" />
                <circle cx="120" cy="120" r={diagram.rtPx} className="tdr-tidal-circle" />

                <g transform={`translate(120 ${120 - diagram.markerPx})`}>
                  <ellipse
                    rx="7"
                    ry={diagram.swallowed ? 6 : 16}
                    className={diagram.swallowed ? "tdr-star tdr-star--swallowed" : "tdr-star tdr-star--disrupted"}
                  />
                  {!diagram.swallowed && Array.from({ length: diagram.debrisCount }).map((_, i) => (
                    <circle
                      key={i}
                      cx={(i % 2 === 0 ? -1 : 1) * (6 + i * 3)}
                      cy={-14 - i * 6}
                      r={Math.max(1, 2.4 - i * 0.2)}
                      className="tdr-debris"
                    />
                  ))}
                </g>
              </svg>
              <p className="tdr-chart-caption">
                Dashed circle is the tidal disruption radius; the solid dark disk is the black hole's
                Schwarzschild radius (event horizon).{" "}
                {diagram.swallowed
                  ? "The tidal radius falls inside the horizon here, so the star is drawn disappearing intact into it."
                  : "The star is drawn stretched into debris right at the tidal radius, outside the horizon."}
              </p>
            </div>
          )}

          {chart && (
            <div className="chart-wrap">
              <svg
                className="tdr-curve-svg"
                viewBox={`0 0 ${chart.width} ${chart.height}`}
                role="img"
                aria-label="Log-log plot of tidal disruption radius and Schwarzschild radius versus black hole mass, crossing at the swallowed-whole threshold"
              >
                {chart.yTicks.map((t) => (
                  <g key={`y${t}`}>
                    <line x1={chart.marginLeft} x2={chart.marginLeft + chart.plotWidth} y1={chart.yScale(t)} y2={chart.yScale(t)} className="tdr-chart-gridline" />
                    <text x={chart.marginLeft - 8} y={chart.yScale(t) + 4} className="tdr-chart-axis-label" textAnchor="end">10{toSuperscript(t)} km</text>
                  </g>
                ))}
                {chart.xTicks.map((t) => (
                  <g key={`x${t}`}>
                    <line x1={chart.xScale(t)} x2={chart.xScale(t)} y1={chart.marginTop} y2={chart.marginTop + chart.plotHeight} className="tdr-chart-gridline" />
                    <text x={chart.xScale(t)} y={chart.height - 12} className="tdr-chart-axis-label" textAnchor="middle">10{toSuperscript(t)}</text>
                  </g>
                ))}
                <line x1={chart.marginLeft} x2={chart.marginLeft} y1={chart.marginTop} y2={chart.marginTop + chart.plotHeight} className="tdr-chart-axis-line" />
                <line x1={chart.marginLeft} x2={chart.marginLeft + chart.plotWidth} y1={chart.marginTop + chart.plotHeight} y2={chart.marginTop + chart.plotHeight} className="tdr-chart-axis-line" />

                <line x1={chart.rtLine.x1} y1={chart.rtLine.y1} x2={chart.rtLine.x2} y2={chart.rtLine.y2} className="tdr-chart-line-rt" />
                <line x1={chart.rsLine.x1} y1={chart.rsLine.y1} x2={chart.rsLine.x2} y2={chart.rsLine.y2} className="tdr-chart-line-rs" />

                <circle cx={chart.crossover.x} cy={chart.crossover.y} r="5" className="tdr-chart-crossover-point" />
                <text x={chart.crossover.x} y={chart.crossover.y - 10} className="tdr-chart-crossover-label" textAnchor="middle">swallowed-whole threshold</text>

                <circle cx={chart.point.x} cy={chart.point.y} r="6" className="tdr-chart-point" />
                <text x={chart.point.x} y={chart.point.y - 12} className="tdr-chart-axis-label" textAnchor="middle">this system</text>

                <g className="tdr-chart-legend">
                  <line x1={chart.marginLeft + 4} x2={chart.marginLeft + 22} y1={chart.marginTop + 10} y2={chart.marginTop + 10} className="tdr-chart-line-rt" />
                  <text x={chart.marginLeft + 28} y={chart.marginTop + 13} className="tdr-chart-legend-rt">tidal radius r_t</text>
                  <line x1={chart.marginLeft + 4} x2={chart.marginLeft + 22} y1={chart.marginTop + 24} y2={chart.marginTop + 24} className="tdr-chart-line-rs" />
                  <text x={chart.marginLeft + 28} y={chart.marginTop + 27} className="tdr-chart-legend-rs">Schwarzschild radius r_s</text>
                </g>

                <text x={chart.marginLeft + chart.plotWidth / 2} y={chart.height - 26} className="tdr-chart-axis-label" textAnchor="middle">black hole mass (M☉)</text>
              </svg>
              <p className="tdr-chart-caption">
                <Katex tex={String.raw`r_t \propto M_{\rm BH}^{1/3}`} /> and <Katex tex={String.raw`r_s \propto M_{\rm BH}`} /> are both straight
                lines in log-log space, with different slopes — the point where they cross is exactly the
                mass above which this star would be swallowed whole rather than tidally disrupted.
              </p>
            </div>
          )}
        </>
      )}

      <div className="tdr-footer-row">
        <CalculatorVote slug="tidal-disruption-radius-calculator" />
        <CalculatorTests
          title="Tidal Disruption Radius Calculator — Tests"
          columns={TIDAL_DISRUPTION_TEST_COLUMNS}
          rows={testRows}
          sources={TIDAL_DISRUPTION_TEST_SOURCES}
        />
        <button type="button" className="tdr-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
