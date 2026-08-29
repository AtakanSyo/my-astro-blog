import { useEffect, useMemo, useState } from "react";
import { ratioFromMagDiff, magDiffFromRatio, ratioForMagnitudeStep, describeRatio, niceStep } from "./magnitude";
import "../../../styles/magnitudeBrightnessCalculator.css";

// Every preset is given as a pair of magnitudes — the equivalent ratio
// and "which is brighter" toggle are derived on apply, so the two modes
// never disagree about the same preset.
const PRESETS = [
  { label: "Textbook example (Δm = 5)", mA: 2, mB: 7 },
  { label: "Sirius vs. Polaris", mA: -1.46, mB: 1.98 },
  { label: "Full Moon vs. faintest naked-eye star", mA: -12.7, mB: 6.5 },
  { label: "Sun vs. full Moon", mA: -26.74, mB: -12.7 },
  { label: "Two matched stars (Δm = 0)", mA: 4.2, mB: 4.2 },
];

const REFERENCE_STEPS = [1, 2, 2.5, 5, 7.5, 10, 15, 20];

const SUPERSCRIPT_MAP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
function toSuperscript(n) {
  return String(n).split("").map((ch) => SUPERSCRIPT_MAP[ch] ?? ch).join("");
}
function trimTrailingZeros(s) {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}
function formatMag(n) {
  if (!Number.isFinite(n)) return "—";
  const v = Object.is(n, -0) ? 0 : n;
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}`;
}
function formatFactor(n) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  if (Math.abs(n - 1) < 1e-9) return "1";
  if (n >= 1e6 || n < 1e-3) {
    const exp = Math.floor(Math.log10(n));
    const mantissa = n / Math.pow(10, exp);
    return `${trimTrailingZeros(mantissa.toFixed(3))} × 10${toSuperscript(exp)}`;
  }
  if (n >= 100) return trimTrailingZeros(n.toFixed(0));
  if (n >= 10) return trimTrailingZeros(n.toFixed(1));
  if (n >= 1) return trimTrailingZeros(n.toFixed(3));
  return trimTrailingZeros(n.toFixed(5));
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  if (mode !== "toRatio" && mode !== "toMag") return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  return {
    mode,
    mA: num("ma", "2"),
    mB: num("mb", "7"),
    ratioInput: num("r", "100"),
    brighterIsA: params.get("ba") !== "0",
  };
}

export default function MagnitudeBrightnessCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [mode, setMode] = useState("toRatio");
  const [mA, setMA] = useState("2");
  const [mB, setMB] = useState("7");
  const [ratioInput, setRatioInput] = useState("100");
  const [brighterIsA, setBrighterIsA] = useState(true);
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setMode(initial.mode);
      setMA(initial.mA);
      setMB(initial.mB);
      setRatioInput(initial.ratioInput);
      setBrighterIsA(initial.brighterIsA);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("mode", mode);
      params.set("ma", mA);
      params.set("mb", mB);
      params.set("r", ratioInput);
      params.set("ba", brighterIsA ? "1" : "0");
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, mode, mA, mB, ratioInput, brighterIsA]);

  const result = useMemo(() => {
    if (mode === "toRatio") {
      const a = parseFloat(mA);
      const b = parseFloat(mB);
      if (!Number.isFinite(a) || !Number.isFinite(b)) {
        return { valid: false, reason: "Enter an apparent magnitude for both objects." };
      }
      const ratioAOverB = ratioFromMagDiff(a - b);
      const desc = describeRatio(ratioAOverB);
      return { valid: true, mode, mA: a, mB: b, deltaM: a - b, ratioAOverB, ...desc };
    }
    const r = parseFloat(ratioInput);
    if (!Number.isFinite(r) || r <= 0) {
      return { valid: false, reason: "Enter a positive brightness ratio." };
    }
    const ratioAOverB = brighterIsA ? r : 1 / r;
    const deltaM = magDiffFromRatio(ratioAOverB); // mA - mB, with mB anchored at 0
    const desc = describeRatio(ratioAOverB);
    return { valid: true, mode, mA: deltaM, mB: 0, deltaM, ratioAOverB, ...desc };
  }, [mode, mA, mB, ratioInput, brighterIsA]);

  // --- two-star brightness comparison ---
  // True flux ratios can span many orders of magnitude (Sun vs. faintest
  // star is ~10^14), so a symbol sized linearly by FLUX would make one
  // star invisible in almost every case. Real star charts solve this by
  // sizing symbols linearly by MAGNITUDE instead — this does the same,
  // so both objects stay visible and the size difference stays legible
  // regardless of how extreme the true ratio is. The exact ratio is
  // always given numerically alongside it.
  const starVisual = useMemo(() => {
    if (!result.valid) return null;
    const { mA: a, mB: b } = result;
    const brightestM = Math.min(a, b);
    const R_MAX = 46;
    const R_MIN = 8;
    const PX_PER_MAG = 4.5;
    const radius = (m) => Math.max(R_MIN, R_MAX - PX_PER_MAG * (m - brightestM));
    const glow = (m) => Math.max(0.3, 1 - 0.045 * (m - brightestM));
    const width = 640;
    const height = 236;
    const cy = 92;
    return {
      width,
      height,
      a: { cx: width * 0.28, cy, r: radius(a), glow: glow(a) },
      b: { cx: width * 0.72, cy, r: radius(b), glow: glow(b) },
    };
  }, [result]);

  // --- magnitude number line ---
  // Puts both objects on a single axis that runs BRIGHT -> DIM left to
  // right (i.e. increasing magnitude), the opposite of every other
  // numeric scale most people know — making that reversal visible is the
  // whole point of this chart.
  const ruler = useMemo(() => {
    if (!result.valid) return null;
    const { mA: a, mB: b } = result;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const span = Math.max(hi - lo, 0.5);
    const pad = Math.max(span * 0.4, 1.2);
    const domainMin = lo - pad;
    const domainMax = hi + pad;
    const width = 640;
    const height = 140;
    const marginLeft = 46;
    const marginRight = 46;
    const plotWidth = width - marginLeft - marginRight;
    const xScale = (m) => marginLeft + ((m - domainMin) / (domainMax - domainMin)) * plotWidth;
    const step = niceStep(domainMax - domainMin, 6);
    const tickStart = Math.ceil(domainMin / step) * step;
    const ticks = [];
    for (let t = tickStart; t <= domainMax + 1e-9; t += step) {
      const v = Math.round(t / step) * step;
      if (!ticks.includes(v)) ticks.push(v);
    }
    return {
      width,
      height,
      marginLeft,
      plotWidth,
      y: 62,
      xScale,
      ticks,
      aX: xScale(a),
      bX: xScale(b),
    };
  }, [result]);

  const applyPreset = (preset) => {
    setMode("toRatio");
    setMA(String(preset.mA));
    setMB(String(preset.mB));
    const ratioAOverB = ratioFromMagDiff(preset.mA - preset.mB);
    const desc = describeRatio(ratioAOverB);
    setRatioInput(String(Math.round(desc.factor * 1e6) / 1e6));
    setBrighterIsA(desc.brighter !== "B");
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

  const headline = result.valid
    ? result.brighter === "equal"
      ? "Objects A and B appear equally bright"
      : `Object ${result.brighter} appears ${formatFactor(result.factor)}× brighter`
    : null;

  return (
    <div className="mbc" aria-label="Magnitude and brightness calculator">
      <div className="mbc-header">
        <p className="mbc-title">Magnitude / brightness calculator</p>
        <div className="mbc-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="mbc-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mbc-explainer">
        The magnitude scale runs <strong>backwards and logarithmically</strong>: lower (or more
        negative) means brighter, and every 5 magnitudes is exactly a factor of 100 in flux —{" "}
        <code>F₁/F₂ = 10^(−0.4·(m₁−m₂))</code>. Convert a magnitude difference into a brightness
        ratio, or flip it around and enter a ratio to get the magnitude difference it implies.
      </p>

      <div className="mbc-mode-toggle" role="group" aria-label="Calculation direction">
        <button
          type="button"
          className={mode === "toRatio" ? "mbc-mode-btn active" : "mbc-mode-btn"}
          onClick={() => setMode("toRatio")}
        >
          Magnitudes → Ratio
        </button>
        <button
          type="button"
          className={mode === "toMag" ? "mbc-mode-btn active" : "mbc-mode-btn"}
          onClick={() => setMode("toMag")}
        >
          Ratio → Magnitude difference
        </button>
      </div>

      {mode === "toRatio" ? (
        <div className="mbc-field-row">
          <div className="mbc-field">
            <label htmlFor="mbc-ma">Object A magnitude (m_A)</label>
            <input
              id="mbc-ma"
              className="mbc-input"
              type="number"
              step="any"
              inputMode="decimal"
              value={mA}
              onChange={(e) => setMA(e.target.value)}
            />
          </div>
          <div className="mbc-field">
            <label htmlFor="mbc-mb">Object B magnitude (m_B)</label>
            <input
              id="mbc-mb"
              className="mbc-input"
              type="number"
              step="any"
              inputMode="decimal"
              value={mB}
              onChange={(e) => setMB(e.target.value)}
            />
          </div>
        </div>
      ) : (
        <div className="mbc-field-row">
          <div className="mbc-field">
            <label htmlFor="mbc-ratio">Brightness ratio (× as bright)</label>
            <input
              id="mbc-ratio"
              className="mbc-input"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={ratioInput}
              onChange={(e) => setRatioInput(e.target.value)}
            />
          </div>
          <div className="mbc-field">
            <span className="mbc-field-label-static">Which one is brighter?</span>
            <div className="mbc-brighter-toggle" role="group" aria-label="Which object is brighter">
              <button
                type="button"
                className={brighterIsA ? "mbc-brighter-btn active" : "mbc-brighter-btn"}
                onClick={() => setBrighterIsA(true)}
              >
                Object A
              </button>
              <button
                type="button"
                className={!brighterIsA ? "mbc-brighter-btn active" : "mbc-brighter-btn"}
                onClick={() => setBrighterIsA(false)}
              >
                Object B
              </button>
            </div>
          </div>
        </div>
      )}

      {!result.valid ? (
        <p className="mbc-note mbc-note--warn" role="alert">
          {result.reason}
        </p>
      ) : (
        <>
          <div className="mbc-headline-card">
            <div className="mbc-headline">{headline}</div>
            <div className="mbc-headline-sub">
              Δm = m_A − m_B = {formatMag(result.deltaM)}
              {mode === "toMag" && <> (m_A set to {formatMag(result.mA)}, m_B anchored at 0.00)</>}
            </div>
          </div>

          {starVisual && (
            <div className="mbc-star-wrap">
              <svg
                className="mbc-star-svg"
                viewBox={`0 0 ${starVisual.width} ${starVisual.height}`}
                role="img"
                aria-label={`Two stars sized by relative apparent magnitude; object ${
                  result.brighter === "equal" ? "A and B are equally bright" : `${result.brighter} is ${formatFactor(result.factor)} times brighter`
                }`}
              >
                <defs>
                  <radialGradient id="mbc-star-glow-a" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#fff6d8" stopOpacity={starVisual.a.glow} />
                    <stop offset="55%" stopColor="#ffe08a" stopOpacity={starVisual.a.glow * 0.6} />
                    <stop offset="100%" stopColor="#ffe08a" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="mbc-star-glow-b" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#dbe3ff" stopOpacity={starVisual.b.glow} />
                    <stop offset="55%" stopColor="#a9b4ff" stopOpacity={starVisual.b.glow * 0.6} />
                    <stop offset="100%" stopColor="#a9b4ff" stopOpacity="0" />
                  </radialGradient>
                </defs>

                <circle cx={starVisual.a.cx} cy={starVisual.a.cy} r={starVisual.a.r * 2.8} fill="url(#mbc-star-glow-a)" />
                <circle cx={starVisual.a.cx} cy={starVisual.a.cy} r={starVisual.a.r} className="mbc-star mbc-star--a" opacity={starVisual.a.glow} />
                <text x={starVisual.a.cx} y={starVisual.height - 34} className="mbc-star-label" textAnchor="middle">Object A</text>
                <text x={starVisual.a.cx} y={starVisual.height - 16} className="mbc-star-sublabel" textAnchor="middle">
                  m = {formatMag(result.mA)}
                </text>

                <circle cx={starVisual.b.cx} cy={starVisual.b.cy} r={starVisual.b.r * 2.8} fill="url(#mbc-star-glow-b)" />
                <circle cx={starVisual.b.cx} cy={starVisual.b.cy} r={starVisual.b.r} className="mbc-star mbc-star--b" opacity={starVisual.b.glow} />
                <text x={starVisual.b.cx} y={starVisual.height - 34} className="mbc-star-label" textAnchor="middle">Object B</text>
                <text x={starVisual.b.cx} y={starVisual.height - 16} className="mbc-star-sublabel" textAnchor="middle">
                  m = {formatMag(result.mB)}
                </text>

                {result.brighter !== "equal" && (
                  <text x={starVisual.width / 2} y="20" className="mbc-star-ratio-label" textAnchor="middle">
                    {formatFactor(result.factor)}× brighter
                  </text>
                )}
              </svg>
              <p className="mbc-chart-caption">
                Symbol size (and glow) scales linearly with magnitude, the same convention used on
                real star charts — so both objects stay visible on screen no matter how extreme the
                true ratio is. The exact factor is always given as a number, above and below.
              </p>
            </div>
          )}

          {ruler && (
            <div className="mbc-ruler-wrap">
              <svg
                className="mbc-ruler-svg"
                viewBox={`0 0 ${ruler.width} ${ruler.height}`}
                role="img"
                aria-label="Magnitude number line, brighter objects to the left, showing both objects' positions"
              >
                <line
                  x1={ruler.marginLeft} x2={ruler.marginLeft + ruler.plotWidth}
                  y1={ruler.y} y2={ruler.y}
                  className="mbc-ruler-axis"
                />
                {ruler.ticks.map((t) => (
                  <g key={t}>
                    <line x1={ruler.xScale(t)} x2={ruler.xScale(t)} y1={ruler.y - 5} y2={ruler.y + 5} className="mbc-ruler-tick" />
                    <text x={ruler.xScale(t)} y={ruler.y + 22} className="mbc-ruler-tick-label" textAnchor="middle">
                      {formatMag(t)}
                    </text>
                  </g>
                ))}

                <line
                  x1={Math.min(ruler.aX, ruler.bX)} x2={Math.max(ruler.aX, ruler.bX)}
                  y1={ruler.y - 26} y2={ruler.y - 26}
                  className="mbc-ruler-bracket"
                />
                <line x1={ruler.aX} x2={ruler.aX} y1={ruler.y - 26} y2={ruler.y - 20} className="mbc-ruler-bracket" />
                <line x1={ruler.bX} x2={ruler.bX} y1={ruler.y - 26} y2={ruler.y - 20} className="mbc-ruler-bracket" />
                <text x={(ruler.aX + ruler.bX) / 2} y={ruler.y - 32} className="mbc-ruler-bracket-label" textAnchor="middle">
                  Δm = {formatMag(Math.abs(result.deltaM))}
                </text>

                <circle cx={ruler.aX} cy={ruler.y} r="6" className="mbc-ruler-point mbc-ruler-point--a" />
                <text x={ruler.aX} y={ruler.y + 40} className="mbc-ruler-point-label" textAnchor="middle">A</text>
                <circle cx={ruler.bX} cy={ruler.y} r="6" className="mbc-ruler-point mbc-ruler-point--b" />
                <text x={ruler.bX} y={ruler.y + 40} className="mbc-ruler-point-label" textAnchor="middle">B</text>

                <text x={ruler.marginLeft} y={ruler.height - 8} className="mbc-ruler-end-label" textAnchor="start">← brighter</text>
                <text x={ruler.marginLeft + ruler.plotWidth} y={ruler.height - 8} className="mbc-ruler-end-label" textAnchor="end">dimmer →</text>
              </svg>
              <p className="mbc-chart-caption">
                Magnitude increases to the right — the opposite of most numeric scales — so the
                physically brighter object always sits on the left, however negative its number is.
              </p>
            </div>
          )}

          <div className="mbc-ref-table" role="table" aria-label="Reference magnitude steps and their brightness ratios">
            <div className="mbc-ref-row mbc-ref-row--head" role="row">
              <span role="columnheader">Δm</span>
              <span role="columnheader">Brightness ratio</span>
            </div>
            {REFERENCE_STEPS.map((d) => (
              <div key={d} className={Math.abs(Math.abs(result.deltaM) - d) < 0.05 ? "mbc-ref-row mbc-ref-row--active" : "mbc-ref-row"} role="row">
                <span role="cell">{d}</span>
                <span role="cell">{formatFactor(ratioForMagnitudeStep(d))}×</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="mbc-footer-row">
        <button type="button" className="mbc-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
