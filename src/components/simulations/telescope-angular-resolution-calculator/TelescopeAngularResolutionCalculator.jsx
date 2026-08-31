import { useEffect, useMemo, useState } from "react";
import {
  APERTURE_UNITS,
  APERTURE_UNIT_ORDER,
  WAVELENGTH_UNITS,
  WAVELENGTH_UNIT_ORDER,
  ANGLE_UNITS,
  ANGLE_UNIT_ORDER,
  RESOLUTION_LANDMARKS,
  apertureToMeters,
  wavelengthToMeters,
  radiansToAngle,
  rayleighLimitRad,
  dawesLimitRad,
} from "./angularResolution";
import "../../../styles/telescopeAngularResolutionCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";

// Every preset is a real (or realistic) aperture + wavelength pair, and
// doubles as a landmark on the comparison ruler below.
const PRESETS = [
  { label: "Small backyard scope (100 mm, visible)", D: 100, DUnit: "mm", wavelength: 550, wavelengthUnit: "nm" },
  { label: "8-inch amateur scope (203 mm, visible)", D: 203, DUnit: "mm", wavelength: 550, wavelengthUnit: "nm" },
  { label: "Hubble Space Telescope (2.4 m, visible)", D: 2.4, DUnit: "m", wavelength: 550, wavelengthUnit: "nm" },
  { label: "Keck Telescope (10 m, near-IR)", D: 10, DUnit: "m", wavelength: 2200, wavelengthUnit: "nm" },
  { label: "25 m radio dish (21 cm HI line)", D: 25, DUnit: "m", wavelength: 21, wavelengthUnit: "cm" },
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

const FILMSTRIP_RATIOS = [0.5, 1.0, 1.5, 2.5, 4.0];

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const D = params.get("D");
  if (D === null || !Number.isFinite(parseFloat(D))) return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  return {
    D,
    DUnit: APERTURE_UNITS[params.get("Du")] ? params.get("Du") : "mm",
    wavelength: num("l", "550"),
    wavelengthUnit: WAVELENGTH_UNITS[params.get("lu")] ? params.get("lu") : "nm",
    angleUnit: ANGLE_UNITS[params.get("au")] ? params.get("au") : "arcsec",
  };
}

export default function TelescopeAngularResolutionCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [D, setD] = useState("100");
  const [DUnit, setDUnit] = useState("mm");
  const [wavelength, setWavelength] = useState("550");
  const [wavelengthUnit, setWavelengthUnit] = useState("nm");
  const [angleUnit, setAngleUnit] = useState("arcsec");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setD(initial.D);
      setDUnit(initial.DUnit);
      setWavelength(initial.wavelength);
      setWavelengthUnit(initial.wavelengthUnit);
      setAngleUnit(initial.angleUnit);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("D", D);
      params.set("Du", DUnit);
      params.set("l", wavelength);
      params.set("lu", wavelengthUnit);
      params.set("au", angleUnit);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, D, DUnit, wavelength, wavelengthUnit, angleUnit]);

  const result = useMemo(() => {
    const DNum = parseFloat(D);
    const wNum = parseFloat(wavelength);
    if (!(DNum > 0) || !(wNum > 0)) {
      return { valid: false, reason: "Enter a positive aperture diameter and wavelength." };
    }
    const DM = apertureToMeters(DNum, DUnit);
    const wM = wavelengthToMeters(wNum, wavelengthUnit);
    const rayleighRad = rayleighLimitRad(DM, wM);
    const dawesRad = dawesLimitRad(DM);
    return { valid: true, rayleighRad, dawesRad };
  }, [D, DUnit, wavelength, wavelengthUnit]);

  // --- two stars gradually separating ---
  // A filmstrip of overlapping blobs (a simplified Gaussian stand-in for
  // a true ringed Airy pattern) at several multiples of the Rayleigh
  // limit, so "resolved" versus "not resolved" is something you see
  // change, not just a number to interpret.
  const filmstrip = useMemo(() => {
    if (!result.valid) return null;
    const pxPerRayleigh = 20;
    const blobRadius = 15;
    return FILMSTRIP_RATIOS.map((ratio) => {
      const sep = ratio * pxPerRayleigh;
      let status;
      if (ratio < 0.9) status = "not resolved";
      else if (ratio < 1.3) status = "just resolved";
      else status = "resolved";
      return { ratio, sep, blobRadius, status };
    });
  }, [result]);

  // --- resolution comparison ruler ---
  const ladder = useMemo(() => {
    if (!result.valid) return null;
    const rayleighArcsec = radiansToAngle(result.rayleighRad, "arcsec");
    const allArcsec = [...RESOLUTION_LANDMARKS.map((l) => l.arcsec), rayleighArcsec];
    const domainMinLog = Math.log10(Math.min(...allArcsec)) - 0.4;
    const domainMaxLog = Math.log10(Math.max(...allArcsec)) + 0.4;
    const width = 640;
    const height = 190;
    const marginLeft = 26;
    const marginRight = 26;
    const y = 76;
    const plotWidth = width - marginLeft - marginRight;
    const xScale = (logArcsec) => marginLeft + ((logArcsec - domainMinLog) / (domainMaxLog - domainMinLog)) * plotWidth;
    const ticks = [];
    for (let e = Math.ceil(domainMinLog); e <= domainMaxLog; e++) ticks.push(e);

    return {
      width, height, marginLeft, plotWidth, y, xScale, ticks,
      markerX: xScale(Math.log10(rayleighArcsec)),
      landmarks: RESOLUTION_LANDMARKS.map((l) => ({ ...l, x: xScale(Math.log10(l.arcsec)) })),
    };
  }, [result]);

  const applyPreset = (preset) => {
    setD(String(preset.D));
    setDUnit(preset.DUnit);
    setWavelength(String(preset.wavelength));
    setWavelengthUnit(preset.wavelengthUnit);
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
    <div className="tar" aria-label="Telescope angular resolution calculator">
      <div className="tar-header">
        <p className="tar-title">Telescope angular resolution calculator</p>
        <div className="tar-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="tar-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="tar-explainer">
        Light diffracts through any finite aperture, which alone limits how close together two
        point sources can be and still look distinct: <code>θ = 1.22λ/D</code> (Rayleigh
        criterion). This is an <strong>ideal, diffraction-only limit</strong> — real ground-based
        observations are very often limited far more by atmospheric seeing, optical quality,
        tracking, and detector sampling than by diffraction at all. See below for details.
      </p>

      <div className="tar-fields">
        <div className="tar-field">
          <label htmlFor="tar-d">Aperture diameter (D)</label>
          <div className="tar-input-row">
            <input id="tar-d" className="tar-input" type="number" min="0" step="any" inputMode="decimal" value={D} onChange={(e) => setD(e.target.value)} />
            <select className="tar-unit-select" value={DUnit} onChange={(e) => setDUnit(e.target.value)}>
              {APERTURE_UNIT_ORDER.map((u) => <option key={u} value={u}>{APERTURE_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
        <div className="tar-field">
          <label htmlFor="tar-l">Wavelength (λ)</label>
          <div className="tar-input-row">
            <input id="tar-l" className="tar-input" type="number" min="0" step="any" inputMode="decimal" value={wavelength} onChange={(e) => setWavelength(e.target.value)} />
            <select className="tar-unit-select" value={wavelengthUnit} onChange={(e) => setWavelengthUnit(e.target.value)}>
              {WAVELENGTH_UNIT_ORDER.map((u) => <option key={u} value={u}>{WAVELENGTH_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!result.valid ? (
        <p className="tar-note tar-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="tar-headline-card">
            <div className="tar-headline">
              θ (Rayleigh) ≈ {formatNumber(radiansToAngle(result.rayleighRad, angleUnit))} {ANGLE_UNITS[angleUnit].short}
            </div>
            <div className="tar-headline-sub">
              Dawes limit (empirical, visible light): ≈ {formatNumber(radiansToAngle(result.dawesRad, angleUnit))} {ANGLE_UNITS[angleUnit].short}
            </div>
            <select className="tar-angle-select" value={angleUnit} onChange={(e) => setAngleUnit(e.target.value)}>
              {ANGLE_UNIT_ORDER.map((u) => <option key={u} value={u}>{ANGLE_UNITS[u].label}</option>)}
            </select>
          </div>

          <div className="tar-table" role="table" aria-label="Rayleigh resolution in every unit">
            {ANGLE_UNIT_ORDER.map((key) => (
              <div className={key === angleUnit ? "tar-row tar-row--active" : "tar-row"} role="row" key={key}>
                <span className="tar-row-label" role="cell">{ANGLE_UNITS[key].label}</span>
                <span className="tar-row-value" role="cell">
                  {formatNumber(radiansToAngle(result.rayleighRad, key))} <span className="tar-row-unit">{ANGLE_UNITS[key].short}</span>
                </span>
              </div>
            ))}
          </div>

          {filmstrip && (
            <div className="tar-chart-wrap">
              <div className="tar-filmstrip">
                {filmstrip.map((panel) => (
                  <div key={panel.ratio} className="tar-filmstrip-panel">
                    <svg viewBox="0 0 100 70" className="tar-filmstrip-svg" role="img" aria-label={`Two sources at ${panel.ratio}x the Rayleigh limit apart: ${panel.status}`}>
                      <defs>
                        <radialGradient id={`tar-blob-${panel.ratio}`} cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#ffe9b0" stopOpacity="0.95" />
                          <stop offset="55%" stopColor="#ffd479" stopOpacity="0.55" />
                          <stop offset="100%" stopColor="#ffd479" stopOpacity="0" />
                        </radialGradient>
                      </defs>
                      <circle cx={50 - panel.sep / 2} cy="30" r={panel.blobRadius} fill={`url(#tar-blob-${panel.ratio})`} />
                      <circle cx={50 + panel.sep / 2} cy="30" r={panel.blobRadius} fill={`url(#tar-blob-${panel.ratio})`} />
                    </svg>
                    <p className="tar-filmstrip-label">{panel.ratio}× θ</p>
                    <p className={`tar-filmstrip-status tar-filmstrip-status--${panel.status.replace(/\s+/g, "-")}`}>{panel.status}</p>
                  </div>
                ))}
              </div>
              <p className="tar-chart-caption">
                Idealized overlapping-blob approximation of two point sources (not a true, ringed
                Airy pattern) at increasing separation, in multiples of this telescope's Rayleigh
                limit θ. Around 1× is the classic "just resolved" boundary.
              </p>
            </div>
          )}

          {ladder && (
            <div className="tar-chart-wrap">
              <svg className="tar-ladder-svg" viewBox={`0 0 ${ladder.width} ${ladder.height}`} role="img" aria-label="Resolution comparison scale">
                <line x1={ladder.marginLeft} x2={ladder.marginLeft + ladder.plotWidth} y1={ladder.y} y2={ladder.y} className="tar-ladder-axis" />
                {ladder.ticks.map((e) => (
                  <g key={e}>
                    <line x1={ladder.xScale(e)} x2={ladder.xScale(e)} y1={ladder.y - 5} y2={ladder.y + 5} className="tar-ladder-tick" />
                    <text x={ladder.xScale(e)} y={ladder.y + 20} className="tar-chart-axis-label" textAnchor="middle">10{toSuperscript(e)}″</text>
                  </g>
                ))}
                {ladder.landmarks.map((lm) => (
                  <g key={lm.label}>
                    <line x1={lm.x} x2={lm.x} y1={ladder.y - 14} y2={ladder.y + 14} className="tar-landmark-tick" />
                    <text x={lm.x} y={ladder.y + 40} className="tar-landmark-label" textAnchor="middle">{lm.label}</text>
                  </g>
                ))}
                <polygon points={`${ladder.markerX - 7},${ladder.y - 26} ${ladder.markerX + 7},${ladder.y - 26} ${ladder.markerX},${ladder.y - 10}`} className="tar-ladder-marker" />
                <text x={ladder.markerX} y={ladder.y - 31} className="tar-ladder-marker-label" textAnchor="middle">this telescope</text>
              </svg>
              <p className="tar-chart-caption">
                Log scale — resolving power (smaller is better) spans more than four orders of
                magnitude from a single radio dish to a large visible-light telescope.
              </p>
            </div>
          )}
        </>
      )}

      <p className="tar-caveat">
        <strong>This is a theoretical ceiling, not a promise.</strong> Ground-based optical
        telescopes are routinely limited far more by atmospheric seeing (typically ~1″ at an
        average site, occasionally much worse) than by diffraction — a large amateur or even
        professional telescope's actual resolution can be worse than a much smaller instrument's
        diffraction limit on a bad night. Optical quality, mechanical tracking error, and how
        finely the detector samples the focal plane all set additional, independent limits.
      </p>

      <div className="tar-footer-row">
        <CalculatorVote slug="telescope-angular-resolution-calculator" />
        <button type="button" className="tar-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
