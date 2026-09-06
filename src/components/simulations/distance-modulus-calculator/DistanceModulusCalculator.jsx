import { useEffect, useMemo, useState } from "react";
import {
  DISTANCE_UNITS,
  DISTANCE_UNIT_ORDER,
  LANDMARKS,
  distanceToParsecs,
  distanceFromParsecs,
  distanceModulus,
  apparentFromAbsolute,
  absoluteFromApparent,
  distanceFromMagnitudes,
} from "./distanceModulus";
import { DISTANCE_MODULUS_TEST_COLUMNS, DISTANCE_MODULUS_TEST_SOURCES, getDistanceModulusTestRows } from "./distanceModulusTests";
import "../../../styles/distanceModulusCalculator.css";
import "../../../styles/calculators.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import CalculatorTests from "../../CalculatorTests.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";
import Katex from "../../Katex.jsx";

// Every preset is self-consistent under all three "solve for" choices, so
// switching "solve for" after applying one never shows a jarring mismatch.
const PRESETS = [
  { label: "Textbook example (μ = 5)", solveFor: "distance", m: 10, M: 5, d: 100, dUnit: "pc", includeExtinction: false, extinction: "0" },
  { label: "Proxima Centauri (nearest star)", solveFor: "apparent", m: 11.17, M: 15.6, d: 1.3, dUnit: "pc", includeExtinction: false, extinction: "0" },
  { label: "Betelgeuse (with extinction)", solveFor: "distance", m: 0.42, M: -5.85, d: 163.68, dUnit: "pc", includeExtinction: true, extinction: "0.2" },
  { label: "Andromeda Galaxy (M31)", solveFor: "apparent", m: 3.12, M: -21.5, d: 765000, dUnit: "pc", includeExtinction: true, extinction: "0.2" },
  { label: "Dusty cluster star", solveFor: "absolute", m: 14, M: 2.5, d: 1000, dUnit: "pc", includeExtinction: true, extinction: "1.5" },
];

