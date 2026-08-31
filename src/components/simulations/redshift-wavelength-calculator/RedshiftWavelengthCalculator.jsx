import { useEffect, useId, useMemo, useState } from "react";
import {
  C,
  WAVELENGTH_UNITS,
  WAVELENGTH_UNIT_ORDER,
  wavelengthToMeters,
  metersToWavelength,
  computeRedshift,
  computeObservedWavelength,
  computeRestWavelength,
  velocityClassical,
  velocityRelativistic,
} from "./redshift";
import "../../../styles/redshiftWavelengthCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";

// Every preset is self-consistent under all three "solve for" choices.
// Each also names the real spectral line it uses, since which line is
// diagnostic changes with redshift regime — that's a real observational
// fact, not an arbitrary choice.
const PRESETS = [
  { label: "Nearby galaxy (Hα)", solveFor: "z", z: 0.0033, lamRest: 656.3, lamRestUnit: "nm", lamObs: 658.466, lamObsUnit: "nm" },
  { label: "Andromeda (blueshifted)", solveFor: "z", z: -0.001004, lamRest: 656.3, lamRestUnit: "nm", lamObs: 655.641, lamObsUnit: "nm" },
  { label: "3C 273 quasar (Hβ)", solveFor: "z", z: 0.158, lamRest: 486.1, lamRestUnit: "nm", lamObs: 562.904, lamObsUnit: "nm" },
  { label: "Distant galaxy (Hα)", solveFor: "z", z: 0.5, lamRest: 656.3, lamRestUnit: "nm", lamObs: 984.45, lamObsUnit: "nm" },
  { label: "High-z quasar (Lyα)", solveFor: "z", z: 6, lamRest: 121.6, lamRestUnit: "nm", lamObs: 851.2, lamObsUnit: "nm" },
  { label: "Very high-z galaxy (Lyα)", solveFor: "z", z: 10.6, lamRest: 121.6, lamRestUnit: "nm", lamObs: 1410.56, lamObsUnit: "nm" },
];

const SOLVE_OPTIONS = [
  { key: "z", label: "Redshift" },
  { key: "obs", label: "Observed wavelength" },
  { key: "rest", label: "Rest wavelength" },
];

const SUPERSCRIPT_MAP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
function toSuperscript(n) {
  return String(n).split("").map((ch) => SUPERSCRIPT_MAP[ch] ?? ch).join("");
}
function trimTrailingZeros(s) {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}
function formatNumber(n, { forceSign = false } = {}) {
  if (!Number.isFinite(n)) return "—";
  const sign = forceSign && n >= 0 ? "+" : "";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e6 || abs < 1e-3) {
    const exp = Math.floor(Math.log10(abs));
    const mantissa = n / Math.pow(10, exp);
    return `${sign}${trimTrailingZeros(mantissa.toFixed(4))} × 10${toSuperscript(exp)}`;
  }
  if (abs >= 100) return `${sign}${trimTrailingZeros(n.toFixed(2))}`;
  if (abs >= 1) return `${sign}${trimTrailingZeros(n.toFixed(4))}`;
  return `${sign}${trimTrailingZeros(n.toFixed(6))}`;
}
function formatVelocity(vMs) {
  const kms = formatNumber(vMs / 1000, { forceSign: true });
  const fracC = (vMs / C) * 100;
  const fracSign = fracC >= 0 ? "+" : "";
  return `${kms} km/s (${fracSign}${fracC.toFixed(2)}% c)`;
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
  const unit = (key, fallback) => (WAVELENGTH_UNITS[params.get(key)] ? params.get(key) : fallback);
  return {
    solveFor,
    z: num("z", "0.158"),
    lamRest: num("lr", "486.1"),
    lamRestUnit: unit("lru", "nm"),
    lamObs: num("lo", "562.904"),
    lamObsUnit: unit("lou", "nm"),
  };
}

