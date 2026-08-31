import { useEffect, useMemo, useState } from "react";
import {
  PERIOD_UNITS,
  PERIOD_UNIT_ORDER,
  VELOCITY_UNITS,
  VELOCITY_UNIT_ORDER,
  periodToSeconds,
  velocityToMs,
  massFunctionSolar,
  solveCompanionMass,
} from "./binaryMassFunction";
import { BINARY_MASS_FUNCTION_TEST_COLUMNS, BINARY_MASS_FUNCTION_TEST_SOURCES, getBinaryMassFunctionTestRows } from "./binaryMassFunctionTests";
import "../../../styles/binaryMassFunctionCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import CalculatorTests from "../../CalculatorTests.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";

// Every preset is self-consistent: applying one and toggling "estimate
// companion mass" on/off never shows a jarring mismatch, because f(M)
// is always recomputed from P, K, e directly.
const PRESETS = [
  { label: "Cygnus X-1 (confirmed black hole)", P: 5.599829, PUnit: "day", K: 75.6, KUnit: "kms", e: 0, advanced: true, M1: 40.6, i: 27.51 },
  { label: "Neutron-star X-ray binary", P: 5, PUnit: "day", K: 25, KUnit: "kms", e: 0.1, advanced: true, M1: 15, i: 75 },
  { label: "Edge-on binary (i = 90°, minimum mass)", P: 2, PUnit: "day", K: 100, KUnit: "kms", e: 0, advanced: true, M1: 10, i: 90 },
  { label: "Low-inclination, ambiguous case", P: 10, PUnit: "day", K: 30, KUnit: "kms", e: 0.3, advanced: true, M1: 5, i: 20 },
  { label: "Unknown inclination — lower bound only", P: 3, PUnit: "day", K: 40, KUnit: "kms", e: 0, advanced: false, M1: 10, i: 90 },
];

const LANDMARKS = [
  { label: "Typical neutron star (~1.4 M☉)", m: 1.4 },
  { label: "Maximum neutron star mass (~2.2 M☉, TOV limit)", m: 2.2 },
  { label: "Typical stellar black hole (≳5 M☉)", m: 5 },
];

function trimTrailingZeros(s) {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}
const SUPERSCRIPT_MAP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
function toSuperscript(n) {
  return String(n).split("").map((ch) => SUPERSCRIPT_MAP[ch] ?? ch).join("");
}
function formatMsun(n) {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n === 0) return "0";
  if (n >= 1e5 || n < 1e-3) {
    const exp = Math.floor(Math.log10(n));
    const mantissa = n / Math.pow(10, exp);
    return `${trimTrailingZeros(mantissa.toFixed(3))} × 10${toSuperscript(exp)}`;
  }
  if (n >= 100) return trimTrailingZeros(n.toFixed(1));
  if (n >= 1) return trimTrailingZeros(n.toFixed(3));
  return trimTrailingZeros(n.toFixed(5));
}
function niceStep(span, targetCount = 5) {
  if (!(span > 0)) return 1;
  const raw = span / targetCount;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
  return step * mag;
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const P = params.get("p");
  if (P === null || !Number.isFinite(parseFloat(P))) return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  return {
    P,
    PUnit: PERIOD_UNITS[params.get("pu")] ? params.get("pu") : "day",
    K: num("k", "75.6"),
    KUnit: VELOCITY_UNITS[params.get("ku")] ? params.get("ku") : "kms",
    e: num("e", "0"),
    advanced: params.get("adv") === "1",
    M1: num("m1", "10"),
    i: num("i", "90"),
  };
}

