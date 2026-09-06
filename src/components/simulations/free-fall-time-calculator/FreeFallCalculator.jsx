import { useEffect, useMemo, useState } from "react";
import {
  MASS_DENSITY_UNITS,
  MASS_DENSITY_UNIT_ORDER,
  NUMBER_DENSITY_UNITS,
  NUMBER_DENSITY_UNIT_ORDER,
  TIME_UNITS,
  TIME_UNIT_ORDER,
  massDensityToKgM3,
  numberDensityToPerM3,
  numberDensityToMassDensity,
  freeFallTime,
  timeFromSeconds,
  bestTimeUnit,
  collapseCurve,
  radiusFractionAtTimeFraction,
} from "./freeFall";
import { FREE_FALL_TEST_COLUMNS, FREE_FALL_TEST_SOURCES, getFreeFallTestRows } from "./freeFallTests";
import "../../../styles/freeFallCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import CalculatorTests from "../../CalculatorTests.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";

// Every preset applies both an input mode and the fields that mode uses.
// The other mode's fields are left as whatever they already were — mass
// density and number density are just two alternate ways to specify the
// same one underlying quantity, and a solid body like Earth has no
// physically meaningful "mean molecular weight" to invent for it.
const PRESETS = [
  { label: "Diffuse molecular cloud", mode: "number", n: 100, nUnit: "percm3", mu: 2.3 },
  { label: "Typical GMC clump", mode: "number", n: 300, nUnit: "percm3", mu: 2.3 },
  { label: "Dense prestellar core", mode: "number", n: 1e5, nUnit: "percm3", mu: 2.3 },
  { label: "The Sun's mean density", mode: "mass", density: 1408, densityUnit: "kgm3" },
  { label: "Earth's mean density", mode: "mass", density: 5514, densityUnit: "kgm3" },
];

// Landmark points for the comparison ladder — same five presets, each
// resolved to its own free-fall time in seconds, so the ladder always
// shows exactly what the preset buttons above it would produce.
const LANDMARK_POINTS = PRESETS.map((p) => {
  const rhoKgM3 =
    p.mode === "number"
      ? numberDensityToMassDensity(numberDensityToPerM3(p.n, p.nUnit), p.mu)
      : massDensityToKgM3(p.density, p.densityUnit);
  return { label: p.label, seconds: freeFallTime(rhoKgM3) };
});

function trimTrailingZeros(s) {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}
const SUPERSCRIPT_MAP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
function toSuperscript(n) {
  return String(n).split("").map((ch) => SUPERSCRIPT_MAP[ch] ?? ch).join("");
}
function formatNumber(n, digits = 4) {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e6 || abs < 1e-3) {
    const exp = Math.floor(Math.log10(abs));
    const mantissa = n / Math.pow(10, exp);
    return `${trimTrailingZeros(mantissa.toFixed(digits))} × 10${toSuperscript(exp)}`;
  }
  if (abs >= 100) return trimTrailingZeros(n.toFixed(2));
  if (abs >= 1) return trimTrailingZeros(n.toFixed(digits));
  return trimTrailingZeros(n.toFixed(digits + 2));
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  if (mode !== "number" && mode !== "mass") return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    const parsed = raw === null ? NaN : parseFloat(raw);
    return Number.isFinite(parsed) ? String(parsed) : fallback;
  };
  return {
    mode,
    n: num("n", "100"),
    nUnit: NUMBER_DENSITY_UNITS[params.get("nu")] ? params.get("nu") : "percm3",
    mu: num("mu", "2.3"),
    density: num("d", "1408"),
    densityUnit: MASS_DENSITY_UNITS[params.get("du")] ? params.get("du") : "kgm3",
  };
}

