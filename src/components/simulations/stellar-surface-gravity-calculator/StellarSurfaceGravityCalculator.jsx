import { useEffect, useMemo, useState } from "react";
import {
  MASS_UNITS,
  MASS_UNIT_ORDER,
  RADIUS_UNITS,
  RADIUS_UNIT_ORDER,
  M_SUN,
  R_SUN,
  LOG_G_SUN,
  massToKg,
  radiusToMeters,
  surfaceGravitySI,
  surfaceGravityCGS,
  logG,
  classifyLogG,
} from "./stellarGravity";
import "../../../styles/stellarSurfaceGravityCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";

// Every preset doubles as a permanent landmark on both charts below,
// plotted whether or not it's the one currently applied.
const PRESETS = [
  { label: "The Sun", mass: 1, massUnit: "msun", radius: 1, radiusUnit: "rsun" },
  { label: "Red giant", mass: 1.16, massUnit: "msun", radius: 44, radiusUnit: "rsun" },
  { label: "Red supergiant (Betelgeuse-like)", mass: 16.5, massUnit: "msun", radius: 764, radiusUnit: "rsun" },
  { label: "White dwarf (Sirius B-like)", mass: 1.02, massUnit: "msun", radius: 0.0084, radiusUnit: "rsun" },
  { label: "Neutron star", mass: 1.4, massUnit: "msun", radius: 10, radiusUnit: "km" },
];

