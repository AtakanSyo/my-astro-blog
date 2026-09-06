import { useEffect, useMemo, useState } from "react";
import {
  PERIOD_UNITS,
  PERIOD_UNIT_ORDER,
  DISTANCE_UNITS,
  DISTANCE_UNIT_ORDER,
  MASS_UNITS,
  MASS_UNIT_ORDER,
  periodToSeconds,
  periodFromSeconds,
  distanceToMeters,
  distanceFromMeters,
  massToKg,
  massFromKg,
  periodFromAxisMass,
  axisFromPeriodMass,
  massFromPeriodAxis,
  simplifiedPeriodYears,
  simplifiedAxisAU,
} from "./keplerThirdLaw";
import { KEPLER_THIRD_LAW_TEST_COLUMNS, KEPLER_THIRD_LAW_TEST_SOURCES, getKeplerThirdLawTestRows } from "./keplerThirdLawTests";
import "../../../styles/keplerThirdLawCalculator.css";
import "../../../styles/calculators.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import CalculatorTests from "../../CalculatorTests.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";
import Katex from "../../Katex.jsx";

// Every preset is self-consistent and solves for the field its narrative
// is actually about: Earth and the ISS both solve for period (one shows
// the shortcut working fine, the other shows it failing by ~2.5 orders
// of magnitude), while the hot Jupiter and binary pulsar both solve for
// total mass — the same "recover a mass from an orbit" move this site's
// binary mass function calculator makes for the invisible companion in
// an X-ray binary.
const PRESETS = [
  { label: "Earth around the Sun", solveFor: "period", P: "365.25", PUnit: "day", a: "1", aUnit: "au", M1: "1", M1Unit: "msun", M2: "1", M2Unit: "mearth" },
  { label: "The ISS around Earth", solveFor: "period", P: "92.68", PUnit: "minute", a: "6798", aUnit: "km", M1: "1", M1Unit: "mearth", M2: "0", M2Unit: "mearth" },
  { label: "A hot Jupiter (WASP-12b)", solveFor: "mass", P: "1.09142", PUnit: "day", a: "0.0234", aUnit: "au", M1: "1", M1Unit: "msun", M2: "1.4", M2Unit: "mjup" },
  { label: "Binary pulsar (Hulse–Taylor)", solveFor: "mass", P: "7.751939", PUnit: "hour", a: "2.8032", aUnit: "rsun", M1: "1.44", M1Unit: "msun", M2: "1.39", M2Unit: "msun" },
];

const SOLVE_FOR_OPTIONS = [
  { key: "period", label: "Orbital period" },
  { key: "axis", label: "Semi-major axis" },
  { key: "mass", label: "Total mass" },
];