export default function FreeFallCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [mode, setMode] = useState("number");
  const [n, setN] = useState("100");
  const [nUnit, setNUnit] = useState("percm3");
  const [mu, setMu] = useState("2.3");
  const [density, setDensity] = useState("1408");
  const [densityUnit, setDensityUnit] = useState("kgm3");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setMode(initial.mode);
      setN(initial.n);
      setNUnit(initial.nUnit);
      setMu(initial.mu);
      setDensity(initial.density);
      setDensityUnit(initial.densityUnit);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("mode", mode);
      params.set("n", n);
      params.set("nu", nUnit);
      params.set("mu", mu);
      params.set("d", density);
      params.set("du", densityUnit);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, mode, n, nUnit, mu, density, densityUnit]);

  const result = useMemo(() => {
    let rhoKgM3;
    if (mode === "number") {
      const nNum = parseFloat(n);
      const muNum = parseFloat(mu);
      if (!(nNum > 0) || !(muNum > 0)) {
        return { valid: false, reason: "Enter a positive number density and mean molecular weight." };
      }
      rhoKgM3 = numberDensityToMassDensity(numberDensityToPerM3(nNum, nUnit), muNum);
    } else {
      const dNum = parseFloat(density);
      if (!(dNum > 0)) return { valid: false, reason: "Enter a positive density." };
      rhoKgM3 = massDensityToKgM3(dNum, densityUnit);
    }
    const tff = freeFallTime(rhoKgM3);
    if (!Number.isFinite(tff)) return { valid: false, reason: "Enter a positive, finite density." };
    return { valid: true, rhoKgM3, tff };
  }, [mode, n, nUnit, mu, density, densityUnit]);

  const headlineUnit = result.valid ? bestTimeUnit(result.tff) : null;

  // --- collapse curve: the exact normalized r(t) trajectory ---
  const collapseDiagram = useMemo(() => {
    if (!result.valid) return null;
    const points = collapseCurve(48);
    const width = 640;
    const height = 260;
    const marginLeft = 46;
    const marginRight = 16;
    const marginTop = 14;
    const marginBottom = 38;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;
    const xAt = (tFrac) => marginLeft + tFrac * plotWidth;
    const yAt = (rFrac) => marginTop + (1 - rFrac) * plotHeight;

    const path = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${xAt(p.tFraction).toFixed(2)} ${yAt(p.rFraction).toFixed(2)}`)
      .join(" ");

    const markerTFraction = 0.5;
    const markerRFraction = radiusFractionAtTimeFraction(markerTFraction);
    const markerX = xAt(markerTFraction);
    const markerY = yAt(markerRFraction);

    const ticks = [0, 0.25, 0.5, 0.75, 1];
    return {
      width, height, marginLeft, marginBottom, plotWidth, plotHeight,
      path, xAt, yAt, ticks,
      markerX, markerY, markerRFraction,
    };
  }, [result]);

  // --- comparison ladder: this body's t_ff among the five presets, log scale ---
  const ladder = useMemo(() => {
    if (!result.valid) return null;
    const allSeconds = [...LANDMARK_POINTS.map((p) => p.seconds), result.tff];
    const logMax = Math.log10(Math.max(...allSeconds)) + 0.4;
    const logMin = Math.log10(Math.min(...allSeconds)) - 0.4;
    const width = 640;
    const height = 190;
    const marginLeft = 26;
    const marginRight = 26;
    const y = 76;
    const plotWidth = width - marginLeft - marginRight;
    const xScale = (logS) => marginLeft + ((logS - logMin) / (logMax - logMin)) * plotWidth;

    const ticks = [];
    for (let e10 = Math.ceil(logMin); e10 <= logMax; e10++) ticks.push(e10);

    return {
      width, height, marginLeft, plotWidth, y, xScale, ticks,
      markerX: xScale(Math.log10(result.tff)),
      landmarks: LANDMARK_POINTS.map((p) => ({ ...p, x: xScale(Math.log10(p.seconds)) })),
    };
  }, [result]);

  const applyPreset = (preset) => {
    setMode(preset.mode);
    if (preset.mode === "number") {
      setN(String(preset.n));
      setNUnit(preset.nUnit);
      setMu(String(preset.mu));
    } else {
      setDensity(String(preset.density));
      setDensityUnit(preset.densityUnit);
    }
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

  // Self-check rows: runs the real freeFall.js functions against cited
  // reference densities and edge cases — independent of the fields above.
  const testRows = useMemo(() => getFreeFallTestRows(), []);

  return (
    <div className="ffc" aria-label="Free-fall time calculator">
      <div className="ffc-header">
        <p className="ffc-title">Free-fall time calculator</p>
        <div className="ffc-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="ffc-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="ffc-explainer">
        How long a uniform-density sphere of gas would take to collapse to a point under its own
        gravity alone, with nothing — pressure, rotation, magnetic fields — holding it up:{" "}
        <code>t_ff = √(3π / 32Gρ)</code>. Widely used in star formation as the natural collapse
        timescale for a molecular cloud or clump, to compare against how long star formation
        actually takes there.
      </p>

      <div className="ffc-mode-toggle" role="group" aria-label="Density input mode">
        <button
          type="button"
          className={mode === "number" ? "ffc-mode-btn active" : "ffc-mode-btn"}
          onClick={() => setMode("number")}
        >
          Number density (cloud gas)
        </button>
        <button
          type="button"
          className={mode === "mass" ? "ffc-mode-btn active" : "ffc-mode-btn"}
          onClick={() => setMode("mass")}
        >
          Mass density
        </button>
      </div>

      <div className="ffc-fields">
        {mode === "number" ? (
          <>
            <div className="ffc-field">
              <label htmlFor="ffc-n">Number density (n)</label>
              <div className="ffc-input-row">
                <input
                  id="ffc-n"
                  className="ffc-input"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={n}
                  onChange={(e) => setN(e.target.value)}
                />
                <select className="ffc-unit-select" value={nUnit} onChange={(e) => setNUnit(e.target.value)}>
                  {NUMBER_DENSITY_UNIT_ORDER.map((u) => (
                    <option key={u} value={u}>{NUMBER_DENSITY_UNITS[u].short}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="ffc-field">
              <label htmlFor="ffc-mu">Mean molecular weight (μ) — 2.3 for molecular gas, 1.27 for atomic</label>
              <input
                id="ffc-mu"
                className="ffc-input"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={mu}
                onChange={(e) => setMu(e.target.value)}
              />
            </div>
          </>
        ) : (
          <div className="ffc-field">
            <label htmlFor="ffc-density">Mass density (ρ)</label>
            <div className="ffc-input-row">
              <input
                id="ffc-density"
                className="ffc-input"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={density}
                onChange={(e) => setDensity(e.target.value)}
              />
              <select className="ffc-unit-select" value={densityUnit} onChange={(e) => setDensityUnit(e.target.value)}>
                {MASS_DENSITY_UNIT_ORDER.map((u) => (
                  <option key={u} value={u}>{MASS_DENSITY_UNITS[u].short}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {!result.valid ? (
        <p className="ffc-note ffc-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="ffc-headline-card">
            <div className="ffc-headline">
              t_ff ≈ {formatNumber(timeFromSeconds(result.tff, headlineUnit))} {TIME_UNITS[headlineUnit].short}
            </div>
            <div className="ffc-headline-sub">
              ρ = {formatNumber(result.rhoKgM3)} kg/m³ = {formatNumber(result.rhoKgM3 / 1000)} g/cm³
            </div>
          </div>

          <div className="ffc-table" role="table" aria-label="Free-fall time in every unit">
            {TIME_UNIT_ORDER.map((key) => (
              <div className={key === headlineUnit ? "ffc-row ffc-row--active" : "ffc-row"} role="row" key={key}>
                <span className="ffc-row-label" role="cell">{TIME_UNITS[key].label}</span>
                <span className="ffc-row-value" role="cell">
                  {formatNumber(timeFromSeconds(result.tff, key))} <span className="ffc-row-unit">{TIME_UNITS[key].short}</span>
                </span>
              </div>
            ))}
          </div>

          {collapseDiagram && (
            <div className="ffc-chart-wrap">
              <svg
                className="ffc-chart-svg"
                viewBox={`0 0 ${collapseDiagram.width} ${collapseDiagram.height}`}
                role="img"
                aria-label={`Radius versus time as a uniform sphere of this density collapses, reaching the center at t_ff = ${formatNumber(timeFromSeconds(result.tff, headlineUnit))} ${TIME_UNITS[headlineUnit].short}`}
              >
                {collapseDiagram.ticks.map((frac) => (
                  <g key={`v${frac}`}>
                    <line
                      x1={collapseDiagram.xAt(frac)} x2={collapseDiagram.xAt(frac)}
                      y1={14} y2={collapseDiagram.height - collapseDiagram.marginBottom}
                      className="ffc-chart-grid"
                    />
                    <text
                      x={collapseDiagram.xAt(frac)} y={collapseDiagram.height - collapseDiagram.marginBottom + 16}
                      className="ffc-chart-axis-label" textAnchor="middle"
                    >
                      {formatNumber(timeFromSeconds(result.tff, headlineUnit) * frac, 2)}
                    </text>
                  </g>
                ))}
                <text
                  x={collapseDiagram.marginLeft + collapseDiagram.plotWidth / 2}
                  y={collapseDiagram.height - 4}
                  className="ffc-chart-axis-label" textAnchor="middle"
                >
                  elapsed time ({TIME_UNITS[headlineUnit].short})
                </text>

                {collapseDiagram.ticks.map((frac) => (
                  <text
                    key={`h${frac}`}
                    x={collapseDiagram.marginLeft - 8} y={collapseDiagram.yAt(frac) + 3}
                    className="ffc-chart-axis-label" textAnchor="end"
                  >
                    {Math.round(frac * 100)}%
                  </text>
                ))}
                <text
                  x={12} y={collapseDiagram.height / 2}
                  className="ffc-chart-axis-label"
                  transform={`rotate(-90 12 ${collapseDiagram.height / 2})`}
                  textAnchor="middle"
                >
                  radius (% of r₀)
                </text>

                <line
                  x1={collapseDiagram.marginLeft} y1={14}
                  x2={collapseDiagram.marginLeft} y2={collapseDiagram.height - collapseDiagram.marginBottom}
                  className="ffc-chart-axis"
                />
                <line
                  x1={collapseDiagram.marginLeft} y1={collapseDiagram.height - collapseDiagram.marginBottom}
                  x2={collapseDiagram.width - 16} y2={collapseDiagram.height - collapseDiagram.marginBottom}
                  className="ffc-chart-axis"
                />

                <path d={collapseDiagram.path} className="ffc-collapse-curve" />

                <line
                  x1={collapseDiagram.marginLeft} y1={collapseDiagram.markerY}
                  x2={collapseDiagram.markerX} y2={collapseDiagram.markerY}
                  className="ffc-collapse-marker-line"
                />
                <line
                  x1={collapseDiagram.markerX} y1={collapseDiagram.markerY}
                  x2={collapseDiagram.markerX} y2={collapseDiagram.height - collapseDiagram.marginBottom}
                  className="ffc-collapse-marker-line"
                />
                <circle cx={collapseDiagram.markerX} cy={collapseDiagram.markerY} r="4" className="ffc-collapse-marker" />
                <text x={collapseDiagram.markerX + 8} y={collapseDiagram.markerY - 8} className="ffc-collapse-marker-label">
                  {Math.round(collapseDiagram.markerRFraction * 100)}% of r₀ left at 50% of t_ff
                </text>
              </svg>
              <p className="ffc-chart-caption">
                The exact collapse trajectory of a uniform sphere's outer edge, normalized to its
                own r₀ and t_ff — the same shape for every density. Collapse starts slowly and
                plunges only right at the end: half of the total free-fall time passes before the
                radius has shrunk by even a sixth.
              </p>
            </div>
          )}

          {ladder && (
            <div className="ffc-chart-wrap">
              <svg className="ffc-chart-svg" viewBox={`0 0 ${ladder.width} ${ladder.height}`} role="img" aria-label="Free-fall time comparison scale">
                <line x1={ladder.marginLeft} x2={ladder.marginLeft + ladder.plotWidth} y1={ladder.y} y2={ladder.y} className="ffc-ladder-axis" />
                {ladder.ticks.map((t) => (
                  <g key={t}>
                    <line x1={ladder.xScale(t)} x2={ladder.xScale(t)} y1={ladder.y - 5} y2={ladder.y + 5} className="ffc-ladder-tick" />
                    <text x={ladder.xScale(t)} y={ladder.y + 20} className="ffc-chart-axis-label" textAnchor="middle">10{toSuperscript(t)} s</text>
                  </g>
                ))}
                {ladder.landmarks.map((lm) => (
                  <g key={lm.label}>
                    <line x1={lm.x} x2={lm.x} y1={ladder.y - 14} y2={ladder.y + 14} className="ffc-landmark-tick" />
                    <text x={lm.x} y={ladder.y + 40} className="ffc-landmark-label" textAnchor="middle">{lm.label}</text>
                  </g>
                ))}
                <polygon points={`${ladder.markerX - 7},${ladder.y - 26} ${ladder.markerX + 7},${ladder.y - 26} ${ladder.markerX},${ladder.y - 10}`} className="ffc-ladder-marker" />
                <text x={ladder.markerX} y={ladder.y - 31} className="ffc-ladder-marker-label" textAnchor="middle">this density</text>
              </svg>
              <p className="ffc-chart-caption">
                Log scale — free-fall time spans upward of ten orders of magnitude across these
                presets alone, from a rocky planet's density (minutes) to a diffuse molecular
                cloud's (millions of years).
              </p>
            </div>
          )}
        </>
      )}

      <div className="ffc-footer-row">
        <CalculatorVote slug="free-fall-time-calculator" />
        <CalculatorTests
          title="Free-Fall Time Calculator — Tests"
          columns={FREE_FALL_TEST_COLUMNS}
          rows={testRows}
          sources={FREE_FALL_TEST_SOURCES}
        />
        <button type="button" className="ffc-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
