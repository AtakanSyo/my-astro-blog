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

// Landmarks for the scale bar below — deliberately mirrors the preset
// buttons above (same underlying values) so clicking a preset always
// lands the "your value" marker exactly on that landmark's tick, with
// shorter labels sized for the chart rather than a button.
const SCALE_LANDMARKS = [
  { label: "Human height", meters: 1.7 },
  { label: "Earth–Moon", meters: toMeters(384400, "km") },
  { label: "Earth–Sun", meters: toMeters(1, "au") },
  { label: "Nearest star", meters: toMeters(4.2465, "ly") },
  { label: "Galactic center", meters: toMeters(8.178, "kpc") },
  { label: "Andromeda", meters: toMeters(2.5e6, "ly") },
  { label: "Observable universe", meters: toMeters(14.26, "gpc") },
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

  // --- logarithmic "cosmic ruler" scale bar ---
  // This tool's whole point is grasping scale across ~27 orders of
  // magnitude — a log-log line chart wouldn't show anything (it's a
  // trivial straight-line unit conversion), so the useful visual here is
  // a ruler: fixed, well-known reference distances plus a marker showing
  // exactly where the entered value falls among them.
  const scaleBar = useMemo(() => {
    if (!result.valid) return null;
    const logValue = Math.log10(result.meters);
    const fixedMin = 0; // 10^0 m — about human scale
    const fixedMax = 27; // a bit past the observable universe
    const domainMin = Math.min(fixedMin, logValue - 0.5);
    const domainMax = Math.max(fixedMax, logValue + 0.5);

    const width = 640;
    const height = 170;
    const marginLeft = 24;
    const marginRight = 24;
    const barY = 96;
    const plotWidth = width - marginLeft - marginRight;

    const xScale = (log10m) => marginLeft + ((log10m - domainMin) / (domainMax - domainMin)) * plotWidth;

    // Text centered on a point overflows the viewBox — and, since the SVG
    // scales with the card, the actual page on narrow viewports — once
    // that point sits close enough to either edge. Rather than clamp the
    // marker/tick itself (which must stay at its true position), switch
    // the label to edge-anchored text instead.
    const edgeAwareLabel = (x) => {
      if (x > width - marginRight - 90) return { anchor: "end", x: width - marginRight };
      if (x < marginLeft + 90) return { anchor: "start", x: marginLeft };
      return { anchor: "middle", x };
    };

    const landmarks = SCALE_LANDMARKS.map((l, i) => {
      const x = xScale(Math.log10(l.meters));
      return { ...l, x, row: i % 2, labelPos: edgeAwareLabel(x) };
    });

    const valueX = xScale(logValue);
    const valueLabel = edgeAwareLabel(valueX);

    return {
      width, height, marginLeft, marginRight, barY, plotWidth, landmarks,
      valueX, valueLabelAnchor: valueLabel.anchor, valueLabelX: valueLabel.x,
    };
  }, [result]);

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

          {scaleBar && (
            <div className="adc-scale-wrap">
              <svg
                className="adc-scale-svg"
                viewBox={`0 0 ${scaleBar.width} ${scaleBar.height}`}
                role="img"
                aria-label={`Logarithmic scale bar showing this distance, ${formatNumber(result.meters)} meters, against reference distances from human height to the observable universe`}
              >
                <line
                  x1={scaleBar.marginLeft} x2={scaleBar.width - scaleBar.marginRight}
                  y1={scaleBar.barY} y2={scaleBar.barY}
                  className="adc-scale-bar-line"
                />

                {scaleBar.landmarks.map((l) => (
                  <g key={l.label}>
                    <line
                      x1={l.x} x2={l.x}
                      y1={scaleBar.barY} y2={scaleBar.barY + (l.row === 0 ? 8 : 16)}
                      className="adc-scale-tick"
                    />
                    <text
                      x={l.labelPos.x} y={scaleBar.barY + (l.row === 0 ? 22 : 40)}
                      className="adc-scale-tick-label"
                      textAnchor={l.labelPos.anchor}
                    >
                      {l.label}
                    </text>
                  </g>
                ))}

                <line x1={scaleBar.valueX} x2={scaleBar.valueX} y1={scaleBar.barY - 36} y2={scaleBar.barY} className="adc-scale-value-line" />
                <circle cx={scaleBar.valueX} cy={scaleBar.barY} r="5" className="adc-scale-value-dot" />
                <text x={scaleBar.valueLabelX} y={scaleBar.barY - 44} className="adc-scale-value-label" textAnchor={scaleBar.valueLabelAnchor}>
                  your value — {formatNumber(result.meters)} m
                </text>
              </svg>
              <p className="adc-scale-caption">
                Logarithmic scale — each step along the bar is a factor of ten, not an equal
                distance, so the marker's position reflects orders of magnitude, not a linear
                fraction of the way to the universe's edge.
              </p>
            </div>
          )}

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
