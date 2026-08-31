import { useEffect, useMemo, useState } from "react";
import {
  TIME_UNITS,
  TIME_UNIT_ORDER,
  FREQUENCY_UNITS,
  FREQUENCY_UNIT_ORDER,
  ANGULAR_VELOCITY_UNITS,
  ANGULAR_VELOCITY_UNIT_ORDER,
  RADIUS_UNITS,
  RADIUS_UNIT_ORDER,
  OMEGA_LANDMARKS,
  timeToSeconds,
  frequencyToHz,
  radiansPerSecondToUnit,
  radiusToMeters,
  omegaFromPeriod,
  omegaFromFrequency,
  omegaFromRotationsAndTime,
  periodFromOmega,
  tangentialVelocity,
} from "./angularVelocity";
import { ANGULAR_VELOCITY_TEST_COLUMNS, ANGULAR_VELOCITY_TEST_SOURCES, getAngularVelocityTestRows } from "./angularVelocityTests";
import "../../../styles/angularVelocityCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import CalculatorTests from "../../CalculatorTests.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";

// Every preset is self-consistent (mode + all three input branches would
// agree), and doubles as a landmark on the comparison ladder below.
const PRESETS = [
  { label: "Earth (sidereal day)", mode: "period", period: 23.934691805555556, periodUnit: "h", frequency: 1, frequencyUnit: "hz", rotations: 1, elapsed: 23.934691805555556, elapsedUnit: "h", radius: 6378, radiusUnit: "km" },
  { label: "The Moon (own rotation)", mode: "period", period: 27.321661, periodUnit: "day", frequency: 1, frequencyUnit: "hz", rotations: 1, elapsed: 27.321661, elapsedUnit: "day", radius: 1737.4, radiusUnit: "km" },
  { label: "Washing machine (spin cycle)", mode: "frequency", period: 0.05, periodUnit: "s", frequency: 1200, frequencyUnit: "rpm", rotations: 20, elapsed: 1, elapsedUnit: "s", radius: 0.25, radiusUnit: "m" },
  { label: "Car wheel (highway speed)", mode: "frequency", period: 0.0679, periodUnit: "s", frequency: 884, frequencyUnit: "rpm", rotations: 15, elapsed: 1, elapsedUnit: "s", radius: 0.3, radiusUnit: "m" },
  { label: "Ceiling fan", mode: "frequency", period: 0.3, periodUnit: "s", frequency: 200, frequencyUnit: "rpm", rotations: 3, elapsed: 1, elapsedUnit: "s", radius: 0.6, radiusUnit: "m" },
  { label: "7200 RPM hard drive", mode: "frequency", period: 0.00833, periodUnit: "s", frequency: 7200, frequencyUnit: "rpm", rotations: 120, elapsed: 1, elapsedUnit: "s", radius: 4.45, radiusUnit: "cm" },
  { label: "Crab Pulsar", mode: "frequency", period: 0.0334, periodUnit: "s", frequency: 29.9, frequencyUnit: "hz", rotations: 30, elapsed: 1, elapsedUnit: "s", radius: 10, radiusUnit: "km" },
  { label: "Fastest known pulsar (~716 Hz)", mode: "frequency", period: 0.0014, periodUnit: "s", frequency: 716, frequencyUnit: "hz", rotations: 716, elapsed: 1, elapsedUnit: "s", radius: 10, radiusUnit: "km" },
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

// Compresses a real period (which can span ~9 orders of magnitude,
// milliseconds to weeks) into a watchable CSS animation duration.
// Relative speed is preserved (a faster real rotation animates faster)
// but this is emphatically not real-time for most presets.
const T_REF_MIN = 0.0005;
const T_REF_MAX = 2.5e6;
function animationDurationSec(periodS) {
  const clamped = Math.min(T_REF_MAX, Math.max(T_REF_MIN, periodS));
  const t = (Math.log10(clamped) - Math.log10(T_REF_MIN)) / (Math.log10(T_REF_MAX) - Math.log10(T_REF_MIN));
  return 0.25 + (6 - 0.25) * t;
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  if (!["period", "frequency", "rotations"].includes(mode)) return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  return {
    mode,
    period: num("p", "23.934691805555556"),
    periodUnit: TIME_UNITS[params.get("pu")] ? params.get("pu") : "h",
    frequency: num("f", "1"),
    frequencyUnit: FREQUENCY_UNITS[params.get("fu")] ? params.get("fu") : "hz",
    rotations: num("n", "1"),
    elapsed: num("t", "1"),
    elapsedUnit: TIME_UNITS[params.get("tu")] ? params.get("tu") : "s",
    radius: params.get("r") ?? "",
    radiusUnit: RADIUS_UNITS[params.get("ru")] ? params.get("ru") : "m",
  };
}

export default function AngularVelocityCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [mode, setMode] = useState("period");
  const [period, setPeriod] = useState("23.934691805555556");
  const [periodUnit, setPeriodUnit] = useState("h");
  const [frequency, setFrequency] = useState("1");
  const [frequencyUnit, setFrequencyUnit] = useState("hz");
  const [rotations, setRotations] = useState("1");
  const [elapsed, setElapsed] = useState("1");
  const [elapsedUnit, setElapsedUnit] = useState("s");
  const [radius, setRadius] = useState("6378");
  const [radiusUnit, setRadiusUnit] = useState("km");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setMode(initial.mode);
      setPeriod(initial.period);
      setPeriodUnit(initial.periodUnit);
      setFrequency(initial.frequency);
      setFrequencyUnit(initial.frequencyUnit);
      setRotations(initial.rotations);
      setElapsed(initial.elapsed);
      setElapsedUnit(initial.elapsedUnit);
      setRadius(initial.radius);
      setRadiusUnit(initial.radiusUnit);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("mode", mode);
      params.set("p", period);
      params.set("pu", periodUnit);
      params.set("f", frequency);
      params.set("fu", frequencyUnit);
      params.set("n", rotations);
      params.set("t", elapsed);
      params.set("tu", elapsedUnit);
      if (radius) params.set("r", radius);
      params.set("ru", radiusUnit);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, mode, period, periodUnit, frequency, frequencyUnit, rotations, elapsed, elapsedUnit, radius, radiusUnit]);

  const result = useMemo(() => {
    let omegaRadS;
    if (mode === "period") {
      const p = parseFloat(period);
      if (!(p > 0)) return { valid: false, reason: "Enter a positive rotation period." };
      omegaRadS = omegaFromPeriod(timeToSeconds(p, periodUnit));
    } else if (mode === "frequency") {
      const f = parseFloat(frequency);
      if (!(f > 0)) return { valid: false, reason: "Enter a positive frequency." };
      omegaRadS = omegaFromFrequency(frequencyToHz(f, frequencyUnit));
    } else {
      const n = parseFloat(rotations);
      const t = parseFloat(elapsed);
      if (!(n > 0) || !(t > 0)) return { valid: false, reason: "Enter a positive number of rotations and a positive elapsed time." };
      omegaRadS = omegaFromRotationsAndTime(n, timeToSeconds(t, elapsedUnit));
    }

    const rNum = parseFloat(radius);
    const hasRadius = radius.trim() !== "" && Number.isFinite(rNum) && rNum > 0;
    const radiusM = hasRadius ? radiusToMeters(rNum, radiusUnit) : null;
    const v = hasRadius ? tangentialVelocity(omegaRadS, radiusM) : null;

    return { valid: true, omegaRadS, periodS: periodFromOmega(omegaRadS), hasRadius, radiusM, v };
  }, [mode, period, periodUnit, frequency, frequencyUnit, rotations, elapsed, elapsedUnit, radius, radiusUnit]);

  // --- one dot orbiting another ---
  const spinner = useMemo(() => {
    if (!result.valid) return null;
    const durationSec = animationDurationSec(result.periodS);
    const orbitR = 70;
    const v = result.hasRadius ? tangentialVelocity(result.omegaRadS, result.radiusM) : null;
    return { durationSec, orbitR, v };
  }, [result]);

  // --- angular velocity comparison ladder ---
  const ladder = useMemo(() => {
    if (!result.valid) return null;
    const allOmega = [...OMEGA_LANDMARKS.map((l) => l.omegaRadS), result.omegaRadS];
    const domainMinLog = Math.log10(Math.min(...allOmega)) - 0.4;
    const domainMaxLog = Math.log10(Math.max(...allOmega)) + 0.4;
    const width = 640;
    const height = 210;
    const marginLeft = 26;
    const marginRight = 26;
    const y = 90;
    const plotWidth = width - marginLeft - marginRight;
    const xScale = (logOmega) => marginLeft + ((logOmega - domainMinLog) / (domainMaxLog - domainMinLog)) * plotWidth;
    const ticks = [];
    for (let e = Math.ceil(domainMinLog); e <= domainMaxLog; e++) ticks.push(e);

    return {
      width, height, marginLeft, plotWidth, y, xScale, ticks,
      markerX: xScale(Math.log10(result.omegaRadS)),
      landmarks: OMEGA_LANDMARKS.map((l, i) => ({ ...l, x: xScale(Math.log10(l.omegaRadS)), row: i % 2 })),
    };
  }, [result]);

  // Self-check rows: runs the real angularVelocity.js functions against
  // pure identities and known reference constants — independent of the
  // fields above.
  const testRows = useMemo(() => getAngularVelocityTestRows(), []);

  const applyPreset = (preset) => {
    setMode(preset.mode);
    setPeriod(String(preset.period));
    setPeriodUnit(preset.periodUnit);
    setFrequency(String(preset.frequency));
    setFrequencyUnit(preset.frequencyUnit);
    setRotations(String(preset.rotations));
    setElapsed(String(preset.elapsed));
    setElapsedUnit(preset.elapsedUnit);
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

  return (
    <div className="avc" aria-label="Angular velocity calculator">
      <div className="avc-header">
        <p className="avc-title">Angular velocity calculator</p>
        <div className="avc-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="avc-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="avc-explainer">
        Angular velocity is angle swept per unit time: <code>ω = Δθ/Δt</code>, or for steady
        rotation, <code>ω = 2π/T = 2πf</code>. Every point on a rigid rotating body shares the same
        ω — but a point's tangential speed, <code>v = ωr</code>, grows with its distance from the axis.
      </p>

      <div className="avc-mode-toggle" role="group" aria-label="Input mode">
        <button type="button" className={mode === "period" ? "avc-mode-btn active" : "avc-mode-btn"} onClick={() => setMode("period")}>
          Period
        </button>
        <button type="button" className={mode === "frequency" ? "avc-mode-btn active" : "avc-mode-btn"} onClick={() => setMode("frequency")}>
          Frequency
        </button>
        <button type="button" className={mode === "rotations" ? "avc-mode-btn active" : "avc-mode-btn"} onClick={() => setMode("rotations")}>
          Rotations + time
        </button>
      </div>

      <div className="avc-fields">
        {mode === "period" && (
          <div className="avc-field">
            <label htmlFor="avc-period">Rotation period (T)</label>
            <div className="avc-input-row">
              <input id="avc-period" className="avc-input" type="number" min="0" step="any" inputMode="decimal" value={period} onChange={(e) => setPeriod(e.target.value)} />
              <select className="avc-unit-select" value={periodUnit} onChange={(e) => setPeriodUnit(e.target.value)}>
                {TIME_UNIT_ORDER.map((u) => <option key={u} value={u}>{TIME_UNITS[u].short}</option>)}
              </select>
            </div>
          </div>
        )}
        {mode === "frequency" && (
          <div className="avc-field">
            <label htmlFor="avc-freq">Rotational frequency (f)</label>
            <div className="avc-input-row">
              <input id="avc-freq" className="avc-input" type="number" min="0" step="any" inputMode="decimal" value={frequency} onChange={(e) => setFrequency(e.target.value)} />
              <select className="avc-unit-select" value={frequencyUnit} onChange={(e) => setFrequencyUnit(e.target.value)}>
                {FREQUENCY_UNIT_ORDER.map((u) => <option key={u} value={u}>{FREQUENCY_UNITS[u].short}</option>)}
              </select>
            </div>
          </div>
        )}
        {mode === "rotations" && (
          <div className="avc-field-row">
            <div className="avc-field">
              <label htmlFor="avc-n">Number of rotations (N)</label>
              <input id="avc-n" className="avc-input" type="number" min="0" step="any" inputMode="decimal" value={rotations} onChange={(e) => setRotations(e.target.value)} />
            </div>
            <div className="avc-field">
              <label htmlFor="avc-t">Elapsed time (Δt)</label>
              <div className="avc-input-row">
                <input id="avc-t" className="avc-input" type="number" min="0" step="any" inputMode="decimal" value={elapsed} onChange={(e) => setElapsed(e.target.value)} />
                <select className="avc-unit-select" value={elapsedUnit} onChange={(e) => setElapsedUnit(e.target.value)}>
                  {TIME_UNIT_ORDER.map((u) => <option key={u} value={u}>{TIME_UNITS[u].short}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        <div className="avc-field">
          <label htmlFor="avc-radius">Radius (r) — optional, for tangential velocity</label>
          <div className="avc-input-row">
            <input id="avc-radius" className="avc-input" type="number" min="0" step="any" inputMode="decimal" placeholder="leave blank to skip" value={radius} onChange={(e) => setRadius(e.target.value)} />
            <select className="avc-unit-select" value={radiusUnit} onChange={(e) => setRadiusUnit(e.target.value)}>
              {RADIUS_UNIT_ORDER.map((u) => <option key={u} value={u}>{RADIUS_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!result.valid ? (
        <p className="avc-note avc-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="avc-table" role="table" aria-label="Angular velocity in every unit">
            {ANGULAR_VELOCITY_UNIT_ORDER.map((key) => (
              <div className="avc-row" role="row" key={key}>
                <span className="avc-row-label" role="cell">{ANGULAR_VELOCITY_UNITS[key].label}</span>
                <span className="avc-row-value" role="cell">
                  {formatNumber(radiansPerSecondToUnit(result.omegaRadS, key))} <span className="avc-row-unit">{ANGULAR_VELOCITY_UNITS[key].short}</span>
                </span>
              </div>
            ))}
          </div>

          {result.hasRadius && (
            <p className="avc-velocity-note">
              At radius {formatNumber(parseFloat(radius))} {RADIUS_UNITS[radiusUnit].short}: tangential speed v = ωr ≈{" "}
              <strong>{formatNumber(result.v)} m/s</strong> ({formatNumber(result.v * 3.6)} km/h)
            </p>
          )}

          {spinner && (
            <div className="avc-chart-wrap">
              <svg viewBox="0 0 200 200" className="avc-spinner-svg" role="img" aria-label="A dot orbiting a central dot at this angular velocity">
                <circle cx="100" cy="100" r={spinner.orbitR} className="avc-spinner-rim" />
                <g
                  key={spinner.durationSec}
                  className="avc-spinner-group"
                  style={{ animationDuration: `${spinner.durationSec}s` }}
                >
                  <circle cx={100 + spinner.orbitR} cy="100" r="7" className="avc-spinner-dot" />
                </g>
                <circle cx="100" cy="100" r="5" className="avc-spinner-hub" />
              </svg>
              <p className="avc-chart-caption">
                One full lap of the small dot = one rotation, at this ω.
                {result.hasRadius
                  ? ` At radius ${formatNumber(parseFloat(radius))} ${RADIUS_UNITS[radiusUnit].short}, that dot is moving at ${formatNumber(spinner.v)} m/s.`
                  : " Enter a radius above to see its actual speed."}{" "}
                Animation speed is compressed logarithmically to stay watchable — it preserves
                relative speed, not real time.
              </p>
            </div>
          )}

          {ladder && (
            <div className="avc-chart-wrap">
              <svg viewBox={`0 0 ${ladder.width} ${ladder.height}`} className="avc-ladder-svg" role="img" aria-label="Angular velocity comparison scale">
                <line x1={ladder.marginLeft} x2={ladder.marginLeft + ladder.plotWidth} y1={ladder.y} y2={ladder.y} className="avc-ladder-axis" />
                {ladder.ticks.map((e) => (
                  <g key={e}>
                    <line x1={ladder.xScale(e)} x2={ladder.xScale(e)} y1={ladder.y - 5} y2={ladder.y + 5} className="avc-ladder-tick" />
                    <text x={ladder.xScale(e)} y={ladder.y + 20} className="avc-chart-axis-label" textAnchor="middle">10{toSuperscript(e)}</text>
                  </g>
                ))}
                {ladder.landmarks.map((lm) => (
                  <g key={lm.label}>
                    <line x1={lm.x} x2={lm.x} y1={ladder.y - 12} y2={ladder.y + 12} className="avc-landmark-tick" />
                    <text x={lm.x} y={lm.row === 0 ? ladder.y - 18 : ladder.y + 32} className="avc-landmark-label" textAnchor="middle">{lm.label}</text>
                  </g>
                ))}
                <polygon points={`${ladder.markerX - 7},${ladder.y - 30} ${ladder.markerX + 7},${ladder.y - 30} ${ladder.markerX},${ladder.y - 14}`} className="avc-ladder-marker" />
                <text x={ladder.markerX} y={ladder.y - 35} className="avc-ladder-marker-label" textAnchor="middle">this object</text>
              </svg>
              <p className="avc-chart-caption">
                Log scale of ω in rad/s — spanning roughly nine orders of magnitude from the Moon's
                slow tidally-locked spin to a millisecond pulsar.
              </p>
            </div>
          )}
        </>
      )}

      <div className="avc-footer-row">
        <CalculatorVote slug="angular-velocity-calculator" />
        <CalculatorTests
          title="Angular Velocity Calculator — Tests"
          columns={ANGULAR_VELOCITY_TEST_COLUMNS}
          rows={testRows}
          sources={ANGULAR_VELOCITY_TEST_SOURCES}
        />
        <button type="button" className="avc-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