export default function BinaryMassFunctionCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [P, setP] = useState("5.599829");
  const [PUnit, setPUnit] = useState("day");
  const [K, setK] = useState("75.6");
  const [KUnit, setKUnit] = useState("kms");
  const [e, setE] = useState("0");
  const [advanced, setAdvanced] = useState(false);
  const [M1, setM1] = useState("10");
  const [inclination, setInclination] = useState("90");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setP(initial.P);
      setPUnit(initial.PUnit);
      setK(initial.K);
      setKUnit(initial.KUnit);
      setE(initial.e);
      setAdvanced(initial.advanced);
      setM1(initial.M1);
      setInclination(initial.i);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("p", P);
      params.set("pu", PUnit);
      params.set("k", K);
      params.set("ku", KUnit);
      params.set("e", e);
      params.set("adv", advanced ? "1" : "0");
      if (advanced) {
        params.set("m1", M1);
        params.set("i", inclination);
      }
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, P, PUnit, K, KUnit, e, advanced, M1, inclination]);

  const result = useMemo(() => {
    const Pnum = parseFloat(P);
    const Knum = parseFloat(K);
    const eNum = parseFloat(e) || 0;
    if (!(Pnum > 0) || !(Knum > 0) || eNum < 0 || eNum >= 1) {
      return { valid: false, reason: "Enter a positive orbital period and RV semi-amplitude, and an eccentricity between 0 and 1." };
    }
    const Ps = periodToSeconds(Pnum, PUnit);
    const Kms = velocityToMs(Knum, KUnit);
    const fM = massFunctionSolar(Ps, Kms, eNum);

    let M2 = null;
    let M1num = null;
    let iNum = null;
    if (advanced) {
      M1num = parseFloat(M1);
      iNum = parseFloat(inclination);
      if (Number.isFinite(M1num) && M1num >= 0 && Number.isFinite(iNum) && iNum > 0 && iNum <= 90) {
        M2 = solveCompanionMass(fM, M1num, iNum);
      }
    }
    return { valid: true, fM, advancedValid: M2 !== null, M2, M1: M1num, i: iNum };
  }, [P, PUnit, K, KUnit, e, advanced, M1, inclination]);

  // --- mass benchmark ruler ---
  // Shades the region M2 >= f(M) — the one fact that's true with NO
  // assumptions about inclination or the visible star's mass — next to
  // real reference masses, so "f(M) = 0.25 M_sun" becomes "the companion
  // has to be at least here," visibly, rather than an abstract number.
  const ruler = useMemo(() => {
    if (!result.valid) return null;
    const candidates = [result.fM, result.M2 ?? 0, ...LANDMARKS.map((l) => l.m)];
    const domainMax = Math.max(...candidates) * 1.25;
    const width = 640;
    const height = 190;
    const marginLeft = 26;
    const marginRight = 26;
    const y = 76;
    const plotWidth = width - marginLeft - marginRight;
    const xScale = (m) => marginLeft + (Math.max(0, Math.min(domainMax, m)) / domainMax) * plotWidth;
    const step = niceStep(domainMax, 6);
    const ticks = [];
    for (let t = 0; t <= domainMax + 1e-9; t += step) ticks.push(Math.round((t / step)) * step);

    return {
      width, height, marginLeft, plotWidth, y, xScale, ticks,
      fMX: xScale(result.fM),
      m2X: result.M2 !== null ? xScale(result.M2) : null,
      landmarks: LANDMARKS.filter((l) => l.m <= domainMax).map((l) => ({ ...l, x: xScale(l.m) })),
    };
  }, [result]);

  // --- M2 vs. inclination curve ---
  // Shows how much the required companion mass depends on the one thing
  // radial velocities alone can't measure: how the orbit is tilted to
  // our line of sight. Log-scaled because the curve spans roughly two
  // orders of magnitude between near-face-on and edge-on.
  const curve = useMemo(() => {
    if (!result.valid || !advanced) return null;
    const M1num = parseFloat(M1);
    if (!Number.isFinite(M1num) || M1num < 0) return null;
    const iMin = 10;
    const iMax = 90;
    const N = 80;
    const pts = [];
    for (let k = 0; k <= N; k++) {
      const iDeg = iMin + ((iMax - iMin) * k) / N;
      const m2 = solveCompanionMass(result.fM, M1num, iDeg);
      if (m2 !== null && m2 > 0) pts.push({ i: iDeg, logM2: Math.log10(m2) });
    }
    if (pts.length < 2) return null;
    const logVals = pts.map((p) => p.logM2);
    const yMin = Math.min(...logVals) - 0.1;
    const yMax = Math.max(...logVals) + 0.1;

    const width = 640;
    const height = 300;
    const marginLeft = 56;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 40;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;
    const xScale = (iDeg) => marginLeft + ((iDeg - iMin) / (iMax - iMin)) * plotWidth;
    const yScale = (logM) => marginTop + (1 - (logM - yMin) / (yMax - yMin)) * plotHeight;

    const linePoints = pts.map((p) => `${xScale(p.i)},${yScale(p.logM2)}`).join(" ");
    const iCurrent = result.i;
    const currentPoint = result.M2 !== null && iCurrent >= iMin && iCurrent <= iMax
      ? { x: xScale(iCurrent), y: yScale(Math.log10(result.M2)) }
      : null;

    const thresholdY = yMin <= Math.log10(3) && Math.log10(3) <= yMax ? yScale(Math.log10(3)) : null;

    const xTicks = [10, 30, 50, 70, 90];
    const yTickStart = Math.ceil(yMin);
    const yTicks = [];
    for (let t = yTickStart; t <= yMax; t++) yTicks.push(t);

    return {
      width, height, marginLeft, marginRight, marginTop, marginBottom, plotWidth, plotHeight,
      xScale, yScale, linePoints, currentPoint, thresholdY, xTicks, yTicks,
    };
  }, [result, advanced, M1]);

  const applyPreset = (preset) => {
    setP(String(preset.P));
    setPUnit(preset.PUnit);
    setK(String(preset.K));
    setKUnit(preset.KUnit);
    setE(String(preset.e));
    setAdvanced(preset.advanced);
    setM1(String(preset.M1));
    setInclination(String(preset.i));
  };

  // Self-check rows: runs the real binaryMassFunctionTests.js functions against

  // identities, edge cases, and (where cited) real reference data.

  const testRows = useMemo(() => getBinaryMassFunctionTestRows(), []);


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
    <div className="bmf" aria-label="Binary mass function calculator">
      <div className="bmf-header">
        <p className="bmf-title">Binary mass function calculator</p>
        <div className="bmf-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="bmf-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="bmf-explainer">
        From an orbital period P and RV semi-amplitude K alone —{" "}
        <code>f(M) = PK³/(2πG) · (1−e²)^1.5 = M2³sin³i / (M1+M2)²</code> — you get something
        genuinely useful even with the inclination i and the visible star's mass M1 completely
        unknown: <strong>f(M) is always a strict lower bound on the companion's mass</strong>,
        M2 ≥ f(M), true for any M1 and any i.
      </p>

      <div className="bmf-fields">
        <div className="bmf-field">
          <label htmlFor="bmf-p">Orbital period (P)</label>
          <div className="bmf-input-row">
            <input id="bmf-p" className="bmf-input" type="number" min="0" step="any" inputMode="decimal" value={P} onChange={(e) => setP(e.target.value)} />
            <select className="bmf-unit-select" value={PUnit} onChange={(e) => setPUnit(e.target.value)}>
              {PERIOD_UNIT_ORDER.map((u) => <option key={u} value={u}>{PERIOD_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
        <div className="bmf-field">
          <label htmlFor="bmf-k">RV semi-amplitude (K)</label>
          <div className="bmf-input-row">
            <input id="bmf-k" className="bmf-input" type="number" min="0" step="any" inputMode="decimal" value={K} onChange={(e) => setK(e.target.value)} />
            <select className="bmf-unit-select" value={KUnit} onChange={(e) => setKUnit(e.target.value)}>
              {VELOCITY_UNIT_ORDER.map((u) => <option key={u} value={u}>{VELOCITY_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
        <div className="bmf-field">
          <label htmlFor="bmf-e">Eccentricity (e) — optional</label>
          <input id="bmf-e" className="bmf-input" type="number" min="0" max="0.999" step="any" inputMode="decimal" value={e} onChange={(e2) => setE(e2.target.value)} />
        </div>
      </div>

      <div className="bmf-advanced-row">
        <button type="button" className={advanced ? "bmf-advanced-toggle active" : "bmf-advanced-toggle"} onClick={() => setAdvanced((v) => !v)}>
          {advanced ? "− Hide" : "+ Estimate companion mass"} (needs M1 and inclination)
        </button>
      </div>

      {advanced && (
        <div className="bmf-fields">
          <div className="bmf-field">
            <label htmlFor="bmf-m1">Visible star's estimated mass (M1)</label>
            <div className="bmf-input-row">
              <input id="bmf-m1" className="bmf-input" type="number" min="0" step="any" inputMode="decimal" value={M1} onChange={(e) => setM1(e.target.value)} />
              <span className="bmf-static-unit">M☉</span>
            </div>
          </div>
          <div className="bmf-field">
            <label htmlFor="bmf-i">Orbital inclination (i)</label>
            <div className="bmf-input-row">
              <input id="bmf-i" className="bmf-range-input" type="range" min="1" max="90" step="0.1" value={inclination} onChange={(e) => setInclination(e.target.value)} />
              <span className="bmf-static-unit">{parseFloat(inclination).toFixed(1)}°</span>
            </div>
          </div>
        </div>
      )}

      {!result.valid ? (
        <p className="bmf-note bmf-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="bmf-headline-card">
            <div className="bmf-headline">f(M) = {formatMsun(result.fM)} M☉</div>
            <div className="bmf-headline-sub">
              M2 ≥ {formatMsun(result.fM)} M☉ — regardless of inclination or the visible star's mass
            </div>
            {advanced && result.advancedValid && (
              <div className="bmf-headline-advanced">
                At i = {parseFloat(inclination).toFixed(1)}°, M1 ≈ {formatMsun(result.M1)} M☉ → M2 ≈{" "}
                <strong>{formatMsun(result.M2)} M☉</strong>
              </div>
            )}
          </div>

          {ruler && (
            <div className="bmf-chart-wrap">
              <svg
                className="bmf-ruler-svg"
                viewBox={`0 0 ${ruler.width} ${ruler.height}`}
                role="img"
                aria-label={`Mass ruler; companion mass must be at least ${formatMsun(result.fM)} solar masses`}
              >
                <line x1={ruler.marginLeft} x2={ruler.marginLeft + ruler.plotWidth} y1={ruler.y} y2={ruler.y} className="bmf-ruler-axis" />
                <rect x={ruler.fMX} y={ruler.y - 10} width={Math.max(0, ruler.marginLeft + ruler.plotWidth - ruler.fMX)} height="20" className="bmf-ruler-allowed-band" />
                {ruler.ticks.map((t) => (
                  <g key={t}>
                    <line x1={ruler.xScale(t)} x2={ruler.xScale(t)} y1={ruler.y - 5} y2={ruler.y + 5} className="bmf-ruler-tick" />
                    <text x={ruler.xScale(t)} y={ruler.y + 20} className="bmf-chart-axis-label" textAnchor="middle">{formatMsun(t)}</text>
                  </g>
                ))}

                {ruler.landmarks.map((lm) => (
                  <g key={lm.label}>
                    <line x1={lm.x} x2={lm.x} y1={ruler.y - 14} y2={ruler.y + 14} className="bmf-landmark-tick" />
                    <text x={lm.x} y={ruler.y + 42} className="bmf-landmark-label" textAnchor="middle">{lm.label}</text>
                  </g>
                ))}

                <line x1={ruler.fMX} x2={ruler.fMX} y1={ruler.y - 22} y2={ruler.y + 22} className="bmf-fm-marker" />
                <text x={ruler.fMX} y={ruler.y - 28} className="bmf-fm-label" textAnchor="middle">f(M) — hard lower bound</text>

                {ruler.m2X !== null && (
                  <>
                    <circle cx={ruler.m2X} cy={ruler.y} r="6" className="bmf-m2-point" />
                    <text x={ruler.m2X} y={ruler.y - 28} className="bmf-m2-label" textAnchor="middle">M2 at chosen i</text>
                  </>
                )}
              </svg>
              <p className="bmf-chart-caption">
                The shaded band is every mass the companion is allowed to have; the marked f(M) is
                its left edge. Landmark masses give a sense of the neutron-star/black-hole boundary.
              </p>
            </div>
          )}

          {curve && (
            <div className="bmf-chart-wrap">
              <svg
                className="bmf-curve-svg"
                viewBox={`0 0 ${curve.width} ${curve.height}`}
                role="img"
                aria-label="Plot of companion mass versus assumed inclination, log scale"
              >
                {curve.yTicks.map((t) => (
                  <g key={`y${t}`}>
                    <line x1={curve.marginLeft} x2={curve.marginLeft + curve.plotWidth} y1={curve.yScale(t)} y2={curve.yScale(t)} className="bmf-chart-gridline" />
                    <text x={curve.marginLeft - 8} y={curve.yScale(t) + 4} className="bmf-chart-axis-label" textAnchor="end">
                      10{toSuperscript(t)}
                    </text>
                  </g>
                ))}
                {curve.xTicks.map((t) => (
                  <g key={`x${t}`}>
                    <line x1={curve.xScale(t)} x2={curve.xScale(t)} y1={curve.marginTop} y2={curve.marginTop + curve.plotHeight} className="bmf-chart-gridline" />
                    <text x={curve.xScale(t)} y={curve.height - 12} className="bmf-chart-axis-label" textAnchor="middle">{t}°</text>
                  </g>
                ))}
                <line x1={curve.marginLeft} x2={curve.marginLeft} y1={curve.marginTop} y2={curve.marginTop + curve.plotHeight} className="bmf-chart-axis-line" />
                <line x1={curve.marginLeft} x2={curve.marginLeft + curve.plotWidth} y1={curve.marginTop + curve.plotHeight} y2={curve.marginTop + curve.plotHeight} className="bmf-chart-axis-line" />

                {curve.thresholdY !== null && (
                  <>
                    <line x1={curve.marginLeft} x2={curve.marginLeft + curve.plotWidth} y1={curve.thresholdY} y2={curve.thresholdY} className="bmf-threshold-line" />
                    <text x={curve.marginLeft + curve.plotWidth - 4} y={curve.thresholdY - 6} className="bmf-threshold-label" textAnchor="end">~3 M☉ (plausible NS/BH boundary)</text>
                  </>
                )}

                <polyline points={curve.linePoints} className="bmf-curve-line" />
                {curve.currentPoint && <circle cx={curve.currentPoint.x} cy={curve.currentPoint.y} r="5.5" className="bmf-curve-point" />}
              </svg>
              <p className="bmf-chart-caption">
                Required companion mass versus assumed inclination, for this f(M) and M1. Where the
                curve sits above the dashed line, the companion can't plausibly be a neutron star.
              </p>
            </div>
          )}
        </>
      )}

      <div className="bmf-footer-row">
        <CalculatorVote slug="binary-mass-function-calculator" />
        <CalculatorTests
          title="Binary Mass Function Calculator — Tests"
          columns={BINARY_MASS_FUNCTION_TEST_COLUMNS}
          rows={testRows}
          sources={BINARY_MASS_FUNCTION_TEST_SOURCES}
        />
        <button type="button" className="bmf-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