const LANDMARK_POINTS = PRESETS.map((p) => {
  const massKg = massToKg(p.mass, p.massUnit);
  const radiusM = radiusToMeters(p.radius, p.radiusUnit);
  const logg = logG(surfaceGravityCGS(surfaceGravitySI(massKg, radiusM)));
  return {
    label: p.label,
    logM: Math.log10(massKg / M_SUN),
    logR: Math.log10(radiusM / R_SUN),
    logg,
  };
});

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
  if (n >= 1e5 || n < 1e-3) {
    const exp = Math.floor(Math.log10(n));
    const mantissa = n / Math.pow(10, exp);
    return `${trimTrailingZeros(mantissa.toFixed(digits))} × 10${toSuperscript(exp)}`;
  }
  if (n >= 100) return trimTrailingZeros(n.toFixed(1));
  if (n >= 1) return trimTrailingZeros(n.toFixed(digits));
  return trimTrailingZeros(n.toFixed(digits + 2));
}
function formatSigned(n, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  const v = Object.is(n, -0) ? 0 : n;
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)}`;
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const m = params.get("m");
  if (m === null || !Number.isFinite(parseFloat(m))) return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  return {
    mass: m,
    massUnit: MASS_UNITS[params.get("mu")] ? params.get("mu") : "msun",
    radius: num("r", "1"),
    radiusUnit: RADIUS_UNITS[params.get("ru")] ? params.get("ru") : "rsun",
  };
}

export default function StellarSurfaceGravityCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [mass, setMass] = useState("1");
  const [massUnit, setMassUnit] = useState("msun");
  const [radius, setRadius] = useState("1");
  const [radiusUnit, setRadiusUnit] = useState("rsun");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setMass(initial.mass);
      setMassUnit(initial.massUnit);
      setRadius(initial.radius);
      setRadiusUnit(initial.radiusUnit);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("m", mass);
      params.set("mu", massUnit);
      params.set("r", radius);
      params.set("ru", radiusUnit);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, mass, massUnit, radius, radiusUnit]);

  const result = useMemo(() => {
    const M = parseFloat(mass);
    const R = parseFloat(radius);
    if (!(M > 0) || !(R > 0)) return { valid: false, reason: "Enter a positive mass and radius." };
    const massKg = massToKg(M, massUnit);
    const radiusM = radiusToMeters(R, radiusUnit);
    const gSI = surfaceGravitySI(massKg, radiusM);
    const gCGS = surfaceGravityCGS(gSI);
    const logg = logG(gCGS);
    return {
      valid: true, massKg, radiusM, gSI, gCGS, logg,
      classification: classifyLogG(logg),
      logM: Math.log10(massKg / M_SUN),
      logR: Math.log10(radiusM / R_SUN),
    };
  }, [mass, massUnit, radius, radiusUnit]);

  // --- log g ladder ---
  // A fixed scale from log g = -1 to 15, colored by the same rough
  // classification bins used for the headline badge, with every preset
  // plotted as a permanent landmark alongside the current value.
  const ladder = useMemo(() => {
    if (!result.valid) return null;
    const domainMin = -1;
    const domainMax = 15;
    const width = 640;
    const height = 190;
    const marginLeft = 26;
    const marginRight = 26;
    const y = 70;
    const plotWidth = width - marginLeft - marginRight;
    const xScale = (lg) => marginLeft + ((Math.max(domainMin, Math.min(domainMax, lg)) - domainMin) / (domainMax - domainMin)) * plotWidth;

    const zones = [
      { from: domainMin, to: 0.5, cls: "ssg-zone--supergiant" },
      { from: 0.5, to: 3.0, cls: "ssg-zone--giant" },
      { from: 3.0, to: 5.5, cls: "ssg-zone--dwarf" },
      { from: 5.5, to: 9.0, cls: "ssg-zone--wd" },
      { from: 9.0, to: domainMax, cls: "ssg-zone--ns" },
    ].map((z) => ({ x1: xScale(z.from), x2: xScale(z.to), cls: z.cls }));

    const ticks = [];
    for (let e = domainMin; e <= domainMax; e += 2) ticks.push(e);

    return {
      width, height, marginLeft, plotWidth, y, xScale, zones, ticks,
      landmarks: LANDMARK_POINTS.map((p) => ({ ...p, x: xScale(p.logg) })),
      markerX: xScale(result.logg),
    };
  }, [result]);

  // --- mass-radius diagram with iso-g lines ---
  // g/g_sun = (M/Msun)/(R/Rsun)^2 exactly, so a line of constant log g in
  // log(M)-log(R) space has slope 1/2 — this draws several such lines so
  // the current star's position relative to the whole dwarf/giant/white
  // dwarf/neutron star landscape is visible at a glance, the same way
  // the mass-luminosity relation charts elsewhere on this site work.
  const chart = useMemo(() => {
    if (!result.valid) return null;
    const allLogM = [...LANDMARK_POINTS.map((p) => p.logM), result.logM];
    const allLogR = [...LANDMARK_POINTS.map((p) => p.logR), result.logR];
    const xPad = 0.6;
    const yPad = 0.6;
    const xMin = Math.min(...allLogM) - xPad;
    const xMax = Math.max(...allLogM) + xPad;
    const yMin = Math.min(...allLogR) - yPad;
    const yMax = Math.max(...allLogR) + yPad;

    const width = 640;
    const height = 340;
    const marginLeft = 60;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 40;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;
    const xScale = (x) => marginLeft + ((x - xMin) / (xMax - xMin)) * plotWidth;
    const yScale = (y) => marginTop + (1 - (y - yMin) / (yMax - yMin)) * plotHeight;

    // logR = (LOG_G_SUN + logM - logg) / 2
    const isoGLines = [0, 2, 4, 6, 8, 10, 12, 14].map((lg) => {
      const rAt = (m) => (LOG_G_SUN + m - lg) / 2;
      return { logg: lg, x1: xScale(xMin), y1: yScale(rAt(xMin)), x2: xScale(xMax), y2: yScale(rAt(xMax)) };
    });

    const decadeTicks = (lo, hi) => {
      const ticks = [];
      for (let e = Math.ceil(lo); e <= hi; e++) ticks.push(e);
      return ticks;
    };

    return {
      width, height, marginLeft, marginRight, marginTop, marginBottom, plotWidth, plotHeight,
      xScale, yScale, isoGLines,
      point: { x: xScale(result.logM), y: yScale(result.logR) },
      landmarks: LANDMARK_POINTS.map((p) => ({ ...p, x: xScale(p.logM), y: yScale(p.logR) })),
      xTicks: decadeTicks(xMin, xMax),
      yTicks: decadeTicks(yMin, yMax),
    };
  }, [result]);

  const applyPreset = (preset) => {
    setMass(String(preset.mass));
    setMassUnit(preset.massUnit);
    setRadius(String(preset.radius));
    setRadiusUnit(preset.radiusUnit);
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
    <div className="ssg" aria-label="Stellar surface gravity and log g calculator">
      <div className="ssg-header">
        <p className="ssg-title">Surface gravity / log g calculator</p>
        <div className="ssg-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="ssg-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="ssg-explainer">
        Surface gravity <code>g = GM/R²</code> is almost always quoted as{" "}
        <strong>log g</strong> — the base-10 logarithm of g in cgs units (cm/s²) — because it spans
        such a huge range across stellar types. The Sun: g ≈ 2.74 × 10⁴ cm/s², log g ≈ 4.44. Giants
        and supergiants have enormous radii and correspondingly tiny log g; compact remnants
        (white dwarfs, neutron stars) have minuscule radii and enormous log g.
      </p>

      <div className="ssg-fields">
        <div className="ssg-field">
          <label htmlFor="ssg-mass">Mass (M)</label>
          <div className="ssg-input-row">
            <input id="ssg-mass" className="ssg-input" type="number" min="0" step="any" inputMode="decimal" value={mass} onChange={(e) => setMass(e.target.value)} />
            <select className="ssg-unit-select" value={massUnit} onChange={(e) => setMassUnit(e.target.value)}>
              {MASS_UNIT_ORDER.map((u) => <option key={u} value={u}>{MASS_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
        <div className="ssg-field">
          <label htmlFor="ssg-radius">Radius (R)</label>
          <div className="ssg-input-row">
            <input id="ssg-radius" className="ssg-input" type="number" min="0" step="any" inputMode="decimal" value={radius} onChange={(e) => setRadius(e.target.value)} />
            <select className="ssg-unit-select" value={radiusUnit} onChange={(e) => setRadiusUnit(e.target.value)}>
              {RADIUS_UNIT_ORDER.map((u) => <option key={u} value={u}>{RADIUS_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!result.valid ? (
        <p className="ssg-note ssg-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="ssg-headline-card">
            <div className="ssg-headline">
              log g ≈ {formatSigned(result.logg)}
              {result.classification && (
                <span className={`ssg-badge ssg-badge--${result.classification.tone}`}>{result.classification.label}</span>
              )}
            </div>
            <div className="ssg-headline-sub">
              g = {formatNumber(result.gCGS)} cm/s² = {formatNumber(result.gSI)} m/s² ·{" "}
              {formatNumber(result.gSI / 9.80665)}× Earth's surface gravity
            </div>
          </div>

          {ladder && (
            <div className="ssg-chart-wrap">
              <svg
                className="ssg-ladder-svg"
                viewBox={`0 0 ${ladder.width} ${ladder.height}`}
                role="img"
                aria-label={`Log g scale from -1 to 15; this star's log g is ${formatSigned(result.logg)}`}
              >
                {ladder.zones.map((z, i) => (
                  <rect key={i} x={z.x1} y={ladder.y - 11} width={Math.max(0, z.x2 - z.x1)} height="22" className={z.cls} />
                ))}
                {ladder.ticks.map((t) => (
                  <g key={t}>
                    <line x1={ladder.xScale(t)} x2={ladder.xScale(t)} y1={ladder.y - 11} y2={ladder.y + 11} className="ssg-ladder-tick" />
                    <text x={ladder.xScale(t)} y={ladder.y + 28} className="ssg-chart-axis-label" textAnchor="middle">{t}</text>
                  </g>
                ))}

                {ladder.landmarks.map((lm) => (
                  <g key={lm.label}>
                    <line x1={lm.x} x2={lm.x} y1={ladder.y - 20} y2={ladder.y + 20} className="ssg-landmark-tick" />
                    <text x={lm.x} y={ladder.y + 44} className="ssg-landmark-label" textAnchor="middle">{lm.label}</text>
                  </g>
                ))}

                <polygon
                  points={`${ladder.markerX - 7},${ladder.y - 28} ${ladder.markerX + 7},${ladder.y - 28} ${ladder.markerX},${ladder.y - 12}`}
                  className="ssg-ladder-marker"
                />
                <text x={ladder.markerX} y={ladder.y - 33} className="ssg-ladder-marker-label" textAnchor="middle">this star</text>
              </svg>
              <p className="ssg-chart-caption">
                Supergiant → giant → dwarf → white dwarf → neutron star, left to right — a rough
                guide, not a substitute for spectroscopic luminosity classification.
              </p>
            </div>
          )}

          {chart && (
            <div className="ssg-chart-wrap">
              <svg
                className="ssg-mr-svg"
                viewBox={`0 0 ${chart.width} ${chart.height}`}
                role="img"
                aria-label="Mass-radius diagram with lines of constant log g"
              >
                {chart.xTicks.map((e) => (
                  <g key={`x${e}`}>
                    <line x1={chart.xScale(e)} x2={chart.xScale(e)} y1={chart.marginTop} y2={chart.marginTop + chart.plotHeight} className="ssg-chart-gridline" />
                    <text x={chart.xScale(e)} y={chart.height - 12} className="ssg-chart-axis-label" textAnchor="middle">10{toSuperscript(e)} M☉</text>
                  </g>
                ))}
                {chart.yTicks.map((e) => (
                  <g key={`y${e}`}>
                    <line x1={chart.marginLeft} x2={chart.marginLeft + chart.plotWidth} y1={chart.yScale(e)} y2={chart.yScale(e)} className="ssg-chart-gridline" />
                    <text x={chart.marginLeft - 8} y={chart.yScale(e) + 4} className="ssg-chart-axis-label" textAnchor="end">10{toSuperscript(e)} R☉</text>
                  </g>
                ))}
                <line x1={chart.marginLeft} x2={chart.marginLeft} y1={chart.marginTop} y2={chart.marginTop + chart.plotHeight} className="ssg-chart-axis-line" />
                <line x1={chart.marginLeft} x2={chart.marginLeft + chart.plotWidth} y1={chart.marginTop + chart.plotHeight} y2={chart.marginTop + chart.plotHeight} className="ssg-chart-axis-line" />

                {chart.isoGLines.map((l) => (
                  <g key={l.logg}>
                    <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} className="ssg-isog-line" />
                    <text x={l.x2 - 4} y={l.y2 - 4} className="ssg-isog-label" textAnchor="end">log g={l.logg}</text>
                  </g>
                ))}

                {chart.landmarks.map((lm) => (
                  <g key={lm.label}>
                    <circle cx={lm.x} cy={lm.y} r="4" className="ssg-chart-landmark" />
                    <text x={lm.x} y={lm.y - 8} className="ssg-chart-landmark-label" textAnchor="middle">{lm.label}</text>
                  </g>
                ))}

                <circle cx={chart.point.x} cy={chart.point.y} r="6" className="ssg-chart-point" />
              </svg>
              <p className="ssg-chart-caption">
                Diagonal lines mark constant log g (each has slope ½ in this log-log space, since
                g ∝ M/R²). Where a star sits relative to them is its log g, read directly off the
                chart.
              </p>
            </div>
          )}
        </>
      )}

      <div className="ssg-footer-row">
        <CalculatorVote slug="stellar-surface-gravity-calculator" />
        <button type="button" className="ssg-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
