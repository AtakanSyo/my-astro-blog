import { useEffect, useMemo, useState } from "react";
import {
  STAR_RADIUS_UNITS,
  STAR_RADIUS_UNIT_ORDER,
  PLANET_RADIUS_UNITS,
  PLANET_RADIUS_UNIT_ORDER,
  DISTANCE_UNITS,
  DISTANCE_UNIT_ORDER,
  starRadiusToMeters,
  planetRadiusToMeters,
  distanceToMeters,
  transitProbability,
} from "./transitProbability";
import "../../../styles/exoplanetTransitProbabilityCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";

// Every preset is a real (or realistically illustrative) star+planet
// system, and doubles as a landmark on the a-vs-probability scatter
// below, plotted whether or not it's the applied preset.
const PRESETS = [
  { label: "Earth around the Sun", rStar: 1, rStarUnit: "rsun", rPlanet: 1, rPlanetUnit: "rearth", a: 1, aUnit: "au", e: 0, omega: 0 },
  { label: "Hot Jupiter", rStar: 1, rStarUnit: "rsun", rPlanet: 1, rPlanetUnit: "rjup", a: 0.05, aUnit: "au", e: 0, omega: 0 },
  { label: "Earth-size around a red dwarf (TRAPPIST-1e-like)", rStar: 0.121, rStarUnit: "rsun", rPlanet: 1, rPlanetUnit: "rearth", a: 0.02925, aUnit: "au", e: 0, omega: 0 },
  { label: "Jupiter around the Sun", rStar: 1, rStarUnit: "rsun", rPlanet: 1, rPlanetUnit: "rjup", a: 5.2044, aUnit: "au", e: 0, omega: 0 },
  { label: "Eccentric hot Jupiter (favorable ω)", rStar: 1, rStarUnit: "rsun", rPlanet: 1, rPlanetUnit: "rjup", a: 0.455, aUnit: "au", e: 0.93, omega: 90 },
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
  const rs = starRadiusToMeters(p.rStar, p.rStarUnit);
  const rp = planetRadiusToMeters(p.rPlanet, p.rPlanetUnit);
  const am = distanceToMeters(p.a, p.aUnit);
  const aAu = am / distanceToMeters(1, "au");
  const P = transitProbability(rs, rp, am, p.e, (p.omega * Math.PI) / 180);
  return { label: p.label, aAu, pPercent: P * 100 };
});

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const a = params.get("a");
  if (a === null || !Number.isFinite(parseFloat(a))) return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  return {
    rStar: num("rs", "1"),
    rStarUnit: STAR_RADIUS_UNITS[params.get("rsu")] ? params.get("rsu") : "rsun",
    rPlanet: num("rp", "1"),
    rPlanetUnit: PLANET_RADIUS_UNITS[params.get("rpu")] ? params.get("rpu") : "rearth",
    a,
    aUnit: DISTANCE_UNITS[params.get("au")] ? params.get("au") : "au",
    advanced: params.get("adv") === "1",
    e: num("e", "0"),
    omega: num("om", "0"),
  };
}

export default function ExoplanetTransitProbabilityCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [rStar, setRStar] = useState("1");
  const [rStarUnit, setRStarUnit] = useState("rsun");
  const [rPlanet, setRPlanet] = useState("1");
  const [rPlanetUnit, setRPlanetUnit] = useState("rearth");
  const [a, setA] = useState("1");
  const [aUnit, setAUnit] = useState("au");
  const [advanced, setAdvanced] = useState(false);
  const [e, setE] = useState("0");
  const [omega, setOmega] = useState("0");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setRStar(initial.rStar);
      setRStarUnit(initial.rStarUnit);
      setRPlanet(initial.rPlanet);
      setRPlanetUnit(initial.rPlanetUnit);
      setA(initial.a);
      setAUnit(initial.aUnit);
      setAdvanced(initial.advanced);
      setE(initial.e);
      setOmega(initial.omega);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("rs", rStar);
      params.set("rsu", rStarUnit);
      params.set("rp", rPlanet);
      params.set("rpu", rPlanetUnit);
      params.set("a", a);
      params.set("au", aUnit);
      params.set("adv", advanced ? "1" : "0");
      if (advanced) {
        params.set("e", e);
        params.set("om", omega);
      }
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, rStar, rStarUnit, rPlanet, rPlanetUnit, a, aUnit, advanced, e, omega]);

  const result = useMemo(() => {
    const rStarNum = parseFloat(rStar);
    const rPlanetNum = parseFloat(rPlanet);
    const aNum = parseFloat(a);
    if (!(rStarNum > 0) || !(rPlanetNum >= 0) || !(aNum > 0)) {
      return { valid: false, reason: "Enter a positive stellar radius, non-negative planet radius, and positive orbital distance." };
    }
    const eNum = advanced ? parseFloat(e) || 0 : 0;
    const omegaDeg = advanced ? parseFloat(omega) || 0 : 0;
    if (eNum < 0 || eNum >= 1) return { valid: false, reason: "Eccentricity must be between 0 and 1." };

    const rStarM = starRadiusToMeters(rStarNum, rStarUnit);
    const rPlanetM = planetRadiusToMeters(rPlanetNum, rPlanetUnit);
    const aM = distanceToMeters(aNum, aUnit);
    const P = transitProbability(rStarM, rPlanetM, aM, eNum, (omegaDeg * Math.PI) / 180);
    const aAu = aM / distanceToMeters(1, "au");

    return { valid: true, rStarM, rPlanetM, aM, aAu, P, e: eNum };
  }, [rStar, rStarUnit, rPlanet, rPlanetUnit, a, aUnit, advanced, e, omega]);

  // --- edge-on geometry diagram ---
  // Panel A: the full range of possible impact parameters (-a to +a) an
  // orbit could have — the transit-producing band is almost always far
  // too thin to see there, which is honestly the whole point. Panel B:
  // zoomed to the star's own scale, where that same band (drawn to real
  // proportion) is roughly the star's own height.
  const diagram = useMemo(() => {
    if (!result.valid) return null;
    const { rStarM, rPlanetM, aM } = result;
    const bandM = rStarM + rPlanetM;

    const panelAWidth = 260;
    const trueHalfPx = (bandM / aM) * (panelAWidth / 2);
    const clamped = trueHalfPx < 1.2;
    const halfPx = Math.max(1.2, trueHalfPx);

    const starPx = 66;
    const bandBHalfPx = starPx * (bandM / rStarM);

    return { panelAWidth, halfPx, clamped, truePercent: (bandM / aM) * 100, starPx, bandBHalfPx };
  }, [result]);

  // --- distance vs. probability scatter ---
  const scatter = useMemo(() => {
    if (!result.valid) return null;
    const allA = [...LANDMARK_POINTS.map((l) => l.aAu), result.aAu];
    const allP = [...LANDMARK_POINTS.map((l) => l.pPercent), result.P * 100];
    const xMin = Math.log10(Math.min(...allA)) - 0.3;
    const xMax = Math.log10(Math.max(...allA)) + 0.3;
    const yMin = Math.log10(Math.min(...allP)) - 0.3;
    const yMax = Math.log10(Math.max(...allP)) + 0.3;

    const width = 640;
    const height = 320;
    const marginLeft = 60;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 40;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;
    const xScale = (x) => marginLeft + ((x - xMin) / (xMax - xMin)) * plotWidth;
    const yScale = (y) => marginTop + (1 - (y - yMin) / (yMax - yMin)) * plotHeight;

    // reference slope -1 line (P proportional to 1/a for this system's
    // own fixed stellar+planet radius) through the current point.
    const logACur = Math.log10(result.aAu);
    const logPCur = Math.log10(result.P * 100);
    const refAt = (logA) => logPCur - (logA - logACur);
    const refLine = { x1: xScale(xMin), y1: yScale(refAt(xMin)), x2: xScale(xMax), y2: yScale(refAt(xMax)) };

    const decadeTicks = (lo, hi) => {
      const ticks = [];
      for (let e10 = Math.ceil(lo); e10 <= hi; e10++) ticks.push(e10);
      return ticks;
    };

    return {
      width, height, marginLeft, marginRight, marginTop, marginBottom, plotWidth, plotHeight,
      xScale, yScale, refLine,
      point: { x: xScale(logACur), y: yScale(logPCur) },
      landmarks: LANDMARK_POINTS.map((lm) => ({ ...lm, x: xScale(Math.log10(lm.aAu)), y: yScale(Math.log10(lm.pPercent)) })),
      xTicks: decadeTicks(xMin, xMax),
      yTicks: decadeTicks(yMin, yMax),
    };
  }, [result]);

  const applyPreset = (preset) => {
    setRStar(String(preset.rStar));
    setRStarUnit(preset.rStarUnit);
    setRPlanet(String(preset.rPlanet));
    setRPlanetUnit(preset.rPlanetUnit);
    setA(String(preset.a));
    setAUnit(preset.aUnit);
    setAdvanced(preset.e > 0);
    setE(String(preset.e));
    setOmega(String(preset.omega));
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
    <div className="etp" aria-label="Exoplanet transit probability calculator">
      <div className="etp-header">
        <p className="etp-title">Exoplanet transit probability calculator</p>
        <div className="etp-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="etp-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="etp-explainer">
        For a randomly oriented orbital plane, the chance we happen to see a transit at all is
        geometric, not astrophysical: <code>P ≈ (R★+R_p)/a</code>. It pairs with this site's{" "}
        <a href="/posts/exoplanet-transit-depth-calculator">Transit Depth Calculator</a> — one
        answers "how likely are we to see it," the other "how big would the dip be if we did."
      </p>

      <div className="etp-fields">
        <div className="etp-field">
          <label htmlFor="etp-rstar">Stellar radius (R★)</label>
          <div className="etp-input-row">
            <input id="etp-rstar" className="etp-input" type="number" min="0" step="any" inputMode="decimal" value={rStar} onChange={(e) => setRStar(e.target.value)} />
            <select className="etp-unit-select" value={rStarUnit} onChange={(e) => setRStarUnit(e.target.value)}>
              {STAR_RADIUS_UNIT_ORDER.map((u) => <option key={u} value={u}>{STAR_RADIUS_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
        <div className="etp-field">
          <label htmlFor="etp-rp">Planet radius (R_p)</label>
          <div className="etp-input-row">
            <input id="etp-rp" className="etp-input" type="number" min="0" step="any" inputMode="decimal" value={rPlanet} onChange={(e) => setRPlanet(e.target.value)} />
            <select className="etp-unit-select" value={rPlanetUnit} onChange={(e) => setRPlanetUnit(e.target.value)}>
              {PLANET_RADIUS_UNIT_ORDER.map((u) => <option key={u} value={u}>{PLANET_RADIUS_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
        <div className="etp-field">
          <label htmlFor="etp-a">Orbital distance (a)</label>
          <div className="etp-input-row">
            <input id="etp-a" className="etp-input" type="number" min="0" step="any" inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} />
            <select className="etp-unit-select" value={aUnit} onChange={(e) => setAUnit(e.target.value)}>
              {DISTANCE_UNIT_ORDER.map((u) => <option key={u} value={u}>{DISTANCE_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="etp-advanced-row">
        <button type="button" className={advanced ? "etp-advanced-toggle active" : "etp-advanced-toggle"} onClick={() => setAdvanced((v) => !v)}>
          {advanced ? "− Hide" : "+ Advanced"}: eccentricity &amp; argument of periapsis
        </button>
      </div>

      {advanced && (
        <div className="etp-fields">
          <div className="etp-field">
            <label htmlFor="etp-e">Eccentricity (e)</label>
            <input id="etp-e" className="etp-input" type="number" min="0" max="0.999" step="any" inputMode="decimal" value={e} onChange={(e2) => setE(e2.target.value)} />
          </div>
          <div className="etp-field">
            <label htmlFor="etp-omega">Argument of periapsis (ω)</label>
            <div className="etp-input-row">
              <input id="etp-omega" className="etp-input" type="number" min="0" max="360" step="any" inputMode="decimal" value={omega} onChange={(e) => setOmega(e.target.value)} />
              <span className="etp-static-unit">degrees</span>
            </div>
          </div>
        </div>
      )}

      {!result.valid ? (
        <p className="etp-note etp-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="etp-headline-card">
            <div className="etp-headline">P_transit ≈ {formatNumber(result.P * 100)}%</div>
            <div className="etp-headline-sub">
              About 1 in {formatNumber(1 / result.P, 0)} randomly oriented orbits would show a transit
            </div>
          </div>

          {diagram && (
            <div className="etp-chart-wrap">
              <div className="etp-diagram-row">
                <div className="etp-diagram-panel">
                  <svg viewBox="0 0 260 90" className="etp-diagram-svg" role="img" aria-label="Full range of possible impact parameters, with the narrow transit-producing band highlighted">
                    <line x1="10" y1="45" x2="250" y2="45" className="etp-diagram-axis" />
                    <rect x={130 - diagram.halfPx} y="20" width={diagram.halfPx * 2} height="50" className="etp-diagram-band" />
                    <text x="130" y="14" className="etp-diagram-label" textAnchor="middle">transit zone</text>
                    <text x="10" y="70" className="etp-diagram-label" textAnchor="start">−a</text>
                    <text x="250" y="70" className="etp-diagram-label" textAnchor="end">+a</text>
                  </svg>
                  <p className="etp-diagram-caption">
                    Full range of orbital orientations{diagram.clamped ? " (band exaggerated to stay visible — really just " + formatNumber(diagram.truePercent) + "% of this width)" : ""}
                  </p>
                </div>
                <div className="etp-diagram-panel">
                  <svg viewBox="0 0 260 170" className="etp-diagram-svg" role="img" aria-label="Zoomed view: the star and the transit-producing band at true relative scale">
                    <circle cx="130" cy="85" r={diagram.starPx} className="etp-diagram-star" />
                    <rect x="40" y={85 - diagram.bandBHalfPx} width="180" height={diagram.bandBHalfPx * 2} className="etp-diagram-band etp-diagram-band--zoom" />
                  </svg>
                  <p className="etp-diagram-caption">Zoomed to the star's own scale — this band is to true proportion.</p>
                </div>
              </div>
            </div>
          )}

          {scatter && (
            <div className="etp-chart-wrap">
              <svg className="etp-scatter-svg" viewBox={`0 0 ${scatter.width} ${scatter.height}`} role="img" aria-label="Log-log plot of transit probability versus orbital distance">
                {scatter.yTicks.map((t) => (
                  <g key={`y${t}`}>
                    <line x1={scatter.marginLeft} x2={scatter.marginLeft + scatter.plotWidth} y1={scatter.yScale(t)} y2={scatter.yScale(t)} className="etp-chart-gridline" />
                    <text x={scatter.marginLeft - 8} y={scatter.yScale(t) + 4} className="etp-chart-axis-label" textAnchor="end">10{toSuperscript(t)}%</text>
                  </g>
                ))}
                {scatter.xTicks.map((t) => (
                  <g key={`x${t}`}>
                    <line x1={scatter.xScale(t)} x2={scatter.xScale(t)} y1={scatter.marginTop} y2={scatter.marginTop + scatter.plotHeight} className="etp-chart-gridline" />
                    <text x={scatter.xScale(t)} y={scatter.height - 12} className="etp-chart-axis-label" textAnchor="middle">10{toSuperscript(t)} AU</text>
                  </g>
                ))}
                <line x1={scatter.marginLeft} x2={scatter.marginLeft} y1={scatter.marginTop} y2={scatter.marginTop + scatter.plotHeight} className="etp-chart-axis-line" />
                <line x1={scatter.marginLeft} x2={scatter.marginLeft + scatter.plotWidth} y1={scatter.marginTop + scatter.plotHeight} y2={scatter.marginTop + scatter.plotHeight} className="etp-chart-axis-line" />

                <line x1={scatter.refLine.x1} y1={scatter.refLine.y1} x2={scatter.refLine.x2} y2={scatter.refLine.y2} className="etp-ref-line" />

                {scatter.landmarks.map((lm) => (
                  <circle key={lm.label} cx={lm.x} cy={lm.y} r="4" className="etp-chart-landmark" />
                ))}

                <circle cx={scatter.point.x} cy={scatter.point.y} r="6" className="etp-chart-point" />
                <text x={scatter.point.x} y={scatter.point.y - 12} className="etp-chart-point-label" textAnchor="middle">this planet</text>
              </svg>
              <p className="etp-chart-caption">
                Dashed line: the 1/a trend for this system's own star+planet size. Dots: real
                example systems, each with their own stellar radius — they don't sit exactly on the
                line because their stars aren't the same size as this one.
              </p>
            </div>
          )}
        </>
      )}

      <div className="etp-footer-row">
        <CalculatorVote slug="exoplanet-transit-probability-calculator" />
        <button type="button" className="etp-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
