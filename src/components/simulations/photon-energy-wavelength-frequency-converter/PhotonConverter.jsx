import { useEffect, useMemo, useState } from "react";
import {
  C,
  ENERGY_UNITS,
  WAVELENGTH_UNITS,
  FREQUENCY_UNITS,
  toBase,
  fromBase,
  wavelengthToFrequency,
  wavelengthToEnergyJ,
  energyJToWavelength,
  frequencyToWavelength,
  classifyBand,
  visibleWavelengthToRgb,
} from "./physics";
import "../../../styles/photonConverter.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";

const PRESETS = [
  { label: "FM radio (100 MHz)", wavelengthM: C / 100e6 },
  { label: "Wi-Fi (2.4 GHz)", wavelengthM: C / 2.4e9 },
  { label: "Green light (550 nm)", wavelengthM: 550e-9 },
  { label: "Soft X-ray (1 keV)", wavelengthM: energyJToWavelength(1000 * ENERGY_UNITS.eV) },
  { label: "Gamma ray (1 MeV)", wavelengthM: energyJToWavelength(1e6 * ENERGY_UNITS.eV) },
];

// One config per field: which unit table it uses, the units offered (in
// display order), and how to convert between that field's own unit and the
// single canonical quantity every field is derived from — wavelength in
// metres. Keeping the conversions here means the three input rows below can
// all be rendered from one small loop instead of being copy-pasted three
// times.
const FIELDS = {
  energy: {
    label: "Photon energy",
    id: "pwf-energy",
    units: ENERGY_UNITS,
    unitOrder: ["eV", "keV", "MeV", "J"],
    toWavelengthM: (value, unit) => energyJToWavelength(toBase(value, ENERGY_UNITS, unit)),
    fromWavelengthM: (lambdaM, unit) => fromBase(wavelengthToEnergyJ(lambdaM), ENERGY_UNITS, unit),
  },
  wavelength: {
    label: "Wavelength",
    id: "pwf-wavelength",
    units: WAVELENGTH_UNITS,
    unitOrder: ["pm", "Å", "nm", "µm", "mm", "m"],
    toWavelengthM: (value, unit) => toBase(value, WAVELENGTH_UNITS, unit),
    fromWavelengthM: (lambdaM, unit) => fromBase(lambdaM, WAVELENGTH_UNITS, unit),
  },
  frequency: {
    label: "Frequency",
    id: "pwf-frequency",
    units: FREQUENCY_UNITS,
    unitOrder: ["Hz", "kHz", "MHz", "GHz", "THz", "PHz", "EHz"],
    toWavelengthM: (value, unit) => frequencyToWavelength(toBase(value, FREQUENCY_UNITS, unit)),
    fromWavelengthM: (lambdaM, unit) => fromBase(wavelengthToFrequency(lambdaM), FREQUENCY_UNITS, unit),
  },
};

function trimTrailingZeros(s) {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// --- symbolic wave visualization ---
// Not to scale in either axis: real photon wavelengths span ~15 orders of
// magnitude, far too wide to draw literally. Instead this fixes a constant,
// readable number of cycles on screen and only varies two things with the
// actual physics: the wave's color (from the spectrum-band swatch) and how
// fast it visibly oscillates (log-mapped from real frequency, so a gamma ray
// scrolls much faster than a radio wave, but always within a range a human
// eye can actually follow). Amplitude is left arbitrary throughout — for a
// single photon, energy is set by frequency, not by the classical wave's
// amplitude (that corresponds to intensity, i.e. photon count).
const WAVE_VIEW_W = 400;
const WAVE_VIEW_H = 90;
const WAVE_CENTER_Y = WAVE_VIEW_H / 2;
const WAVE_AMPLITUDE = 26;
const WAVE_CYCLES_VISIBLE = 6;
const WAVE_CYCLE_PX = WAVE_VIEW_W / WAVE_CYCLES_VISIBLE;
// The path is drawn twice as wide as the viewBox and scrolled left by
// exactly one cycle width, so the loop point is seamless.
const WAVE_PATH_W = WAVE_VIEW_W * 2;

function buildWavePath() {
  const steps = Math.round(WAVE_PATH_W / 4);
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * WAVE_PATH_W;
    const y = WAVE_CENTER_Y - WAVE_AMPLITUDE * Math.sin((2 * Math.PI * x) / WAVE_CYCLE_PX);
    d += `${i === 0 ? "M" : "L"} ${x.toFixed(1)},${y.toFixed(1)} `;
  }
  return d.trim();
}

