import { useEffect, useMemo, useState } from "react";
import {
  MASS_UNITS,
  MASS_UNIT_ORDER,
  DISTANCE_UNITS,
  DISTANCE_UNIT_ORDER,
  M_SUN,
  massToKg,
  massFromKg,
  distanceToMeters,
  distanceFromMeters,
  schwarzschildRadiusM,
  massFromSchwarzschildRadiusM,
  closestSizeComparison,
} from "./schwarzschild";
import "../../../styles/schwarzschildRadiusCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";

// Every preset is self-consistent under both "solve for" choices — the
// mass and radius always match — and doubles as a landmark point on the
// mass-vs-radius chart below, plotted whether or not it's the applied preset.
const PRESETS = [
  { label: "Earth", massSolar: 5.9722e24 / M_SUN, mass: 1, massUnit: "mearth" },
  { label: "Jupiter", massSolar: 1.89813e27 / M_SUN, mass: 1, massUnit: "mjupiter" },
  { label: "The Sun", massSolar: 1, mass: 1, massUnit: "msun" },
  { label: "10 M☉ stellar black hole", massSolar: 10, mass: 10, massUnit: "msun" },
  { label: "Sagittarius A*", massSolar: 4.297e6, mass: 4.297e6, massUnit: "msun" },
  { label: "M87*", massSolar: 6.5e9, mass: 6.5e9, massUnit: "msun" },
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
function niceRoundValue(x) {
  if (!(x > 0)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(x)));
  const norm = x / mag;
  const nice = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
  return nice * mag;
}

// Static landmark points for the chart — always shown, regardless of
// which preset (if any) is currently applied.
const LANDMARK_POINTS = PRESETS.map((p) => ({
  label: p.label,
  logM: Math.log10(p.massSolar),
  logR: Math.log10(distanceFromMeters(schwarzschildRadiusM(p.massSolar * M_SUN), "km")),
}));

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const solveFor = params.get("solve");
  if (solveFor !== "radius" && solveFor !== "mass") return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  return {
    solveFor,
    mass: num("m", "1"),
    massUnit: MASS_UNITS[params.get("mu")] ? params.get("mu") : "msun",
    radius: num("r", "2.95"),
    radiusUnit: DISTANCE_UNITS[params.get("ru")] ? params.get("ru") : "km",
  };
}

