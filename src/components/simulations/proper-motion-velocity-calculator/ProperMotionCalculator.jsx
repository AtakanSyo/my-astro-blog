import { useEffect, useMemo, useState } from "react";
import {
  PROPER_MOTION_UNITS,
  PROPER_MOTION_UNIT_ORDER,
  PARALLAX_UNITS,
  PARALLAX_UNIT_ORDER,
  DISTANCE_UNITS,
  DISTANCE_UNIT_ORDER,
  properMotionToArcsecYr,
  arcsecYrToProperMotion,
  parallaxToArcsec,
  distanceToMeters,
  metersToDistance,
  distancePcFromParallaxArcsec,
  parallaxArcsecFromDistancePc,
  totalProperMotion,
  tangentialVelocity,
  properMotionFromVelocityDistance,
  distancePcFromVelocityProperMotion,
  totalSpaceVelocity,
} from "./properMotion";
import { PROPER_MOTION_TEST_COLUMNS, PROPER_MOTION_TEST_SOURCES, getProperMotionTestRows } from "./properMotionTests";
import "../../../styles/properMotionVelocityCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import CalculatorTests from "../../CalculatorTests.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";
import Katex from "../../Katex.jsx";

const PRESETS = [
  {
    label: "Barnard's Star",
    solveFor: "vt", muMode: "components",
    muAlpha: "-798.71", muDelta: "10328.12", muTotal: "10358.96", muUnit: "mas",
    distMode: "distance", distance: "1.8282", distanceUnit: "pc", parallax: "546.98", parallaxUnit: "mas",
    vt: "89.78", radialVelocity: "-110.6",
  },
  {
    label: "Proxima Centauri",
    solveFor: "vt", muMode: "total",
    muAlpha: "", muDelta: "", muTotal: "3775", muUnit: "mas",
    distMode: "parallax", distance: "1.3012", distanceUnit: "pc", parallax: "768.5", parallaxUnit: "mas",
    vt: "23.29", radialVelocity: "-22.4",
  },
  {
    label: "Same speed, 55× farther",
    solveFor: "mu", muMode: "total",
    muAlpha: "", muDelta: "", muTotal: "189.4", muUnit: "mas",
    distMode: "distance", distance: "100", distanceUnit: "pc", parallax: "10", parallaxUnit: "mas",
    vt: "89.78", radialVelocity: "",
  },
  {
    label: "Solve for distance",
    solveFor: "d", muMode: "total",
    muAlpha: "", muDelta: "", muTotal: "150", muUnit: "mas",
    distMode: "distance", distance: "63.28", distanceUnit: "pc", parallax: "15.8", parallaxUnit: "mas",
    vt: "45", radialVelocity: "",
  },
];