const WAVE_PATH = buildWavePath();
const WAVE_DURATION_SLOW_S = 3.2; // radio/microwave — visibly lazy
const WAVE_DURATION_FAST_S = 0.18; // gamma-ray — as fast as still looks smooth
const WAVE_LOG_F_MIN = 4; // ~10 kHz
const WAVE_LOG_F_MAX = 22; // ~hard gamma-ray line

function waveAnimDurationS(freqHz) {
  if (!Number.isFinite(freqHz) || freqHz <= 0) return WAVE_DURATION_SLOW_S;
  const logF = clamp(Math.log10(freqHz), WAVE_LOG_F_MIN, WAVE_LOG_F_MAX);
  const t = (logF - WAVE_LOG_F_MIN) / (WAVE_LOG_F_MAX - WAVE_LOG_F_MIN);
  return WAVE_DURATION_SLOW_S + t * (WAVE_DURATION_FAST_S - WAVE_DURATION_SLOW_S);
}

// A generic formatter has to cover values from ~1e-16 (gamma-ray-line
// wavelengths in metres) to ~1e24 (gamma-ray frequencies in Hz), so it
// switches to exponential notation outside a comfortable fixed-point range.
function formatValue(n) {
  if (!Number.isFinite(n) || n <= 0) return "";
  const abs = Math.abs(n);
  if (abs >= 1e6 || abs < 1e-4) {
    const exp = Math.floor(Math.log10(abs));
    const mantissa = n / Math.pow(10, exp);
    return `${trimTrailingZeros(mantissa.toFixed(4))}e${exp}`;
  }
  if (abs >= 100) return trimTrailingZeros(n.toFixed(2));
  if (abs >= 1) return trimTrailingZeros(n.toFixed(4));
  return trimTrailingZeros(n.toFixed(6));
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const m = params.get("m");
  if (m === null) return null;
  const lambdaM = parseFloat(m);
  if (!Number.isFinite(lambdaM) || lambdaM <= 0) return null;
  return {
    wavelengthM: lambdaM,
    units: {
      energy: params.get("eu") && ENERGY_UNITS[params.get("eu")] ? params.get("eu") : "eV",
      wavelength: params.get("wu") && WAVELENGTH_UNITS[params.get("wu")] ? params.get("wu") : "nm",
      frequency: params.get("fu") && FREQUENCY_UNITS[params.get("fu")] ? params.get("fu") : "THz",
    },
  };
}

