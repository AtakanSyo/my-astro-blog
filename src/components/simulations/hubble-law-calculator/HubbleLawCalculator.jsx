import { useEffect, useMemo, useState } from "react";
import {
  DISTANCE_UNITS,
  DISTANCE_UNIT_ORDER,
  VELOCITY_UNITS,
  VELOCITY_UNIT_ORDER,
  C_KM_S,
  distanceToMpc,
  distanceFromMpc,
  velocityToKms,
  velocityFromKms,
  velocityFromDistance,
  distanceFromVelocity,
  velocityFractionOfC,
  getValidityLevel,
} from "./hubbleLaw";
import { HUBBLE_LAW_TEST_COLUMNS, HUBBLE_LAW_TEST_SOURCES, getHubbleLawTestRows } from "./hubbleLawTests";
import "../../../styles/hubbleLawCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import CalculatorTests from "../../CalculatorTests.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";

// Every preset is self-consistent under v = H0 * d at H0 = 70, so
// switching direction after applying one never shows a jarring mismatch.
// Labeled "illustrative" because real measured distances/velocities for
// these clusters vary across the literature — these are round,
// physically reasonable stand-ins, not a citation.
const PRESETS = [
  { label: "Local Group neighbor (illustrative, ~10 Mpc)", solveFor: "velocity", H0: 70, d: 10, dUnit: "mpc", v: 700, vUnit: "kms" },
  { label: "Virgo Cluster (illustrative, ~16.5 Mpc)", solveFor: "velocity", H0: 70, d: 16.5, dUnit: "mpc", v: 1155, vUnit: "kms" },
  { label: "Coma Cluster (illustrative, ~100 Mpc)", solveFor: "velocity", H0: 70, d: 100, dUnit: "mpc", v: 7000, vUnit: "kms" },
  { label: "Reverse: 20,000 km/s recession", solveFor: "distance", H0: 70, d: 285.71, dUnit: "mpc", v: 20000, vUnit: "kms" },
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
  if (abs >= 1e6 || abs < 1e-4) {
    const exp = Math.floor(Math.log10(abs));
    const mantissa = abs / Math.pow(10, exp);
    return `${sign}${trimTrailingZeros(mantissa.toFixed(digits))} × 10${toSuperscript(exp)}`;
  }
  if (abs >= 100) return `${sign}${trimTrailingZeros(abs.toFixed(1))}`;
  if (abs >= 1) return `${sign}${trimTrailingZeros(abs.toFixed(digits))}`;
  return `${sign}${trimTrailingZeros(abs.toFixed(digits + 2))}`;
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const solveFor = params.get("solve");
  if (solveFor !== "distance" && solveFor !== "velocity") return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  return {
    solveFor,
    H0: num("h0", "70"),
    d: num("d", "16.5"),
    dUnit: DISTANCE_UNITS[params.get("du")] ? params.get("du") : "mpc",
    v: num("v", "1155"),
    vUnit: VELOCITY_UNITS[params.get("vu")] ? params.get("vu") : "kms",
  };
}

