import { useEffect, useMemo, useState } from "react";
import {
  MASS_UNITS,
  MASS_UNIT_ORDER,
  DISTANCE_UNITS,
  DISTANCE_UNIT_ORDER,
  RADIUS_UNITS,
  RADIUS_UNIT_ORDER,
  massToKg,
  distanceToMeters,
  distanceFromMeters,
  radiusToMeters,
  radiusFromMeters,
  hillRadius,
  hillRadiusPeriapsis,
} from "./hillSphere";
import "../../../styles/hillSphereCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";

// Every preset is a real (or realistically illustrative) orbiting-body +
// host pair, and doubles as a permanent landmark on the comparison
// ruler below, plotted whether or not it's the applied preset.
const PRESETS = [
  { label: "Earth around the Sun", m: 1, mUnit: "mearth", M: 1, MUnit: "msun", a: 1, aUnit: "au", e: 0.0167, planetRadius: 1, planetRadiusUnit: "rearth" },
  { label: "Moon around Earth", m: 1, mUnit: "mmoon", M: 1, MUnit: "mearth", a: 384400, aUnit: "km", e: 0.0549, planetRadius: 1, planetRadiusUnit: "rmoon" },
  { label: "Jupiter around the Sun", m: 1, mUnit: "mjupiter", M: 1, MUnit: "msun", a: 5.2044, aUnit: "au", e: 0.0489, planetRadius: 1, planetRadiusUnit: "rjupiter" },
  { label: "Hot Jupiter around its star", m: 1, mUnit: "mjupiter", M: 1, MUnit: "msun", a: 0.05, aUnit: "au", e: 0, planetRadius: 1, planetRadiusUnit: "rjupiter" },
];

const LANDMARK_POINTS = PRESETS.map((p) => {
  const mKg = massToKg(p.m, p.mUnit);
  const MKg = massToKg(p.M, p.MUnit);
  const aM = distanceToMeters(p.a, p.aUnit);
  const rH = hillRadiusPeriapsis(aM, mKg, MKg, p.e);
  return { label: p.label, km: distanceFromMeters(rH, "km") };
});

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
  if (n >= 1e6 || n < 1e-3) {
    const exp = Math.floor(Math.log10(n));
    const mantissa = n / Math.pow(10, exp);
    return `${trimTrailingZeros(mantissa.toFixed(digits))} × 10${toSuperscript(exp)}`;
  }
  if (n >= 100) return trimTrailingZeros(n.toFixed(1));
  if (n >= 1) return trimTrailingZeros(n.toFixed(digits));
  return trimTrailingZeros(n.toFixed(digits + 2));
}

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
    m: num("m", "1"),
    mUnit: MASS_UNITS[params.get("mu")] ? params.get("mu") : "mearth",
    M: num("M", "1"),
    MUnit: MASS_UNITS[params.get("Mu")] ? params.get("Mu") : "msun",
    a,
    aUnit: DISTANCE_UNITS[params.get("au")] ? params.get("au") : "au",
    e: num("e", "0.0167"),
    planetRadius: params.get("pr") ?? "1",
    planetRadiusUnit: RADIUS_UNITS[params.get("pru")] ? params.get("pru") : "rearth",
  };
}

