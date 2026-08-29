import { useEffect, useMemo, useState } from "react";
import {
  PLANET_RADIUS_UNITS,
  PLANET_RADIUS_UNIT_ORDER,
  STAR_RADIUS_UNITS,
  STAR_RADIUS_UNIT_ORDER,
  DEPTH_UNITS,
  DEPTH_UNIT_ORDER,
  planetRadiusToMeters,
  planetRadiusFromMeters,
  starRadiusToMeters,
  depthToFraction,
  depthFromFraction,
  transitDepth,
  planetRadiusFromDepth,
  depthToMillimag,
} from "./transitDepth";
import "../../../styles/exoplanetTransitDepthCalculator.css";

// Every preset is self-consistent under both solve directions, so
// switching direction after applying one never shows a jarring mismatch.
const PRESETS = [
  { label: "Hot Jupiter, Sun-like star", solveFor: "depth", rp: 1, rpUnit: "rjup", rs: 1, rsUnit: "rsun", depth: 1.0551, depthUnit: "percent" },
  { label: "Earth, Sun-like star", solveFor: "depth", rp: 1, rpUnit: "rearth", rs: 1, rsUnit: "rsun", depth: 83.79, depthUnit: "ppm" },
  { label: "Earth-size, red-dwarf star (TRAPPIST-1-like)", solveFor: "depth", rp: 1, rpUnit: "rearth", rs: 0.121, rsUnit: "rsun", depth: 5723, depthUnit: "ppm" },
  { label: "Sub-Neptune, Sun-like star", solveFor: "depth", rp: 3.88, rpUnit: "rearth", rs: 1, rsUnit: "rsun", depth: 1261, depthUnit: "ppm" },
  { label: "Reverse: 500 ppm signal", solveFor: "radius", rp: 2.44, rpUnit: "rearth", rs: 1, rsUnit: "rsun", depth: 500, depthUnit: "ppm" },
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
  if (n >= 1e6 || n < 1e-4) {
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
  if (solveFor !== "depth" && solveFor !== "radius") return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  return {
    solveFor,
    rp: num("rp", "1"),
    rpUnit: PLANET_RADIUS_UNITS[params.get("rpu")] ? params.get("rpu") : "rearth",
    rs: num("rs", "1"),
    rsUnit: STAR_RADIUS_UNITS[params.get("rsu")] ? params.get("rsu") : "rsun",
    depth: num("d", "83.79"),
    depthUnit: DEPTH_UNITS[params.get("du")] ? params.get("du") : "ppm",
  };
}

export default function ExoplanetTransitDepthCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [solveFor, setSolveFor] = useState("depth");
  const [rp, setRp] = useState("1");
  const [rpUnit, setRpUnit] = useState("rearth");
  const [rs, setRs] = useState("1");
  const [rsUnit, setRsUnit] = useState("rsun");
  const [depth, setDepth] = useState("83.79");
  const [depthUnit, setDepthUnit] = useState("ppm");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setSolveFor(initial.solveFor);
      setRp(initial.rp);
      setRpUnit(initial.rpUnit);
      setRs(initial.rs);
      setRsUnit(initial.rsUnit);
      setDepth(initial.depth);
      setDepthUnit(initial.depthUnit);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("solve", solveFor);
      params.set("rp", rp);
      params.set("rpu", rpUnit);
      params.set("rs", rs);
      params.set("rsu", rsUnit);
      params.set("d", depth);
      params.set("du", depthUnit);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, solveFor, rp, rpUnit, rs, rsUnit, depth, depthUnit]);

  const result = useMemo(() => {
    const rsNum = parseFloat(rs);
    if (!(rsNum > 0)) return { valid: false, reason: "Enter a positive stellar radius." };
    const rsM = starRadiusToMeters(rsNum, rsUnit);

    if (solveFor === "depth") {
      const rpNum = parseFloat(rp);
      if (!(rpNum > 0)) return { valid: false, reason: "Enter a positive planet radius." };
      const rpM = planetRadiusToMeters(rpNum, rpUnit);
      const depthFrac = transitDepth(rpM, rsM);
      return { valid: true, quantity: "depth", rpM, rsM, depthFrac, ratio: rpM / rsM };
    }

    const depthNum = parseFloat(depth);
    if (!(depthNum > 0)) return { valid: false, reason: "Enter a positive transit depth." };
    const depthFrac = depthToFraction(depthNum, depthUnit);
    if (depthFrac >= 1) return { valid: false, reason: "A transit depth can't reach or exceed 100% of the star's light." };
    const rpM = planetRadiusFromDepth(depthFrac, rsM);
    return { valid: true, quantity: "radius", rpM, rsM, depthFrac, ratio: rpM / rsM };
  }, [solveFor, rp, rpUnit, rs, rsUnit, depth, depthUnit]);

  // --- star + transiting planet, to scale ---
  const disk = useMemo(() => {
    if (!result.valid) return null;
    const starPx = 92;
    const planetPxRaw = starPx * result.ratio;
    const planetPx = Math.max(1.2, planetPxRaw);
    const tooSmallToSeeAccurately = planetPxRaw < 1.2;
    return { starPx, planetPx, tooSmallToSeeAccurately };
  }, [result]);

  // --- synthetic light curve ---
  // A schematic (not period/duration-derived) transit shape: flat
  // baseline, linear ingress, flat bottom at 1-delta, linear egress,
  // flat baseline. The y-axis auto-fits tightly around [1-delta, 1] so
  // the dip is always clearly visible — the axis labels carry the true
  // (often tiny) depth honestly even though the plot is visually zoomed in.
  const lightcurve = useMemo(() => {
    if (!result.valid) return null;
    const { depthFrac } = result;
    const width = 640;
    const height = 260;
    const marginLeft = 66;
    const marginRight = 20;
    const marginTop = 24;
    const marginBottom = 40;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;

    const yTop = 1;
    const yBottom = 1 - depthFrac;
    const pad = depthFrac * 0.25;
    const yMax = yTop + pad;
    const yMin = yBottom - pad;
    const yScale = (y) => marginTop + (1 - (y - yMin) / (yMax - yMin)) * plotHeight;
    const xScale = (frac) => marginLeft + frac * plotWidth;

    // illustrative phase fractions: baseline / ingress / flat bottom / egress / baseline
    const x0 = 0, x1 = 0.24, x2 = 0.34, x3 = 0.66, x4 = 0.76, x5 = 1;
    const points = [
      [x0, yTop], [x1, yTop], [x2, yBottom], [x3, yBottom], [x4, yTop], [x5, yTop],
    ].map(([xf, y]) => `${xScale(xf)},${yScale(y)}`).join(" ");

    const yTicks = [yTop, yBottom];

    return { width, height, marginLeft, marginRight, marginTop, marginBottom, plotWidth, plotHeight, xScale, yScale, points, yTicks, yTop, yBottom };
  }, [result]);

  const applyPreset = (preset) => {
    setSolveFor(preset.solveFor);
    setRp(String(preset.rp));
    setRpUnit(preset.rpUnit);
    setRs(String(preset.rs));
    setRsUnit(preset.rsUnit);
    setDepth(String(preset.depth));
    setDepthUnit(preset.depthUnit);
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
    <div className="etd" aria-label="Exoplanet transit depth calculator">
      <div className="etd-header">
        <p className="etd-title">Exoplanet transit depth calculator</p>
        <div className="etd-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="etd-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="etd-explainer">
        In the simplest model — a uniform stellar disk, planet crossing dead-center — the
        fractional brightness drop is just the ratio of the two disks' areas:{" "}
        <code>δ = (R_p / R_star)²</code>. Real light curves deviate somewhat from this (limb
        darkening, grazing transits), but it's the right first estimate, and the one every more
        detailed model corrects.
      </p>

      <div className="etd-solve-toggle" role="group" aria-label="Solve for">
        <button type="button" className={solveFor === "depth" ? "etd-solve-btn active" : "etd-solve-btn"} onClick={() => setSolveFor("depth")}>
          Radii → Depth
        </button>
        <button type="button" className={solveFor === "radius" ? "etd-solve-btn active" : "etd-solve-btn"} onClick={() => setSolveFor("radius")}>
          Depth → Planet radius
        </button>
      </div>

      <div className="etd-fields">
        {solveFor === "depth" ? (
          <div className="etd-field">
            <label htmlFor="etd-rp">Planet radius (R_p)</label>
            <div className="etd-input-row">
              <input id="etd-rp" className="etd-input" type="number" min="0" step="any" inputMode="decimal" value={rp} onChange={(e) => setRp(e.target.value)} />
              <select className="etd-unit-select" value={rpUnit} onChange={(e) => setRpUnit(e.target.value)}>
                {PLANET_RADIUS_UNIT_ORDER.map((u) => <option key={u} value={u}>{PLANET_RADIUS_UNITS[u].short}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="etd-field">
            <label htmlFor="etd-depth">Transit depth (δ)</label>
            <div className="etd-input-row">
              <input id="etd-depth" className="etd-input" type="number" min="0" step="any" inputMode="decimal" value={depth} onChange={(e) => setDepth(e.target.value)} />
              <select className="etd-unit-select" value={depthUnit} onChange={(e) => setDepthUnit(e.target.value)}>
                {DEPTH_UNIT_ORDER.map((u) => <option key={u} value={u}>{DEPTH_UNITS[u].short || "—"}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="etd-field">
          <label htmlFor="etd-rs">Stellar radius (R_star)</label>
          <div className="etd-input-row">
            <input id="etd-rs" className="etd-input" type="number" min="0" step="any" inputMode="decimal" value={rs} onChange={(e) => setRs(e.target.value)} />
            <select className="etd-unit-select" value={rsUnit} onChange={(e) => setRsUnit(e.target.value)}>
              {STAR_RADIUS_UNIT_ORDER.map((u) => <option key={u} value={u}>{STAR_RADIUS_UNITS[u].short}</option>)}
            </select>
          </div>
        </div>
      </div>

      {!result.valid ? (
        <p className="etd-note etd-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="etd-headline-card">
            {solveFor === "radius" && (
              <div className="etd-headline">
                R_p ≈ {formatNumber(planetRadiusFromMeters(result.rpM, "rearth"))} R⊕ = {formatNumber(planetRadiusFromMeters(result.rpM, "rjup"))} R♃
              </div>
            )}
            <div className="etd-depth-row">
              <span>{formatNumber(depthFromFraction(result.depthFrac, "percent"))}%</span>
              <span>{formatNumber(depthFromFraction(result.depthFrac, "ppm"))} ppm</span>
              <span>{formatNumber(depthToMillimag(result.depthFrac))} mmag</span>
            </div>
            <div className="etd-headline-sub">R_p / R_star = {formatNumber(result.ratio)}</div>
          </div>

          {disk && (
            <div className="etd-chart-wrap">
              <svg
                className="etd-disk-svg"
                viewBox="0 0 240 200"
                role="img"
                aria-label={`Star and transiting planet drawn to scale; the planet's disk covers ${formatNumber(depthFromFraction(result.depthFrac, "percent"))} percent of the star's area`}
              >
                <defs>
                  <radialGradient id="etd-star-gradient" cx="45%" cy="40%" r="65%">
                    <stop offset="0%" stopColor="#fff6d8" />
                    <stop offset="60%" stopColor="#ffd479" />
                    <stop offset="100%" stopColor="#e0a83f" />
                  </radialGradient>
                </defs>
                <circle cx="120" cy="90" r={disk.starPx} fill="url(#etd-star-gradient)" />
                <circle cx="120" cy="90" r={disk.planetPx} className="etd-planet-disk" />
                {disk.tooSmallToSeeAccurately && (
                  <text x="120" y="180" className="etd-disk-note" textAnchor="middle">planet enlarged slightly to stay visible</text>
                )}
              </svg>
              <p className="etd-chart-caption">
                Drawn to scale (planet size floor-clamped for visibility when necessary) — the dark
                disk's area relative to the star's is exactly δ.
              </p>
            </div>
          )}

          {lightcurve && (
            <div className="etd-chart-wrap">
              <svg
                className="etd-curve-svg"
                viewBox={`0 0 ${lightcurve.width} ${lightcurve.height}`}
                role="img"
                aria-label={`Synthetic transit light curve; flux drops from 1.0 to ${formatNumber(lightcurve.yBottom, 6)} during transit`}
              >
                {lightcurve.yTicks.map((t, idx) => (
                  <g key={idx}>
                    <line x1={lightcurve.marginLeft} x2={lightcurve.marginLeft + lightcurve.plotWidth} y1={lightcurve.yScale(t)} y2={lightcurve.yScale(t)} className="etd-chart-gridline" />
                    <text x={lightcurve.marginLeft - 8} y={lightcurve.yScale(t) + 4} className="etd-chart-axis-label" textAnchor="end">{formatNumber(t, 6)}</text>
                  </g>
                ))}
                <line x1={lightcurve.marginLeft} x2={lightcurve.marginLeft} y1={lightcurve.marginTop} y2={lightcurve.marginTop + lightcurve.plotHeight} className="etd-chart-axis-line" />
                <line x1={lightcurve.marginLeft} x2={lightcurve.marginLeft + lightcurve.plotWidth} y1={lightcurve.marginTop + lightcurve.plotHeight} y2={lightcurve.marginTop + lightcurve.plotHeight} className="etd-chart-axis-line" />

                <polyline points={lightcurve.points} className="etd-curve-line" />

                <text x={lightcurve.marginLeft + lightcurve.plotWidth / 2} y={lightcurve.height - 12} className="etd-chart-axis-label" textAnchor="middle">time →</text>
                <text x={lightcurve.marginLeft - 46} y={lightcurve.marginTop + lightcurve.plotHeight / 2} className="etd-chart-axis-label etd-ylabel" textAnchor="middle">relative flux</text>
              </svg>
              <p className="etd-chart-caption">
                Schematic shape (ingress/egress durations are illustrative, not derived from an
                orbital period) — but the vertical axis is real: it's zoomed in tightly around the
                true depth so the dip stays visible even at 84 ppm.
              </p>
            </div>
          )}
        </>
      )}

      <div className="etd-footer-row">
        <button type="button" className="etd-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