export default function HubbleLawCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [solveFor, setSolveFor] = useState("velocity");
  const [H0, setH0] = useState("70");
  const [d, setD] = useState("16.5");
  const [dUnit, setDUnit] = useState("mpc");
  const [v, setV] = useState("1155");
  const [vUnit, setVUnit] = useState("kms");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setSolveFor(initial.solveFor);
      setH0(initial.H0);
      setD(initial.d);
      setDUnit(initial.dUnit);
      setV(initial.v);
      setVUnit(initial.vUnit);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("solve", solveFor);
      params.set("h0", H0);
      params.set("d", d);
      params.set("du", dUnit);
      params.set("v", v);
      params.set("vu", vUnit);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, solveFor, H0, d, dUnit, v, vUnit]);

  const result = useMemo(() => {
    const H0Num = parseFloat(H0);
    if (!(H0Num > 0)) return { valid: false, reason: "Enter a positive Hubble constant." };

    if (solveFor === "velocity") {
      const dNum = parseFloat(d);
      if (!Number.isFinite(dNum) || dNum <= 0) return { valid: false, reason: "Enter a positive distance." };
      const dMpc = distanceToMpc(dNum, dUnit);
      const vKms = velocityFromDistance(dMpc, H0Num);
      return { valid: true, quantity: "velocity", H0: H0Num, dMpc, vKms };
    }

    const vNum = parseFloat(v);
    if (!Number.isFinite(vNum) || vNum <= 0) return { valid: false, reason: "Enter a positive recession velocity." };
    const vKms = velocityToKms(vNum, vUnit);
    if (vKms >= C_KM_S) return { valid: false, reason: "A recession velocity can't reach or exceed the speed of light." };
    const dMpc = distanceFromVelocity(vKms, H0Num);
    return { valid: true, quantity: "distance", H0: H0Num, dMpc, vKms };
  }, [solveFor, H0, d, dUnit, v, vUnit]);

  const validity = result.valid ? getValidityLevel(result.vKms) : "ok";

  // --- Hubble diagram: v = H0 * d line, with the current point plotted ---
  const diagram = useMemo(() => {
    if (!result.valid) return null;
    const { dMpc, vKms, H0: H0Num } = result;

    const width = 640;
    const height = 360;
    const marginLeft = 64;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 46;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;

    // Axis extents: always include the origin and the current point, with
    // headroom so the point never sits right at the plot edge.
    const dMax = Math.max(dMpc * 1.25, 1);
    const vMax = Math.max(H0Num * dMax, vKms * 1.05, 1);

    const xScale = (distMpc) => marginLeft + (distMpc / dMax) * plotWidth;
    const yScale = (velKms) => marginTop + (1 - velKms / vMax) * plotHeight;

    const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * dMax);
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * vMax);

    return {
      width, height, marginLeft, marginRight, marginTop, marginBottom, plotWidth, plotHeight,
      xScale, yScale, xTicks, yTicks,
      lineX1: xScale(0), lineY1: yScale(0), lineX2: xScale(dMax), lineY2: yScale(H0Num * dMax),
      pointX: xScale(dMpc), pointY: yScale(vKms),
    };
  }, [result]);

  // Self-check rows: runs the real hubbleLaw.js functions against known
  // reference clusters and edge cases — independent of the fields above.
  const testRows = useMemo(() => getHubbleLawTestRows(), []);

  const applyPreset = (preset) => {
    setSolveFor(preset.solveFor);
    setH0(String(preset.H0));
    setD(String(preset.d));
    setDUnit(preset.dUnit);
    setV(String(preset.v));
    setVUnit(preset.vUnit);
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
    <div className="hlc" aria-label="Hubble law calculator">
      <div className="hlc-header">
        <p className="hlc-title">Hubble law calculator</p>
        <div className="hlc-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="hlc-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="hlc-explainer">
        For nearby galaxies, recession velocity grows linearly with distance:{" "}
        <code>v = H₀ · d</code>. H₀ itself isn't perfectly nailed down — local
        measurements (Cepheids, supernovae) and measurements from the early-universe
        cosmic microwave background currently disagree by a few km/s/Mpc, a
        mismatch cosmologists call the "Hubble tension." Slide H₀ below to see how
        much that disagreement actually matters for a given galaxy.
      </p>

      <div className="hlc-field hlc-h0-field">
        <label htmlFor="hlc-h0">
          Hubble constant H₀ <span className="hlc-h0-value">{formatNumber(parseFloat(H0) || 0, 1)} km/s/Mpc</span>
        </label>
        <input
          id="hlc-h0"
          type="range"
          min="60"
          max="80"
          step="0.1"
          value={H0}
          onChange={(e) => setH0(e.target.value)}
          className="hlc-slider"
        />
        <div className="hlc-h0-scale">
          <span>60</span>
          <span>70</span>
          <span>80</span>
        </div>
      </div>

      <div className="hlc-solve-toggle" role="group" aria-label="Solve for">
        <button type="button" className={solveFor === "velocity" ? "hlc-solve-btn active" : "hlc-solve-btn"} onClick={() => setSolveFor("velocity")}>
          Distance → Velocity
        </button>
        <button type="button" className={solveFor === "distance" ? "hlc-solve-btn active" : "hlc-solve-btn"} onClick={() => setSolveFor("distance")}>
          Velocity → Distance
        </button>
      </div>

      <div className="hlc-fields">
        {solveFor === "velocity" ? (
          <div className="hlc-field">
            <label htmlFor="hlc-d">Distance (d)</label>
            <div className="hlc-input-row">
              <input id="hlc-d" className="hlc-input" type="number" min="0" step="any" inputMode="decimal" value={d} onChange={(e) => setD(e.target.value)} />
              <select className="hlc-unit-select" value={dUnit} onChange={(e) => setDUnit(e.target.value)}>
                {DISTANCE_UNIT_ORDER.map((u) => <option key={u} value={u}>{DISTANCE_UNITS[u].short}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="hlc-field">
            <label htmlFor="hlc-v">Recession velocity (v)</label>
            <div className="hlc-input-row">
              <input id="hlc-v" className="hlc-input" type="number" min="0" step="any" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} />
              <select className="hlc-unit-select" value={vUnit} onChange={(e) => setVUnit(e.target.value)}>
                {VELOCITY_UNIT_ORDER.map((u) => <option key={u} value={u}>{VELOCITY_UNITS[u].short}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {!result.valid ? (
        <p className="hlc-note hlc-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="hlc-headline-card">
            {solveFor === "distance" && (
              <div className="hlc-headline">
                d ≈ {formatNumber(distanceFromMpc(result.dMpc, "mpc"))} Mpc = {formatNumber(distanceFromMpc(result.dMpc, "mly"))} Mly
              </div>
            )}
            {solveFor === "velocity" && (
              <div className="hlc-headline">
                v ≈ {formatNumber(velocityFromKms(result.vKms, "kms"))} km/s
              </div>
            )}
            <div className="hlc-depth-row">
              <span>{formatNumber(result.vKms)} km/s</span>
              <span>{formatNumber(velocityFractionOfC(result.vKms), 4)} c</span>
              <span>{formatNumber(result.dMpc)} Mpc</span>
            </div>
          </div>

          {validity !== "ok" && (
            <p className={validity === "bad" ? "hlc-note hlc-note--warn" : "hlc-note hlc-note--caution"} role="alert">
              {validity === "bad"
                ? `This recession velocity is ${formatNumber(velocityFractionOfC(result.vKms) * 100, 1)}% of the speed of light — well past where the linear Hubble law is a reasonable approximation. Distances at this scale require the full FLRW cosmological distance-redshift relation, not v = H₀·d.`
                : `This recession velocity is ${formatNumber(velocityFractionOfC(result.vKms) * 100, 1)}% of the speed of light — the linear approximation is starting to break down here. Treat this distance/velocity as a rough estimate only.`}
            </p>
          )}

          {diagram && (
            <div className="hlc-chart-wrap">
              <svg
                className="hlc-diagram-svg"
                viewBox={`0 0 ${diagram.width} ${diagram.height}`}
                role="img"
                aria-label={`Hubble diagram: recession velocity ${formatNumber(result.vKms)} kilometers per second versus distance ${formatNumber(result.dMpc)} megaparsecs, on the H0 = ${formatNumber(result.H0, 1)} line`}
              >
                {diagram.yTicks.map((t, idx) => (
                  <g key={`y-${idx}`}>
                    <line x1={diagram.marginLeft} x2={diagram.marginLeft + diagram.plotWidth} y1={diagram.yScale(t)} y2={diagram.yScale(t)} className="hlc-chart-gridline" />
                    <text x={diagram.marginLeft - 8} y={diagram.yScale(t) + 4} className="hlc-chart-axis-label" textAnchor="end">{formatNumber(t, 0)}</text>
                  </g>
                ))}
                {diagram.xTicks.map((t, idx) => (
                  <g key={`x-${idx}`}>
                    <text x={diagram.xScale(t)} y={diagram.marginTop + diagram.plotHeight + 18} className="hlc-chart-axis-label" textAnchor="middle">{formatNumber(t, 0)}</text>
                  </g>
                ))}

                <line x1={diagram.marginLeft} x2={diagram.marginLeft} y1={diagram.marginTop} y2={diagram.marginTop + diagram.plotHeight} className="hlc-chart-axis-line" />
                <line x1={diagram.marginLeft} x2={diagram.marginLeft + diagram.plotWidth} y1={diagram.marginTop + diagram.plotHeight} y2={diagram.marginTop + diagram.plotHeight} className="hlc-chart-axis-line" />

                <line
                  x1={diagram.lineX1} y1={diagram.lineY1}
                  x2={diagram.lineX2} y2={diagram.lineY2}
                  className="hlc-hubble-line"
                />

                <line x1={diagram.pointX} x2={diagram.pointX} y1={diagram.pointY} y2={diagram.marginTop + diagram.plotHeight} className="hlc-point-guide" />
                <line x1={diagram.marginLeft} x2={diagram.pointX} y1={diagram.pointY} y2={diagram.pointY} className="hlc-point-guide" />
                <circle cx={diagram.pointX} cy={diagram.pointY} r="6.5" className="hlc-point-dot" />

                <text x={diagram.marginLeft + diagram.plotWidth / 2} y={diagram.height - 8} className="hlc-chart-axis-label" textAnchor="middle">distance d (Mpc)</text>
                <text x={16} y={diagram.marginTop + diagram.plotHeight / 2} className="hlc-chart-axis-label hlc-ylabel" textAnchor="middle">velocity v (km/s)</text>
              </svg>
              <p className="hlc-chart-caption">
                The diagonal line is v = H₀·d at the current H₀; the dot is your
                current distance/velocity pair, always sitting exactly on it —
                that's the whole content of a linear Hubble law.
              </p>
            </div>
          )}
        </>
      )}

      <p className="hlc-caveat">
        <strong>Scope of this tool:</strong> the linear relation v = H₀·d is a
        low-redshift approximation, good only for relatively nearby galaxies
        (roughly up to a few hundred megaparsecs, z ≲ 0.1-ish). It does not
        attempt to compute cosmological distances for distant, high-redshift
        objects — that requires the full FLRW comoving/luminosity-distance
        relation, which depends on the universe's matter and dark-energy
        density (Ωm, ΩΛ), not just H₀. Rather than silently returning a wrong
        number for an extreme input, this calculator flags it above instead.
      </p>

      <div className="hlc-footer-row">
        <CalculatorVote slug="hubble-law-calculator" />
        <CalculatorTests
          title="Hubble Law Calculator — Tests"
          columns={HUBBLE_LAW_TEST_COLUMNS}
          rows={testRows}
          sources={HUBBLE_LAW_TEST_SOURCES}
        />
        <button type="button" className="hlc-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
