import { useEffect, useMemo, useState } from "react";
import {
  PARALLAX_UNITS,
  PARALLAX_UNIT_ORDER,
  DISTANCE_UNITS,
  DISTANCE_UNIT_ORDER,
  parallaxToArcsec,
  arcsecToParallax,
  distanceToMeters,
  metersToDistance,
  distancePcFromParallaxArcsec,
  parallaxArcsecFromDistancePc,
  parallaxReliability,
} from "./parallax";
import { PARALLAX_DISTANCE_TEST_COLUMNS, PARALLAX_DISTANCE_TEST_SOURCES, getParallaxDistanceTestRows } from "./parallaxTests";
import "../../../styles/parallaxDistanceCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import CalculatorTests from "../../CalculatorTests.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";
import Katex from "../../Katex.jsx";

const PRESETS = [
  { label: "Proxima Centauri", pMas: 768.5, sigmaMas: "" },
  { label: "Barnard's Star", pMas: 546.98, sigmaMas: "" },
  { label: "Hypothetical 1 mas star", pMas: 1, sigmaMas: "" },
  { label: "Distant, uncertain star (Gaia-faint)", pMas: 0.5, sigmaMas: "0.3" },
];

function trimTrailingZeros(s) {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}
const SUPERSCRIPT_MAP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
function toSuperscript(n) {
  return String(n).split("").map((ch) => SUPERSCRIPT_MAP[ch] ?? ch).join("");
}
function formatValue(n) {
  if (!Number.isFinite(n) || n <= 0) return "";
  const abs = Math.abs(n);
  if (abs >= 1e6 || abs < 1e-3) {
    const exp = Math.floor(Math.log10(abs));
    const mantissa = n / Math.pow(10, exp);
    return `${trimTrailingZeros(mantissa.toFixed(4))}e${exp}`;
  }
  if (abs >= 100) return trimTrailingZeros(n.toFixed(2));
  if (abs >= 1) return trimTrailingZeros(n.toFixed(4));
  return trimTrailingZeros(n.toFixed(6));
}
function formatDisplay(n) {
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

// Log-scaled slider, matching the blackbody generator's temperature slider —
// parallax spans four decades across the tool's realistic range (0.1 mas
// to 1″), far too wide for a linear control to be usable.
const SLIDER_STEPS = 1000;
const LOG_P_MIN = -4; // 0.1 mas
const LOG_P_MAX = 0; // 1″
function posFromParallaxArcsec(pArcsec) {
  const clamped = Math.min(Math.pow(10, LOG_P_MAX), Math.max(Math.pow(10, LOG_P_MIN), pArcsec));
  return ((Math.log10(clamped) - LOG_P_MIN) / (LOG_P_MAX - LOG_P_MIN)) * SLIDER_STEPS;
}
function parallaxArcsecFromPos(pos) {
  const frac = pos / SLIDER_STEPS;
  return Math.pow(10, LOG_P_MIN + frac * (LOG_P_MAX - LOG_P_MIN));
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const d = params.get("d");
  if (d === null) return null;
  const dPc = parseFloat(d);
  if (!Number.isFinite(dPc) || dPc <= 0) return null;
  return {
    distancePc: dPc,
    parallaxUnit: PARALLAX_UNITS[params.get("pu")] ? params.get("pu") : "mas",
    distanceUnit: DISTANCE_UNITS[params.get("du")] ? params.get("du") : "ly",
    parallaxSigma: params.get("ps") ?? "",
  };
}

export default function ParallaxDistanceCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [distancePc, setDistancePc] = useState(1 / 0.7685); // Proxima Centauri
  const [parallaxUnit, setParallaxUnit] = useState("mas");
  const [distanceUnit, setDistanceUnit] = useState("ly");
  const [parallaxSigma, setParallaxSigma] = useState("");
  const [editingField, setEditingField] = useState(null);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setDistancePc(initial.distancePc);
      setParallaxUnit(initial.parallaxUnit);
      setDistanceUnit(initial.distanceUnit);
      setParallaxSigma(initial.parallaxSigma);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("d", distancePc.toExponential(8));
      params.set("pu", parallaxUnit);
      params.set("du", distanceUnit);
      if (parallaxSigma) params.set("ps", parallaxSigma);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, distancePc, parallaxUnit, distanceUnit, parallaxSigma]);

  const parallaxArcsec = parallaxArcsecFromDistancePc(distancePc);

  const parallaxDisplayFor = (unit) => arcsecToParallax(parallaxArcsec, unit);
  const distanceDisplayFor = (unit) => metersToDistance(distanceToMeters(distancePc, "pc"), unit);

  const displayValueFor = (field) => {
    if (editingField === field) return draft;
    return formatValue(field === "parallax" ? parallaxDisplayFor(parallaxUnit) : distanceDisplayFor(distanceUnit));
  };

  const handleFocus = (field) => {
    const current = field === "parallax" ? parallaxDisplayFor(parallaxUnit) : distanceDisplayFor(distanceUnit);
    setDraft(formatValue(current));
    setEditingField(field);
  };

  const handleChange = (field, raw) => {
    setDraft(raw);
    const num = parseFloat(raw);
    if (!(Number.isFinite(num) && num > 0)) return;
    if (field === "parallax") {
      const pArcsec = parallaxToArcsec(num, parallaxUnit);
      if (pArcsec > 0) setDistancePc(distancePcFromParallaxArcsec(pArcsec));
    } else {
      const meters = distanceToMeters(num, distanceUnit);
      const dPc = metersToDistance(meters, "pc");
      if (dPc > 0) setDistancePc(dPc);
    }
  };

  const handleBlur = () => setEditingField(null);

  const handleUnitChange = (field, newUnit) => {
    if (field === "parallax") setParallaxUnit(newUnit);
    else setDistanceUnit(newUnit);
    if (editingField === field) {
      const current = field === "parallax" ? arcsecToParallax(parallaxArcsec, newUnit) : distanceDisplayFor(newUnit);
      setDraft(formatValue(current));
    }
  };

  const handleSlider = (pos) => {
    const pArcsec = parallaxArcsecFromPos(parseFloat(pos));
    setDistancePc(distancePcFromParallaxArcsec(pArcsec));
    if (editingField === "parallax") setEditingField(null);
  };

  const applyPreset = (preset) => {
    setDistancePc(distancePcFromParallaxArcsec(preset.pMas / 1000));
    setParallaxSigma(preset.sigmaMas);
    setEditingField(null);
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

  const parallaxValueInUnit = parallaxDisplayFor(parallaxUnit);
  const sigmaNum = parseFloat(parallaxSigma);
  const hasSigma = Number.isFinite(sigmaNum) && sigmaNum > 0;
  const fracUncertainty = hasSigma ? sigmaNum / parallaxValueInUnit : 0;
  const reliability = hasSigma ? parallaxReliability(fracUncertainty) : null;
  const consistentWithZero = hasSigma && parallaxValueInUnit - sigmaNum <= 0;

  // --- parallax geometry diagram ---------------------------------------
  // Real stellar parallaxes are far too small to draw to true scale (the
  // orbit would be an invisible point next to the star), so the star's
  // schematic distance is a log-compressed function of the real distance
  // — closer stars render nearer the orbit, farther stars render farther
  // away, monotonically. Given that schematic placement, though, the ray
  // geometry itself (sightlines from each Earth position, extended past
  // the star to the fixed background) is computed exactly via real
  // trigonometry, not faked — so the *direction* and *relative* size of
  // the apparent shift are physically grounded, only the absolute scale
  // is exaggerated for visibility.
  const diagram = useMemo(() => {
    const width = 640;
    const height = 260;
    const sunX = 70;
    const sunY = 130;
    const orbitR = 22;
    const starXMin = 150;
    const starXMax = 400;
    const backgroundX = 560;

    const logDMin = 0; // 1 pc
    const logDMax = 3.4; // ~2500 pc
    const logD = Math.min(logDMax, Math.max(logDMin, Math.log10(distancePc)));
    const frac = (logD - logDMin) / (logDMax - logDMin);
    const starXOffset = starXMin + frac * (starXMax - starXMin);
    const starX = sunX + starXOffset;
    const starY = sunY;

    const earthA = { x: sunX, y: sunY - orbitR };
    const earthB = { x: sunX, y: sunY + orbitR };

    const extend = (from) => {
      const slope = (starY - from.y) / (starX - from.x);
      return from.y + slope * (backgroundX - from.x);
    };
    const bgYA = extend(earthA);
    const bgYB = extend(earthB);

    return { width, height, sunX, sunY, orbitR, starX, starY, backgroundX, earthA, earthB, bgYA, bgYB };
  }, [distancePc]);

  // Self-check rows: runs the real parallax.js functions against known
  // reference stars and edge cases — independent of the fields above.
  const testRows = useMemo(() => getParallaxDistanceTestRows(), []);

  return (
    <div className="pdc" aria-label="Parallax and distance calculator">
      <div className="pdc-header">
        <p className="pdc-title">Parallax / distance calculator</p>
        <div className="pdc-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="pdc-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="pdc-explainer">
        d(pc) = 1 / p(″) — exact by the definition of the parsec. A star's parallax is the tiny
        back-and-forth shift in its apparent position, measured against distant background stars,
        as Earth orbits the Sun. Smaller shift means a farther star.
      </p>

      <div className="pdc-fields">
        <div className="pdc-field">
          <label htmlFor="pdc-parallax">Parallax (<Katex tex="p" />)</label>
          <div className="pdc-input-row">
            <input
              id="pdc-parallax"
              className="pdc-input"
              type="text"
              inputMode="decimal"
              value={displayValueFor("parallax")}
              onFocus={() => handleFocus("parallax")}
              onChange={(e) => handleChange("parallax", e.target.value)}
              onBlur={handleBlur}
            />
            <select className="pdc-unit-select" value={parallaxUnit} onChange={(e) => handleUnitChange("parallax", e.target.value)}>
              {PARALLAX_UNIT_ORDER.map((u) => (
                <option key={u} value={u}>{PARALLAX_UNITS[u].short}</option>
              ))}
            </select>
          </div>
          <input
            className="pdc-slider"
            type="range"
            min={0}
            max={SLIDER_STEPS}
            step={1}
            value={posFromParallaxArcsec(parallaxArcsec)}
            onChange={(e) => handleSlider(e.target.value)}
            aria-label="Parallax (logarithmic)"
          />
          <input
            className="pdc-sigma-input"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder={`± uncertainty in ${PARALLAX_UNITS[parallaxUnit].short} (optional)`}
            value={parallaxSigma}
            onChange={(e) => setParallaxSigma(e.target.value)}
          />
        </div>

        <div className="pdc-field">
          <label htmlFor="pdc-distance">Distance (<Katex tex="d" />)</label>
          <div className="pdc-input-row">
            <input
              id="pdc-distance"
              className="pdc-input"
              type="text"
              inputMode="decimal"
              value={displayValueFor("distance")}
              onFocus={() => handleFocus("distance")}
              onChange={(e) => handleChange("distance", e.target.value)}
              onBlur={handleBlur}
            />
            <select className="pdc-unit-select" value={distanceUnit} onChange={(e) => handleUnitChange("distance", e.target.value)}>
              {DISTANCE_UNIT_ORDER.map((u) => (
                <option key={u} value={u}>{DISTANCE_UNITS[u].short}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {consistentWithZero && (
        <p className="pdc-note pdc-note--bad" role="alert">
          This parallax is consistent with zero (or negative) within its uncertainty — no finite
          distance is meaningful via simple inversion here. This is exactly the regime real
          astrometry (e.g. Gaia) handles with Bayesian distance priors rather than d = 1/p.
        </p>
      )}

      <div className="pdc-table" role="table" aria-label="Distance in every unit">
        {DISTANCE_UNIT_ORDER.map((key) => (
          <div className={key === distanceUnit ? "pdc-row pdc-row--active" : "pdc-row"} role="row" key={key}>
            <span className="pdc-row-label" role="cell">{DISTANCE_UNITS[key].label}</span>
            <span className="pdc-row-value" role="cell">
              {formatDisplay(distanceDisplayFor(key))}
              {hasSigma && !consistentWithZero && ` ± ${formatDisplay(distanceDisplayFor(key) * fracUncertainty)}`}{" "}
              <span className="pdc-row-unit">{DISTANCE_UNITS[key].short}</span>
            </span>
          </div>
        ))}
      </div>

      {hasSigma && !consistentWithZero && (
        <div className="pdc-reliability-card">
          <div className="pdc-reliability-row">
            <span className="pdc-reliability-label">Fractional parallax uncertainty</span>
            <span className="pdc-reliability-value">{(fracUncertainty * 100).toFixed(1)}%</span>
          </div>
          <div className="pdc-reliability-row">
            <span className="pdc-reliability-label">Naive inversion (d = 1/p)</span>
            <span className={`pdc-quality-badge pdc-quality-badge--${reliability.tone}`}>{reliability.label}</span>
          </div>
          <p className="pdc-note">
            Because d = 1/p is nonlinear, a symmetric error bar on p doesn't translate into a
            symmetric, unbiased error bar on d once the fractional uncertainty grows — the
            distribution skews and the simple point estimate becomes biased. Below ~10% it's
            fine; above ~20% (like this preset, when applicable), treat this as illustrative
            only, not a rigorous distance estimate.
          </p>
        </div>
      )}

      <div className="pdc-diagram-wrap">
        <svg
          className="pdc-diagram-svg"
          viewBox={`0 0 ${diagram.width} ${diagram.height}`}
          role="img"
          aria-label="Schematic diagram of Earth at two points in its orbit, sightlines to a nearby star, and the star's apparent shift against distant background stars"
        >
          {/* background star field */}
          <line x1={diagram.backgroundX} x2={diagram.backgroundX} y1="10" y2={diagram.height - 10} className="pdc-diagram-bg-line" />
          {[20, 55, 95, 140, 175, 210, 240].map((y, i) => (
            <circle key={i} cx={diagram.backgroundX + (i % 2 === 0 ? 14 : -12)} cy={y} r="1.6" className="pdc-diagram-bg-star" />
          ))}
          <text x={diagram.backgroundX} y="12" className="pdc-diagram-small-label" textAnchor="middle">distant background stars</text>

          {/* sightlines, extended to background */}
          <line x1={diagram.earthA.x} y1={diagram.earthA.y} x2={diagram.backgroundX} y2={diagram.bgYA} className="pdc-diagram-sightline pdc-diagram-sightline--a" />
          <line x1={diagram.earthB.x} y1={diagram.earthB.y} x2={diagram.backgroundX} y2={diagram.bgYB} className="pdc-diagram-sightline pdc-diagram-sightline--b" />

          {/* orbit */}
          <ellipse cx={diagram.sunX} cy={diagram.sunY} rx={diagram.orbitR} ry={diagram.orbitR} className="pdc-diagram-orbit" />
          <circle cx={diagram.sunX} cy={diagram.sunY} r="5" className="pdc-diagram-sun" />
          <text x={diagram.sunX} y={diagram.sunY + 34} className="pdc-diagram-small-label" textAnchor="middle">Sun</text>

          <circle cx={diagram.earthA.x} cy={diagram.earthA.y} r="3.5" className="pdc-diagram-earth pdc-diagram-earth--a" />
          <text x={diagram.earthA.x - 10} y={diagram.earthA.y - 6} className="pdc-diagram-small-label pdc-diagram-small-label--a" textAnchor="end">Earth (Jan)</text>
          <circle cx={diagram.earthB.x} cy={diagram.earthB.y} r="3.5" className="pdc-diagram-earth pdc-diagram-earth--b" />
          <text x={diagram.earthB.x - 10} y={diagram.earthB.y + 16} className="pdc-diagram-small-label pdc-diagram-small-label--b" textAnchor="end">Earth (Jul)</text>

          {/* star */}
          <circle cx={diagram.starX} cy={diagram.starY} r="4.5" className="pdc-diagram-star" />
          <text x={diagram.starX} y={diagram.starY - 12} className="pdc-diagram-star-label" textAnchor="middle">nearby star</text>

          {/* apparent shift on background */}
          <circle cx={diagram.backgroundX} cy={diagram.bgYA} r="3" className="pdc-diagram-apparent pdc-diagram-apparent--a" />
          <circle cx={diagram.backgroundX} cy={diagram.bgYB} r="3" className="pdc-diagram-apparent pdc-diagram-apparent--b" />
          <line x1={diagram.backgroundX + 20} x2={diagram.backgroundX + 20} y1={diagram.bgYA} y2={diagram.bgYB} className="pdc-diagram-shift-bracket" />
          <text x={diagram.backgroundX + 26} y={(diagram.bgYA + diagram.bgYB) / 2 + 4} className="pdc-diagram-shift-label">
            apparent shift = 2p
          </text>
        </svg>
        <p className="pdc-diagram-caption">
          Schematic — the star's distance and the apparent shift are both exaggerated for
          visibility (real stellar parallaxes are far too small to draw to scale); the direction
          and relative size of the effect — smaller shift, farther star — are accurate.
        </p>
      </div>

      <div className="pdc-footer-row">
        <CalculatorVote slug="parallax-distance-calculator" />
        <CalculatorTests
          title="Parallax / Distance Calculator — Tests"
          columns={PARALLAX_DISTANCE_TEST_COLUMNS}
          rows={testRows}
          sources={PARALLAX_DISTANCE_TEST_SOURCES}
        />
        <button type="button" className="pdc-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
