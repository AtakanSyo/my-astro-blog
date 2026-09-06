import { useEffect, useMemo, useState } from "react";
import {
  MASS_UNITS,
  MASS_UNIT_ORDER,
  AGE_OF_UNIVERSE_YEARS,
  massToKg,
  massFromKg,
  evaporationTimeYears,
  ageOfUniverseMultiple,
  massEvaporatingTodayKg,
} from "./evaporationTime";
import "../../../styles/blackHoleEvaporationTimeCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";

// The mass at which a Schwarzschild black hole's Hawking-radiation
// lifetime exactly equals the age of the universe — derived from the
// same formula the rest of this tool uses, not a separately hand-typed
// number, so it can never drift out of sync with evaporationTimeYears.
const EVAPORATING_TODAY_MASS_KG = massEvaporatingTodayKg();

// Every preset mass is expressed in whichever unit reads most naturally
// for it — solar masses for astrophysical black holes, kilograms for
// the hypothetical primordial-scale one.
const PRESETS = [
  { label: "Sun-mass black hole", mass: 1, unit: "msun" },
  { label: "Stellar-mass black hole (~10 M☉)", mass: 10, unit: "msun" },
  { label: "Sgr A*-mass black hole", mass: 4.3e6, unit: "msun" },
  { label: "Mass that would be finishing evaporation today", mass: massFromKg(EVAPORATING_TODAY_MASS_KG, "kg"), unit: "kg" },
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
  if (n >= 1e6 || n < 1e-4) {
    const exp = Math.floor(Math.log10(n));
    const mantissa = n / Math.pow(10, exp);
    return `${trimTrailingZeros(mantissa.toFixed(digits))} × 10${toSuperscript(exp)}`;
  }
  if (n >= 100) return trimTrailingZeros(n.toFixed(1));
  if (n >= 1) return trimTrailingZeros(n.toFixed(digits));
  return trimTrailingZeros(n.toFixed(digits + 2));
}
function formatExponent(exp) {
  return `10${toSuperscript(exp)}`;
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const massRaw = params.get("m");
  if (massRaw === null || !Number.isFinite(parseFloat(massRaw))) return null;
  const unit = params.get("u");
  return {
    mass: massRaw,
    unit: MASS_UNITS[unit] ? unit : "msun",
  };
}

// Log-log plot domain: from small hypothetical primordial-black-hole
// masses up through a very massive supermassive black hole. Widened on
// the fly (below) if the user's own mass falls outside this range.
const PLOT_MASS_MIN_KG = 1e11;
const PLOT_MASS_MAX_KG = massToKg(1e10, "msun");

export default function BlackHoleEvaporationTimeCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [mass, setMass] = useState("1");
  const [unit, setUnit] = useState("msun");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setMass(initial.mass);
      setUnit(initial.unit);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("m", mass);
      params.set("u", unit);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, mass, unit]);

  const result = useMemo(() => {
    const massNum = parseFloat(mass);
    if (!(massNum > 0)) return { valid: false, reason: "Enter a positive black hole mass." };
    const massKg = massToKg(massNum, unit);
    const evapYears = evaporationTimeYears(massKg);
    const ageMultiple = ageOfUniverseMultiple(evapYears);
    return { valid: true, massKg, evapYears, ageMultiple, alreadyEvaporated: ageMultiple < 1 };
  }, [mass, unit]);

  // --- log-log evaporation-time-vs-mass curve ---
  const chart = useMemo(() => {
    if (!result.valid) return null;
    const width = 640;
    const height = 320;
    const marginLeft = 68;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 46;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;

    // Widen the fixed reference domain to always include the user's
    // current mass, with a decade of padding on either side.
    const userLogMass = Math.log10(result.massKg);
    const xMin = Math.min(Math.log10(PLOT_MASS_MIN_KG), userLogMass - 1);
    const xMax = Math.max(Math.log10(PLOT_MASS_MAX_KG), userLogMass + 1);

    const yOf = (logMassKg) => Math.log10(evaporationTimeYears(Math.pow(10, logMassKg)));
    const yMin = Math.min(yOf(xMin), Math.log10(1));
    const yMax = yOf(xMax);

    const xScale = (logMass) => marginLeft + ((logMass - xMin) / (xMax - xMin)) * plotWidth;
    const yScale = (logYears) => marginTop + (1 - (logYears - yMin) / (yMax - yMin)) * plotHeight;

    // Sample the curve — a straight line in log-log space since
    // t ∝ M³, but sampled rather than drawn as a bare 2-point segment
    // so the relationship stays visibly derived from evaporationTimeYears.
    const samples = 48;
    const curvePoints = Array.from({ length: samples + 1 }, (_, i) => {
      const logMass = xMin + (i / samples) * (xMax - xMin);
      const logYears = yOf(logMass);
      return `${xScale(logMass)},${yScale(logYears)}`;
    }).join(" ");

    const xTickStep = 5;
    const xTickStart = Math.ceil(xMin / xTickStep) * xTickStep;
    const xTicks = [];
    for (let t = xTickStart; t <= xMax; t += xTickStep) xTicks.push(t);

    const yTickStep = 10;
    const yTickStart = Math.ceil(yMin / yTickStep) * yTickStep;
    const yTicks = [];
    for (let t = yTickStart; t <= yMax; t += yTickStep) yTicks.push(t);

    const ageLineY = Math.log10(AGE_OF_UNIVERSE_YEARS);
    const ageLineVisible = ageLineY >= yMin && ageLineY <= yMax;

    const referencePoints = [
      { label: "stellar-mass BH (~6 M☉)", massKg: massToKg(6, "msun") },
      { label: "Sgr A* (~4.3×10⁶ M☉)", massKg: massToKg(4.3e6, "msun") },
      { label: "evaporates ~now", massKg: EVAPORATING_TODAY_MASS_KG },
    ].map((p) => {
      const logMass = Math.log10(p.massKg);
      const logYears = yOf(logMass);
      return { ...p, x: xScale(logMass), y: yScale(logYears) };
    });

    const userPoint = { x: xScale(userLogMass), y: yScale(Math.log10(result.evapYears)) };

    return {
      width, height, marginLeft, marginRight, marginTop, marginBottom, plotWidth, plotHeight,
      xScale, yScale, xMin, xMax, yMin, yMax, curvePoints, xTicks, yTicks,
      ageLineY, ageLineVisible, referencePoints, userPoint,
    };
  }, [result]);

  const applyPreset = (preset) => {
    setMass(String(preset.mass));
    setUnit(preset.unit);
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
    <div className="bhe" aria-label="Black hole evaporation time calculator">
      <div className="bhe-header">
        <p className="bhe-title">Black hole evaporation time calculator</p>
        <div className="bhe-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="bhe-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="bhe-explainer">
        For an idealized, isolated Schwarzschild black hole, Hawking radiation carries away mass
        at a rate set entirely by its mass: <code>t = 5120 π G² M³ / (ħ c⁴)</code>. Because time
        scales with the <em>cube</em> of the mass, this single exponent is responsible for
        everything interesting below — shrink the mass by 1,000× and the lifetime drops by a
        billion times.
      </p>

      <div className="bhe-fields">
        <div className="bhe-field">
          <label htmlFor="bhe-mass">Black hole mass (M)</label>
          <div className="bhe-input-row">
            <input id="bhe-mass" className="bhe-input" type="number" min="0" step="any" inputMode="decimal" value={mass} onChange={(e) => setMass(e.target.value)} />
            <select className="bhe-unit-select" value={unit} onChange={(e) => setUnit(e.target.value)}>
              {MASS_UNIT_ORDER.map((u) => <option key={u} value={u}>{MASS_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!result.valid ? (
        <p className="bhe-note bhe-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="bhe-headline-card">
            <div className="bhe-headline">t_evap ≈ {formatNumber(result.evapYears)} years</div>
            <div className="bhe-headline-sub">
              {result.alreadyEvaporated
                ? <>≈ {formatNumber(result.ageMultiple)} × the age of the universe — a black hole this small would already be long gone</>
                : <>≈ {formatNumber(result.ageMultiple)} × the age of the universe (13.8 Gyr)</>}
            </div>
          </div>

          {chart && (
            <div className="bhe-chart-wrap">
              <svg
                className="bhe-curve-svg"
                viewBox={`0 0 ${chart.width} ${chart.height}`}
                role="img"
                aria-label={`Log-log plot of Hawking evaporation time versus black hole mass, spanning roughly 10 to the ${Math.round(chart.xMin)} through 10 to the ${Math.round(chart.xMax)} kilograms; the current mass evaporates in about ${formatNumber(result.evapYears)} years`}
              >
                {chart.yTicks.map((t) => (
                  <g key={`y-${t}`}>
                    <line x1={chart.marginLeft} x2={chart.marginLeft + chart.plotWidth} y1={chart.yScale(t)} y2={chart.yScale(t)} className="bhe-chart-gridline" />
                    <text x={chart.marginLeft - 8} y={chart.yScale(t) + 4} className="bhe-chart-axis-label" textAnchor="end">{formatExponent(Math.round(t))}</text>
                  </g>
                ))}
                {chart.xTicks.map((t) => (
                  <g key={`x-${t}`}>
                    <line x1={chart.xScale(t)} x2={chart.xScale(t)} y1={chart.marginTop} y2={chart.marginTop + chart.plotHeight} className="bhe-chart-gridline bhe-chart-gridline--v" />
                    <text x={chart.xScale(t)} y={chart.marginTop + chart.plotHeight + 16} className="bhe-chart-axis-label" textAnchor="middle">{formatExponent(Math.round(t))}</text>
                  </g>
                ))}

                <line x1={chart.marginLeft} x2={chart.marginLeft} y1={chart.marginTop} y2={chart.marginTop + chart.plotHeight} className="bhe-chart-axis-line" />
                <line x1={chart.marginLeft} x2={chart.marginLeft + chart.plotWidth} y1={chart.marginTop + chart.plotHeight} y2={chart.marginTop + chart.plotHeight} className="bhe-chart-axis-line" />

                {chart.ageLineVisible && (
                  <>
                    <line x1={chart.marginLeft} x2={chart.marginLeft + chart.plotWidth} y1={chart.yScale(chart.ageLineY)} y2={chart.yScale(chart.ageLineY)} className="bhe-age-line" />
                    <text x={chart.marginLeft + chart.plotWidth - 4} y={chart.yScale(chart.ageLineY) - 6} className="bhe-chart-axis-label bhe-age-line-label" textAnchor="end">age of universe (13.8 Gyr)</text>
                  </>
                )}

                <polyline points={chart.curvePoints} className="bhe-curve-line" />

                {chart.referencePoints.map((p) => (
                  <g key={p.label}>
                    <circle cx={p.x} cy={p.y} r="3.5" className="bhe-ref-point" />
                    <text x={p.x} y={p.y - 8} className="bhe-chart-axis-label bhe-ref-label" textAnchor="middle">{p.label}</text>
                  </g>
                ))}

                <circle cx={chart.userPoint.x} cy={chart.userPoint.y} r="5.5" className="bhe-user-point" />

                <text x={chart.marginLeft + chart.plotWidth / 2} y={chart.height - 6} className="bhe-chart-axis-label" textAnchor="middle">mass (kg, log scale)</text>
                <text x={16} y={chart.marginTop + chart.plotHeight / 2} className="bhe-chart-axis-label bhe-ylabel" textAnchor="middle">evaporation time (years, log scale)</text>
              </svg>
              <p className="bhe-chart-caption">
                Both axes are logarithmic, so the perfectly straight line is the M³ relationship
                itself — three decades of mass become nine decades of lifetime. The highlighted
                point is your current mass; the dashed line marks the age of the universe, and the
                curve crosses it at the mass a hypothetical primordial black hole would need in
                order to be finishing its evaporation right about now.
              </p>
            </div>
          )}
        </>
      )}

      <div className="bhe-footer-row">
        <CalculatorVote slug="black-hole-evaporation-time-calculator" />
        <button type="button" className="bhe-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