export default function HillSphereCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [m, setM] = useState("1");
  const [mUnit, setMUnit] = useState("mearth");
  const [M, setM2] = useState("1");
  const [MUnit, setMUnit2] = useState("msun");
  const [a, setA] = useState("1");
  const [aUnit, setAUnit] = useState("au");
  const [e, setE] = useState("0.0167");
  const [planetRadius, setPlanetRadius] = useState("1");
  const [planetRadiusUnit, setPlanetRadiusUnit] = useState("rearth");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setM(initial.m);
      setMUnit(initial.mUnit);
      setM2(initial.M);
      setMUnit2(initial.MUnit);
      setA(initial.a);
      setAUnit(initial.aUnit);
      setE(initial.e);
      setPlanetRadius(initial.planetRadius);
      setPlanetRadiusUnit(initial.planetRadiusUnit);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("m", m);
      params.set("mu", mUnit);
      params.set("M", M);
      params.set("Mu", MUnit);
      params.set("a", a);
      params.set("au", aUnit);
      params.set("e", e);
      if (planetRadius) params.set("pr", planetRadius);
      params.set("pru", planetRadiusUnit);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, m, mUnit, M, MUnit, a, aUnit, e, planetRadius, planetRadiusUnit]);

  const result = useMemo(() => {
    const mNum = parseFloat(m);
    const MNum = parseFloat(M);
    const aNum = parseFloat(a);
    const eNum = parseFloat(e) || 0;
    if (!(mNum > 0) || !(MNum > 0) || !(aNum > 0) || eNum < 0 || eNum >= 1) {
      return { valid: false, reason: "Enter positive masses and semi-major axis, and an eccentricity between 0 and 1." };
    }
    const mKg = massToKg(mNum, mUnit);
    const MKg = massToKg(MNum, MUnit);
    const aM = distanceToMeters(aNum, aUnit);
    const rHCircular = hillRadius(aM, mKg, MKg);
    const rHPeriapsis = hillRadiusPeriapsis(aM, mKg, MKg, eNum);

    const prNum = parseFloat(planetRadius);
    const hasRadius = planetRadius.trim() !== "" && Number.isFinite(prNum) && prNum > 0;
    const planetRadiusM = hasRadius ? radiusToMeters(prNum, planetRadiusUnit) : null;

    return { valid: true, mKg, MKg, aM, e: eNum, rHCircular, rHPeriapsis, hasRadius, planetRadiusM };
  }, [m, mUnit, M, MUnit, a, aUnit, e, planetRadius, planetRadiusUnit]);

  // --- system view + zoomed Hill sphere ---
  // Left panel: the orbit, to its own auto-fit scale, with the planet
  // marked at periapsis. Right panel: the planet and its Hill sphere,
  // to a completely separate auto-fit scale — the Hill sphere is
  // almost always far too small to see at the orbit's own scale, so
  // showing both is the only honest way to depict "scaled" for both.
  const diagram = useMemo(() => {
    if (!result.valid) return null;
    const { aM, e, rHPeriapsis, planetRadiusM, hasRadius } = result;
    const orbitSemiMajorPx = 105;
    const orbitSemiMinorPx = orbitSemiMajorPx * Math.sqrt(1 - e * e);
    const focusOffsetPx = orbitSemiMajorPx * e;

    const hillPx = 92;
    const planetPxRaw = hasRadius ? hillPx * (planetRadiusM / rHPeriapsis) : null;
    const planetPx = hasRadius ? Math.max(1.5, Math.min(hillPx * 0.9, planetPxRaw)) : 4;

    return { orbitSemiMajorPx, orbitSemiMinorPx, focusOffsetPx, hillPx, planetPx, hasRadius };
  }, [result]);

  // --- Hill radius comparison ruler ---
  const ladder = useMemo(() => {
    if (!result.valid) return null;
    const rHKm = distanceFromMeters(result.rHPeriapsis, "km");
    const allKm = [...LANDMARK_POINTS.map((p) => p.km), rHKm];
    const domainMax = Math.log10(Math.max(...allKm)) + 0.4;
    const domainMinLog = Math.log10(Math.min(...allKm)) - 0.4;
    const width = 640;
    const height = 190;
    const marginLeft = 26;
    const marginRight = 26;
    const y = 76;
    const plotWidth = width - marginLeft - marginRight;
    const xScale = (logKm) => marginLeft + ((logKm - domainMinLog) / (domainMax - domainMinLog)) * plotWidth;

    const ticks = [];
    for (let e10 = Math.ceil(domainMinLog); e10 <= domainMax; e10++) ticks.push(e10);

    return {
      width, height, marginLeft, plotWidth, y, xScale, ticks,
      markerX: xScale(Math.log10(rHKm)),
      landmarks: LANDMARK_POINTS.map((p) => ({ ...p, x: xScale(Math.log10(p.km)) })),
    };
  }, [result]);

  const applyPreset = (preset) => {
    setM(String(preset.m));
    setMUnit(preset.mUnit);
    setM2(String(preset.M));
    setMUnit2(preset.MUnit);
    setA(String(preset.a));
    setAUnit(preset.aUnit);
    setE(String(preset.e));
    setPlanetRadius(String(preset.planetRadius));
    setPlanetRadiusUnit(preset.planetRadiusUnit);
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
    <div className="hsc" aria-label="Hill sphere calculator">
      <div className="hsc-header">
        <p className="hsc-title">Hill sphere calculator</p>
        <div className="hsc-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="hsc-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="hsc-explainer">
        The Hill sphere is roughly how far a body's own gravity can hold onto a satellite despite
        the pull of whatever it orbits: <code>r_H ≈ a(m/3M)^(1/3)</code>, or the more conservative{" "}
        <code>r_H ≈ a(1−e)(m/3M)^(1/3)</code> at periapsis, where tidal stress is strongest. It's an
        approximation, not a hard boundary — see below for why.
      </p>

      <div className="hsc-fields">
        <div className="hsc-field">
          <label htmlFor="hsc-m">Orbiting body's mass (m)</label>
          <div className="hsc-input-row">
            <input id="hsc-m" className="hsc-input" type="number" min="0" step="any" inputMode="decimal" value={m} onChange={(e) => setM(e.target.value)} />
            <select className="hsc-unit-select" value={mUnit} onChange={(e) => setMUnit(e.target.value)}>
              {MASS_UNIT_ORDER.map((u) => <option key={u} value={u}>{MASS_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
        <div className="hsc-field">
          <label htmlFor="hsc-M">Host body's mass (M)</label>
          <div className="hsc-input-row">
            <input id="hsc-M" className="hsc-input" type="number" min="0" step="any" inputMode="decimal" value={M} onChange={(e) => setM2(e.target.value)} />
            <select className="hsc-unit-select" value={MUnit} onChange={(e) => setMUnit2(e.target.value)}>
              {MASS_UNIT_ORDER.map((u) => <option key={u} value={u}>{MASS_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
        <div className="hsc-field">
          <label htmlFor="hsc-a">Semi-major axis (a)</label>
          <div className="hsc-input-row">
            <input id="hsc-a" className="hsc-input" type="number" min="0" step="any" inputMode="decimal" value={a} onChange={(e) => setA(e.target.value)} />
            <select className="hsc-unit-select" value={aUnit} onChange={(e) => setAUnit(e.target.value)}>
              {DISTANCE_UNIT_ORDER.map((u) => <option key={u} value={u}>{DISTANCE_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
        <div className="hsc-field">
          <label htmlFor="hsc-e">Eccentricity (e) — optional</label>
          <input id="hsc-e" className="hsc-input" type="number" min="0" max="0.999" step="any" inputMode="decimal" value={e} onChange={(e2) => setE(e2.target.value)} />
        </div>
        <div className="hsc-field">
          <label htmlFor="hsc-pr">Orbiting body's radius — optional</label>
          <div className="hsc-input-row">
            <input id="hsc-pr" className="hsc-input" type="number" min="0" step="any" inputMode="decimal" placeholder="leave blank to skip" value={planetRadius} onChange={(e) => setPlanetRadius(e.target.value)} />
            <select className="hsc-unit-select" value={planetRadiusUnit} onChange={(e) => setPlanetRadiusUnit(e.target.value)}>
              {RADIUS_UNIT_ORDER.map((u) => <option key={u} value={u}>{RADIUS_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!result.valid ? (
        <p className="hsc-note hsc-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="hsc-headline-card">
            <div className="hsc-headline">
              r_H ≈ {formatNumber(distanceFromMeters(result.rHPeriapsis, "km"))} km = {formatNumber(distanceFromMeters(result.rHPeriapsis, "au"))} AU
            </div>
            <div className="hsc-headline-sub">
              Circular-orbit estimate: {formatNumber(distanceFromMeters(result.rHCircular, "km"))} km
              {result.hasRadius && (
                <> · {formatNumber(result.rHPeriapsis / result.planetRadiusM)}× the orbiting body's own radius</>
              )}
            </div>
          </div>

          {diagram && (
            <div className="hsc-chart-wrap">
              <svg className="hsc-diagram-svg" viewBox="0 0 640 260" role="img" aria-label="Left: the orbit around the host body. Right: the orbiting body and its Hill sphere, to a separate scale.">
                <line x1="320" y1="20" x2="320" y2="240" className="hsc-panel-divider" />
                <text x="150" y="240" className="hsc-panel-label" textAnchor="middle">system view (orbit)</text>
                <text x="480" y="240" className="hsc-panel-label" textAnchor="middle">zoomed: Hill sphere</text>

                <g transform="translate(150 130)">
                  <ellipse cx="0" cy="0" rx={diagram.orbitSemiMajorPx} ry={diagram.orbitSemiMinorPx} className="hsc-orbit-ellipse" />
                  <circle cx={diagram.focusOffsetPx} cy="0" r="12" className="hsc-host-disk" />
                  <circle cx={diagram.orbitSemiMajorPx} cy="0" r="4" className="hsc-planet-marker" />
                </g>

                <g transform="translate(480 130)">
                  <circle cx="0" cy="0" r={diagram.hillPx} className="hsc-hill-circle" />
                  <circle cx="0" cy="0" r={diagram.planetPx} className="hsc-planet-disk" />
                </g>
              </svg>
              <p className="hsc-chart-caption">
                Left: the orbit (host body and orbiting body at periapsis), to its own scale. Right:
                the orbiting body and its Hill sphere (dashed), to a separate, much more zoomed-in
                scale — the Hill sphere is almost always far too small to see next to the full orbit.
              </p>
            </div>
          )}

          {ladder && (
            <div className="hsc-chart-wrap">
              <svg className="hsc-ladder-svg" viewBox={`0 0 ${ladder.width} ${ladder.height}`} role="img" aria-label="Hill radius comparison scale">
                <line x1={ladder.marginLeft} x2={ladder.marginLeft + ladder.plotWidth} y1={ladder.y} y2={ladder.y} className="hsc-ladder-axis" />
                {ladder.ticks.map((t) => (
                  <g key={t}>
                    <line x1={ladder.xScale(t)} x2={ladder.xScale(t)} y1={ladder.y - 5} y2={ladder.y + 5} className="hsc-ladder-tick" />
                    <text x={ladder.xScale(t)} y={ladder.y + 20} className="hsc-chart-axis-label" textAnchor="middle">10{toSuperscript(t)} km</text>
                  </g>
                ))}
                {ladder.landmarks.map((lm) => (
                  <g key={lm.label}>
                    <line x1={lm.x} x2={lm.x} y1={ladder.y - 14} y2={ladder.y + 14} className="hsc-landmark-tick" />
                    <text x={lm.x} y={ladder.y + 40} className="hsc-landmark-label" textAnchor="middle">{lm.label}</text>
                  </g>
                ))}
                <polygon points={`${ladder.markerX - 7},${ladder.y - 26} ${ladder.markerX + 7},${ladder.y - 26} ${ladder.markerX},${ladder.y - 10}`} className="hsc-ladder-marker" />
                <text x={ladder.markerX} y={ladder.y - 31} className="hsc-ladder-marker-label" textAnchor="middle">this body</text>
              </svg>
              <p className="hsc-chart-caption">
                Log scale — Hill radii across real systems span more than three orders of magnitude,
                from a moon's own modest sphere to a giant planet's sphere millions of km across.
              </p>
            </div>
          )}
        </>
      )}

      <div className="hsc-footer-row">
        <CalculatorVote slug="hill-sphere-calculator" />
        <button type="button" className="hsc-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
