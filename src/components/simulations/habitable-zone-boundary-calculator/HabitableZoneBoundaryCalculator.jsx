import { useEffect, useMemo, useState } from "react";
import {
  conservativeHZ,
  optimisticHZ,
  classifyOrbit,
  isWithinCalibratedRange,
  luminosityFromRadiusTeff,
  KOPPARAPU_TEFF_MIN,
  KOPPARAPU_TEFF_MAX,
} from "./habitableZone";
import { HABITABLE_ZONE_TEST_COLUMNS, HABITABLE_ZONE_TEST_SOURCES, getHabitableZoneTestRows } from "./habitableZoneTests";
import "../../../styles/habitableZoneBoundaryCalculator.css";
import "../../../styles/calculators.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import CalculatorTests from "../../CalculatorTests.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";
import Katex from "../../Katex.jsx";

// Every preset is a real (or realistically illustrative) star, with a
// candidate orbital distance chosen to land somewhere meaningful in or
// around its zone, so switching presets always starts from a physically
// sensible baseline.
const PRESETS = [
  { label: "The Sun, with Earth's orbit", teff: 5778, lumMode: "direct", luminosity: 1, radius: 1, orbitDistance: 1 },
  { label: "Hot F-type star (Teff ≈ 7000 K)", teff: 7000, lumMode: "derived", luminosity: 4.24, radius: 1.4, orbitDistance: 2.5 },
  { label: "TRAPPIST-1, with planet e's orbit", teff: 2566, lumMode: "direct", luminosity: 0.000553, radius: 0.121, orbitDistance: 0.02925 },
];

function trimTrailingZeros(s) {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}
const SUPERSCRIPT_MAP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
function toSuperscript(n) {
  return String(n).split("").map((ch) => SUPERSCRIPT_MAP[ch] ?? ch).join("");
}
function formatNumber(n, digits = 3) {
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e5 || abs < 1e-3) {
    const exp = Math.floor(Math.log10(abs));
    const mantissa = n / Math.pow(10, exp);
    return `${trimTrailingZeros(mantissa.toFixed(digits))} × 10${toSuperscript(exp)}`;
  }
  if (abs >= 100) return trimTrailingZeros(n.toFixed(1));
  if (abs >= 1) return trimTrailingZeros(n.toFixed(digits));
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

// Astronomical blackbody-ish star color: hotter -> bluer (same convention
// as the exoplanet equilibrium temperature calculator).
function starColor(teff) {
  if (teff < 3700) return "#ff6b4a";
  if (teff < 5200) return "#ffab5e";
  if (teff < 6000) return "#fff4d1";
  if (teff < 7500) return "#f5f7ff";
  return "#cdd9ff";
}

const ZONE_LABELS = {
  "too-hot": "Too close — likely too hot for surface liquid water",
  "optimistic-inner": "Warm marginal zone — inside the optimistic HZ only (Recent Venus criterion)",
  "in-conservative": "Inside the conservative habitable zone",
  "optimistic-outer": "Cold marginal zone — inside the optimistic HZ only (Early Mars criterion)",
  "too-cold": "Too far — likely too cold for surface liquid water",
};
function zoneColor(zone) {
  switch (zone) {
    case "in-conservative":
      return "#5ce0a0";
    case "optimistic-inner":
    case "optimistic-outer":
      return "#ffd479";
    case "too-hot":
      return "#ff8a7e";
    case "too-cold":
      return "#7ec8ff";
    default:
      return "#cfd6e6";
  }
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const teff = params.get("T");
  if (teff === null || !Number.isFinite(parseFloat(teff))) return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  return {
    teff,
    lumMode: params.get("lm") === "derived" ? "derived" : "direct",
    luminosity: num("L", "1"),
    radius: num("R", "1"),
    orbitDistance: params.get("a") ?? "1",
  };
}

export default function HabitableZoneBoundaryCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [teff, setTeff] = useState("5778");
  const [lumMode, setLumMode] = useState("direct");
  const [luminosity, setLuminosity] = useState("1");
  const [radius, setRadius] = useState("1");
  const [orbitDistance, setOrbitDistance] = useState("1");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setTeff(initial.teff);
      setLumMode(initial.lumMode);
      setLuminosity(initial.luminosity);
      setRadius(initial.radius);
      setOrbitDistance(initial.orbitDistance);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("T", teff);
      params.set("lm", lumMode);
      params.set("L", luminosity);
      params.set("R", radius);
      if (orbitDistance) params.set("a", orbitDistance);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, teff, lumMode, luminosity, radius, orbitDistance]);

  const result = useMemo(() => {
    const teffNum = parseFloat(teff);
    let lumNum;
    if (lumMode === "derived") {
      const rNum = parseFloat(radius);
      lumNum = Number.isFinite(rNum) && rNum > 0 && teffNum > 0 ? luminosityFromRadiusTeff(rNum, teffNum) : NaN;
    } else {
      lumNum = parseFloat(luminosity);
    }
    if (!(teffNum > 0) || !(lumNum > 0)) {
      return {
        valid: false,
        reason:
          lumMode === "derived"
            ? "Enter a positive stellar effective temperature and a positive stellar radius."
            : "Enter a positive stellar effective temperature and a positive luminosity.",
      };
    }

    const orbitNum = parseFloat(orbitDistance);
    const hasOrbit = orbitDistance.trim() !== "" && Number.isFinite(orbitNum) && orbitNum > 0;

    const cons = conservativeHZ(teffNum, lumNum);
    const opt = optimisticHZ(teffNum, lumNum);
    const zone = hasOrbit ? classifyOrbit(orbitNum, cons, opt) : null;

    return {
      valid: true,
      teff: teffNum,
      luminosity: lumNum,
      cons,
      opt,
      hasOrbit,
      orbit: hasOrbit ? orbitNum : null,
      zone,
      calibrated: isWithinCalibratedRange(teffNum),
    };
  }, [teff, lumMode, luminosity, radius, orbitDistance]);

  // --- orbital diagram ---
  // Star at the center; the optimistic HZ drawn as a wide, lighter band,
  // the conservative HZ as a narrower, more saturated band nested inside
  // it (by the boundaries' own definitions, conservative always sits
  // inside optimistic); the candidate planet's orbit drawn as a dashed
  // circle at its actual scaled distance, colored by which zone it falls
  // into.
  const diagram = useMemo(() => {
    if (!result.valid) return null;
    const relevant = [result.opt.outer, result.hasOrbit ? result.orbit : 0].filter((v) => Number.isFinite(v) && v > 0);
    const maxAU = Math.max(...relevant) * 1.15;
    const maxPx = 100;
    const scale = (au) => Math.min(maxPx, Math.max(0, (au / maxAU) * maxPx));
    return {
      starHex: starColor(result.teff),
      optInnerPx: scale(result.opt.inner),
      optOuterPx: scale(result.opt.outer),
      consInnerPx: scale(result.cons.inner),
      consOuterPx: scale(result.cons.outer),
      orbitPx: result.hasOrbit ? scale(result.orbit) : null,
      markerColor: zoneColor(result.zone),
    };
  }, [result]);

  // --- HZ boundary distance vs. stellar temperature ---
  // Sweeps Teff across (at least) Kopparapu's own calibrated 2600-7200 K
  // range, holding the current luminosity fixed, to show how both HZ
  // bands shift for hotter/cooler stars — plotted on a log distance axis
  // since the span can cover several orders of magnitude (an M dwarf's
  // HZ vs. an F star's, for instance).
  const sweep = useMemo(() => {
    if (!result.valid) return null;
    const lum = result.luminosity;
    const tDomainMin = Math.min(KOPPARAPU_TEFF_MIN, result.teff - 200);
    const tDomainMax = Math.max(KOPPARAPU_TEFF_MAX, result.teff + 200);
    const steps = 40;
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const t = tDomainMin + (i / steps) * (tDomainMax - tDomainMin);
      const cons = conservativeHZ(t, lum);
      const opt = optimisticHZ(t, lum);
      points.push({ t, consInner: cons.inner, consOuter: cons.outer, optInner: opt.inner, optOuter: opt.outer });
    }
    const allY = points.flatMap((p) => [p.consInner, p.consOuter, p.optInner, p.optOuter]).filter((v) => Number.isFinite(v) && v > 0);
    if (allY.length === 0) return null;

    const width = 640;
    const height = 300;
    const marginLeft = 66;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 40;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;

    const yLogMin = Math.log10(Math.min(...allY)) - 0.12;
    const yLogMax = Math.log10(Math.max(...allY)) + 0.12;

    const xScale = (t) => roundSvg(marginLeft + ((t - tDomainMin) / (tDomainMax - tDomainMin)) * plotWidth);
    const yScale = (au) => roundSvg(marginTop + (1 - (Math.log10(au) - yLogMin) / (yLogMax - yLogMin)) * plotHeight);

    const bandPolygon = (innerKey, outerKey) => {
      const top = points.map((p) => `${xScale(p.t)},${yScale(p[outerKey])}`);
      const bottom = [...points].reverse().map((p) => `${xScale(p.t)},${yScale(p[innerKey])}`);
      return [...top, ...bottom].join(" ");
    };

    const xStep = niceStep(tDomainMax - tDomainMin, 5);
    const xTicks = [];
    for (let t = Math.ceil(tDomainMin / xStep) * xStep; t <= tDomainMax; t += xStep) xTicks.push(Math.round(t / xStep) * xStep);
    const yStep = niceStep(yLogMax - yLogMin, 4);
    const yTicks = [];
    for (let t = Math.ceil(yLogMin / yStep) * yStep; t <= yLogMax; t += yStep) yTicks.push(Math.round(t / yStep) * yStep);

    return {
      width, height, marginLeft, marginRight, marginTop, marginBottom, plotWidth, plotHeight,
      xScale, yScale, xTicks, yTicks,
      optimisticBand: bandPolygon("optInner", "optOuter"),
      conservativeBand: bandPolygon("consInner", "consOuter"),
      calibratedX1: xScale(KOPPARAPU_TEFF_MIN),
      calibratedX2: xScale(KOPPARAPU_TEFF_MAX),
      markerX: xScale(result.teff),
    };
  }, [result]);

  // Self-check rows: runs the real habitableZone.js functions against
  // published reference figures and edge cases — independent of the
  // fields above.
  const testRows = useMemo(() => getHabitableZoneTestRows(), []);

  const applyPreset = (preset) => {
    setTeff(String(preset.teff));
    setLumMode(preset.lumMode);
    setLuminosity(String(preset.luminosity));
    setRadius(String(preset.radius));
    setOrbitDistance(String(preset.orbitDistance));
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
    <div className="hzb" aria-label="Habitable zone boundary calculator">
      <div className="hzb-header">
        <p className="hzb-title">Habitable zone boundary calculator</p>
        <div className="hzb-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="hzb-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="hzb-explainer">
        Computed with the empirical fit from Kopparapu et al. (2013): a normalized effective solar
        flux at each boundary,{" "}
        <Katex tex={String.raw`S_{\rm eff} = S_{\rm eff\odot} + aT_\star + bT_\star^2 + cT_\star^3 + dT_\star^4`} />, where{" "}
        <Katex tex={String.raw`T_\star = T_{\rm eff} - 5780\,{\rm K}`} />, converted to a distance via{" "}
        <Katex tex={String.raw`d = \sqrt{L / S_{\rm eff}}`} /> (AU, with <Katex tex="L" /> in solar luminosities).
        <br /><br />
        The <strong>conservative</strong> zone (Runaway Greenhouse inner edge, Maximum Greenhouse outer edge) is
        the narrower, higher-confidence habitable zone; the <strong>optimistic</strong> zone (Recent Venus inner
        edge, Early Mars outer edge) is a wider, more liberal estimate.
      </p>

      <div className="hzb-mode-toggle" role="group" aria-label="Luminosity input mode">
        <button type="button" className={lumMode === "direct" ? "hzb-mode-btn active" : "hzb-mode-btn"} onClick={() => setLumMode("direct")}>
          Enter luminosity directly
        </button>
        <button type="button" className={lumMode === "derived" ? "hzb-mode-btn active" : "hzb-mode-btn"} onClick={() => setLumMode("derived")}>
          Derive from radius + Teff
        </button>
      </div>

      <div className="hzb-fields">
        <div className="hzb-field">
          <label htmlFor="hzb-teff">Stellar effective temperature (<Katex tex="T_{\rm eff}" />)</label>
          <div className="hzb-input-row">
            <input id="hzb-teff" className="hzb-input" type="number" min="0" step="any" inputMode="decimal" value={teff} onChange={(e) => setTeff(e.target.value)} />
            <span className="hzb-static-unit">K</span>
          </div>
        </div>

        {lumMode === "direct" ? (
          <div className="hzb-field">
            <label htmlFor="hzb-lum">Stellar luminosity (<Katex tex="L" />)</label>
            <div className="hzb-input-row">
              <input id="hzb-lum" className="hzb-input" type="number" min="0" step="any" inputMode="decimal" value={luminosity} onChange={(e) => setLuminosity(e.target.value)} />
              <span className="hzb-static-unit">L☉</span>
            </div>
          </div>
        ) : (
          <div className="hzb-field">
            <label htmlFor="hzb-radius">Stellar radius (<Katex tex="R_\star" />)</label>
            <div className="hzb-input-row">
              <input id="hzb-radius" className="hzb-input" type="number" min="0" step="any" inputMode="decimal" value={radius} onChange={(e) => setRadius(e.target.value)} />
              <span className="hzb-static-unit">R☉</span>
            </div>
          </div>
        )}

        <div className="hzb-field">
          <label htmlFor="hzb-orbit">Candidate planet's orbital distance — optional</label>
          <div className="hzb-input-row">
            <input id="hzb-orbit" className="hzb-input" type="number" min="0" step="any" inputMode="decimal" placeholder="leave blank to skip" value={orbitDistance} onChange={(e) => setOrbitDistance(e.target.value)} />
            <span className="hzb-static-unit">AU</span>
          </div>
        </div>
      </div>

      {!result.valid ? (
        <p className="hzb-note hzb-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          {!result.calibrated && (
            <p className="hzb-note hzb-note--warn">
              {formatNumber(result.teff, 0)} K is outside Kopparapu et al. (2013)'s own calibrated fit range
              ({KOPPARAPU_TEFF_MIN}-{KOPPARAPU_TEFF_MAX} K) — the boundaries below are a small extrapolation
              beyond the published range, not a formal prediction. This is a commonly-accepted extrapolation
              for very cool M dwarfs like TRAPPIST-1, whose real Teff (~2566 K) sits just below the floor.
            </p>
          )}

          <div className="hzb-headline-card">
            <div className="hzb-headline">
              Conservative HZ ≈ {formatNumber(result.cons.inner)}-{formatNumber(result.cons.outer)} AU
            </div>
            <div className="hzb-headline-sub">
              Optimistic HZ ≈ {formatNumber(result.opt.inner)}-{formatNumber(result.opt.outer)} AU · L = {formatNumber(result.luminosity)} L☉
            </div>
            {result.hasOrbit && (
              <div
                className={
                  result.zone === "in-conservative"
                    ? "hzb-headline-compare hzb-headline-compare--safe"
                    : result.zone === "optimistic-inner" || result.zone === "optimistic-outer"
                    ? "hzb-headline-compare hzb-headline-compare--marginal"
                    : "hzb-headline-compare hzb-headline-compare--danger"
                }
              >
                A planet at {formatNumber(result.orbit)} AU: {ZONE_LABELS[result.zone]}.
              </div>
            )}
          </div>

          {diagram && (
            <div className="chart-wrap">
              <svg
                className="hzb-diagram-svg"
                viewBox="0 0 240 240"
                role="img"
                aria-label={result.hasOrbit ? `Planet at ${formatNumber(result.orbit)} AU: ${ZONE_LABELS[result.zone]}` : "Habitable zone bands around the star"}
              >
                <circle cx="120" cy="120" r={(diagram.optInnerPx + diagram.optOuterPx) / 2} fill="none" strokeWidth={Math.max(0, diagram.optOuterPx - diagram.optInnerPx)} className="hzb-optimistic-band" />
                <circle cx="120" cy="120" r={(diagram.consInnerPx + diagram.consOuterPx) / 2} fill="none" strokeWidth={Math.max(0, diagram.consOuterPx - diagram.consInnerPx)} className="hzb-conservative-band" />

                {diagram.orbitPx !== null && (
                  <circle cx="120" cy="120" r={diagram.orbitPx} className="hzb-orbit-circle" />
                )}

                <circle cx="120" cy="120" r="7" fill={diagram.starHex} className="hzb-star" />

                {diagram.orbitPx !== null && (
                  <circle cx={120 + diagram.orbitPx} cy="120" r="5" fill={diagram.markerColor} className="hzb-planet-marker" />
                )}
              </svg>
              <p className="hzb-chart-caption">
                Lighter outer band: optimistic HZ. Darker inner band: conservative HZ.{" "}
                {result.hasOrbit
                  ? "Dashed circle and dot: the candidate planet's orbit, colored by which zone it falls into."
                  : "Enter a candidate orbital distance above to plot a planet."}
              </p>
            </div>
          )}

          {sweep && (
            <div className="chart-wrap">
              <svg
                className="hzb-sweep-svg"
                viewBox={`0 0 ${sweep.width} ${sweep.height}`}
                role="img"
                aria-label="Habitable zone inner and outer distance versus stellar effective temperature, at the current luminosity"
              >
                {sweep.yTicks.map((t) => (
                  <g key={`y${t}`}>
                    <line x1={sweep.marginLeft} x2={sweep.marginLeft + sweep.plotWidth} y1={sweep.yScale(Math.pow(10, t))} y2={sweep.yScale(Math.pow(10, t))} className="hzb-chart-gridline" />
                    <text x={sweep.marginLeft - 8} y={sweep.yScale(Math.pow(10, t)) + 4} className="hzb-chart-axis-label" textAnchor="end">10{toSuperscript(Number(t.toFixed(2)))} AU</text>
                  </g>
                ))}
                {sweep.xTicks.map((t) => (
                  <g key={`x${t}`}>
                    <line x1={sweep.xScale(t)} x2={sweep.xScale(t)} y1={sweep.marginTop} y2={sweep.marginTop + sweep.plotHeight} className="hzb-chart-gridline" />
                    <text x={sweep.xScale(t)} y={sweep.height - 12} className="hzb-chart-axis-label" textAnchor="middle">{t} K</text>
                  </g>
                ))}
                <line x1={sweep.marginLeft} x2={sweep.marginLeft} y1={sweep.marginTop} y2={sweep.marginTop + sweep.plotHeight} className="hzb-chart-axis-line" />
                <line x1={sweep.marginLeft} x2={sweep.marginLeft + sweep.plotWidth} y1={sweep.marginTop + sweep.plotHeight} y2={sweep.marginTop + sweep.plotHeight} className="hzb-chart-axis-line" />

                <line x1={sweep.calibratedX1} x2={sweep.calibratedX1} y1={sweep.marginTop} y2={sweep.marginTop + sweep.plotHeight} className="hzb-calibration-line" />
                <line x1={sweep.calibratedX2} x2={sweep.calibratedX2} y1={sweep.marginTop} y2={sweep.marginTop + sweep.plotHeight} className="hzb-calibration-line" />

                <polygon points={sweep.optimisticBand} className="hzb-sweep-optimistic-fill" />
                <polygon points={sweep.conservativeBand} className="hzb-sweep-conservative-fill" />

                <line x1={sweep.markerX} x2={sweep.markerX} y1={sweep.marginTop} y2={sweep.marginTop + sweep.plotHeight} className="hzb-sweep-marker-line" />
                <text x={sweep.markerX} y={sweep.marginTop - 6} className="hzb-chart-point-label" textAnchor="middle">this star</text>

                <text x={sweep.marginLeft + sweep.plotWidth / 2} y={sweep.height - 26} className="hzb-chart-axis-label" textAnchor="middle">stellar effective temperature (K)</text>
              </svg>
              <p className="hzb-chart-caption">
                Both bands computed at the current luminosity ({formatNumber(result.luminosity)} L☉), held fixed
                across the sweep — real main-sequence stars also get more luminous as they get hotter, which
                pushes their actual habitable zones out much farther than this fixed-luminosity view alone
                shows. Dashed vertical lines mark Kopparapu et al. (2013)'s own calibrated 2600-7200 K range.
              </p>
            </div>
          )}
        </>
      )}

      <div className="hzb-footer-row">
        <CalculatorVote slug="habitable-zone-boundary-calculator" />
        <CalculatorTests
          title="Habitable Zone Boundary Calculator — Tests"
          columns={HABITABLE_ZONE_TEST_COLUMNS}
          rows={testRows}
          sources={HABITABLE_ZONE_TEST_SOURCES}
        />
        <button type="button" className="hzb-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
