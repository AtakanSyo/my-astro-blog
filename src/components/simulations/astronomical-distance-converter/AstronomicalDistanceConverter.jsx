import { useEffect, useMemo, useState } from "react";
import { UNITS, UNIT_ORDER, toMeters, fromMeters, formatLightTime } from "./distances";
import "../../../styles/astronomicalDistanceConverter.css";

const PRESETS = [
  { label: "Earth–Moon distance", value: 384400, unit: "km" },
  { label: "Earth–Sun (1 AU)", value: 1, unit: "au" },
  { label: "Nearest star (Proxima Centauri)", value: 4.2465, unit: "ly" },
  { label: "Galactic center", value: 8.178, unit: "kpc" },
  { label: "Andromeda Galaxy", value: 2.5e6, unit: "ly" },
  { label: "Observable universe (radius)", value: 14.26, unit: "gpc" },
];

const SUPERSCRIPT_MAP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };

function toSuperscript(n) {
  return String(n)
    .split("")
    .map((ch) => SUPERSCRIPT_MAP[ch] ?? ch)
    .join("");
}

function trimTrailingZeros(s) {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

// Distances here range from sub-metre inputs to gigaparsecs (~1e26 m), so
// most rows in the results table need scientific notation — these are
// read-only display cells (not inputs), so a real unicode superscript
// exponent reads far better than an "e" suffix.
function formatNumber(n) {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e6 || abs < 1e-3) {
    const exp = Math.floor(Math.log10(abs));
    const mantissa = n / Math.pow(10, exp);
    return `${trimTrailingZeros(mantissa.toFixed(4))} × 10${toSuperscript(exp)}`;
  }
  if (abs >= 100) return trimTrailingZeros(n.toFixed(2));
  if (abs >= 1) return trimTrailingZeros(n.toFixed(4));
  return trimTrailingZeros(n.toFixed(6));
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const v = params.get("v");
  const u = params.get("u");
  if (v === null || !u || !UNITS[u]) return null;
  const num = parseFloat(v);
  if (!Number.isFinite(num) || num <= 0) return null;
  return { value: v, unit: u };
}

export default function AstronomicalDistanceConverter() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [value, setValue] = useState("1");
  const [unit, setUnit] = useState("au");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setValue(initial.value);
      setUnit(initial.unit);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("v", value);
      params.set("u", unit);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, value, unit]);

  const result = useMemo(() => {
    const num = parseFloat(value);
    if (!Number.isFinite(num) || num <= 0) return { valid: false };
    const meters = toMeters(num, unit);
    const rows = UNIT_ORDER.map((key) => ({
      key,
      ...UNITS[key],
      converted: fromMeters(meters, key),
    }));
    return { valid: true, meters, rows };
  }, [value, unit]);

  const applyPreset = (preset) => {
    setValue(String(preset.value));
    setUnit(preset.unit);
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
    <div className="adc" aria-label="Astronomical distance converter">
      <div className="adc-header">
        <p className="adc-title">Distance converter</p>
        <div className="adc-presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="adc-preset-btn"
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="adc-input-row">
        <div className="adc-field">
          <label htmlFor="adc-value">Distance</label>
          <input
            id="adc-value"
            className="adc-input"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="adc-field">
          <label htmlFor="adc-unit">Unit</label>
          <select
            id="adc-unit"
            className="adc-unit-select"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          >
            {UNIT_ORDER.map((key) => (
              <option key={key} value={key}>
                {UNITS[key].label} ({UNITS[key].short})
              </option>
            ))}
          </select>
        </div>
      </div>

      {!result.valid ? (
        <p className="adc-note adc-note--warn" role="alert">
          Enter a positive distance to see its equivalent in every other unit.
        </p>
      ) : (
        <>
          <div className="adc-table" role="table" aria-label="Equivalent distances">
            {result.rows.map((row) => (
              <div
                className={row.key === unit ? "adc-row adc-row--active" : "adc-row"}
                role="row"
                key={row.key}
              >
                <span className="adc-row-label" role="cell">
                  {row.label}
                  {row.key === unit && <span className="adc-row-badge">entered</span>}
                </span>
                <span className="adc-row-value" role="cell">
                  {formatNumber(row.converted)}{" "}
                  <span className="adc-row-unit">{row.short}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="adc-time-card">
            <span className="adc-time-label">Light-travel time</span>
            <span className="adc-time-value">{formatLightTime(result.meters, formatNumber)}</span>
          </div>
        </>
      )}

      <div className="adc-footer-row">
        <button type="button" className="adc-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
