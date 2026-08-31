import { useEffect, useMemo, useState } from "react";
import {
  MASS_UNITS,
  MASS_UNIT_ORDER,
  DISTANCE_UNITS,
  DISTANCE_UNIT_ORDER,
  VELOCITY_UNITS,
  VELOCITY_UNIT_ORDER,
  C,
  massToKg,
  massFromKg,
  distanceToMeters,
  distanceFromMeters,
  velocityToUnit,
  velocityFromUnit,
  escapeVelocityFromMassRadius,
  massFromVelocityRadius,
  radiusFromVelocityMass,
  schwarzschildRadiusM,
  PRESETS,
  LADDER_LANDMARKS,
} from "./escapeVelocity";
import { ESCAPE_VELOCITY_TEST_COLUMNS, ESCAPE_VELOCITY_TEST_SOURCES, getEscapeVelocityTestRows } from "./escapeVelocityTests";
import "../../../styles/escapeVelocityCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import CalculatorTests from "../../CalculatorTests.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";

const SOLVE_OPTIONS = [
  { key: "velocity", label: "Escape velocity" },
  { key: "mass", label: "Mass" },
  { key: "radius", label: "Radius" },
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

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const solveFor = params.get("solve");
  if (!solveFor || !SOLVE_OPTIONS.some((o) => o.key === solveFor)) return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    const n = raw === null ? NaN : parseFloat(raw);
    return Number.isFinite(n) ? String(n) : fallback;
  };
  return {
    solveFor,
    mass: num("m", String(5.9722e24)),
    massUnit: MASS_UNITS[params.get("mu")] ? params.get("mu") : "kg",
    radius: num("r", "6371"),
    radiusUnit: DISTANCE_UNITS[params.get("ru")] ? params.get("ru") : "km",
    velocity: num("v", "11.186"),
    velocityUnit: VELOCITY_UNITS[params.get("vu")] ? params.get("vu") : "kms",
  };
}