function trimTrailingZeros(s) {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}
const SUPERSCRIPT_MAP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
function toSuperscript(n) {
  return String(n).split("").map((ch) => SUPERSCRIPT_MAP[ch] ?? ch).join("");
}
function formatNumber(n) {
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
function percentDiff(a, b) {
  if (b === 0) return a === 0 ? 0 : Infinity;
  return Math.abs((a - b) / b) * 100;
}
function formatPercent(pct) {
  if (!Number.isFinite(pct)) return "∞%";
  if (pct >= 100) return `${formatNumber(pct)}%`;
  if (pct >= 10) return `${trimTrailingZeros(pct.toFixed(1))}%`;
  return `${trimTrailingZeros(pct.toFixed(2))}%`;
}
function niceLogTicks(min, max, targetCount = 6) {
  const span = max - min;
  const step = span <= targetCount ? 1 : Math.ceil(span / targetCount);
  const start = Math.ceil(min / step) * step;
  const ticks = [];
  for (let t = start; t <= max; t += step) ticks.push(t);
  return ticks;
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const sf = params.get("sf");
  if (!sf || !["period", "axis", "mass"].includes(sf)) return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  return {
    solveFor: sf,
    P: num("p", "365.25"),
    PUnit: PERIOD_UNITS[params.get("pu")] ? params.get("pu") : "day",
    a: num("a", "1"),
    aUnit: DISTANCE_UNITS[params.get("au")] ? params.get("au") : "au",
    M1: num("m1", "1"),
    M1Unit: MASS_UNITS[params.get("m1u")] ? params.get("m1u") : "msun",
    M2: num("m2", "1"),
    M2Unit: MASS_UNITS[params.get("m2u")] ? params.get("m2u") : "mearth",
    showSimplified: params.get("cmp") !== "0",
  };
}

export default function KeplerThirdLawCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these
  // (the Earth/Sun preset). Any URL-encoded state is applied client-side,
  // after mount, below.
  const [solveFor, setSolveFor] = useState("period");
  const [P, setP] = useState("365.25");
  const [PUnit, setPUnit] = useState("day");
  const [a, setA] = useState("1");
  const [aUnit, setAUnit] = useState("au");
  const [M1, setM1] = useState("1");
  const [M1Unit, setM1Unit] = useState("msun");
  const [M2, setM2] = useState("1");
  const [M2Unit, setM2Unit] = useState("mearth");
  const [showSimplified, setShowSimplified] = useState(true);
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setSolveFor(initial.solveFor);
      setP(initial.P);
      setPUnit(initial.PUnit);
      setA(initial.a);
      setAUnit(initial.aUnit);
      setM1(initial.M1);
      setM1Unit(initial.M1Unit);
      setM2(initial.M2);
      setM2Unit(initial.M2Unit);
      setShowSimplified(initial.showSimplified);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("sf", solveFor);
      params.set("p", P);
      params.set("pu", PUnit);
      params.set("a", a);
      params.set("au", aUnit);
      params.set("m1", M1);
      params.set("m1u", M1Unit);
      params.set("m2", M2);
      params.set("m2u", M2Unit);
      params.set("cmp", showSimplified ? "1" : "0");
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, solveFor, P, PUnit, a, aUnit, M1, M1Unit, M2, M2Unit, showSimplified]);

  const result = useMemo(() => {
    const Pnum = parseFloat(P);
    const anum = parseFloat(a);
    const M1num = parseFloat(M1);
    const M2raw = parseFloat(M2);
    const M2num = Number.isFinite(M2raw) && M2raw >= 0 ? M2raw : 0;

    const Ps = Number.isFinite(Pnum) && Pnum > 0 ? periodToSeconds(Pnum, PUnit) : null;
    const a_m = Number.isFinite(anum) && anum > 0 ? distanceToMeters(anum, aUnit) : null;
    const M1_kg = Number.isFinite(M1num) && M1num >= 0 ? massToKg(M1num, M1Unit) : null;
    const M2_kg = massToKg(M2num, M2Unit);
    const Mtotal_kg_input = M1_kg !== null ? M1_kg + M2_kg : null;

    let P_s_final = Ps;
    let a_m_final = a_m;
    let Mtotal_kg_final = Mtotal_kg_input;

    if (solveFor === "period") {
      if (!(a_m > 0) || !(Mtotal_kg_input > 0)) {
        return { valid: false, reason: "Enter a positive semi-major axis and a positive primary mass." };
      }
      P_s_final = periodFromAxisMass(a_m, Mtotal_kg_input);
      if (P_s_final === null) return { valid: false, reason: "Couldn't solve for a period with these inputs." };
    } else if (solveFor === "axis") {
      if (!(Ps > 0) || !(Mtotal_kg_input > 0)) {
        return { valid: false, reason: "Enter a positive orbital period and a positive primary mass." };
      }
      a_m_final = axisFromPeriodMass(Ps, Mtotal_kg_input);
      if (a_m_final === null) return { valid: false, reason: "Couldn't solve for a semi-major axis with these inputs." };
    } else {
      if (!(Ps > 0) || !(a_m > 0)) {
        return { valid: false, reason: "Enter a positive orbital period and a positive semi-major axis." };
      }
      Mtotal_kg_final = massFromPeriodAxis(Ps, a_m);
      if (Mtotal_kg_final === null) return { valid: false, reason: "Couldn't solve for a mass with these inputs." };
    }

    const a_AU = distanceFromMeters(a_m_final, "au");
    const P_yr = periodFromSeconds(P_s_final, "year");
    const Mtotal_Msun = massFromKg(Mtotal_kg_final, "msun");

    let comparison = null;
    if (solveFor === "period") {
      const simplified_P_yr = simplifiedPeriodYears(a_AU);
      comparison = {
        quantityLabel: "orbital period",
        generalValue: P_yr,
        simplifiedValue: simplified_P_yr,
        unitShort: "yr",
        pct: simplified_P_yr !== null ? percentDiff(simplified_P_yr, P_yr) : null,
      };
    } else if (solveFor === "axis") {
      const simplified_a_AU = simplifiedAxisAU(P_yr);
      comparison = {
        quantityLabel: "semi-major axis",
        generalValue: a_AU,
        simplifiedValue: simplified_a_AU,
        unitShort: "AU",
        pct: simplified_a_AU !== null ? percentDiff(simplified_a_AU, a_AU) : null,
      };
    } else {
      comparison = {
        quantityLabel: "total system mass",
        generalValue: Mtotal_Msun,
        simplifiedValue: 1,
        unitShort: "M☉",
        pct: percentDiff(1, Mtotal_Msun),
      };
    }

    return {
      valid: true,
      P_s: P_s_final,
      a_m: a_m_final,
      Mtotal_kg: Mtotal_kg_final,
      a_AU,
      P_yr,
      Mtotal_Msun,
      comparison,
    };
  }, [solveFor, P, PUnit, a, aUnit, M1, M1Unit, M2, M2Unit]);

  // --- divergence chart: log10(P[yr]) vs log10(a[AU]) ---
  // In these units Kepler's third law reduces exactly to
  // P[yr]² = a[AU]³ / M[M☉], so at fixed mass it's a straight line of
  // slope 1.5 in log-log space; changing the mass slides that whole line
  // up or down by exactly -0.5·log10(M), never changing its slope. The
  // shortcut (M fixed at 1) is that same line pinned to zero offset.
  const chart = useMemo(() => {
    if (!result.valid || !showSimplified) return null;
    const logA = Math.log10(result.a_AU);
    const logM = Math.log10(result.Mtotal_Msun);
    const offset = -0.5 * logM;
    const yGen = (x) => 1.5 * x + offset;
    const ySimp = (x) => 1.5 * x;

    const xMin = Math.min(logA, 0) - 1.5;
    const xMax = Math.max(logA, 0) + 1.5;
    const candidateYs = [yGen(xMin), yGen(xMax), ySimp(xMin), ySimp(xMax)];
    const yMin = Math.min(...candidateYs) - 0.3;
    const yMax = Math.max(...candidateYs) + 0.3;

    const width = 640;
    const height = 320;
    const marginLeft = 52;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 42;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;
    const xScale = (x) => marginLeft + ((x - xMin) / (xMax - xMin)) * plotWidth;
    const yScale = (y) => marginTop + (1 - (y - yMin) / (yMax - yMin)) * plotHeight;

    const genLine = `${xScale(xMin)},${yScale(yGen(xMin))} ${xScale(xMax)},${yScale(yGen(xMax))}`;
    const simpLine = `${xScale(xMin)},${yScale(ySimp(xMin))} ${xScale(xMax)},${yScale(ySimp(xMax))}`;

    const px = xScale(logA);
    const pyGen = yScale(yGen(logA));
    const pySimp = yScale(ySimp(logA));

    const xTicks = niceLogTicks(xMin, xMax);
    const yTicks = niceLogTicks(yMin, yMax);

    return {
      width, height, marginLeft, marginRight, marginTop, marginBottom, plotWidth, plotHeight,
      xScale, yScale, genLine, simpLine, px, pyGen, pySimp, xTicks, yTicks,
    };
  }, [result, showSimplified]);

  const applyPreset = (preset) => {
    setSolveFor(preset.solveFor);
    setP(preset.P);
    setPUnit(preset.PUnit);
    setA(preset.a);
    setAUnit(preset.aUnit);
    setM1(preset.M1);
    setM1Unit(preset.M1Unit);
    setM2(preset.M2);
    setM2Unit(preset.M2Unit);
  };

  const testRows = useMemo(() => getKeplerThirdLawTestRows(), []);

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

  const meterPct = result.valid && result.comparison ? result.comparison.pct : null;
  const meterWidth = meterPct !== null && Number.isFinite(meterPct) ? Math.max(2, Math.min(100, (Math.log10(1 + meterPct) / Math.log10(1 + 100000)) * 100)) : 0;
  const meterClass = meterPct === null ? "" : meterPct < 5 ? "ktl-meter-good" : meterPct < 50 ? "ktl-meter-warn" : "ktl-meter-bad";

  return (
    <div className="ktl" aria-label="Kepler's third law calculator">
      <div className="ktl-header">
        <p className="ktl-title">Kepler's third law calculator</p>
        <div className="ktl-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="ktl-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="ktl-explainer">
        <Katex tex={String.raw`P^2 = \dfrac{4\pi^2 a^3}{G(M_1+M_2)}`} /> relates an orbital period <Katex tex="P" />, a
        semi-major axis <Katex tex="a" />, and the total mass of the two orbiting bodies —
        pick which one to solve for, and the other two become the inputs.
      </p>

      <div className="ktl-solvefor-row">
        <span className="ktl-solvefor-label">Solve for</span>
        <div className="ktl-solvefor-group">
          {SOLVE_FOR_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={solveFor === opt.key ? "ktl-solvefor-btn active" : "ktl-solvefor-btn"}
              onClick={() => setSolveFor(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ktl-fields">
        <div className={solveFor === "period" ? "ktl-field ktl-field--solved" : "ktl-field"}>
          <label htmlFor={solveFor === "period" ? undefined : "ktl-p"}>Orbital period (<Katex tex="P" />){solveFor === "period" && <span className="ktl-solved-tag">solved</span>}</label>
          <div className="ktl-input-row">
            {solveFor === "period" ? (
              <div className="ktl-computed-value">{result.valid ? formatNumber(periodFromSeconds(result.P_s, PUnit)) : "—"}</div>
            ) : (
              <input id="ktl-p" className="ktl-input" type="number" min="0" step="any" inputMode="decimal" value={P} onChange={(e) => setP(e.target.value)} />
            )}
            <select className="ktl-unit-select" value={PUnit} onChange={(e) => setPUnit(e.target.value)}>
              {PERIOD_UNIT_ORDER.map((u) => <option key={u} value={u}>{PERIOD_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>

        <div className={solveFor === "axis" ? "ktl-field ktl-field--solved" : "ktl-field"}>
          <label htmlFor={solveFor === "axis" ? undefined : "ktl-a"}>Semi-major axis (<Katex tex="a" />){solveFor === "axis" && <span className="ktl-solved-tag">solved</span>}</label>
          <div className="ktl-input-row">
            {solveFor === "axis" ? (
              <div className="ktl-computed-value">{result.valid ? formatNumber(distanceFromMeters(result.a_m, aUnit)) : "—"}</div>
            ) : (
              <input id="ktl-a" className="ktl-input" type="number" min="0" step="any" inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} />
            )}
            <select className="ktl-unit-select" value={aUnit} onChange={(e) => setAUnit(e.target.value)}>
              {DISTANCE_UNIT_ORDER.map((u) => <option key={u} value={u}>{DISTANCE_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>

        {solveFor === "mass" ? (
          <div className="ktl-field ktl-field--solved">
            <label>Total mass (<Katex tex="M_1+M_2" />)<span className="ktl-solved-tag">solved</span></label>
            <div className="ktl-input-row">
              <div className="ktl-computed-value">{result.valid ? formatNumber(massFromKg(result.Mtotal_kg, M1Unit)) : "—"}</div>
              <select className="ktl-unit-select" value={M1Unit} onChange={(e) => setM1Unit(e.target.value)}>
                {MASS_UNIT_ORDER.map((u) => <option key={u} value={u}>{MASS_UNITS[u].short}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="ktl-mass-block">
            <div className="ktl-field">
              <label htmlFor="ktl-m1">Primary mass (<Katex tex="M_1" />)</label>
              <div className="ktl-input-row">
                <input id="ktl-m1" className="ktl-input" type="number" min="0" step="any" inputMode="decimal" value={M1} onChange={(e) => setM1(e.target.value)} />
                <select className="ktl-unit-select" value={M1Unit} onChange={(e) => setM1Unit(e.target.value)}>
                  {MASS_UNIT_ORDER.map((u) => <option key={u} value={u}>{MASS_UNITS[u].short}</option>)}
                </select>
              </div>
            </div>
            <div className="ktl-field">
              <label htmlFor="ktl-m2">Secondary / orbiting mass (<Katex tex="M_2" />) — optional, often negligible</label>
              <div className="ktl-input-row">
                <input id="ktl-m2" className="ktl-input" type="number" min="0" step="any" inputMode="decimal" value={M2} onChange={(e) => setM2(e.target.value)} />
                <select className="ktl-unit-select" value={M2Unit} onChange={(e) => setM2Unit(e.target.value)}>
                  {MASS_UNIT_ORDER.map((u) => <option key={u} value={u}>{MASS_UNITS[u].short}</option>)}
                </select>
              </div>
            </div>
            {result.valid && (
              <p className="ktl-subtotal">Total mass (<Katex tex="M_1+M_2" />) ≈ {formatNumber(massFromKg(result.Mtotal_kg, "msun"))} M☉</p>
            )}
          </div>
        )}
      </div>

      <div className="ktl-simplified-row">
        <button type="button" className={showSimplified ? "ktl-simplified-toggle active" : "ktl-simplified-toggle"} onClick={() => setShowSimplified((v) => !v)}>
          {showSimplified ? "− Hide" : "+ Compare to"} the <Katex tex="P^2=a^3" /> solar-system shortcut
        </button>
      </div>

      {!result.valid ? (
        <p className="ktl-note ktl-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="ktl-headline-card">
            <div className="ktl-headline">
              {solveFor === "period" && <><Katex tex="P" /> = {formatNumber(periodFromSeconds(result.P_s, PUnit))} {PERIOD_UNITS[PUnit].short}</>}
              {solveFor === "axis" && <><Katex tex="a" /> = {formatNumber(distanceFromMeters(result.a_m, aUnit))} {DISTANCE_UNITS[aUnit].short}</>}
              {solveFor === "mass" && <><Katex tex="M_1+M_2" /> = {formatNumber(massFromKg(result.Mtotal_kg, M1Unit))} {MASS_UNITS[M1Unit].short}</>}
            </div>

            {showSimplified && result.comparison && (
              <>
                <div className="ktl-headline-sub">
                  Shortcut (<Katex tex="P^2=a^3" />, assumes 1 M☉) would give{" "}
                  {solveFor === "mass" ? (
                    <>1 M☉ — off by <strong>{formatPercent(result.comparison.pct)}</strong></>
                  ) : (
                    <>{result.comparison.simplifiedValue !== null ? formatNumber(result.comparison.simplifiedValue) : "—"} {result.comparison.unitShort} — off by{" "}
                    <strong>{result.comparison.pct !== null ? formatPercent(result.comparison.pct) : "—"}</strong></>
                  )}
                </div>
                <div className="ktl-meter-track">
                  <div className={`ktl-meter-fill ${meterClass}`} style={{ width: `${meterWidth}%` }} />
                </div>
              </>
            )}
          </div>

          {chart && (
            <div className="chart-wrap">
              <svg
                className="ktl-chart-svg"
                viewBox={`0 0 ${chart.width} ${chart.height}`}
                role="img"
                aria-label="Log-log plot of orbital period versus semi-major axis, comparing this system's mass to the solar-system shortcut's fixed 1 solar mass"
              >
                {chart.yTicks.map((t) => (
                  <g key={`y${t}`}>
                    <line x1={chart.marginLeft} x2={chart.marginLeft + chart.plotWidth} y1={chart.yScale(t)} y2={chart.yScale(t)} className="ktl-chart-gridline" />
                    <text x={chart.marginLeft - 8} y={chart.yScale(t) + 4} className="ktl-chart-axis-label" textAnchor="end">10{toSuperscript(t)} yr</text>
                  </g>
                ))}
                {chart.xTicks.map((t) => (
                  <g key={`x${t}`}>
                    <line x1={chart.xScale(t)} x2={chart.xScale(t)} y1={chart.marginTop} y2={chart.marginTop + chart.plotHeight} className="ktl-chart-gridline" />
                    <text x={chart.xScale(t)} y={chart.height - 14} className="ktl-chart-axis-label" textAnchor="middle">10{toSuperscript(t)} AU</text>
                  </g>
                ))}
                <line x1={chart.marginLeft} x2={chart.marginLeft} y1={chart.marginTop} y2={chart.marginTop + chart.plotHeight} className="ktl-chart-axis-line" />
                <line x1={chart.marginLeft} x2={chart.marginLeft + chart.plotWidth} y1={chart.marginTop + chart.plotHeight} y2={chart.marginTop + chart.plotHeight} className="ktl-chart-axis-line" />

                <polyline points={chart.simpLine} className="ktl-simp-line" />
                <polyline points={chart.genLine} className="ktl-gen-line" />

                <line x1={chart.px} x2={chart.px} y1={chart.pyGen} y2={chart.pySimp} className="ktl-gap-line" />
                <circle cx={chart.px} cy={chart.pyGen} r="5.5" className="ktl-gen-point" />
                <circle cx={chart.px} cy={chart.pySimp} r="4" className="ktl-simp-point" />

                <text x={chart.marginLeft + 6} y={chart.marginTop + 14} className="ktl-legend-gen" textAnchor="start">— this system (M ≈ {formatNumber(result.Mtotal_Msun)} M☉)</text>
                <text x={chart.marginLeft + 6} y={chart.marginTop + 28} className="ktl-legend-simp" textAnchor="start">- - shortcut (fixed at 1 M☉)</text>
              </svg>
              <p className="ktl-chart-caption">
                Both lines have the same slope — Kepler's third law's shape never changes — but a
                system's total mass slides its line up or down. The dashed vertical gap at this
                system's semi-major axis is exactly how far off the <Katex tex="P^2=a^3" /> shortcut is here.
              </p>
            </div>
          )}
        </>
      )}

      <div className="ktl-footer-row">
        <CalculatorVote slug="kepler-third-law-calculator" />
        <CalculatorTests
          title="Kepler's Third Law Calculator — Tests"
          columns={KEPLER_THIRD_LAW_TEST_COLUMNS}
          rows={testRows}
          sources={KEPLER_THIRD_LAW_TEST_SOURCES}
        />
        <button type="button" className="ktl-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