function trimTrailingZeros(s) {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}
const SUPERSCRIPT_MAP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
function toSuperscript(n) {
  return String(n).split("").map((ch) => SUPERSCRIPT_MAP[ch] ?? ch).join("");
}
function formatMag(n) {
  if (!Number.isFinite(n)) return "—";
  const v = Object.is(n, -0) ? 0 : n;
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}`;
}
function formatDistance(n) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1e6 || n < 1e-3) {
    const exp = Math.floor(Math.log10(n));
    const mantissa = n / Math.pow(10, exp);
    return `${trimTrailingZeros(mantissa.toFixed(3))} × 10${toSuperscript(exp)}`;
  }
  if (n >= 100) return trimTrailingZeros(n.toFixed(1));
  if (n >= 1) return trimTrailingZeros(n.toFixed(3));
  return trimTrailingZeros(n.toFixed(5));
}
/** A "nice" linear tick step (1/2/5 x a power of 10) covering `span` in ~targetCount ticks. */
function niceStep(span, targetCount = 5) {
  if (!(span > 0)) return 1;
  const raw = span / targetCount;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
  return step * mag;
}
/** Human label for 10^e parsecs, switching pc -> kpc -> Mpc at each threshold. */
function formatPcExponentLabel(e) {
  if (e < 3) return `${trimTrailingZeros((10 ** e).toString())} pc`;
  if (e < 6) return `${trimTrailingZeros((10 ** (e - 3)).toString())} kpc`;
  return `${trimTrailingZeros((10 ** (e - 6)).toString())} Mpc`;
}

const SOLVE_OPTIONS = [
  { key: "distance", label: "Distance" },
  { key: "apparent", label: "Apparent magnitude" },
  { key: "absolute", label: "Absolute magnitude" },
];

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
    m: str("m", "10"),
    M: str("M", "5"),
    d: str("d", "100"),
    dUnit: DISTANCE_UNITS[params.get("du")] ? params.get("du") : "pc",
    includeExtinction: params.get("ext") === "1",
    extinction: str("a", "0"),
  };
}

export default function DistanceModulusCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [solveFor, setSolveFor] = useState("distance");
  const [m, setM] = useState("10");
  const [M, setM2] = useState("5");
  const [d, setD] = useState("100");
  const [dUnit, setDUnit] = useState("pc");
  const [includeExtinction, setIncludeExtinction] = useState(false);
  const [extinction, setExtinction] = useState("0");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setSolveFor(initial.solveFor);
      setM(initial.m);
      setM2(initial.M);
      setD(initial.d);
      setDUnit(initial.dUnit);
      setIncludeExtinction(initial.includeExtinction);
      setExtinction(initial.extinction);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("solve", solveFor);
      params.set("m", m);
      params.set("M", M);
      params.set("d", d);
      params.set("du", dUnit);
      params.set("ext", includeExtinction ? "1" : "0");
      if (includeExtinction) params.set("a", extinction);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, solveFor, m, M, d, dUnit, includeExtinction, extinction]);

  const result = useMemo(() => {
    const A = includeExtinction ? parseFloat(extinction) || 0 : 0;
    if (solveFor === "distance") {
      const mNum = parseFloat(m);
      const MNum = parseFloat(M);
      if (!Number.isFinite(mNum) || !Number.isFinite(MNum)) {
        return { valid: false, reason: "Enter both an apparent and an absolute magnitude." };
      }
      const dPc = distanceFromMagnitudes(mNum, MNum, A);
      if (!(dPc > 0) || !Number.isFinite(dPc)) return { valid: false, reason: "That combination doesn't give a valid distance." };
      return { valid: true, quantity: "distance", m: mNum, M: MNum, A, dPc };
    }
    if (solveFor === "apparent") {
      const MNum = parseFloat(M);
      const dNum = parseFloat(d);
      if (!Number.isFinite(MNum) || !(dNum > 0)) {
        return { valid: false, reason: "Enter an absolute magnitude and a positive distance." };
      }
      const dPc = distanceToParsecs(dNum, dUnit);
      const mVal = apparentFromAbsolute(MNum, dPc, A);
      return { valid: true, quantity: "apparent", m: mVal, M: MNum, A, dPc };
    }
    const mNum = parseFloat(m);
    const dNum = parseFloat(d);
    if (!Number.isFinite(mNum) || !(dNum > 0)) {
      return { valid: false, reason: "Enter an apparent magnitude and a positive distance." };
    }
    const dPc = distanceToParsecs(dNum, dUnit);
    const MVal = absoluteFromApparent(mNum, dPc, A);
    return { valid: true, quantity: "absolute", m: mNum, M: MVal, A, dPc };
  }, [solveFor, m, M, d, dUnit, includeExtinction, extinction]);

  // --- distance ladder ---
  // Places the computed distance on a fixed log scale next to a handful
  // of well-known real distances, anchored on the 10 pc reference point
  // that absolute magnitude is defined at — turns "163 pc" from an
  // abstract number into "a bit farther than the Pleiades."
  const ladder = useMemo(() => {
    if (!result.valid) return null;
    const domainMin = 0; // 1 pc
    const domainMax = 8; // 100 Mpc
    const width = 640;
    const height = 190;
    const marginLeft = 30;
    const marginRight = 30;
    const y = 60;
    const plotWidth = width - marginLeft - marginRight;
    const xScale = (logPc) => marginLeft + ((logPc - domainMin) / (domainMax - domainMin)) * plotWidth;

    const ticks = [];
    for (let e = domainMin; e <= domainMax; e += 2) ticks.push(e);

    const logD = Math.log10(result.dPc);
    const clamped = Math.min(domainMax, Math.max(domainMin, logD));
    const offScale = clamped !== logD;

    const landmarks = LANDMARKS.map((lm) => ({
      ...lm,
      x: xScale(Math.min(domainMax, Math.max(domainMin, Math.log10(lm.pc)))),
    }));

    return { width, height, marginLeft, plotWidth, y, xScale, ticks, landmarks, markerX: xScale(clamped), offScale };
  }, [result]);

  // --- distance-modulus vs. distance chart ---
  // m - M = 5 log10(d/10) + A is linear in log10(d) with a fixed slope of
  // 5 — exactly a straight line in semi-log space. When extinction is
  // included, a second dashed line without it shows exactly how much
  // fainter dust makes the object look at the same true distance.
  const chart = useMemo(() => {
    if (!result.valid) return null;
    const { dPc, A } = result;
    const mu = result.m - result.M;
    const logD = Math.log10(dPc);
    const lineAt = (x, a) => 5 * x - 5 + a;

    const xPad = 1.3;
    const xMin = logD - xPad;
    const xMax = logD + xPad;

    const yValsA = [lineAt(xMin, A), lineAt(xMax, A)];
    const yVals0 = A !== 0 ? [lineAt(xMin, 0), lineAt(xMax, 0)] : [];
    const allY = [...yValsA, ...yVals0, mu];
    const ySpan = Math.max(...allY) - Math.min(...allY);
    const yPad = Math.max(ySpan * 0.2, 1);
    const yMin = Math.min(...allY) - yPad;
    const yMax = Math.max(...allY) + yPad;

    const width = 640;
    const height = 320;
    const marginLeft = 56;
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
    const yStep = niceStep(yMax - yMin, 5);
    const yTickStart = Math.ceil(yMin / yStep) * yStep;
    const yTicks = [];
    for (let t = yTickStart; t <= yMax + 1e-9; t += yStep) yTicks.push(Math.round(t / yStep) * yStep);

    return {
      width, height, marginLeft, marginRight, marginTop, marginBottom, plotWidth, plotHeight,
      xScale, yScale,
      lineA: { x1: xScale(xMin), y1: yScale(lineAt(xMin, A)), x2: xScale(xMax), y2: yScale(lineAt(xMax, A)) },
      line0: A !== 0 ? { x1: xScale(xMin), y1: yScale(lineAt(xMin, 0)), x2: xScale(xMax), y2: yScale(lineAt(xMax, 0)) } : null,
      point: { x: xScale(logD), y: yScale(mu) },
      noExtPoint: A !== 0 ? { x: xScale(logD), y: yScale(lineAt(logD, 0)) } : null,
      xTicks: decadeTicks(xMin, xMax),
      yTicks,
    };
  }, [result]);

  // Self-check rows: runs the real distanceModulus.js functions against
  // known reference objects and edge cases — independent of the fields
  // above.
  const testRows = useMemo(() => getDistanceModulusTestRows(), []);

  const applyPreset = (preset) => {
    setSolveFor(preset.solveFor);
    setM(String(preset.m));
    setM2(String(preset.M));
    setD(String(preset.d));
    setDUnit(preset.dUnit);
    setIncludeExtinction(preset.includeExtinction);
    setExtinction(preset.extinction);
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
    <div className="dmc" aria-label="Distance modulus calculator">
      <div className="dmc-header">
        <p className="dmc-title">Distance modulus calculator</p>
        <div className="dmc-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="dmc-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="dmc-explainer">
        Absolute magnitude <Katex tex="M" /> is defined as the apparent magnitude an object would have if moved to
        exactly <strong>10 parsecs</strong> away. The gap between the two, <Katex tex="m - M" />, is the{" "}
        <strong>distance modulus</strong> — purely a function of distance (plus dust dimming, if
        any): <Katex tex={String.raw`m - M = 5\log_{10}(d/10\,\mathrm{pc}) + A`} />. Give any two of{" "}
        <Katex tex="m" />, <Katex tex="M" />, and <Katex tex="d" />, and this
        solves for the third.
      </p>

      <div className="dmc-solve-toggle" role="group" aria-label="Solve for">
        {SOLVE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={opt.key === solveFor ? "dmc-solve-btn active" : "dmc-solve-btn"}
            onClick={() => setSolveFor(opt.key)}
          >
            Solve for {opt.label}
          </button>
        ))}
      </div>

      <div className="dmc-fields">
        <div className="dmc-field">
          <label htmlFor="dmc-m">Apparent magnitude (<Katex tex="m" />)</label>
          {solveFor === "apparent" ? (
            <div className="dmc-computed">{result.valid ? formatMag(result.m) : "—"}</div>
          ) : (
            <input
              id="dmc-m"
              className="dmc-input"
              type="number"
              step="any"
              inputMode="decimal"
              value={m}
              onChange={(e) => setM(e.target.value)}
            />
          )}
        </div>

        <div className="dmc-field">
          <label htmlFor="dmc-M">Absolute magnitude (<Katex tex="M" />)</label>
          {solveFor === "absolute" ? (
            <div className="dmc-computed">{result.valid ? formatMag(result.M) : "—"}</div>
          ) : (
            <input
              id="dmc-M"
              className="dmc-input"
              type="number"
              step="any"
              inputMode="decimal"
              value={M}
              onChange={(e) => setM2(e.target.value)}
            />
          )}
        </div>

        <div className="dmc-field">
          <label htmlFor="dmc-d">Distance (<Katex tex="d" />)</label>
          {solveFor === "distance" ? (
            <div className="dmc-computed">
              {result.valid ? formatDistance(distanceFromParsecs(result.dPc, dUnit)) : "—"}
              <select className="dmc-unit-select" value={dUnit} onChange={(e) => setDUnit(e.target.value)}>
                {DISTANCE_UNIT_ORDER.map((u) => (
                  <option key={u} value={u}>{DISTANCE_UNITS[u].short}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="dmc-input-row">
              <input
                id="dmc-d"
                className="dmc-input"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={d}
                onChange={(e) => setD(e.target.value)}
              />
              <select className="dmc-unit-select" value={dUnit} onChange={(e) => setDUnit(e.target.value)}>
                {DISTANCE_UNIT_ORDER.map((u) => (
                  <option key={u} value={u}>{DISTANCE_UNITS[u].short}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="dmc-extinction-row">
        <button
          type="button"
          className={includeExtinction ? "dmc-extinction-toggle active" : "dmc-extinction-toggle"}
          onClick={() => setIncludeExtinction((v) => !v)}
        >
          {includeExtinction ? "− Remove" : "+ Include"} interstellar extinction (<Katex tex="A" />)
        </button>
        {includeExtinction && (
          <input
            className="dmc-extinction-input"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="A, in magnitudes"
            value={extinction}
            onChange={(e) => setExtinction(e.target.value)}
          />
        )}
      </div>

      {!result.valid ? (
        <p className="dmc-note dmc-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="dmc-headline-card">
            <div className="dmc-headline"><Katex tex="\mu = m - M" /> = {formatMag(result.m - result.M)}</div>
            <div className="dmc-headline-sub">
              <Katex tex="d" /> = {formatDistance(distanceFromParsecs(result.dPc, dUnit))} {DISTANCE_UNITS[dUnit].short}
              {result.A !== 0 && <> (<Katex tex="A" /> = {formatMag(result.A).replace("+", "")} mag included)</>}
            </div>
          </div>

          {ladder && (
            <div className="chart-wrap">
              <svg
                className="dmc-ladder-svg"
                viewBox={`0 0 ${ladder.width} ${ladder.height}`}
                role="img"
                aria-label={`Distance ladder; computed distance is ${formatDistance(distanceFromParsecs(result.dPc, dUnit))} ${DISTANCE_UNITS[dUnit].short}`}
              >
                <line x1={ladder.marginLeft} x2={ladder.marginLeft + ladder.plotWidth} y1={ladder.y} y2={ladder.y} className="dmc-ladder-axis" />
                {ladder.ticks.map((e) => (
                  <g key={e}>
                    <line x1={ladder.xScale(e)} x2={ladder.xScale(e)} y1={ladder.y - 5} y2={ladder.y + 5} className="dmc-ladder-tick" />
                    <text x={ladder.xScale(e)} y={ladder.y + 20} className="dmc-chart-axis-label" textAnchor="middle">
                      {formatPcExponentLabel(e)}
                    </text>
                  </g>
                ))}

                {ladder.landmarks.map((lm) => (
                  <g key={lm.label}>
                    <line x1={lm.x} x2={lm.x} y1={ladder.y - 4} y2={ladder.y + 4} className={lm.special ? "dmc-landmark-tick dmc-landmark-tick--special" : "dmc-landmark-tick"} />
                    <text x={lm.x} y={ladder.y + 42} className={lm.special ? "dmc-landmark-label dmc-landmark-label--special" : "dmc-landmark-label"} textAnchor="middle">
                      {lm.label}
                    </text>
                  </g>
                ))}

                <polygon
                  points={`${ladder.markerX - 7},${ladder.y - 26} ${ladder.markerX + 7},${ladder.y - 26} ${ladder.markerX},${ladder.y - 9}`}
                  className="dmc-ladder-marker"
                />
                <text x={ladder.markerX} y={ladder.y - 31} className="dmc-ladder-marker-label" textAnchor="middle">
                  {ladder.offScale ? "off scale — " : ""}this object
                </text>
              </svg>
              <p className="dmc-chart-caption">
                Log-scale distance ladder, from 1 pc to 100 Mpc, anchored on the 10 pc reference
                distance that absolute magnitude is defined at.
              </p>
            </div>
          )}

          {chart && (
            <div className="chart-wrap">
              <svg
                className="dmc-chart-svg"
                viewBox={`0 0 ${chart.width} ${chart.height}`}
                role="img"
                aria-label="Semi-log plot of distance modulus versus distance; the relation is a straight line of slope 5"
              >
                {chart.xTicks.map((e) => (
                  <g key={`x${e}`}>
                    <line x1={chart.xScale(e)} x2={chart.xScale(e)} y1={chart.marginTop} y2={chart.marginTop + chart.plotHeight} className="dmc-chart-gridline" />
                    <text x={chart.xScale(e)} y={chart.height - 12} className="dmc-chart-axis-label" textAnchor="middle">
                      {formatPcExponentLabel(e)}
                    </text>
                  </g>
                ))}
                {chart.yTicks.map((t) => (
                  <g key={`y${t}`}>
                    <line x1={chart.marginLeft} x2={chart.marginLeft + chart.plotWidth} y1={chart.yScale(t)} y2={chart.yScale(t)} className="dmc-chart-gridline" />
                    <text x={chart.marginLeft - 8} y={chart.yScale(t) + 4} className="dmc-chart-axis-label" textAnchor="end">
                      {formatMag(t)}
                    </text>
                  </g>
                ))}
                <line x1={chart.marginLeft} x2={chart.marginLeft} y1={chart.marginTop} y2={chart.marginTop + chart.plotHeight} className="dmc-chart-axis-line" />
                <line x1={chart.marginLeft} x2={chart.marginLeft + chart.plotWidth} y1={chart.marginTop + chart.plotHeight} y2={chart.marginTop + chart.plotHeight} className="dmc-chart-axis-line" />

                {chart.line0 && (
                  <line x1={chart.line0.x1} y1={chart.line0.y1} x2={chart.line0.x2} y2={chart.line0.y2} className="dmc-chart-fit-line dmc-chart-fit-line--noext" strokeDasharray="6 5" />
                )}
                <line x1={chart.lineA.x1} y1={chart.lineA.y1} x2={chart.lineA.x2} y2={chart.lineA.y2} className="dmc-chart-fit-line" />

                {chart.noExtPoint && (
                  <line x1={chart.point.x} y1={chart.point.y} x2={chart.noExtPoint.x} y2={chart.noExtPoint.y} className="dmc-chart-connector" />
                )}

                <circle cx={chart.point.x} cy={chart.point.y} r="5" className="dmc-chart-point" />
                <text x={chart.point.x + 9} y={chart.point.y - 8} className="dmc-chart-point-label">this object</text>

                {chart.noExtPoint && (
                  <>
                    <circle cx={chart.noExtPoint.x} cy={chart.noExtPoint.y} r="4" className="dmc-chart-point dmc-chart-point--noext" />
                    <text x={chart.noExtPoint.x + 8} y={chart.noExtPoint.y + 14} className="dmc-chart-point-label dmc-chart-point-label--noext">
                      without extinction
                    </text>
                  </>
                )}
              </svg>
              <p className="dmc-chart-caption">
                Semi-log plot — the distance modulus relation is a straight line of slope 5 here.
                {chart.line0 ? " The dashed line shows the same distance with no dust dimming; the gap between the two points is exactly A." : " Toggle on extinction above to see how dust shifts this line."}
              </p>
            </div>
          )}
        </>
      )}

      <div className="dmc-footer-row">
        <CalculatorVote slug="distance-modulus-calculator" />
        <CalculatorTests
          title="Distance Modulus Calculator — Tests"
          columns={DISTANCE_MODULUS_TEST_COLUMNS}
          rows={testRows}
          sources={DISTANCE_MODULUS_TEST_SOURCES}
        />
        <button type="button" className="dmc-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
