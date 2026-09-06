import { useEffect, useMemo, useState } from "react";
import {
  MASS_UNITS,
  MASS_UNIT_ORDER,
  RADIUS_UNITS,
  RADIUS_UNIT_ORDER,
  WAVELENGTH_UNITS,
  WAVELENGTH_UNIT_ORDER,
  massToKg,
  radiusToMeters,
  wavelengthToMeters,
  wavelengthFromMeters,
  schwarzschildRadiusM,
  gravitationalRedshift,
  redshiftFactorBetween,
  observedWavelength,
  naiveEquivalentVelocity,
} from "./gravitationalRedshift";
import {
  GRAVITATIONAL_REDSHIFT_TEST_COLUMNS,
  GRAVITATIONAL_REDSHIFT_TEST_SOURCES,
  getGravitationalRedshiftTestRows,
} from "./gravitationalRedshiftTests";
import "../../../styles/gravitationalRedshiftCalculator.css";
import "../../../styles/calculators.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import CalculatorTests from "../../CalculatorTests.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";
import Katex from "../../Katex.jsx";

// Every preset is a real (or realistically illustrative) mass + radius
// pair, and doubles as a permanent landmark on the z-vs-radius chart
// below, plotted whether or not it's the applied preset.
const PRESETS = [
  { label: "The Sun's surface", mass: 1, massUnit: "msun", radius: 1, radiusUnit: "rsun" },
  { label: "White dwarf (Sirius B-like)", mass: 1.02, massUnit: "msun", radius: 5846, radiusUnit: "km" },
  { label: "Neutron star", mass: 1.4, massUnit: "msun", radius: 10, radiusUnit: "km" },
  { label: "Photon sphere (R = 1.5 r_s)", mass: 10, massUnit: "msun", radius: 44.300, radiusUnit: "km" },
  { label: "Just outside a black hole (R = 1.01 r_s)", mass: 10, massUnit: "msun", radius: 29.829, radiusUnit: "km" },
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
  if (n >= 1e5 || n < 1e-3) {
    const exp = Math.floor(Math.log10(n));
    const mantissa = n / Math.pow(10, exp);
    return `${trimTrailingZeros(mantissa.toFixed(digits))} × 10${toSuperscript(exp)}`;
  }
  if (n >= 100) return trimTrailingZeros(n.toFixed(1));
  if (n >= 1) return trimTrailingZeros(n.toFixed(digits));
  return trimTrailingZeros(n.toFixed(digits + 2));
}

const LANDMARK_POINTS = PRESETS.map((p) => {
  const massKg = massToKg(p.mass, p.massUnit);
  const rs = schwarzschildRadiusM(massKg);
  const radiusM = radiusToMeters(p.radius, p.radiusUnit);
  const z = gravitationalRedshift(massKg, radiusM);
  return { label: p.label, ratio: radiusM / rs, z };
}).filter((p) => p.z !== null && p.z > 0);

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const mass = params.get("m");
  if (mass === null || !Number.isFinite(parseFloat(mass))) return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  return {
    mass,
    massUnit: MASS_UNITS[params.get("mu")] ? params.get("mu") : "msun",
    radius: num("r", "1"),
    radiusUnit: RADIUS_UNITS[params.get("ru")] ? params.get("ru") : "rsun",
    lambdaEmit: params.get("le") ?? "550",
    lambdaEmitUnit: WAVELENGTH_UNITS[params.get("leu")] ? params.get("leu") : "nm",
  };
}