export default function PhotonConverter() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Reading window.location.search into the initial state here would make
  // the client's first render diverge from that static HTML (a React
  // hydration mismatch) whenever the page is loaded with a query string —
  // e.g. via this component's own "shareable link" feature. Any URL-encoded
  // state is applied client-side, after mount, in the effect below instead.
  const [wavelengthM, setWavelengthM] = useState(550e-9);
  const [units, setUnits] = useState({ energy: "eV", wavelength: "nm", frequency: "THz" });
  const [editingField, setEditingField] = useState(null);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setWavelengthM(initial.wavelengthM);
      setUnits(initial.units);
    }
    setHydrated(true);
  }, []);

  // Debounced: dragging or repeatedly nudging a field can update
  // wavelengthM many times a second. Browsers cap how many times a page may
  // rewrite history in a short window, and blowing through that cap throws
  // an uncaught error that (with no error boundary here) would unmount the
  // whole component. Waiting for a pause keeps the call count trivial.
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("m", wavelengthM.toExponential(6));
      params.set("eu", units.energy);
      params.set("wu", units.wavelength);
      params.set("fu", units.frequency);
      const query = params.toString();
      const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, wavelengthM, units]);

  const displayValueFor = (key) => {
    if (editingField === key) return draft;
    return formatValue(FIELDS[key].fromWavelengthM(wavelengthM, units[key]));
  };

  const handleFocus = (key) => {
    const current = FIELDS[key].fromWavelengthM(wavelengthM, units[key]);
    setDraft(formatValue(current));
    setEditingField(key);
  };

  const handleChange = (key, raw) => {
    setDraft(raw);
    const num = parseFloat(raw);
    if (Number.isFinite(num) && num > 0) {
      const newWavelengthM = FIELDS[key].toWavelengthM(num, units[key]);
      if (Number.isFinite(newWavelengthM) && newWavelengthM > 0) {
        setWavelengthM(newWavelengthM);
      }
    }
  };

  const handleBlur = () => setEditingField(null);

  const handleUnitChange = (key, newUnit) => {
    setUnits((u) => ({ ...u, [key]: newUnit }));
    if (editingField === key) {
      setDraft(formatValue(FIELDS[key].fromWavelengthM(wavelengthM, newUnit)));
    }
  };

  const applyPreset = (preset) => {
    setWavelengthM(preset.wavelengthM);
    setEditingField(null);
  };

  const copyLink = async () => {
    trackEvent("calculator-copy-link");
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API can fail silently (permissions, insecure context) — no-op.
    }
  };

  const band = useMemo(() => classifyBand(wavelengthM), [wavelengthM]);
  const swatchColor = useMemo(() => {
    if (band.name === "Visible") {
      const { r, g, b } = visibleWavelengthToRgb(wavelengthM * 1e9);
      return `rgb(${r}, ${g}, ${b})`;
    }
    return band.color;
  }, [band, wavelengthM]);
  const waveDurationS = useMemo(
    () => waveAnimDurationS(wavelengthToFrequency(wavelengthM)),
    [wavelengthM]
  );

  return (
    <div className="pwf" aria-label="Photon energy, wavelength, and frequency converter">
      <div className="pwf-header">
        <p className="pwf-title">Photon converter</p>
        <div className="pwf-presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="pwf-preset-btn"
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="pwf-fields">
        {Object.entries(FIELDS).map(([key, field]) => (
          <div className="pwf-field" key={key}>
            <label htmlFor={field.id}>{field.label}</label>
            <div className="pwf-field-row">
              <input
                id={field.id}
                className="pwf-input"
                type="text"
                inputMode="decimal"
                value={displayValueFor(key)}
                onFocus={() => handleFocus(key)}
                onChange={(e) => handleChange(key, e.target.value)}
                onBlur={handleBlur}
              />
              <select
                className="pwf-unit-select"
                value={units[key]}
                onChange={(e) => handleUnitChange(key, e.target.value)}
                aria-label={`${field.label} unit`}
              >
                {field.unitOrder.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      <div className="pwf-wave-card">
        <svg
          className="pwf-wave-svg"
          viewBox={`0 0 ${WAVE_VIEW_W} ${WAVE_VIEW_H}`}
          role="img"
          aria-label={`Schematic electric-field wave, oscillating faster for higher-frequency photons — currently ${band.name.toLowerCase()}`}
        >
          <defs>
            <filter id="pwf-wave-glow" x="-20%" y="-80%" width="140%" height="260%">
              <feGaussianBlur stdDeviation="2.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <line
            x1="0"
            x2={WAVE_VIEW_W}
            y1={WAVE_CENTER_Y}
            y2={WAVE_CENTER_Y}
            className="pwf-wave-axis"
          />
          <g
            className="pwf-wave-scroll"
            style={{ "--pwf-cycle-width": `${WAVE_CYCLE_PX}px`, animationDuration: `${waveDurationS}s` }}
          >
            <path
              d={WAVE_PATH}
              className="pwf-wave-path"
              stroke={swatchColor}
              filter="url(#pwf-wave-glow)"
            />
          </g>
        </svg>
        <p className="pwf-wave-caption">
          Electric-field oscillation, colored by this photon's spectral region — schematic only.
          Cycle count and scroll speed are illustrative (faster for higher-frequency light); a
          single photon's energy comes from its frequency, not the wave's amplitude, which is
          arbitrary here.
        </p>
      </div>

      <div className="pwf-band-card">
        <span
          className="pwf-band-swatch"
          style={{ background: swatchColor, boxShadow: `0 0 18px 3px ${swatchColor}` }}
          aria-hidden="true"
        />
        <div className="pwf-band-info">
          <span className="pwf-band-label">Region of the spectrum</span>
          <span className="pwf-band-value">{band.name}</span>
        </div>
      </div>

      <div className="pwf-footer-row">
        <CalculatorVote slug="photon-energy-wavelength-frequency-converter" />
        <button type="button" className="pwf-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