export default function EscapeVelocityCalculator() {
  // Always start from these fixed defaults (Earth) — this is a
  // statically-built page, so the server never sees a request URL and
  // always renders these. Any URL-encoded state is applied client-side,
  // after mount, below.
  const [solveFor, setSolveFor] = useState("velocity");
  const [mass, setMass] = useState(String(5.9722e24));
  const [massUnit, setMassUnit] = useState("kg");
  const [radius, setRadius] = useState("6371");
  const [radiusUnit, setRadiusUnit] = useState("km");
  const [velocity, setVelocity] = useState("11.186");
  const [velocityUnit, setVelocityUnit] = useState("kms");
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
      setVelocity(initial.velocity);
      setVelocityUnit(initial.velocityUnit);
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
      params.set("v", velocity);
      params.set("vu", velocityUnit);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, solveFor, mass, massUnit, radius, radiusUnit, velocity, velocityUnit]);

  const result = useMemo(() => {
    if (solveFor === "velocity") {
      const M = parseFloat(mass);
      const r = parseFloat(radius);
      if (!(M > 0) || !(r > 0)) return { valid: false, reason: "Enter a positive mass and radius." };
      const massKg = massToKg(M, massUnit);
      const radiusM = distanceToMeters(r, radiusUnit);
      const out = escapeVelocityFromMassRadius(massKg, radiusM);
      if (!out.valid) return out;
      return { valid: true, massKg, radiusM, vMs: out.v };
    }
    if (solveFor === "mass") {
      const v = parseFloat(velocity);
      const r = parseFloat(radius);
      if (!(v > 0) || !(r > 0)) return { valid: false, reason: "Enter a positive escape velocity and radius." };
      const vMs = velocityFromUnit(v, velocityUnit);
      const radiusM = distanceToMeters(r, radiusUnit);
      const out = massFromVelocityRadius(vMs, radiusM);
      if (!out.valid) return out;
      return { valid: true, massKg: out.massKg, radiusM, vMs };
    }
    const v = parseFloat(velocity);
    const M = parseFloat(mass);
    if (!(v > 0) || !(M > 0)) return { valid: false, reason: "Enter a positive escape velocity and mass." };
    const vMs = velocityFromUnit(v, velocityUnit);
    const massKg = massToKg(M, massUnit);
    const out = radiusFromVelocityMass(vMs, massKg);
    if (!out.valid) return out;
    return { valid: true, massKg, radiusM: out.radiusM, vMs };
  }, [solveFor, mass, massUnit, radius, radiusUnit, velocity, velocityUnit]);

  // --- Schwarzschild connection: same equation, two directions ---
  const schwarzschild = useMemo(() => {
    if (!result.valid) return null;
    const rsM = schwarzschildRadiusM(result.massKg);
    return { rsM, ratio: result.radiusM / rsM };
  }, [result]);

  // --- comparison ladder: Bennu through a neutron star, log scale ---
  const ladder = useMemo(() => {
    if (!result.valid) return null;
    const allV = [...LADDER_LANDMARKS.map((l) => l.v), result.vMs];
    const domainMinLog = Math.log10(Math.min(...allV)) - 0.4;
    const domainMaxLog = Math.log10(Math.max(...allV)) + 0.4;
    const width = 640;
    const height = 230;
    const marginLeft = 26;
    const marginRight = 26;
    const y = 100;
    const plotWidth = width - marginLeft - marginRight;
    const xScale = (logV) => marginLeft + ((logV - domainMinLog) / (domainMaxLog - domainMinLog)) * plotWidth;
    const ticks = [];
    for (let e = Math.ceil(domainMinLog); e <= domainMaxLog; e++) ticks.push(e);

    return {
      width, height, marginLeft, plotWidth, y, xScale, ticks,
      markerX: xScale(Math.log10(result.vMs)),
      landmarks: LADDER_LANDMARKS.map((l, i) => ({ ...l, x: xScale(Math.log10(l.v)), row: i % 2 })),
    };
  }, [result]);

  // Self-check rows: runs the real escapeVelocity.js functions against
  // pure identities and known reference constants — independent of the
  // fields above.
  const testRows = useMemo(() => getEscapeVelocityTestRows(), []);

  const applyPreset = (preset) => {
    setSolveFor("velocity");
    setMass(String(preset.mass));
    setMassUnit(preset.massUnit);
    setRadius(String(preset.radius));
    setRadiusUnit(preset.radiusUnit);
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

  const quantity = result.valid ? solveFor : null;
  const unitOrder = quantity === "mass" ? MASS_UNIT_ORDER : quantity === "radius" ? DISTANCE_UNIT_ORDER : VELOCITY_UNIT_ORDER;
  const unitTable = quantity === "mass" ? MASS_UNITS : quantity === "radius" ? DISTANCE_UNITS : VELOCITY_UNITS;
  const toDisplay = (key) => {
    if (quantity === "mass") return massFromKg(result.massKg, key);
    if (quantity === "radius") return distanceFromMeters(result.radiusM, key);
    return velocityToUnit(result.vMs, key);
  };
  const headlineUnit = quantity === "mass" ? massUnit : quantity === "radius" ? radiusUnit : velocityUnit;

  return (
    <div className="evc" aria-label="Escape velocity calculator">
      <div className="evc-header">
        <p className="evc-title">Escape velocity calculator</p>
        <div className="evc-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="evc-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="evc-explainer">
        <code>v_esc = √(2GM/r)</code> is the speed needed to leave a body's gravity for good, with no
        further thrust. It's <strong>direction-independent</strong> — an energy condition on speed,
        not a statement about trajectory — and it says nothing about drag: a real rocket leaving
        Earth needs considerably more than 11.2 km/s of actual burn to fight its way through the
        atmosphere.
      </p>

      <div className="evc-solve-toggle" role="group" aria-label="Solve for">
        {SOLVE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={opt.key === solveFor ? "evc-solve-btn active" : "evc-solve-btn"}
            onClick={() => setSolveFor(opt.key)}
          >
            Solve for {opt.label}
          </button>
        ))}
      </div>

      <div className="evc-fields">
        <div className="evc-field">
          <label htmlFor="evc-mass">Mass (M)</label>
          {solveFor === "mass" ? (
            <div className="evc-computed">
              {result.valid ? formatNumber(massFromKg(result.massKg, massUnit)) : "—"}
              <select className="evc-unit-select" value={massUnit} onChange={(e) => setMassUnit(e.target.value)}>
                {MASS_UNIT_ORDER.map((u) => <option key={u} value={u}>{MASS_UNITS[u].short}</option>)}
              </select>
            </div>
          ) : (
            <div className="evc-input-row">
              <input id="evc-mass" className="evc-input" type="number" min="0" step="any" inputMode="decimal" value={mass} onChange={(e) => setMass(e.target.value)} />
              <select className="evc-unit-select" value={massUnit} onChange={(e) => setMassUnit(e.target.value)}>
                {MASS_UNIT_ORDER.map((u) => <option key={u} value={u}>{MASS_UNITS[u].short}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="evc-field">
          <label htmlFor="evc-radius">Radius (r)</label>
          {solveFor === "radius" ? (
            <div className="evc-computed">
              {result.valid ? formatNumber(distanceFromMeters(result.radiusM, radiusUnit)) : "—"}
              <select className="evc-unit-select" value={radiusUnit} onChange={(e) => setRadiusUnit(e.target.value)}>
                {DISTANCE_UNIT_ORDER.map((u) => <option key={u} value={u}>{DISTANCE_UNITS[u].short}</option>)}
              </select>
            </div>
          ) : (
            <div className="evc-input-row">
              <input id="evc-radius" className="evc-input" type="number" min="0" step="any" inputMode="decimal" value={radius} onChange={(e) => setRadius(e.target.value)} />
              <select className="evc-unit-select" value={radiusUnit} onChange={(e) => setRadiusUnit(e.target.value)}>
                {DISTANCE_UNIT_ORDER.map((u) => <option key={u} value={u}>{DISTANCE_UNITS[u].short}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="evc-field">
          <label htmlFor="evc-velocity">Escape velocity (v_esc)</label>
          {solveFor === "velocity" ? (
            <div className="evc-computed">
              {result.valid ? formatNumber(velocityToUnit(result.vMs, velocityUnit)) : "—"}
              <select className="evc-unit-select" value={velocityUnit} onChange={(e) => setVelocityUnit(e.target.value)}>
                {VELOCITY_UNIT_ORDER.map((u) => <option key={u} value={u}>{VELOCITY_UNITS[u].short}</option>)}
              </select>
            </div>
          ) : (
            <div className="evc-input-row">
              <input id="evc-velocity" className="evc-input" type="number" min="0" step="any" inputMode="decimal" value={velocity} onChange={(e) => setVelocity(e.target.value)} />
              <select className="evc-unit-select" value={velocityUnit} onChange={(e) => setVelocityUnit(e.target.value)}>
                {VELOCITY_UNIT_ORDER.map((u) => <option key={u} value={u}>{VELOCITY_UNITS[u].short}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {!result.valid ? (
        <p className="evc-note evc-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="evc-headline-card">
            <div className="evc-headline">
              v_esc ≈ {formatNumber(velocityToUnit(result.vMs, "kms"))} km/s
            </div>
            <div className="evc-headline-sub">
              {formatNumber(velocityToUnit(result.vMs, "ms"))} m/s · {formatNumber(velocityToUnit(result.vMs, "c"), 6)}× the speed of light
            </div>
          </div>

          <div className="evc-table" role="table" aria-label={`Result in every unit of ${quantity}`}>
            {unitOrder.map((key) => (
              <div className={key === headlineUnit ? "evc-row evc-row--active" : "evc-row"} role="row" key={key}>
                <span className="evc-row-label" role="cell">{unitTable[key].label}</span>
                <span className="evc-row-value" role="cell">
                  {formatNumber(toDisplay(key))} <span className="evc-row-unit">{unitTable[key].short}</span>
                </span>
              </div>
            ))}
          </div>

          {schwarzschild && (
            <div className="evc-schwarzschild-card">
              <p className="evc-schwarzschild-title">Same equation, two directions</p>
              <p className="evc-schwarzschild-body">
                For this mass, the Schwarzschild radius is{" "}
                <strong>{formatNumber(distanceFromMeters(schwarzschild.rsM, "km"))} km</strong> — the
                radius this mass would need to be compressed to for its escape velocity to reach
                exactly <strong>c</strong>. The current radius is{" "}
                <strong>{formatNumber(schwarzschild.ratio)}×</strong> the Schwarzschild radius.
                v_esc = √(2GM/r) and r_s = 2GM/c² are the same formula — one solved for speed, the
                other solved for the radius where that speed hits the speed of light. See this
                site's{" "}
                <a href="/posts/schwarzschild-radius-calculator">Schwarzschild Radius Calculator</a>{" "}
                for the other direction.
              </p>
            </div>
          )}

          {ladder && (
            <div className="evc-chart-wrap">
              <svg viewBox={`0 0 ${ladder.width} ${ladder.height}`} className="evc-ladder-svg" role="img" aria-label="Escape velocity comparison scale, from a small asteroid to a neutron star">
                <line x1={ladder.marginLeft} x2={ladder.marginLeft + ladder.plotWidth} y1={ladder.y} y2={ladder.y} className="evc-ladder-axis" />
                {ladder.ticks.map((e) => (
                  <g key={e}>
                    <line x1={ladder.xScale(e)} x2={ladder.xScale(e)} y1={ladder.y - 5} y2={ladder.y + 5} className="evc-ladder-tick" />
                    <text x={ladder.xScale(e)} y={ladder.y + 20} className="evc-chart-axis-label" textAnchor="middle">10{toSuperscript(e)} m/s</text>
                  </g>
                ))}
                {ladder.landmarks.map((lm) => (
                  <g key={lm.label}>
                    <line x1={lm.x} x2={lm.x} y1={ladder.y - 12} y2={ladder.y + 12} className="evc-landmark-tick" />
                    <text x={lm.x} y={lm.row === 0 ? ladder.y - 18 : ladder.y + 32} className="evc-landmark-label" textAnchor="middle">{lm.label}</text>
                  </g>
                ))}
                <polygon points={`${ladder.markerX - 7},${ladder.y - 30} ${ladder.markerX + 7},${ladder.y - 30} ${ladder.markerX},${ladder.y - 14}`} className="evc-ladder-marker" />
                <text x={ladder.markerX} y={ladder.y - 35} className="evc-ladder-marker-label" textAnchor="middle">this object</text>
              </svg>
              <p className="evc-chart-caption">
                Log scale of v_esc — from a small asteroid's stroll-pace escape velocity to a
                neutron star's, a span of almost nine orders of magnitude, not just four.
              </p>
            </div>
          )}
        </>
      )}

      <div className="evc-footer-row">
        <CalculatorVote slug="escape-velocity-calculator" />
        <CalculatorTests
          title="Escape Velocity Calculator — Tests"
          columns={ESCAPE_VELOCITY_TEST_COLUMNS}
          rows={testRows}
          sources={ESCAPE_VELOCITY_TEST_SOURCES}
        />
        <button type="button" className="evc-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