export default function GravitationalRedshiftCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [mass, setMass] = useState("1");
  const [massUnit, setMassUnit] = useState("msun");
  const [radius, setRadius] = useState("1");
  const [radiusUnit, setRadiusUnit] = useState("rsun");
  const [lambdaEmit, setLambdaEmit] = useState("550");
  const [lambdaEmitUnit, setLambdaEmitUnit] = useState("nm");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setMass(initial.mass);
      setMassUnit(initial.massUnit);
      setRadius(initial.radius);
      setRadiusUnit(initial.radiusUnit);
      setLambdaEmit(initial.lambdaEmit);
      setLambdaEmitUnit(initial.lambdaEmitUnit);
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
      if (lambdaEmit) params.set("le", lambdaEmit);
      params.set("leu", lambdaEmitUnit);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, mass, massUnit, radius, radiusUnit, lambdaEmit, lambdaEmitUnit]);

  const result = useMemo(() => {
    const massNum = parseFloat(mass);
    const radiusNum = parseFloat(radius);
    if (!(massNum > 0) || !(radiusNum > 0)) {
      return { valid: false, reason: "Enter a positive mass and radius." };
    }
    const massKg = massToKg(massNum, massUnit);
    const radiusM = radiusToMeters(radiusNum, radiusUnit);
    const rs = schwarzschildRadiusM(massKg);
    if (!(radiusM > rs)) {
      return {
        valid: false,
        insideHorizon: true,
        rs,
        reason: `That radius (${formatNumber(radiusM / 1000)} km) is at or inside the Schwarzschild radius (${formatNumber(rs / 1000)} km) for this mass. There's no escaping light for this formula to describe there — every future light-cone points inward.`,
      };
    }
    const z = gravitationalRedshift(massKg, radiusM);

    const lambdaNum = parseFloat(lambdaEmit);
    const hasLambda = lambdaEmit.trim() !== "" && Number.isFinite(lambdaNum) && lambdaNum > 0;
    let lambdaObsM = null;
    if (hasLambda) {
      const lambdaEmitM = wavelengthToMeters(lambdaNum, lambdaEmitUnit);
      lambdaObsM = observedWavelength(lambdaEmitM, z);
    }

    return { valid: true, massKg, radiusM, rs, z, ratio: radiusM / rs, hasLambda, lambdaObsM, naiveV: naiveEquivalentVelocity(z) };
  }, [mass, massUnit, radius, radiusUnit, lambdaEmit, lambdaEmitUnit]);

  // --- climbing-photon diagram ---
  // A continuously-stretching sine wave from the surface out to "far
  // away" — the local wavelength at each point is the REAL redshift
  // factor accumulated between the surface and that radius (not just
  // an illustrative before/after jump), sampled log-uniformly in r/R
  // out to 50R, by which point the stretching has essentially finished
  // for anything but a near-horizon case.
  const photonDiagram = useMemo(() => {
    if (!result.valid) return null;
    const { massKg, radiusM } = result;
    const width = 640;
    const height = 160;
    const marginLeft = 50;
    const marginRight = 50;
    const centerY = 80;
    const plotWidth = width - marginLeft - marginRight;
    const baseWavelengthPx = 14;
    const N = 400;
    const rMax = radiusM * 50;

    let phase = 0;
    const points = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const r = radiusM * Math.pow(rMax / radiusM, t);
      const factor = redshiftFactorBetween(massKg, radiusM, r) ?? 1;
      const localWavelengthPx = baseWavelengthPx * factor;
      const x = marginLeft + t * plotWidth;
      if (i > 0) {
        const dx = plotWidth / N;
        phase += (dx / localWavelengthPx) * 2 * Math.PI;
      }
      const amplitude = 16 * Math.max(0.15, 1 - t * 0.5);
      points.push(`${x},${centerY + amplitude * Math.sin(phase)}`);
    }

    return { width, height, marginLeft, marginRight, plotWidth, centerY, points: points.join(" ") };
  }, [result]);

  // --- z vs. R/r_s curve ---
  // Log-log plot of redshift against distance in units of the
  // Schwarzschild radius — diverging as R approaches r_s, which is
  // exactly the point: there is no finite redshift for light escaping
  // from arbitrarily close to (let alone at or inside) the horizon.
  const curve = useMemo(() => {
    if (!result.valid) return null;
    const { massKg, ratio } = result;
    const xMin = 0; // log10(R/rs) = 0 means R = rs
    const xMax = Math.max(6, Math.log10(ratio) + 0.6);
    const N = 200;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const logRatio = xMin + ((xMax - xMin) * i) / N;
      const r = Math.pow(10, logRatio); // in units of r_s
      const z = Math.pow(1 - 1 / r, -0.5) - 1;
      if (Number.isFinite(z) && z > 0) pts.push({ x: logRatio, y: Math.log10(z) });
    }
    const yVals = pts.map((p) => p.y);
    const yMin = Math.min(...yVals);
    const yMax = Math.max(...yVals);

    const width = 640;
    const height = 300;
    const marginLeft = 60;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 40;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;
    const xScale = (x) => marginLeft + ((x - xMin) / (xMax - xMin)) * plotWidth;
    const yScale = (y) => marginTop + (1 - (y - yMin) / (yMax - yMin)) * plotHeight;

    const linePoints = pts.map((p) => `${xScale(p.x)},${yScale(p.y)}`).join(" ");

    const decadeTicks = (lo, hi) => {
      const ticks = [];
      for (let e = Math.ceil(lo); e <= hi; e++) ticks.push(e);
      return ticks;
    };

    return {
      width, height, marginLeft, marginRight, marginTop, marginBottom, plotWidth, plotHeight,
      xScale, yScale, linePoints,
      point: { x: xScale(Math.log10(ratio)), y: yScale(Math.log10(result.z)) },
      landmarks: LANDMARK_POINTS.map((lm) => ({
        ...lm,
        x: xScale(Math.log10(lm.ratio)),
        y: yScale(Math.log10(lm.z)),
      })),
      xTicks: decadeTicks(xMin, xMax),
      yTicks: decadeTicks(yMin, yMax),
    };
  }, [result]);

  // Self-check rows: runs the real gravitationalRedshift.js functions
  // against known reference bodies and edge cases — independent of the
  // fields above.
  const testRows = useMemo(() => getGravitationalRedshiftTestRows(), []);

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
    <div className="grc" aria-label="Gravitational redshift calculator">
      <div className="grc-header">
        <p className="grc-title">Gravitational redshift calculator</p>
        <div className="grc-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="grc-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="grc-explainer">
        Light climbing out of a mass's gravity well loses energy on the way out — pure general
        relativity, no motion required:{" "}
        <Katex tex={String.raw`z = \left(1 - \frac{r_s}{R}\right)^{-1/2} - 1`} />, <Katex tex="r_s = 2GM/c^2" />. This assumes a{" "}
        <strong>spherical, non-rotating mass</strong> and a static emitter/observer. It's only
        defined for R &gt; r_s — at or inside the Schwarzschild radius, there's no escaping light
        left for this formula to describe.
      </p>

      <div className="grc-fields">
        <div className="grc-field">
          <label htmlFor="grc-mass">Mass (<Katex tex="M" />)</label>
          <div className="grc-input-row">
            <input id="grc-mass" className="grc-input" type="number" min="0" step="any" inputMode="decimal" value={mass} onChange={(e) => setMass(e.target.value)} />
            <select className="grc-unit-select" value={massUnit} onChange={(e) => setMassUnit(e.target.value)}>
              {MASS_UNIT_ORDER.map((u) => <option key={u} value={u}>{MASS_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
        <div className="grc-field">
          <label htmlFor="grc-radius">Emission radius (<Katex tex="R" />)</label>
          <div className="grc-input-row">
            <input id="grc-radius" className="grc-input" type="number" min="0" step="any" inputMode="decimal" value={radius} onChange={(e) => setRadius(e.target.value)} />
            <select className="grc-unit-select" value={radiusUnit} onChange={(e) => setRadiusUnit(e.target.value)}>
              {RADIUS_UNIT_ORDER.map((u) => <option key={u} value={u}>{RADIUS_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
        <div className="grc-field">
          <label htmlFor="grc-lambda">Emitted wavelength (<Katex tex="\lambda" />) — optional</label>
          <div className="grc-input-row">
            <input id="grc-lambda" className="grc-input" type="number" min="0" step="any" inputMode="decimal" placeholder="leave blank to skip" value={lambdaEmit} onChange={(e) => setLambdaEmit(e.target.value)} />
            <select className="grc-unit-select" value={lambdaEmitUnit} onChange={(e) => setLambdaEmitUnit(e.target.value)}>
              {WAVELENGTH_UNIT_ORDER.map((u) => <option key={u} value={u}>{WAVELENGTH_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!result.valid ? (
        <p className="grc-note grc-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="grc-headline-card">
            <div className="grc-headline"><Katex tex="z" /> ≈ {formatNumber(result.z, 4)}</div>
            <div className="grc-headline-sub">
              <Katex tex="R" /> = {formatNumber(result.ratio)}× the Schwarzschild radius ({formatNumber(result.rs / 1000)} km)
              {result.hasLambda && (
                <> · <Katex tex="\lambda_{\rm obs}" /> ≈ {formatNumber(wavelengthFromMeters(result.lambdaObsM, lambdaEmitUnit))} {WAVELENGTH_UNITS[lambdaEmitUnit].short}</>
              )}
            </div>
            <div className="grc-headline-note">
              If this redshift were (wrongly) attributed to velocity alone, it would suggest ≈{" "}
              {formatNumber(result.naiveV / 1000)} km/s — but no motion is involved here at all.
            </div>
          </div>

          {photonDiagram && (
            <div className="chart-wrap">
              <svg className="grc-photon-svg" viewBox={`0 0 ${photonDiagram.width} ${photonDiagram.height}`} role="img" aria-label={`A photon's wavelength stretching by a factor of ${formatNumber(1 + result.z)} as it climbs from the surface to a distant observer`}>
                <defs>
                  <radialGradient id="grc-body-gradient" cx="35%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#ffe9b0" />
                    <stop offset="60%" stopColor="#ff9d4d" />
                    <stop offset="100%" stopColor="#7a3d1a" />
                  </radialGradient>
                </defs>
                <circle cx={photonDiagram.marginLeft} cy={photonDiagram.centerY} r="22" fill="url(#grc-body-gradient)" />
                <polyline points={photonDiagram.points} className="grc-photon-wave" />
                <text x={photonDiagram.marginLeft} y={photonDiagram.height - 8} className="grc-chart-axis-label" textAnchor="middle">surface</text>
                <text x={photonDiagram.width - photonDiagram.marginRight} y={photonDiagram.height - 8} className="grc-chart-axis-label" textAnchor="middle">far-away observer</text>
              </svg>
              <p className="grc-chart-caption">
                A photon's wavelength stretches continuously as it climbs outward — shown here to
                the real, computed redshift factor (<Katex tex="1+z" /> ≈ {formatNumber(1 + result.z)}) at each
                point along the way, on a log scale of distance from the surface.
              </p>
            </div>
          )}

          {curve && (
            <div className="chart-wrap">
              <svg className="grc-curve-svg" viewBox={`0 0 ${curve.width} ${curve.height}`} role="img" aria-label="Log-log plot of gravitational redshift versus distance in units of the Schwarzschild radius, diverging at the horizon">
                {curve.yTicks.map((t) => (
                  <g key={`y${t}`}>
                    <line x1={curve.marginLeft} x2={curve.marginLeft + curve.plotWidth} y1={curve.yScale(t)} y2={curve.yScale(t)} className="grc-chart-gridline" />
                    <text x={curve.marginLeft - 8} y={curve.yScale(t) + 4} className="grc-chart-axis-label" textAnchor="end">10{toSuperscript(t)}</text>
                  </g>
                ))}
                {curve.xTicks.map((t) => (
                  <g key={`x${t}`}>
                    <line x1={curve.xScale(t)} x2={curve.xScale(t)} y1={curve.marginTop} y2={curve.marginTop + curve.plotHeight} className="grc-chart-gridline" />
                    <text x={curve.xScale(t)} y={curve.height - 12} className="grc-chart-axis-label" textAnchor="middle">10{toSuperscript(t)} r_s</text>
                  </g>
                ))}
                <line x1={curve.marginLeft} x2={curve.marginLeft} y1={curve.marginTop} y2={curve.marginTop + curve.plotHeight} className="grc-chart-axis-line" />
                <line x1={curve.marginLeft} x2={curve.marginLeft + curve.plotWidth} y1={curve.marginTop + curve.plotHeight} y2={curve.marginTop + curve.plotHeight} className="grc-chart-axis-line" />

                <polyline points={curve.linePoints} className="grc-curve-line" />

                {curve.landmarks.map((lm) => (
                  <circle key={lm.label} cx={lm.x} cy={lm.y} r="3.5" className="grc-chart-landmark" />
                ))}

                <circle cx={curve.point.x} cy={curve.point.y} r="6" className="grc-chart-point" />
                <text x={curve.point.x} y={curve.point.y - 12} className="grc-chart-point-label" textAnchor="middle">this case</text>
              </svg>
              <p className="grc-chart-caption">
                <Katex tex="z" /> diverges to infinity as <Katex tex="R \to r_s" /> (left edge) — there is no finite redshift for
                light escaping from arbitrarily close to the horizon, let alone from at or inside it.
              </p>
            </div>
          )}
        </>
      )}

      <div className="grc-footer-row">
        <CalculatorVote slug="gravitational-redshift-calculator" />
        <CalculatorTests
          title="Gravitational Redshift Calculator — Tests"
          columns={GRAVITATIONAL_REDSHIFT_TEST_COLUMNS}
          rows={testRows}
          sources={GRAVITATIONAL_REDSHIFT_TEST_SOURCES}
        />
        <button type="button" className="grc-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
