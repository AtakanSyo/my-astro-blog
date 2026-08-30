import { useEffect, useMemo, useState } from "react";
import {
  STAR_RADIUS_UNITS,
  STAR_RADIUS_UNIT_ORDER,
  DISTANCE_UNITS,
  DISTANCE_UNIT_ORDER,
  TEMPERATURE_LANDMARKS,
  SOLAR_SYSTEM_LANDMARKS,
  starRadiusToMeters,
  distanceToMeters,
  stellarFlux,
  equilibriumTemperature,
  kelvinToCelsius,
} from "./equilibriumTemp";
import "../../../styles/exoplanetEquilibriumTemperatureCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";

// Every preset is a real (or realistically illustrative) star-planet
// pair, so switching the redistribution model after applying one always
// starts from a physically sensible baseline.
const PRESETS = [
  { label: "Earth", tStar: 5772, rStar: 1, rStarUnit: "rsun", a: 1, aUnit: "au", albedo: 0.3, redistribution: "full" },
  { label: "Venus", tStar: 5772, rStar: 1, rStarUnit: "rsun", a: 0.723, aUnit: "au", albedo: 0.75, redistribution: "full" },
  { label: "Mars", tStar: 5772, rStar: 1, rStarUnit: "rsun", a: 1.524, aUnit: "au", albedo: 0.25, redistribution: "full" },
  { label: "Hot Jupiter (HD 209458 b-like)", tStar: 6065, rStar: 1.2, rStarUnit: "rsun", a: 0.047, aUnit: "au", albedo: 0.1, redistribution: "dayside" },
  { label: "TRAPPIST-1e", tStar: 2566, rStar: 0.121, rStarUnit: "rsun", a: 0.02925, aUnit: "au", albedo: 0.3, redistribution: "full" },
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
function niceStep(span, targetCount = 6) {
  if (!(span > 0)) return 1;
  const raw = span / targetCount;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
  return step * mag;
}

// Astronomical blackbody-ish star color: hotter -> bluer.
function starColor(tStar) {
  if (tStar < 3700) return "#ff6b4a";
  if (tStar < 5200) return "#ffab5e";
  if (tStar < 6000) return "#fff4d1";
  if (tStar < 7500) return "#f5f7ff";
  return "#cdd9ff";
}
// Intuitive "how hot is this world" heat-map color: colder -> bluer.
function planetColor(tEq) {
  if (tEq < 200) return "#4a6bff";
  if (tEq < 260) return "#5ec9d9";
  if (tEq < 320) return "#7ee0a0";
  if (tEq < 500) return "#ffce5e";
  if (tEq < 1000) return "#ff7a4a";
  return "#fff4d1";
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const tStar = params.get("ts");
  if (tStar === null || !Number.isFinite(parseFloat(tStar))) return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  return {
    tStar,
    rStar: num("rs", "1"),
    rStarUnit: STAR_RADIUS_UNITS[params.get("rsu")] ? params.get("rsu") : "rsun",
    a: num("a", "1"),
    aUnit: DISTANCE_UNITS[params.get("au")] ? params.get("au") : "au",
    albedo: num("A", "0.3"),
    redistribution: params.get("red") === "dayside" ? "dayside" : "full",
  };
}

export default function ExoplanetEquilibriumTemperatureCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [tStar, setTStar] = useState("5772");
  const [rStar, setRStar] = useState("1");
  const [rStarUnit, setRStarUnit] = useState("rsun");
  const [a, setA] = useState("1");
  const [aUnit, setAUnit] = useState("au");
  const [albedo, setAlbedo] = useState("0.3");
  const [redistribution, setRedistribution] = useState("full");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setTStar(initial.tStar);
      setRStar(initial.rStar);
      setRStarUnit(initial.rStarUnit);
      setA(initial.a);
      setAUnit(initial.aUnit);
      setAlbedo(initial.albedo);
      setRedistribution(initial.redistribution);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("ts", tStar);
      params.set("rs", rStar);
      params.set("rsu", rStarUnit);
      params.set("a", a);
      params.set("au", aUnit);
      params.set("A", albedo);
      params.set("red", redistribution);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, tStar, rStar, rStarUnit, a, aUnit, albedo, redistribution]);

  const result = useMemo(() => {
    const tStarNum = parseFloat(tStar);
    const rStarNum = parseFloat(rStar);
    const aNum = parseFloat(a);
    const albedoNum = parseFloat(albedo) || 0;
    if (!(tStarNum > 0) || !(rStarNum > 0) || !(aNum > 0) || albedoNum < 0 || albedoNum >= 1) {
      return { valid: false, reason: "Enter a positive stellar temperature, stellar radius, and orbital distance, with a Bond albedo between 0 and 1." };
    }
    const rStarM = starRadiusToMeters(rStarNum, rStarUnit);
    const aM = distanceToMeters(aNum, aUnit);
    const flux = stellarFlux(tStarNum, rStarM, aM);
    const tEq = equilibriumTemperature(tStarNum, rStarM, aM, albedoNum, redistribution);
    return { valid: true, tStar: tStarNum, flux, tEq, tEqC: kelvinToCelsius(tEq) };
  }, [tStar, rStar, rStarUnit, a, aUnit, albedo, redistribution]);

  // --- star-planet diagram ---
  const diagram = useMemo(() => {
    if (!result.valid) return null;
    return { starHex: starColor(result.tStar), planetHex: planetColor(result.tEq) };
  }, [result]);

  // --- temperature gauge ---
  const gauge = useMemo(() => {
    if (!result.valid) return null;
    const allK = [...TEMPERATURE_LANDMARKS.map((l) => l.k), ...SOLAR_SYSTEM_LANDMARKS.map((l) => l.k), result.tEq];
    const domainMin = Math.min(0, Math.min(...allK) - 40);
    const domainMax = Math.max(...allK) * 1.15;
    const width = 640;
    const height = 210;
    const marginLeft = 26;
    const marginRight = 26;
    const yPhysical = 56;
    const ySolar = 118;
    const plotWidth = width - marginLeft - marginRight;
    const xScale = (k) => marginLeft + ((k - domainMin) / (domainMax - domainMin)) * plotWidth;
    const step = niceStep(domainMax - domainMin, 6);
    const ticks = [];
    for (let t = Math.ceil(domainMin / step) * step; t <= domainMax; t += step) ticks.push(Math.round(t / step) * step);

    return {
      width, height, marginLeft, plotWidth, yPhysical, ySolar, xScale, ticks,
      markerX: xScale(result.tEq),
      physicalLandmarks: TEMPERATURE_LANDMARKS.map((l) => ({ ...l, x: xScale(l.k) })),
      solarLandmarks: SOLAR_SYSTEM_LANDMARKS.map((l) => ({ ...l, x: xScale(l.k) })),
    };
  }, [result]);

  const applyPreset = (preset) => {
    setTStar(String(preset.tStar));
    setRStar(String(preset.rStar));
    setRStarUnit(preset.rStarUnit);
    setA(String(preset.a));
    setAUnit(preset.aUnit);
    setAlbedo(String(preset.albedo));
    setRedistribution(preset.redistribution);
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
    <div className="eet" aria-label="Exoplanet equilibrium temperature calculator">
      <div className="eet-header">
        <p className="eet-title">Equilibrium temperature calculator</p>
        <div className="eet-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="eet-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="eet-explainer">
        The temperature where absorbed starlight exactly balances emitted thermal radiation —
        ignoring internal heat and any atmospheric greenhouse effect:{" "}
        <code>T_eq = T★√(R★/2a)(1−A)^(1/4)</code> for full day-night heat redistribution. Earth's
        result (≈255 K, −18°C) sits noticeably below its real ≈288 K surface temperature — that gap
        is entirely the greenhouse effect, which this idealized model deliberately omits.
      </p>

      <div className="eet-fields">
        <div className="eet-field">
          <label htmlFor="eet-tstar">Star's effective temperature (T★)</label>
          <div className="eet-input-row">
            <input id="eet-tstar" className="eet-input" type="number" min="0" step="any" inputMode="decimal" value={tStar} onChange={(e) => setTStar(e.target.value)} />
            <span className="eet-static-unit">K</span>
          </div>
        </div>
        <div className="eet-field">
          <label htmlFor="eet-rstar">Stellar radius (R★)</label>
          <div className="eet-input-row">
            <input id="eet-rstar" className="eet-input" type="number" min="0" step="any" inputMode="decimal" value={rStar} onChange={(e) => setRStar(e.target.value)} />
            <select className="eet-unit-select" value={rStarUnit} onChange={(e) => setRStarUnit(e.target.value)}>
              {STAR_RADIUS_UNIT_ORDER.map((u) => <option key={u} value={u}>{STAR_RADIUS_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
        <div className="eet-field">
          <label htmlFor="eet-a">Orbital distance (a)</label>
          <div className="eet-input-row">
            <input id="eet-a" className="eet-input" type="number" min="0" step="any" inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} />
            <select className="eet-unit-select" value={aUnit} onChange={(e) => setAUnit(e.target.value)}>
              {DISTANCE_UNIT_ORDER.map((u) => <option key={u} value={u}>{DISTANCE_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
        <div className="eet-field">
          <label htmlFor="eet-albedo">Bond albedo (A) — optional</label>
          <input id="eet-albedo" className="eet-input" type="number" min="0" max="0.999" step="any" inputMode="decimal" value={albedo} onChange={(e) => setAlbedo(e.target.value)} />
        </div>
      </div>

      <div className="eet-mode-toggle" role="group" aria-label="Heat redistribution assumption">
        <button type="button" className={redistribution === "full" ? "eet-mode-btn active" : "eet-mode-btn"} onClick={() => setRedistribution("full")}>
          Full redistribution (day + night)
        </button>
        <button type="button" className={redistribution === "dayside" ? "eet-mode-btn active" : "eet-mode-btn"} onClick={() => setRedistribution("dayside")}>
          No redistribution (dayside only)
        </button>
      </div>

      {!result.valid ? (
        <p className="eet-note eet-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="eet-headline-card">
            <div className="eet-headline">T_eq ≈ {formatNumber(result.tEq, 1)} K = {formatNumber(result.tEqC, 1)} °C</div>
            <div className="eet-headline-sub">Absorbed stellar flux: {formatNumber(result.flux)} W/m² (Earth receives ≈1361 W/m²)</div>
          </div>

          {diagram && (
            <div className="eet-chart-wrap">
              <svg className="eet-diagram-svg" viewBox="0 0 640 200" role="img" aria-label={`Star at ${formatNumber(result.tStar,0)} kelvin, planet at equilibrium temperature ${formatNumber(result.tEq,0)} kelvin`}>
                <defs>
                  <radialGradient id="eet-star-gradient" cx="40%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="55%" stopColor={diagram.starHex} />
                    <stop offset="100%" stopColor={diagram.starHex} stopOpacity="0.75" />
                  </radialGradient>
                  <radialGradient id="eet-planet-gradient" cx="40%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
                    <stop offset="60%" stopColor={diagram.planetHex} />
                    <stop offset="100%" stopColor={diagram.planetHex} stopOpacity="0.85" />
                  </radialGradient>
                </defs>

                <circle cx="90" cy="100" r="52" fill="url(#eet-star-gradient)" />

                <line x1="150" y1="80" x2="440" y2="80" className="eet-ray-line" markerEnd="url(#eet-arrow-in)" />
                <text x="290" y="68" className="eet-ray-label" textAnchor="middle">absorbed starlight</text>

                <circle cx="480" cy="100" r="30" fill="url(#eet-planet-gradient)" />

                <line x1="500" y1="130" x2="540" y2="165" className="eet-ray-line eet-ray-line--out" />
                <line x1="480" y1="140" x2="480" y2="180" className="eet-ray-line eet-ray-line--out" />
                <line x1="460" y1="130" x2="420" y2="165" className="eet-ray-line eet-ray-line--out" />
                <text x="480" y="196" className="eet-ray-label eet-ray-label--out" textAnchor="middle">re-emitted thermal radiation</text>

                <defs>
                  <marker id="eet-arrow-in" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" className="eet-arrowhead" />
                  </marker>
                </defs>
              </svg>
              <p className="eet-chart-caption">
                Star colored by its actual effective temperature (hotter = bluer, in the real
                astronomical sense); planet colored by equilibrium temperature (colder = bluer, in
                the everyday "heat map" sense) — two different, deliberately distinct color scales.
              </p>
            </div>
          )}

          {gauge && (
            <div className="eet-chart-wrap">
              <svg className="eet-gauge-svg" viewBox={`0 0 ${gauge.width} ${gauge.height}`} role="img" aria-label={`Temperature gauge; this planet's equilibrium temperature is ${formatNumber(result.tEq,0)} kelvin`}>
                <line x1={gauge.marginLeft} x2={gauge.marginLeft + gauge.plotWidth} y1={gauge.yPhysical} y2={gauge.yPhysical} className="eet-gauge-axis" />
                {gauge.ticks.map((t) => (
                  <g key={t}>
                    <line x1={gauge.xScale(t)} x2={gauge.xScale(t)} y1={gauge.yPhysical - 4} y2={gauge.yPhysical + 4} className="eet-gauge-tick" />
                    <text x={gauge.xScale(t)} y={gauge.yPhysical + 18} className="eet-chart-axis-label" textAnchor="middle">{t} K</text>
                  </g>
                ))}
                {gauge.physicalLandmarks.map((lm) => (
                  <g key={lm.label}>
                    <line x1={lm.x} x2={lm.x} y1={gauge.yPhysical - 10} y2={gauge.yPhysical + 10} className="eet-landmark-tick" />
                    <text x={lm.x} y={gauge.yPhysical - 14} className="eet-landmark-label" textAnchor="middle">{lm.label}</text>
                  </g>
                ))}

                <line x1={gauge.marginLeft} x2={gauge.marginLeft + gauge.plotWidth} y1={gauge.ySolar} y2={gauge.ySolar} className="eet-gauge-axis" />
                {gauge.solarLandmarks.map((lm) => (
                  <g key={lm.label}>
                    <circle cx={lm.x} cy={gauge.ySolar} r="4" className="eet-planet-landmark" />
                    <text x={lm.x} y={gauge.ySolar + 20} className="eet-landmark-label" textAnchor="middle">{lm.label}</text>
                  </g>
                ))}

                <polygon points={`${gauge.markerX - 7},${(gauge.yPhysical + gauge.ySolar) / 2 - 8} ${gauge.markerX + 7},${(gauge.yPhysical + gauge.ySolar) / 2 - 8} ${gauge.markerX},${(gauge.yPhysical + gauge.ySolar) / 2 + 8}`} className="eet-gauge-marker" />
                <text x={gauge.markerX} y={(gauge.yPhysical + gauge.ySolar) / 2 - 12} className="eet-gauge-marker-label" textAnchor="middle">this planet</text>
              </svg>
              <p className="eet-chart-caption">
                Top row: familiar physical reference points. Bottom row: solar-system planets' own
                equilibrium temperatures (computed the same way, with the Sun) — fixed regardless of
                whatever star is entered above, for comparison.
              </p>
            </div>
          )}
        </>
      )}

      <div className="eet-footer-row">
        <CalculatorVote slug="exoplanet-equilibrium-temperature-calculator" />
        <button type="button" className="eet-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
