import { useEffect, useMemo, useState } from "react";
import {
  MASS_UNITS,
  MASS_UNIT_ORDER,
  massToKg,
  massFromKg,
  chirpMass,
  totalMass,
  massRatio,
  symmetricMassRatio,
  reducedMass,
  iscoFrequency,
  gwFrequency,
  timeToMerger,
} from "./chirpMass";
import { CHIRP_MASS_TEST_COLUMNS, CHIRP_MASS_TEST_SOURCES, getChirpMassTestRows } from "./chirpMassTests";
import "../../../styles/gravitationalWaveChirpMassCalculator.css";
import "../../../styles/calculators.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import CalculatorTests from "../../CalculatorTests.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";
import Katex from "../../Katex.jsx";

// Every preset is a real (or realistically illustrative) compact-binary
// pairing, so the calculator always opens on something meaningful.
const PRESETS = [
  { label: "GW150914-like (30 + 30 M☉ black holes)", m1: 30, m2: 30 },
  { label: "GW170817-like (1.46 + 1.27 M☉ neutron stars)", m1: 1.46, m2: 1.27 },
  { label: "Asymmetric pair (5 + 50 M☉)", m1: 5, m2: 50 },
];

function trimTrailingZeros(s) {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}
const SUPERSCRIPT_MAP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
function toSuperscript(n) {
  return String(n).split("").map((ch) => SUPERSCRIPT_MAP[ch] ?? ch).join("");
}
function formatNumber(n, digits = 3) {
  if (!Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs === 0) return "0";
  if (abs >= 1e6 || abs < 1e-3) {
    const exp = Math.floor(Math.log10(abs));
    const mantissa = abs / Math.pow(10, exp);
    return `${sign}${trimTrailingZeros(mantissa.toFixed(digits))} × 10${toSuperscript(exp)}`;
  }
  if (abs >= 100) return `${sign}${trimTrailingZeros(abs.toFixed(1))}`;
  if (abs >= 1) return `${sign}${trimTrailingZeros(abs.toFixed(digits))}`;
  return `${sign}${trimTrailingZeros(abs.toFixed(digits + 2))}`;
}
function niceStep(span, targetCount = 5) {
  if (!(span > 0)) return 1;
  const raw = span / targetCount;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
  return step * mag;
}
function roundSvg(n) {
  return Number(n.toFixed(6));
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const m1 = params.get("m1");
  if (m1 === null || !Number.isFinite(parseFloat(m1))) return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  return {
    m1,
    m2: num("m2", "30"),
    unit: MASS_UNITS[params.get("u")] ? params.get("u") : "msun",
  };
}

export default function GravitationalWaveChirpMassCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [m1, setM1] = useState("30");
  const [m2, setM2] = useState("30");
  const [unit, setUnit] = useState("msun");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setM1(initial.m1);
      setM2(initial.m2);
      setUnit(initial.unit);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("m1", m1);
      params.set("m2", m2);
      params.set("u", unit);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, m1, m2, unit]);

  const result = useMemo(() => {
    const m1Num = parseFloat(m1);
    const m2Num = parseFloat(m2);
    if (!(m1Num > 0) || !(m2Num > 0)) {
      return { valid: false, reason: "Enter two positive masses." };
    }
    const m1Kg = massToKg(m1Num, unit);
    const m2Kg = massToKg(m2Num, unit);

    const mcKg = chirpMass(m1Kg, m2Kg);
    const totalKg = totalMass(m1Kg, m2Kg);
    const muKg = reducedMass(m1Kg, m2Kg);
    const q = massRatio(m1Num, m2Num);
    const eta = symmetricMassRatio(m1Num, m2Num);
    const fIsco = iscoFrequency(totalKg);

    return {
      valid: true,
      m1Num, m2Num, m1Kg, m2Kg,
      mcKg, mcMsun: massFromKg(mcKg, "msun"),
      totalKg, totalMsun: massFromKg(totalKg, "msun"),
      muKg, muMsun: massFromKg(muKg, "msun"),
      q, eta, fIsco,
    };
  }, [m1, m2, unit]);

  // --- the actual "chirp": GW frequency sweeping upward toward merger ---
  // Leading post-Newtonian frequency evolution, f(tau) ∝ tau^(-3/8), shown
  // over a fixed last-DISPLAY_WINDOW_SECONDS window before merger — real
  // stellar-mass binaries spend many seconds (light neutron-star pairs)
  // to a fraction of a second (heavy black-hole pairs) sweeping through
  // the lowest frequencies, so zooming into roughly the final second is
  // what actually shows the characteristic upward-curving "chirp" shape
  // (the same reason real LIGO chirp plots are always zoomed this way).
  // A companion strain-like waveform sketch reuses the same time/frequency
  // grid, with an amplitude envelope that grows as f^(2/3) — the standard
  // leading-order post-Newtonian strain-amplitude scaling.
  const DISPLAY_WINDOW_SECONDS = 1.5;
  const visuals = useMemo(() => {
    if (!result.valid) return null;
    const { mcKg, fIsco } = result;
    if (!(fIsco > 0) || !Number.isFinite(fIsco)) return null;

    const tauEnd = timeToMerger(fIsco, mcKg);
    if (!Number.isFinite(tauEnd) || !(tauEnd >= 0)) return null;
    // Guarantees a visible sweep even for extreme/degenerate masses, by
    // never letting the window's start sit close to (or before) its end.
    const tauStart = Math.max(DISPLAY_WINDOW_SECONDS, tauEnd * 4);
    const fStart = gwFrequency(tauStart, mcKg);
    if (!(tauStart > tauEnd) || !Number.isFinite(tauStart)) return null;

    const N = 220;
    const times = []; // seconds relative to merger (negative, increasing toward 0)
    const freqs = [];
    for (let i = 0; i <= N; i++) {
      const tau = tauStart + (tauEnd - tauStart) * (i / N); // tau decreases toward tauEnd
      times.push(-tau);
      freqs.push(gwFrequency(tau, mcKg));
    }

    // --- frequency-sweep chart geometry ---
    const width = 640;
    const height = 300;
    const marginLeft = 56;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 40;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;

    const xMin = -tauStart;
    const xMax = 0; // merger
    const yMin = 0;
    const yMax = fIsco * 1.15;

    const xScale = (t) => roundSvg(marginLeft + ((t - xMin) / (xMax - xMin)) * plotWidth);
    const yScale = (f) => roundSvg(marginTop + (1 - (f - yMin) / (yMax - yMin)) * plotHeight);

    const xStep = niceStep(xMax - xMin, 5);
    const xTicks = [];
    for (let t = Math.ceil(xMin / xStep) * xStep; t <= xMax + 1e-9; t += xStep) xTicks.push(Math.round(t / xStep) * xStep);
    const yStep = niceStep(yMax - yMin, 5);
    const yTicks = [];
    const yTickCount = Math.floor((yMax - yMin) / yStep + 1e-9);
    for (let i = 0; i <= yTickCount; i++) yTicks.push(Number((i * yStep).toFixed(6)));

    const pathD = times.map((t, i) => `${i === 0 ? "M" : "L"} ${xScale(t)} ${yScale(freqs[i])}`).join(" ");
    const mergerX = xScale(-tauEnd);
    const mergerY = yScale(fIsco);

    // --- companion strain-like waveform sketch ---
    // Cumulative phase from the same frequency evolution (forward
    // trapezoidal integration of 2*pi*f dt); amplitude envelope ∝ f^(2/3)
    // (leading-order post-Newtonian strain-amplitude scaling), normalized
    // so the envelope peaks at 1 right before the cutoff.
    const wN = 900;
    let phase = 0;
    const wSamples = [];
    const maxFForEnvelope = Math.pow(fIsco, 2 / 3);
    for (let i = 0; i <= wN; i++) {
      const tau = tauStart + (tauEnd - tauStart) * (i / wN);
      const f = gwFrequency(tau, mcKg);
      if (i > 0) {
        const tauPrev = tauStart + (tauEnd - tauStart) * ((i - 1) / wN);
        const dt = tau - tauPrev; // negative, since tau decreases with i — dt below is |dt|
        const fPrev = wSamples[i - 1].f;
        phase += 2 * Math.PI * ((f + fPrev) / 2) * Math.abs(dt);
      }
      const envelope = Math.pow(f, 2 / 3) / maxFForEnvelope;
      wSamples.push({ t: -tau, f, envelope, strain: envelope * Math.cos(phase) });
    }

    const wWidth = 640;
    const wHeight = 160;
    const wMarginLeft = 20;
    const wMarginRight = 20;
    const wMarginTop = 14;
    const wMarginBottom = 14;
    const wPlotWidth = wWidth - wMarginLeft - wMarginRight;
    const wPlotHeight = wHeight - wMarginTop - wMarginBottom;
    const wxScale = (t) => roundSvg(wMarginLeft + ((t - xMin) / (xMax - xMin)) * wPlotWidth);
    const wyScale = (s) => roundSvg(wMarginTop + (1 - (s + 1.15) / 2.3) * wPlotHeight);
    const waveformD = wSamples.map((s, i) => `${i === 0 ? "M" : "L"} ${wxScale(s.t)} ${wyScale(s.strain)}`).join(" ");

    return {
      sweep: {
        width, height, marginLeft, marginRight, marginTop, marginBottom, plotWidth, plotHeight,
        xScale, yScale, xTicks, yTicks, pathD, mergerX, mergerY, fStart, tauStart, tauEnd,
      },
      waveform: {
        width: wWidth, height: wHeight, marginLeft: wMarginLeft, marginTop: wMarginTop,
        plotWidth: wPlotWidth, plotHeight: wPlotHeight, waveformD, zeroY: wyScale(0),
      },
    };
  }, [result]);

  // Self-check rows: runs the real chirpMass.js functions against known
  // reference events and edge cases — independent of the fields above.
  const testRows = useMemo(() => getChirpMassTestRows(), []);

  const applyPreset = (preset) => {
    setM1(String(preset.m1));
    setM2(String(preset.m2));
    setUnit("msun");
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
    <div className="gwc" aria-label="Gravitational wave chirp mass calculator">
      <div className="gwc-header">
        <p className="gwc-title">Gravitational wave chirp mass calculator</p>
        <div className="gwc-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="gwc-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="gwc-explainer">
        The chirp mass is the one combination of a compact binary's two masses that a
        gravitational-wave detector like LIGO/Virgo measures most precisely — it alone sets
        the leading-order rate at which the signal's frequency sweeps upward as the two
        objects spiral together:
        <br /><br />
        <Katex tex={String.raw`M_c = \frac{(M_1 M_2)^{3/5}}{(M_1+M_2)^{1/5}}`} />
        <br /><br />
        Also computed below: total mass <Katex tex="M_1+M_2" />, mass ratio{" "}
        <Katex tex="q = M_2/M_1" />, symmetric mass ratio{" "}
        <Katex tex={String.raw`\eta = M_1 M_2/(M_1+M_2)^2`} />, and the reduced mass{" "}
        <Katex tex={String.raw`\mu = M_1 M_2/(M_1+M_2)`} />.
      </p>

      <div className="gwc-fields">
        <div className="gwc-field">
          <label htmlFor="gwc-m1">Mass 1 (<Katex tex="M_1" />)</label>
          <div className="gwc-input-row">
            <input id="gwc-m1" className="gwc-input" type="number" min="0" step="any" inputMode="decimal" value={m1} onChange={(e) => setM1(e.target.value)} />
            <select className="gwc-unit-select" value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Mass unit">
              {MASS_UNIT_ORDER.map((u) => <option key={u} value={u}>{MASS_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
        <div className="gwc-field">
          <label htmlFor="gwc-m2">Mass 2 (<Katex tex="M_2" />)</label>
          <div className="gwc-input-row">
            <input id="gwc-m2" className="gwc-input" type="number" min="0" step="any" inputMode="decimal" value={m2} onChange={(e) => setM2(e.target.value)} />
            <span className="gwc-static-unit">{MASS_UNITS[unit].short}</span>
          </div>
        </div>
      </div>

      {!result.valid ? (
        <p className="gwc-note gwc-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="gwc-headline-card">
            <div className="gwc-headline">
              <Katex tex="M_c" /> ≈ {formatNumber(result.mcMsun)} M☉
            </div>
            <div className="gwc-headline-sub">
              Total mass {formatNumber(result.totalMsun)} M☉ · mass ratio q = {formatNumber(result.q)} ·{" "}
              η = {formatNumber(result.eta, 4)} · reduced mass {formatNumber(result.muMsun)} M☉
            </div>
            <div className="gwc-headline-sub">
              ISCO frequency estimate ≈ {formatNumber(result.fIsco)} Hz — an order-of-magnitude
              "where it ends" marker, not an exact numerical-relativity merger frequency.
            </div>
          </div>

          {visuals && (
            <div className="chart-wrap">
              <svg
                className="gwc-sweep-svg"
                viewBox={`0 0 ${visuals.sweep.width} ${visuals.sweep.height}`}
                role="img"
                aria-label={`Gravitational wave frequency sweeping upward from about ${formatNumber(visuals.sweep.fStart)} hertz to about ${formatNumber(result.fIsco)} hertz as the binary spirals toward merger`}
              >
                {visuals.sweep.yTicks.map((t) => (
                  <g key={`y${t}`}>
                    <line x1={visuals.sweep.marginLeft} x2={visuals.sweep.marginLeft + visuals.sweep.plotWidth} y1={visuals.sweep.yScale(t)} y2={visuals.sweep.yScale(t)} className="gwc-chart-gridline" />
                    <text x={visuals.sweep.marginLeft - 8} y={visuals.sweep.yScale(t) + 4} className="gwc-chart-axis-label" textAnchor="end">{formatNumber(t, 0)}</text>
                  </g>
                ))}
                {visuals.sweep.xTicks.map((t) => (
                  <g key={`x${t}`}>
                    <text x={visuals.sweep.xScale(t)} y={visuals.sweep.height - 12} className="gwc-chart-axis-label" textAnchor="middle">{formatNumber(t, 2)}</text>
                  </g>
                ))}
                <line x1={visuals.sweep.marginLeft} x2={visuals.sweep.marginLeft} y1={visuals.sweep.marginTop} y2={visuals.sweep.marginTop + visuals.sweep.plotHeight} className="gwc-chart-axis-line" />
                <line x1={visuals.sweep.marginLeft} x2={visuals.sweep.marginLeft + visuals.sweep.plotWidth} y1={visuals.sweep.marginTop + visuals.sweep.plotHeight} y2={visuals.sweep.marginTop + visuals.sweep.plotHeight} className="gwc-chart-axis-line" />

                <path d={visuals.sweep.pathD} className="gwc-chirp-line" />

                <line x1={visuals.sweep.mergerX} x2={visuals.sweep.mergerX} y1={visuals.sweep.marginTop} y2={visuals.sweep.marginTop + visuals.sweep.plotHeight} className="gwc-merger-guide" />
                <circle cx={visuals.sweep.mergerX} cy={visuals.sweep.mergerY} r="5" className="gwc-merger-point" />
                <text x={visuals.sweep.mergerX - 6} y={visuals.sweep.marginTop + 10} className="gwc-merger-label" textAnchor="end">≈ merger (ISCO est.)</text>

                <text x={visuals.sweep.marginLeft + visuals.sweep.plotWidth / 2} y={visuals.sweep.height - 26} className="gwc-chart-axis-label" textAnchor="middle">time relative to merger (s)</text>
                <text x={14} y={visuals.sweep.marginTop + 10} className="gwc-chart-axis-label" textAnchor="start">Hz</text>
              </svg>
              <p className="gwc-chart-caption">
                The characteristic "chirp": gravitational-wave frequency rising from about{" "}
                {formatNumber(visuals.sweep.fStart)} Hz toward an ISCO-frequency estimate of about{" "}
                {formatNumber(result.fIsco)} Hz as the two masses spiral together, from the
                leading-order post-Newtonian relation <Katex tex={String.raw`f(t) \propto (t_c-t)^{-3/8}`} />.
              </p>
            </div>
          )}

          {visuals && (
            <div className="chart-wrap">
              <svg
                className="gwc-waveform-svg"
                viewBox={`0 0 ${visuals.waveform.width} ${visuals.waveform.height}`}
                role="img"
                aria-label="Stylized gravitational-wave strain waveform, oscillating faster and with growing amplitude as merger approaches"
              >
                <line x1={visuals.waveform.marginLeft} x2={visuals.waveform.marginLeft + visuals.waveform.plotWidth} y1={visuals.waveform.zeroY} y2={visuals.waveform.zeroY} className="gwc-waveform-zero" />
                <path d={visuals.waveform.waveformD} className="gwc-waveform-line" />
              </svg>
              <p className="gwc-chart-caption">
                A stylized strain sketch built from the same frequency sweep — oscillation
                speeds up and grows in amplitude toward merger, the shape that gives the
                "chirp" its name.
              </p>
            </div>
          )}
        </>
      )}

      <p className="gwc-caveat">
        <strong>Scope of this tool:</strong> the ISCO frequency estimate treats the merger as a
        test particle reaching the innermost stable circular orbit around a single Schwarzschild
        mass equal to the binary's total mass. It's a genuinely useful order-of-magnitude "where
        the signal roughly ends" marker, not the precise frequency a full numerical-relativity
        simulation would give — the true merger typically happens a little later, at a somewhat
        higher frequency, once strong-field two-body effects this estimate ignores take over.
        The frequency-sweep formula itself is the standard leading (Newtonian-quadrupole)
        post-Newtonian approximation, accurate for the early-to-mid inspiral but not for the
        final orbits immediately before merger.
      </p>

      <div className="gwc-footer-row">
        <CalculatorVote slug="gravitational-wave-chirp-mass-calculator" />
        <CalculatorTests
          title="Gravitational Wave Chirp Mass Calculator — Tests"
          columns={CHIRP_MASS_TEST_COLUMNS}
          rows={testRows}
          sources={CHIRP_MASS_TEST_SOURCES}
        />
        <button type="button" className="gwc-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