export default function SchwarzschildRadiusCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [solveFor, setSolveFor] = useState("radius");
  const [mass, setMass] = useState("1");
  const [massUnit, setMassUnit] = useState("msun");
  const [radius, setRadius] = useState("2.95");
  const [radiusUnit, setRadiusUnit] = useState("km");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setSolveFor(initial.solveFor);
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
      params.set("solve", solveFor);
      params.set("m", mass);
      params.set("mu", massUnit);
      params.set("r", radius);
      params.set("ru", radiusUnit);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, solveFor, mass, massUnit, radius, radiusUnit]);

  const result = useMemo(() => {
    if (solveFor === "radius") {
      const M = parseFloat(mass);
      if (!(M > 0)) return { valid: false, reason: "Enter a positive mass." };
      const massKg = massToKg(M, massUnit);
      const rsM = schwarzschildRadiusM(massKg);
      return { valid: true, quantity: "radius", massKg, rsM };
    }
    const R = parseFloat(radius);
    if (!(R > 0)) return { valid: false, reason: "Enter a positive radius." };
    const rsM = distanceToMeters(R, radiusUnit);
    const massKg = massFromSchwarzschildRadiusM(rsM);
    return { valid: true, quantity: "mass", massKg, rsM };
  }, [solveFor, mass, massUnit, radius, radiusUnit]);

  const comparison = useMemo(() => {
    if (!result.valid) return null;
    return closestSizeComparison(distanceFromMeters(result.rsM, "km"));
  }, [result]);

  // --- event horizon circle + scale bar ---
  // The circle is always drawn at the same pixel size — what changes is
  // the physical length its scale bar represents, which can range from
  // millimeters to hundreds of AU depending on the mass. That, plus the
  // plain-language size comparison, is what actually conveys scale.
  const horizon = useMemo(() => {
    if (!result.valid) return null;
    const rsKm = distanceFromMeters(result.rsM, "km");
    const circlePx = 95;
    const kmPerPx = rsKm / circlePx;
    const barKm = niceRoundValue(rsKm * 0.45);
    const barPx = barKm / kmPerPx;
    return { circlePx, barKm, barPx, rsKm };
  }, [result]);

  // --- log-log mass vs. radius chart ---
  // r_s = 2GM/c² is a pure, exponent-1 power law — genuinely linear, not
  // merely power-law shaped. Plotted here in log-log space only to fit
  // fifteen-odd orders of magnitude (Earth to M87*) on one chart; the
  // caption is explicit that the underlying relationship is direct
  // proportionality, not an artifact of the log axes.
  const chart = useMemo(() => {
    if (!result.valid) return null;
    const massSolar = massFromKg(result.massKg, "msun");
    const logM = Math.log10(massSolar);
    const logR = Math.log10(distanceFromMeters(result.rsM, "km"));

    const allLogM = [...LANDMARK_POINTS.map((p) => p.logM), logM];
    const xPad = 1;
    const xMin = Math.min(...allLogM) - xPad;
    const xMax = Math.max(...allLogM) + xPad;
    // r_s/M is a fixed constant (2G/c²), so the line's y-intercept is
    // exactly logR - logM for any point on it — use the current point.
    const logK = logR - logM;
    const lineAt = (x) => logK + x;

    const width = 640;
    const height = 320;
    const marginLeft = 66;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 40;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;
    const yMinRaw = lineAt(xMin);
    const yMaxRaw = lineAt(xMax);
    const yPad = Math.abs(yMaxRaw - yMinRaw) * 0.06;
    const yMin = Math.min(yMinRaw, yMaxRaw) - yPad;
    const yMax = Math.max(yMinRaw, yMaxRaw) + yPad;

    const xScale = (x) => marginLeft + ((x - xMin) / (xMax - xMin)) * plotWidth;
    const yScale = (y) => marginTop + (1 - (y - yMin) / (yMax - yMin)) * plotHeight;

    const decadeTicks = (lo, hi, step) => {
      const ticks = [];
      for (let e = Math.ceil(lo / step) * step; e <= hi; e += step) ticks.push(Math.round(e));
      return ticks;
    };
    const xStep = xMax - xMin > 12 ? 3 : xMax - xMin > 6 ? 2 : 1;
    const yStep = yMax - yMin > 12 ? 3 : yMax - yMin > 6 ? 2 : 1;

    return {
      width, height, marginLeft, marginRight, marginTop, marginBottom, plotWidth, plotHeight,
      xScale, yScale,
      x1: xScale(xMin), y1: yScale(lineAt(xMin)),
      x2: xScale(xMax), y2: yScale(lineAt(xMax)),
      point: { x: xScale(logM), y: yScale(logR) },
      landmarks: LANDMARK_POINTS.map((p) => ({ ...p, x: xScale(p.logM), y: yScale(p.logR) })),
      xTicks: decadeTicks(xMin, xMax, xStep),
      yTicks: decadeTicks(yMin, yMax, yStep),
    };
  }, [result]);

  const applyPreset = (preset) => {
    setSolveFor("radius");
    setMass(String(preset.mass));
    setMassUnit(preset.massUnit);
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
    <div className="szr" aria-label="Schwarzschild radius calculator">
      <div className="szr-header">
        <p className="szr-title">Schwarzschild radius calculator</p>
        <div className="szr-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="szr-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="szr-explainer">
        The Schwarzschild radius <code>r_s = 2GM/c²</code> is the event-horizon size of an
        idealized non-rotating, uncharged black hole — and a genuinely{" "}
        <strong>linear</strong> relation: double the mass, exactly double the radius. It applies
        specifically to a Schwarzschild (non-spinning) black hole; a spinning Kerr black hole's
        horizon follows a different formula (see this site's Black Hole ISCO calculator), though it
        reduces to exactly this one at zero spin.
      </p>

      <div className="szr-solve-toggle" role="group" aria-label="Solve for">
        <button type="button" className={solveFor === "radius" ? "szr-solve-btn active" : "szr-solve-btn"} onClick={() => setSolveFor("radius")}>
          Mass → Radius
        </button>
        <button type="button" className={solveFor === "mass" ? "szr-solve-btn active" : "szr-solve-btn"} onClick={() => setSolveFor("mass")}>
          Radius → Mass
        </button>
      </div>

      <div className="szr-fields">
        <div className="szr-field">
          <label htmlFor="szr-mass">Mass (M)</label>
          {solveFor === "mass" ? (
            <div className="szr-computed">
              {result.valid ? formatNumber(massFromKg(result.massKg, massUnit)) : "—"}
              <select className="szr-unit-select" value={massUnit} onChange={(e) => setMassUnit(e.target.value)}>
                {MASS_UNIT_ORDER.map((u) => <option key={u} value={u}>{MASS_UNITS[u].short}</option>)}
              </select>
            </div>
          ) : (
            <div className="szr-input-row">
              <input id="szr-mass" className="szr-input" type="number" min="0" step="any" inputMode="decimal" value={mass} onChange={(e) => setMass(e.target.value)} />
              <select className="szr-unit-select" value={massUnit} onChange={(e) => setMassUnit(e.target.value)}>
                {MASS_UNIT_ORDER.map((u) => <option key={u} value={u}>{MASS_UNITS[u].short}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="szr-field">
          <label htmlFor="szr-radius">Schwarzschild radius (r_s)</label>
          {solveFor === "radius" ? (
            <div className="szr-computed">
              {result.valid ? formatNumber(distanceFromMeters(result.rsM, radiusUnit)) : "—"}
              <select className="szr-unit-select" value={radiusUnit} onChange={(e) => setRadiusUnit(e.target.value)}>
                {DISTANCE_UNIT_ORDER.map((u) => <option key={u} value={u}>{DISTANCE_UNITS[u].short}</option>)}
              </select>
            </div>
          ) : (
            <div className="szr-input-row">
              <input id="szr-radius" className="szr-input" type="number" min="0" step="any" inputMode="decimal" value={radius} onChange={(e) => setRadius(e.target.value)} />
              <select className="szr-unit-select" value={radiusUnit} onChange={(e) => setRadiusUnit(e.target.value)}>
                {DISTANCE_UNIT_ORDER.map((u) => <option key={u} value={u}>{DISTANCE_UNITS[u].short}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {!result.valid ? (
        <p className="szr-note szr-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="szr-table" role="table" aria-label="Result in every unit">
            {DISTANCE_UNIT_ORDER.map((key) => (
              <div className={key === radiusUnit ? "szr-row szr-row--active" : "szr-row"} role="row" key={key}>
                <span className="szr-row-label" role="cell">{DISTANCE_UNITS[key].label}</span>
                <span className="szr-row-value" role="cell">
                  {formatNumber(distanceFromMeters(result.rsM, key))} <span className="szr-row-unit">{DISTANCE_UNITS[key].short}</span>
                </span>
              </div>
            ))}
          </div>

          {comparison && (
            <p className="szr-comparison">
              That's about{" "}
              {comparison.ratio >= 0.7 && comparison.ratio <= 1.4
                ? "the size of"
                : comparison.ratio > 1.4
                ? `${formatNumber(comparison.ratio)}× the size of`
                : `${formatNumber(1 / comparison.ratio)}× smaller than`}{" "}
              <strong>{comparison.label}</strong>.
            </p>
          )}

          {horizon && (
            <div className="szr-chart-wrap">
              <svg
                className="szr-horizon-svg"
                viewBox="0 0 260 200"
                role="img"
                aria-label={`Event horizon, drawn with a scale bar representing ${formatNumber(horizon.barKm)} kilometers`}
              >
                <circle cx="130" cy="90" r={horizon.circlePx * 1.35} className="szr-horizon-glow" />
                <circle cx="130" cy="90" r={horizon.circlePx} className="szr-horizon-disk" />
                <text x="130" y="94" className="szr-horizon-label" textAnchor="middle">event horizon</text>

                <line x1={130 - horizon.barPx / 2} x2={130 + horizon.barPx / 2} y1="172" y2="172" className="szr-scale-bar" />
                <line x1={130 - horizon.barPx / 2} x2={130 - horizon.barPx / 2} y1="167" y2="177" className="szr-scale-bar" />
                <line x1={130 + horizon.barPx / 2} x2={130 + horizon.barPx / 2} y1="167" y2="177" className="szr-scale-bar" />
                <text x="130" y="192" className="szr-scale-label" textAnchor="middle">{formatNumber(horizon.barKm)} km</text>
              </svg>
              <p className="szr-chart-caption">
                Drawn at a fixed size on screen, with a scale bar showing the real physical length
                it represents — the only way to picture sizes from a millimeter to hundreds of AU
                on one page.
              </p>
            </div>
          )}

          {chart && (
            <div className="szr-chart-wrap">
              <svg
                className="szr-line-svg"
                viewBox={`0 0 ${chart.width} ${chart.height}`}
                role="img"
                aria-label="Log-log plot of Schwarzschild radius versus mass; a straight line reflecting direct proportionality"
              >
                {chart.xTicks.map((e) => (
                  <g key={`x${e}`}>
                    <line x1={chart.xScale(e)} x2={chart.xScale(e)} y1={chart.marginTop} y2={chart.marginTop + chart.plotHeight} className="szr-chart-gridline" />
                    <text x={chart.xScale(e)} y={chart.height - 12} className="szr-chart-axis-label" textAnchor="middle">
                      10{toSuperscript(e)} M☉
                    </text>
                  </g>
                ))}
                {chart.yTicks.map((e) => (
                  <g key={`y${e}`}>
                    <line x1={chart.marginLeft} x2={chart.marginLeft + chart.plotWidth} y1={chart.yScale(e)} y2={chart.yScale(e)} className="szr-chart-gridline" />
                    <text x={chart.marginLeft - 8} y={chart.yScale(e) + 4} className="szr-chart-axis-label" textAnchor="end">
                      10{toSuperscript(e)} km
                    </text>
                  </g>
                ))}
                <line x1={chart.marginLeft} x2={chart.marginLeft} y1={chart.marginTop} y2={chart.marginTop + chart.plotHeight} className="szr-chart-axis-line" />
                <line x1={chart.marginLeft} x2={chart.marginLeft + chart.plotWidth} y1={chart.marginTop + chart.plotHeight} y2={chart.marginTop + chart.plotHeight} className="szr-chart-axis-line" />

                <line x1={chart.x1} y1={chart.y1} x2={chart.x2} y2={chart.y2} className="szr-chart-fit-line" />

                {chart.landmarks.map((lm) => (
                  <g key={lm.label}>
                    <circle cx={lm.x} cy={lm.y} r="4" className="szr-chart-landmark" />
                    <text x={lm.x} y={lm.y - 8} className="szr-chart-landmark-label" textAnchor="middle">{lm.label}</text>
                  </g>
                ))}

                <circle cx={chart.point.x} cy={chart.point.y} r="6" className="szr-chart-point" />
              </svg>
              <p className="szr-chart-caption">
                A straight line here reflects genuine direct proportionality (r_s ∝ M, exponent
                exactly 1) — log-log axes are used only to fit fifteen-odd orders of magnitude, from
                Earth to M87*, on one chart.
              </p>
            </div>
          )}
        </>
      )}

      <div className="szr-footer-row">
        <CalculatorVote slug="schwarzschild-radius-calculator" />
        <button type="button" className="szr-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