const VISIBLE_MIN_NM = 380;
const VISIBLE_MAX_NM = 750;

export default function RedshiftWavelengthCalculator() {
  const gradientId = useId().replace(/[:]/g, "");
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [solveFor, setSolveFor] = useState("z");
  const [z, setZ] = useState("0.158");
  const [lamRest, setLamRest] = useState("486.1");
  const [lamRestUnit, setLamRestUnit] = useState("nm");
  const [lamObs, setLamObs] = useState("562.904");
  const [lamObsUnit, setLamObsUnit] = useState("nm");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setSolveFor(initial.solveFor);
      setZ(initial.z);
      setLamRest(initial.lamRest);
      setLamRestUnit(initial.lamRestUnit);
      setLamObs(initial.lamObs);
      setLamObsUnit(initial.lamObsUnit);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("solve", solveFor);
      params.set("z", z);
      params.set("lr", lamRest);
      params.set("lru", lamRestUnit);
      params.set("lo", lamObs);
      params.set("lou", lamObsUnit);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, solveFor, z, lamRest, lamRestUnit, lamObs, lamObsUnit]);

  const result = useMemo(() => {
    if (solveFor === "z") {
      const restM = wavelengthToMeters(parseFloat(lamRest), lamRestUnit);
      const obsM = wavelengthToMeters(parseFloat(lamObs), lamObsUnit);
      const r = computeRedshift(restM, obsM);
      if (!r.valid) return { valid: false, reason: r.reason };
      return { valid: true, quantity: "z", z: r.z, restM, obsM };
    }
    if (solveFor === "obs") {
      const zNum = parseFloat(z);
      const restM = wavelengthToMeters(parseFloat(lamRest), lamRestUnit);
      if (!Number.isFinite(zNum) || !(restM > 0)) {
        return { valid: false, reason: "Enter a redshift and a positive rest wavelength." };
      }
      const r = computeObservedWavelength(zNum, restM);
      if (!r.valid) return { valid: false, reason: r.reason };
      return { valid: true, quantity: "obs", z: zNum, restM, obsM: r.lamObsM };
    }
    const zNum = parseFloat(z);
    const obsM = wavelengthToMeters(parseFloat(lamObs), lamObsUnit);
    if (!Number.isFinite(zNum) || !(obsM > 0)) {
      return { valid: false, reason: "Enter a redshift and a positive observed wavelength." };
    }
    const r = computeRestWavelength(zNum, obsM);
    if (!r.valid) return { valid: false, reason: r.reason };
    return { valid: true, quantity: "rest", z: zNum, restM: r.lamRestM, obsM };
  }, [solveFor, z, lamRest, lamRestUnit, lamObs, lamObsUnit]);

  // --- spectrum-strip visualization ---
  // Unlike the site's other 3-quantity calculators, this one isn't a
  // power law spanning many decades — realistic rest/observed
  // wavelengths here sit within roughly one order of magnitude of each
  // other, so a plain linear wavelength axis works well (no log
  // compression needed). The visible-light band is always kept in view
  // for context, since whether a shifted line lands inside or outside it
  // is a real, practical fact about which lines an optical telescope can
  // actually see — the same band styling as the blackbody generator.
  const spectrum = useMemo(() => {
    if (!result.valid) return null;
    const restNm = metersToWavelength(result.restM, "nm");
    const obsNm = metersToWavelength(result.obsM, "nm");
    if (!(restNm > 0) || !(obsNm > 0)) return null;

    const dataMin = Math.min(restNm, obsNm);
    const dataMax = Math.max(restNm, obsNm);
    const domainMin = Math.min(dataMin, VISIBLE_MIN_NM);
    const domainMax = Math.max(dataMax, VISIBLE_MAX_NM);
    const span = domainMax - domainMin;
    const xMin = Math.max(1, domainMin - span * 0.12);
    const xMax = domainMax + span * 0.12;

    const width = 640;
    const height = 180;
    const marginLeft = 20;
    const marginRight = 20;
    const plotTop = 42;
    const marginBottom = 44;
    const plotWidth = width - marginLeft - marginRight;
    const baselineY = height - marginBottom;

    const xScale = (nm) => marginLeft + ((nm - xMin) / (xMax - xMin)) * plotWidth;

    const redshifted = obsNm >= restNm;
    const arrowY = plotTop + 20;

    return {
      width, height, marginLeft, marginRight, plotTop, baselineY, plotWidth,
      xScale,
      visibleX1: xScale(VISIBLE_MIN_NM), visibleX2: xScale(VISIBLE_MAX_NM),
      restX: xScale(restNm), obsX: xScale(obsNm),
      arrowY, redshifted,
      restNm, obsNm, deltaNm: obsNm - restNm,
    };
  }, [result]);

  const applyPreset = (preset) => {
    setSolveFor(preset.solveFor);
    setZ(String(preset.z));
    setLamRest(String(preset.lamRest));
    setLamRestUnit(preset.lamRestUnit);
    setLamObs(String(preset.lamObs));
    setLamObsUnit(preset.lamObsUnit);
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

  const vClassical = result.valid ? velocityClassical(result.z) : null;
  const vRelativistic = result.valid ? velocityRelativistic(result.z) : null;
  const classicalExceedsC = result.valid && Math.abs(vClassical) >= C;

  return (
    <div className="rwc" aria-label="Redshift and observed wavelength calculator">
      <div className="rwc-header">
        <p className="rwc-title">Redshift / wavelength calculator</p>
        <div className="rwc-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="rwc-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="rwc-explainer">
        1 + z = λ<sub>obs</sub> / λ<sub>rest</sub> — positive z is a redshift (receding source, or
        expanding space), negative is a blueshift (approaching). Give any two of redshift, rest
        wavelength, and observed wavelength; the third follows exactly.
      </p>

      <div className="rwc-solve-toggle" role="group" aria-label="Solve for">
        {SOLVE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={opt.key === solveFor ? "rwc-solve-btn active" : "rwc-solve-btn"}
            onClick={() => setSolveFor(opt.key)}
          >
            Solve for {opt.label}
          </button>
        ))}
      </div>

      <div className="rwc-fields">
        <div className="rwc-field">
          <label htmlFor="rwc-z">Redshift z</label>
          {solveFor === "z" ? (
            <div className="rwc-computed">{result.valid ? formatNumber(result.z, { forceSign: true }) : "—"}</div>
          ) : (
            <input
              id="rwc-z"
              className="rwc-input"
              type="number"
              step="any"
              inputMode="decimal"
              value={z}
              onChange={(e) => setZ(e.target.value)}
            />
          )}
        </div>

        <div className="rwc-field">
          <label htmlFor="rwc-rest">Rest (emitted) wavelength</label>
          {solveFor === "rest" ? (
            <div className="rwc-computed">
              {result.valid ? formatNumber(metersToWavelength(result.restM, lamRestUnit)) : "—"}
              <select className="rwc-unit-select" value={lamRestUnit} onChange={(e) => setLamRestUnit(e.target.value)}>
                {WAVELENGTH_UNIT_ORDER.map((u) => (
                  <option key={u} value={u}>{WAVELENGTH_UNITS[u].short}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="rwc-input-row">
              <input
                id="rwc-rest"
                className="rwc-input"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={lamRest}
                onChange={(e) => setLamRest(e.target.value)}
              />
              <select className="rwc-unit-select" value={lamRestUnit} onChange={(e) => setLamRestUnit(e.target.value)}>
                {WAVELENGTH_UNIT_ORDER.map((u) => (
                  <option key={u} value={u}>{WAVELENGTH_UNITS[u].short}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="rwc-field">
          <label htmlFor="rwc-obs">Observed wavelength</label>
          {solveFor === "obs" ? (
            <div className="rwc-computed">
              {result.valid ? formatNumber(metersToWavelength(result.obsM, lamObsUnit)) : "—"}
              <select className="rwc-unit-select" value={lamObsUnit} onChange={(e) => setLamObsUnit(e.target.value)}>
                {WAVELENGTH_UNIT_ORDER.map((u) => (
                  <option key={u} value={u}>{WAVELENGTH_UNITS[u].short}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="rwc-input-row">
              <input
                id="rwc-obs"
                className="rwc-input"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={lamObs}
                onChange={(e) => setLamObs(e.target.value)}
              />
              <select className="rwc-unit-select" value={lamObsUnit} onChange={(e) => setLamObsUnit(e.target.value)}>
                {WAVELENGTH_UNIT_ORDER.map((u) => (
                  <option key={u} value={u}>{WAVELENGTH_UNITS[u].short}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {!result.valid ? (
        <p className="rwc-note rwc-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          {result.quantity !== "z" && (
            <div className="rwc-table" role="table" aria-label="Result in every unit">
              {WAVELENGTH_UNIT_ORDER.map((key) => {
                const meters = result.quantity === "obs" ? result.obsM : result.restM;
                const activeUnit = result.quantity === "obs" ? lamObsUnit : lamRestUnit;
                return (
                  <div className={key === activeUnit ? "rwc-row rwc-row--active" : "rwc-row"} role="row" key={key}>
                    <span className="rwc-row-label" role="cell">{WAVELENGTH_UNITS[key].label}</span>
                    <span className="rwc-row-value" role="cell">
                      {formatNumber(metersToWavelength(meters, key))} <span className="rwc-row-unit">{WAVELENGTH_UNITS[key].short}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {spectrum && (
            <div className="rwc-spectrum-wrap">
              <svg
                className="rwc-spectrum-svg"
                viewBox={`0 0 ${spectrum.width} ${spectrum.height}`}
                role="img"
                aria-label={`Spectrum strip showing a line at rest wavelength ${formatNumber(spectrum.restNm)} nanometers shifting to an observed wavelength of ${formatNumber(spectrum.obsNm)} nanometers`}
              >
                <defs>
                  <linearGradient id={`visible-${gradientId}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#7f5cff" />
                    <stop offset="25%" stopColor="#4fa8ff" />
                    <stop offset="45%" stopColor="#4fe0a8" />
                    <stop offset="65%" stopColor="#e7e04f" />
                    <stop offset="85%" stopColor="#ff8a4f" />
                    <stop offset="100%" stopColor="#ff4f4f" />
                  </linearGradient>
                </defs>

                <rect
                  x={spectrum.visibleX1} y={spectrum.plotTop}
                  width={spectrum.visibleX2 - spectrum.visibleX1} height={spectrum.baselineY - spectrum.plotTop}
                  fill={`url(#visible-${gradientId})`} opacity="0.14"
                />
                <text x={(spectrum.visibleX1 + spectrum.visibleX2) / 2} y={spectrum.plotTop + 12} className="rwc-spectrum-band-label" textAnchor="middle">
                  visible
                </text>

                <line x1={spectrum.marginLeft} x2={spectrum.width - spectrum.marginRight} y1={spectrum.baselineY} y2={spectrum.baselineY} className="rwc-spectrum-axis" />

                <line
                  x1={spectrum.restX} x2={spectrum.obsX} y1={spectrum.arrowY} y2={spectrum.arrowY}
                  className={spectrum.redshifted ? "rwc-spectrum-arrow rwc-spectrum-arrow--red" : "rwc-spectrum-arrow rwc-spectrum-arrow--blue"}
                />
                <polygon
                  points={
                    spectrum.redshifted
                      ? `${spectrum.obsX},${spectrum.arrowY} ${spectrum.obsX - 8},${spectrum.arrowY - 5} ${spectrum.obsX - 8},${spectrum.arrowY + 5}`
                      : `${spectrum.obsX},${spectrum.arrowY} ${spectrum.obsX + 8},${spectrum.arrowY - 5} ${spectrum.obsX + 8},${spectrum.arrowY + 5}`
                  }
                  className={spectrum.redshifted ? "rwc-spectrum-arrowhead rwc-spectrum-arrowhead--red" : "rwc-spectrum-arrowhead rwc-spectrum-arrowhead--blue"}
                />
                {/* printed even when the shift is too small in pixels for the
                    arrow itself to read — the real magnitude either way */}
                <text
                  x={(spectrum.restX + spectrum.obsX) / 2} y={spectrum.arrowY + 15}
                  className={spectrum.redshifted ? "rwc-spectrum-delta-label rwc-spectrum-delta-label--red" : "rwc-spectrum-delta-label rwc-spectrum-delta-label--blue"}
                  textAnchor="middle"
                >
                  Δλ = {formatNumber(spectrum.deltaNm, { forceSign: true })} nm
                </text>

                <line x1={spectrum.restX} x2={spectrum.restX} y1={spectrum.plotTop} y2={spectrum.baselineY} className="rwc-spectrum-marker rwc-spectrum-marker--rest" />
                <circle cx={spectrum.restX} cy={spectrum.baselineY} r="4" className="rwc-spectrum-marker-dot rwc-spectrum-marker-dot--rest" />
                <text x={spectrum.restX} y="16" className="rwc-spectrum-marker-label" textAnchor="middle">
                  rest {formatNumber(spectrum.restNm)} nm
                </text>

                <line x1={spectrum.obsX} x2={spectrum.obsX} y1={spectrum.plotTop} y2={spectrum.baselineY} className="rwc-spectrum-marker rwc-spectrum-marker--obs" />
                <circle cx={spectrum.obsX} cy={spectrum.baselineY} r="4" className="rwc-spectrum-marker-dot rwc-spectrum-marker-dot--obs" />
                <text x={spectrum.obsX} y={spectrum.baselineY + 20} className="rwc-spectrum-marker-label rwc-spectrum-marker-label--obs" textAnchor="middle">
                  observed {formatNumber(spectrum.obsNm)} nm
                </text>
              </svg>
              <p className="rwc-spectrum-caption">
                A line's rest position vs. where it's actually observed, against the visible-light
                band — some of these presets land inside it, some fall well outside what an
                optical telescope alone can see.
              </p>
            </div>
          )}

          <div className="rwc-velocity-card">
            <p className="rwc-velocity-title">Recession velocity implied by this redshift</p>
            <div className="rwc-velocity-row">
              <span className="rwc-velocity-label">Classical (v = cz)</span>
              <span className={classicalExceedsC ? "rwc-velocity-value rwc-velocity-value--bad" : "rwc-velocity-value"}>
                {formatVelocity(vClassical)}
              </span>
            </div>
            <div className="rwc-velocity-row">
              <span className="rwc-velocity-label">Relativistic Doppler</span>
              <span className="rwc-velocity-value">{formatVelocity(vRelativistic)}</span>
            </div>
            {classicalExceedsC && (
              <p className="rwc-note rwc-note--warn">
                v = cz exceeds the speed of light at this redshift — that's not a real velocity,
                it's a sign the classical approximation has been pushed far outside where it
                applies. Only the relativistic value is physically meaningful here.
              </p>
            )}
            <p className="rwc-note">
              Even the relativistic value is a special-relativistic Doppler velocity — strictly,
              the velocity of a source moving <em>through</em> space. At genuinely cosmological
              distances, redshift instead comes from the expansion of space itself, and there
              isn't a single well-defined "recession velocity" the way special relativity defines
              one — see below for the full explanation.
            </p>
          </div>
        </>
      )}

      <div className="rwc-footer-row">
        <CalculatorVote slug="redshift-wavelength-calculator" />
        <button type="button" className="rwc-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