const SOLVE_OPTIONS = [
  { key: "vt", label: "Tangential velocity" },
  { key: "mu", label: "Proper motion" },
  { key: "d", label: "Distance" },
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
  if (abs >= 1e6 || abs < 1e-3) {
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
  const solveFor = params.get("solve");
  if (!solveFor || !SOLVE_OPTIONS.some((o) => o.key === solveFor)) return null;
  const str = (key, fallback) => (params.get(key) !== null ? params.get(key) : fallback);
  return {
    solveFor,
    muMode: params.get("mm") === "components" ? "components" : "total",
    muAlpha: str("ma", ""), muDelta: str("md", ""), muTotal: str("mt", "10358.96"),
    muUnit: PROPER_MOTION_UNITS[params.get("mu")] ? params.get("mu") : "mas",
    distMode: params.get("dm") === "parallax" ? "parallax" : "distance",
    distance: str("d", "1.8282"), distanceUnit: DISTANCE_UNITS[params.get("du")] ? params.get("du") : "pc",
    parallax: str("p", "546.98"), parallaxUnit: PARALLAX_UNITS[params.get("pu")] ? params.get("pu") : "mas",
    vt: str("vt", "89.78"), radialVelocity: str("vr", "-110.6"),
  };
}

export default function ProperMotionCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [solveFor, setSolveFor] = useState("vt");
  const [muMode, setMuMode] = useState("components");
  const [muAlpha, setMuAlpha] = useState("-798.71");
  const [muDelta, setMuDelta] = useState("10328.12");
  const [muTotal, setMuTotal] = useState("10358.96");
  const [muUnit, setMuUnit] = useState("mas");
  const [distMode, setDistMode] = useState("distance");
  const [distance, setDistance] = useState("1.8282");
  const [distanceUnit, setDistanceUnit] = useState("pc");
  const [parallax, setParallax] = useState("546.98");
  const [parallaxUnit, setParallaxUnit] = useState("mas");
  const [vt, setVt] = useState("89.78");
  const [radialVelocity, setRadialVelocity] = useState("-110.6");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setSolveFor(initial.solveFor);
      setMuMode(initial.muMode);
      setMuAlpha(initial.muAlpha);
      setMuDelta(initial.muDelta);
      setMuTotal(initial.muTotal);
      setMuUnit(initial.muUnit);
      setDistMode(initial.distMode);
      setDistance(initial.distance);
      setDistanceUnit(initial.distanceUnit);
      setParallax(initial.parallax);
      setParallaxUnit(initial.parallaxUnit);
      setVt(initial.vt);
      setRadialVelocity(initial.radialVelocity);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("solve", solveFor);
      params.set("mm", muMode);
      params.set("ma", muAlpha);
      params.set("md", muDelta);
      params.set("mt", muTotal);
      params.set("mu", muUnit);
      params.set("dm", distMode);
      params.set("d", distance);
      params.set("du", distanceUnit);
      params.set("p", parallax);
      params.set("pu", parallaxUnit);
      params.set("vt", vt);
      if (radialVelocity) params.set("vr", radialVelocity);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, solveFor, muMode, muAlpha, muDelta, muTotal, muUnit, distMode, distance, distanceUnit, parallax, parallaxUnit, vt, radialVelocity]);

  const result = useMemo(() => {
    let muArcsecYr = null;
    if (solveFor !== "mu") {
      if (muMode === "components") {
        const a = parseFloat(muAlpha);
        const d = parseFloat(muDelta);
        if (!Number.isFinite(a) || !Number.isFinite(d)) {
          return {
            valid: false,
            reason: (
              <>
                Enter both proper-motion components (<Katex tex="\mu_{\alpha*}" /> and <Katex tex="\mu_\delta" />).
              </>
            ),
          };
        }
        muArcsecYr = properMotionToArcsecYr(totalProperMotion(a, d), muUnit);
      } else {
        const m = parseFloat(muTotal);
        if (!(m > 0)) return { valid: false, reason: "Enter a positive proper motion." };
        muArcsecYr = properMotionToArcsecYr(m, muUnit);
      }
      if (!(muArcsecYr > 0)) return { valid: false, reason: "Total proper motion must be positive." };
    }

    let dPc = null;
    if (solveFor !== "d") {
      if (distMode === "parallax") {
        const p = parseFloat(parallax);
        if (!(p > 0)) return { valid: false, reason: "Enter a positive parallax." };
        dPc = distancePcFromParallaxArcsec(parallaxToArcsec(p, parallaxUnit));
      } else {
        const dv = parseFloat(distance);
        if (!(dv > 0)) return { valid: false, reason: "Enter a positive distance." };
        dPc = metersToDistance(distanceToMeters(dv, distanceUnit), "pc");
      }
      if (!(dPc > 0)) return { valid: false, reason: "Distance must be positive." };
    }

    let vtKms = null;
    if (solveFor !== "vt") {
      const v = parseFloat(vt);
      if (!(v > 0)) return { valid: false, reason: "Enter a positive tangential velocity." };
      vtKms = v;
    }

    if (solveFor === "vt") vtKms = tangentialVelocity(muArcsecYr, dPc);
    else if (solveFor === "mu") muArcsecYr = properMotionFromVelocityDistance(vtKms, dPc);
    else dPc = distancePcFromVelocityProperMotion(vtKms, muArcsecYr);

    const vr = parseFloat(radialVelocity);
    const hasVr = Number.isFinite(vr);
    const totalV = hasVr ? totalSpaceVelocity(vtKms, vr) : null;

    return { valid: true, muArcsecYr, dPc, vtKms, hasVr, vr, totalV };
  }, [solveFor, muMode, muAlpha, muDelta, muTotal, muUnit, distMode, distance, distanceUnit, parallax, parallaxUnit, vt, radialVelocity]);

  // Self-check rows: runs the real properMotion.js functions against known
  // reference stars and edge cases — independent of the fields above.
  const testRows = useMemo(() => getProperMotionTestRows(), []);

  const applyPreset = (preset) => {
    setSolveFor(preset.solveFor);
    setMuMode(preset.muMode);
    setMuAlpha(preset.muAlpha);
    setMuDelta(preset.muDelta);
    setMuTotal(preset.muTotal);
    setMuUnit(preset.muUnit);
    setDistMode(preset.distMode);
    setDistance(preset.distance);
    setDistanceUnit(preset.distanceUnit);
    setParallax(preset.parallax);
    setParallaxUnit(preset.parallaxUnit);
    setVt(preset.vt);
    setRadialVelocity(preset.radialVelocity);
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
    <div className="pmc" aria-label="Proper motion and tangential velocity calculator">
      <div className="pmc-header">
        <p className="pmc-title">Proper motion / velocity calculator</p>
        <div className="pmc-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="pmc-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="pmc-explainer">
        <Katex tex="v_t = 4.74047 \cdot \mu \cdot d" /> — a star's proper motion (its apparent creep across the sky,
        in arcsec/yr) combined with its distance gives the actual sideways speed through space, in
        km/s. Apparent motion alone conflates true speed with distance — the same real velocity
        looks far slower from farther away.
      </p>

      <div className="pmc-solve-toggle" role="group" aria-label="Solve for">
        {SOLVE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={opt.key === solveFor ? "pmc-solve-btn active" : "pmc-solve-btn"}
            onClick={() => setSolveFor(opt.key)}
          >
            Solve for {opt.label}
          </button>
        ))}
      </div>

      {/* --- proper motion --- */}
      <div className="pmc-section">
        <div className="pmc-section-head">
          <span className="pmc-section-title">Proper motion (<Katex tex="\mu" />)</span>
          {solveFor !== "mu" && (
            <div className="pmc-mode-toggle">
              <button type="button" className={muMode === "total" ? "pmc-mode-btn active" : "pmc-mode-btn"} onClick={() => setMuMode("total")}>
                Total
              </button>
              <button type="button" className={muMode === "components" ? "pmc-mode-btn active" : "pmc-mode-btn"} onClick={() => setMuMode("components")}>
                RA/Dec components
              </button>
            </div>
          )}
        </div>

        {solveFor === "mu" ? (
          <div className="pmc-computed">
            {result.valid ? formatNumber(arcsecYrToProperMotion(result.muArcsecYr, muUnit)) : "—"}
            <select className="pmc-unit-select" value={muUnit} onChange={(e) => setMuUnit(e.target.value)}>
              {PROPER_MOTION_UNIT_ORDER.map((u) => <option key={u} value={u}>{PROPER_MOTION_UNITS[u].short}</option>)}
            </select>
          </div>
        ) : muMode === "total" ? (
          <div className="pmc-input-row">
            <input className="pmc-input" type="number" min="0" step="any" inputMode="decimal" value={muTotal} onChange={(e) => setMuTotal(e.target.value)} />
            <select className="pmc-unit-select" value={muUnit} onChange={(e) => setMuUnit(e.target.value)}>
              {PROPER_MOTION_UNIT_ORDER.map((u) => <option key={u} value={u}>{PROPER_MOTION_UNITS[u].short}</option>)}
            </select>
          </div>
        ) : (
          <>
            <div className="pmc-component-row">
              <div className="pmc-field">
                <label><Katex tex="\mu_{\alpha*}" /> (RA, ×cos <Katex tex="\delta" />)</label>
                <input className="pmc-input" type="number" step="any" inputMode="decimal" value={muAlpha} onChange={(e) => setMuAlpha(e.target.value)} />
              </div>
              <div className="pmc-field">
                <label><Katex tex="\mu_\delta" /> (Dec)</label>
                <input className="pmc-input" type="number" step="any" inputMode="decimal" value={muDelta} onChange={(e) => setMuDelta(e.target.value)} />
              </div>
              <select className="pmc-unit-select" value={muUnit} onChange={(e) => setMuUnit(e.target.value)}>
                {PROPER_MOTION_UNIT_ORDER.map((u) => <option key={u} value={u}>{PROPER_MOTION_UNITS[u].short}</option>)}
              </select>
            </div>
            {Number.isFinite(parseFloat(muAlpha)) && Number.isFinite(parseFloat(muDelta)) && (
              <p className="pmc-derived-note">
                Total <Katex tex="\mu" /> = {formatNumber(totalProperMotion(parseFloat(muAlpha), parseFloat(muDelta)))} {PROPER_MOTION_UNITS[muUnit].short}
              </p>
            )}
          </>
        )}

        {solveFor === "mu" && result.valid && (
          <div className="pmc-table">
            {PROPER_MOTION_UNIT_ORDER.map((key) => (
              <div className={key === muUnit ? "pmc-row pmc-row--active" : "pmc-row"} role="row" key={key}>
                <span className="pmc-row-label">{PROPER_MOTION_UNITS[key].label}</span>
                <span className="pmc-row-value">{formatNumber(arcsecYrToProperMotion(result.muArcsecYr, key))} <span className="pmc-row-unit">{PROPER_MOTION_UNITS[key].short}</span></span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- distance --- */}
      <div className="pmc-section">
        <div className="pmc-section-head">
          <span className="pmc-section-title">Distance (<Katex tex="d" />)</span>
          {solveFor !== "d" && (
            <div className="pmc-mode-toggle">
              <button type="button" className={distMode === "distance" ? "pmc-mode-btn active" : "pmc-mode-btn"} onClick={() => setDistMode("distance")}>
                Distance
              </button>
              <button type="button" className={distMode === "parallax" ? "pmc-mode-btn active" : "pmc-mode-btn"} onClick={() => setDistMode("parallax")}>
                Parallax
              </button>
            </div>
          )}
        </div>

        {solveFor === "d" ? (
          <div className="pmc-computed">
            {result.valid ? formatNumber(metersToDistance(distanceToMeters(result.dPc, "pc"), distanceUnit)) : "—"}
            <select className="pmc-unit-select" value={distanceUnit} onChange={(e) => setDistanceUnit(e.target.value)}>
              {DISTANCE_UNIT_ORDER.map((u) => <option key={u} value={u}>{DISTANCE_UNITS[u].short}</option>)}
            </select>
          </div>
        ) : distMode === "distance" ? (
          <div className="pmc-input-row">
            <input className="pmc-input" type="number" min="0" step="any" inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} />
            <select className="pmc-unit-select" value={distanceUnit} onChange={(e) => setDistanceUnit(e.target.value)}>
              {DISTANCE_UNIT_ORDER.map((u) => <option key={u} value={u}>{DISTANCE_UNITS[u].short}</option>)}
            </select>
          </div>
        ) : (
          <div className="pmc-input-row">
            <input className="pmc-input" type="number" min="0" step="any" inputMode="decimal" value={parallax} onChange={(e) => setParallax(e.target.value)} />
            <select className="pmc-unit-select" value={parallaxUnit} onChange={(e) => setParallaxUnit(e.target.value)}>
              {PARALLAX_UNIT_ORDER.map((u) => <option key={u} value={u}>{PARALLAX_UNITS[u].short}</option>)}
            </select>
          </div>
        )}

        {solveFor === "d" && result.valid && (
          <>
            <div className="pmc-table">
              {DISTANCE_UNIT_ORDER.map((key) => (
                <div className={key === distanceUnit ? "pmc-row pmc-row--active" : "pmc-row"} role="row" key={key}>
                  <span className="pmc-row-label">{DISTANCE_UNITS[key].label}</span>
                  <span className="pmc-row-value">{formatNumber(metersToDistance(distanceToMeters(result.dPc, "pc"), key))} <span className="pmc-row-unit">{DISTANCE_UNITS[key].short}</span></span>
                </div>
              ))}
            </div>
            <p className="pmc-derived-note">
              Equivalent parallax: {formatNumber(parallaxArcsecFromDistancePc(result.dPc) * 1000)} mas
            </p>
          </>
        )}
      </div>

      {/* --- tangential velocity --- */}
      <div className="pmc-section">
        <div className="pmc-section-head">
          <span className="pmc-section-title">Tangential velocity (<Katex tex="v_t" />)</span>
        </div>
        {solveFor === "vt" ? (
          <div className="pmc-computed">{result.valid ? formatNumber(result.vtKms) : "—"} <span className="pmc-row-unit">km/s</span></div>
        ) : (
          <div className="pmc-input-row">
            <input className="pmc-input" type="number" min="0" step="any" inputMode="decimal" value={vt} onChange={(e) => setVt(e.target.value)} />
            <span className="pmc-static-unit">km/s</span>
          </div>
        )}
      </div>

      {!result.valid && (
        <p className="pmc-note pmc-note--warn" role="alert">{result.reason}</p>
      )}

      {/* --- optional radial velocity --- */}
      <div className="pmc-section">
        <label htmlFor="pmc-vr" className="pmc-section-title">Radial velocity (optional)</label>
        <div className="pmc-input-row">
          <input
            id="pmc-vr" className="pmc-input" type="number" step="any" inputMode="decimal"
            placeholder="from spectroscopy, km/s"
            value={radialVelocity} onChange={(e) => setRadialVelocity(e.target.value)}
          />
          <span className="pmc-static-unit">km/s</span>
        </div>
      </div>

      {result.valid && result.hasVr && (
        <div className="pmc-total-card">
          <span className="pmc-total-label">Total 3D space velocity</span>
          <span className="pmc-total-value">
            <Katex tex="\sqrt{v_t^2 + v_r^2}" /> = {formatNumber(result.totalV)} km/s
          </span>
        </div>
      )}

      <div className="pmc-footer-row">
        <CalculatorVote slug="proper-motion-velocity-calculator" />
        <CalculatorTests
          title="Proper Motion & Tangential Velocity Calculator — Tests"
          columns={PROPER_MOTION_TEST_COLUMNS}
          rows={testRows}
          sources={PROPER_MOTION_TEST_SOURCES}
        />
        <button type="button" className="pmc-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
