import { useEffect, useMemo, useState } from "react";
import {
  ANGLE_UNITS,
  ANGLE_UNIT_ORDER,
  LENGTH_UNITS,
  LENGTH_UNIT_ORDER,
  angleToRad,
  radToAngle,
  lengthToMeters,
  metersToLength,
  exactThetaFromSizeDistance,
  exactDiameterFromAngleDistance,
  exactDistanceFromAngleSize,
  smallAngleTheta,
  smallAngleDiameter,
  smallAngleDistance,
  approxQuality,
} from "./geometry";
import { ANGULAR_SIZE_TEST_COLUMNS, ANGULAR_SIZE_TEST_SOURCES, getAngularSizeTestRows } from "./angularSizeTests";
import "../../../styles/angularSizeCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import CalculatorTests from "../../CalculatorTests.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";

// Every preset is self-consistent under all three "solve for" choices —
// diameter, distance, and the angle they imply — so switching "solve for"
// after applying one never shows a jarring mismatch.
const PRESETS = [
  {
    label: "The Moon",
    solveFor: "theta",
    theta: 31.08,
    thetaUnit: "arcmin",
    diameter: 3474.8,
    diameterUnit: "km",
    distance: 384400,
    distanceUnit: "km",
  },
  {
    label: "The Sun",
    solveFor: "theta",
    theta: 32.0,
    thetaUnit: "arcmin",
    diameter: 1392700,
    diameterUnit: "km",
    distance: 1,
    distanceUnit: "au",
  },
  {
    label: "Andromeda Galaxy (M31)",
    solveFor: "theta",
    theta: 5.04,
    thetaUnit: "deg",
    diameter: 220000,
    diameterUnit: "ly",
    distance: 2.5e6,
    distanceUnit: "ly",
  },
  {
    label: "Distant spiral galaxy",
    solveFor: "theta",
    theta: 61.9,
    thetaUnit: "arcsec",
    diameter: 30,
    diameterUnit: "kpc",
    distance: 100,
    distanceUnit: "mpc",
  },
  {
    label: "Very close object (large angle)",
    solveFor: "theta",
    theta: 79.6111,
    thetaUnit: "deg",
    diameter: 0.5,
    diameterUnit: "m",
    distance: 0.3,
    distanceUnit: "m",
  },
];

const SOLVE_OPTIONS = [
  { key: "theta", label: "Angular size" },
  { key: "diameter", label: "Physical size" },
  { key: "distance", label: "Distance" },
];

const SUPERSCRIPT_MAP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
function toSuperscript(n) {
  return String(n).split("").map((ch) => SUPERSCRIPT_MAP[ch] ?? ch).join("");
}
function trimTrailingZeros(s) {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}
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
  const solveFor = params.get("solve");
  if (!solveFor || !SOLVE_OPTIONS.some((o) => o.key === solveFor)) return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    const n = raw === null ? NaN : parseFloat(raw);
    return Number.isFinite(n) ? String(n) : fallback;
  };
  return {
    solveFor,
    theta: num("t", "31.08"),
    thetaUnit: ANGLE_UNITS[params.get("tu")] ? params.get("tu") : "arcmin",
    diameter: num("d", "3474.8"),
    diameterUnit: LENGTH_UNITS[params.get("du")] ? params.get("du") : "km",
    distance: num("r", "384400"),
    distanceUnit: LENGTH_UNITS[params.get("ru")] ? params.get("ru") : "km",
  };
}

export default function AngularSizeCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [solveFor, setSolveFor] = useState("theta");
  const [theta, setTheta] = useState("31.08");
  const [thetaUnit, setThetaUnit] = useState("arcmin");
  const [diameter, setDiameter] = useState("3474.8");
  const [diameterUnit, setDiameterUnit] = useState("km");
  const [distance, setDistance] = useState("384400");
  const [distanceUnit, setDistanceUnit] = useState("km");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setSolveFor(initial.solveFor);
      setTheta(initial.theta);
      setThetaUnit(initial.thetaUnit);
      setDiameter(initial.diameter);
      setDiameterUnit(initial.diameterUnit);
      setDistance(initial.distance);
      setDistanceUnit(initial.distanceUnit);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("solve", solveFor);
      params.set("t", theta);
      params.set("tu", thetaUnit);
      params.set("d", diameter);
      params.set("du", diameterUnit);
      params.set("r", distance);
      params.set("ru", distanceUnit);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, solveFor, theta, thetaUnit, diameter, diameterUnit, distance, distanceUnit]);

  const result = useMemo(() => {
    if (solveFor === "theta") {
      const D = parseFloat(diameter);
      const dist = parseFloat(distance);
      if (!(D > 0) || !(dist > 0)) return { valid: false, reason: "Enter a positive physical size and distance." };
      const Dm = lengthToMeters(D, diameterUnit);
      const dm = lengthToMeters(dist, distanceUnit);
      const exact = exactThetaFromSizeDistance(Dm, dm);
      if (!exact.valid) return { valid: false, reason: exact.reason };
      const approx = smallAngleTheta(Dm, dm);
      return {
        valid: true,
        quantity: "theta",
        exact: exact.theta,
        approx,
        percentError: ((approx - exact.theta) / exact.theta) * 100,
        thetaRad: exact.theta,
      };
    }
    if (solveFor === "diameter") {
      const th = angleToRad(parseFloat(theta), thetaUnit);
      const dist = parseFloat(distance);
      if (!(th > 0) || !(dist > 0)) return { valid: false, reason: "Enter a positive angular size and distance." };
      const dm = lengthToMeters(dist, distanceUnit);
      const exact = exactDiameterFromAngleDistance(th, dm);
      if (!exact.valid) return { valid: false, reason: exact.reason };
      const approx = smallAngleDiameter(th, dm);
      return {
        valid: true,
        quantity: "diameter",
        exact: exact.D,
        approx,
        percentError: ((approx - exact.D) / exact.D) * 100,
        thetaRad: th,
      };
    }
    const th = angleToRad(parseFloat(theta), thetaUnit);
    const D = parseFloat(diameter);
    if (!(th > 0) || !(D > 0)) return { valid: false, reason: "Enter a positive angular size and physical size." };
    const Dm = lengthToMeters(D, diameterUnit);
    const exact = exactDistanceFromAngleSize(th, Dm);
    if (!exact.valid) return { valid: false, reason: exact.reason };
    const approx = smallAngleDistance(th, Dm);
    return {
      valid: true,
      quantity: "distance",
      exact: exact.d,
      approx,
      percentError: ((approx - exact.d) / exact.d) * 100,
      thetaRad: th,
    };
  }, [solveFor, theta, thetaUnit, diameter, diameterUnit, distance, distanceUnit]);

  // --- schematic subtended-angle diagram ---
  // The real angle spans arcseconds to 100°+ across the tool's use cases —
  // far too wide a range to draw to a literal linear scale (a Moon-sized
  // angle would be an invisible sliver next to the "very close object"
  // preset). Instead the drawn half-angle is a log-compressed, strictly
  // monotonic function of the true angle: bigger real angle always means
  // a visibly wider wedge, but the mapping is exaggerated for legibility,
  // not literal — the actual value is printed on the diagram itself.
  const diagram = useMemo(() => {
    if (!result.valid) return null;
    const thetaRad = result.thetaRad;
    // Calibrated to the tool's actual realistic range (~20 arcsec, the
    // "distant galaxy" preset, up to just past 90°, the "very close
    // object" preset) rather than an arbitrary theoretical minimum — so
    // presets spread across the display range instead of clustering.
    const logMin = -4; // ~20 arcsec
    const logMax = Math.log10(Math.PI);
    const dispMinDeg = 4;
    const dispMaxDeg = 150;
    const logT = Math.log10(Math.max(thetaRad, 1e-9));
    const clampedLog = Math.min(logMax, Math.max(logMin, logT));
    const frac = (clampedLog - logMin) / (logMax - logMin);
    const displayDeg = dispMinDeg + frac * (dispMaxDeg - dispMinDeg);
    const halfAngleRad = (displayDeg / 2) * (Math.PI / 180);

    const width = 640;
    const height = 300;
    const observerX = 70;
    const observerY = height / 2;
    // Ray length is bounded by *both* how far right and how far up/down
    // the endpoints are allowed to go, whichever binds first — this keeps
    // the wedge inside the viewBox at every angle from a hairline sliver
    // up to the 150° display cap, instead of a fixed length that blows
    // past the vertical bounds for wide angles.
    const maxHorizontal = width - observerX - 40;
    const maxVertical = height / 2 - 20;
    const rayLength = Math.min(maxHorizontal / Math.cos(halfAngleRad), maxVertical / Math.sin(halfAngleRad));

    const topX = observerX + rayLength * Math.cos(halfAngleRad);
    const topY = observerY - rayLength * Math.sin(halfAngleRad);
    const bottomX = observerX + rayLength * Math.cos(halfAngleRad);
    const bottomY = observerY + rayLength * Math.sin(halfAngleRad);

    // small arc marking the angle at the observer vertex
    const arcR = 40;
    const arcTopX = observerX + arcR * Math.cos(halfAngleRad);
    const arcTopY = observerY - arcR * Math.sin(halfAngleRad);
    const arcBottomX = observerX + arcR * Math.cos(halfAngleRad);
    const arcBottomY = observerY + arcR * Math.sin(halfAngleRad);

    // For wide display angles the wedge is short (the horizontal/vertical
    // trade-off above), which can pull the object bar close enough to the
    // vertex that its label would collide with the θ label — so the D
    // label anchors at whichever is further right: just past the object
    // bar, or a fixed safe clearance from the θ label's typical width.
    const dLabelX = Math.max(topX + 12, observerX + 190);

    return {
      width, height, observerX, observerY,
      topX, topY, bottomX, bottomY,
      arcTopX, arcTopY, arcBottomX, arcBottomY, arcR, dLabelX,
      midX: (topX + bottomX) / 2, midY: observerY,
    };
  }, [result]);

  const applyPreset = (preset) => {
    setSolveFor(preset.solveFor);
    setTheta(String(preset.theta));
    setThetaUnit(preset.thetaUnit);
    setDiameter(String(preset.diameter));
    setDiameterUnit(preset.diameterUnit);
    setDistance(String(preset.distance));
    setDistanceUnit(preset.distanceUnit);
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

  // Self-check rows: runs the real geometry.js functions against known
  // reference objects and edge cases — independent of the fields above.
  const testRows = useMemo(() => getAngularSizeTestRows(), []);

  const isAngle = result.valid && result.quantity === "theta";
  const unitOrder = isAngle ? ANGLE_UNIT_ORDER : LENGTH_UNIT_ORDER;
  const unitTable = isAngle ? ANGLE_UNITS : LENGTH_UNITS;
  const toDisplay = (v, u) => (isAngle ? radToAngle(v, u) : metersToLength(v, u));
  const quality = result.valid ? approxQuality(result.percentError) : null;
  const headlineUnit = result.quantity === "theta" ? thetaUnit : result.quantity === "diameter" ? diameterUnit : distanceUnit;

  return (
    <div className="asc" aria-label="Angular size and physical size calculator">
      <div className="asc-header">
        <p className="asc-title">Angular / physical size calculator</p>
        <div className="asc-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="asc-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="asc-explainer">
        Angular size is how large an object looks from the viewpoint of the observer.
        Which would correspond to its apparent extent
        on the sky from a person looking at a celestial object from Earth. Physical size
        is the objects true linear diameter.
      </p>

      <div className="asc-solve-toggle" role="group" aria-label="Solve for">
        {SOLVE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={opt.key === solveFor ? "asc-solve-btn active" : "asc-solve-btn"}
            onClick={() => setSolveFor(opt.key)}
          >
            Solve for {opt.label}
          </button>
        ))}
      </div>

      <div className="asc-fields">
        <div className="asc-field">
          <label htmlFor="asc-theta">Angular size</label>
          {solveFor === "theta" ? (
            <div className="asc-computed">
              {result.valid ? formatNumber(radToAngle(result.exact, thetaUnit)) : "—"}
              <select className="asc-unit-select" value={thetaUnit} onChange={(e) => setThetaUnit(e.target.value)}>
                {ANGLE_UNIT_ORDER.map((u) => (
                  <option key={u} value={u}>
                    {ANGLE_UNITS[u].short}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="asc-input-row">
              <input
                id="asc-theta"
                className="asc-input"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={theta}
                onChange={(e) => setTheta(e.target.value)}
              />
              <select className="asc-unit-select" value={thetaUnit} onChange={(e) => setThetaUnit(e.target.value)}>
                {ANGLE_UNIT_ORDER.map((u) => (
                  <option key={u} value={u}>
                    {ANGLE_UNITS[u].short}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="asc-field">
          <label htmlFor="asc-diameter">Physical size</label>
          {solveFor === "diameter" ? (
            <div className="asc-computed">
              {result.valid ? formatNumber(metersToLength(result.exact, diameterUnit)) : "—"}
              <select className="asc-unit-select" value={diameterUnit} onChange={(e) => setDiameterUnit(e.target.value)}>
                {LENGTH_UNIT_ORDER.map((u) => (
                  <option key={u} value={u}>
                    {LENGTH_UNITS[u].short}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="asc-input-row">
              <input
                id="asc-diameter"
                className="asc-input"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={diameter}
                onChange={(e) => setDiameter(e.target.value)}
              />
              <select className="asc-unit-select" value={diameterUnit} onChange={(e) => setDiameterUnit(e.target.value)}>
                {LENGTH_UNIT_ORDER.map((u) => (
                  <option key={u} value={u}>
                    {LENGTH_UNITS[u].short}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="asc-field">
          <label htmlFor="asc-distance">Distance</label>
          {solveFor === "distance" ? (
            <div className="asc-computed">
              {result.valid ? formatNumber(metersToLength(result.exact, distanceUnit)) : "—"}
              <select className="asc-unit-select" value={distanceUnit} onChange={(e) => setDistanceUnit(e.target.value)}>
                {LENGTH_UNIT_ORDER.map((u) => (
                  <option key={u} value={u}>
                    {LENGTH_UNITS[u].short}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="asc-input-row">
              <input
                id="asc-distance"
                className="asc-input"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
              />
              <select className="asc-unit-select" value={distanceUnit} onChange={(e) => setDistanceUnit(e.target.value)}>
                {LENGTH_UNIT_ORDER.map((u) => (
                  <option key={u} value={u}>
                    {LENGTH_UNITS[u].short}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {!result.valid ? (
        <p className="asc-note asc-note--warn" role="alert">
          {result.reason}
        </p>
      ) : (
        <>
          <div className="asc-table" role="table" aria-label="Result in every unit">
            {unitOrder.map((key) => (
              <div className={key === headlineUnit ? "asc-row asc-row--active" : "asc-row"} role="row" key={key}>
                <span className="asc-row-label" role="cell">
                  {unitTable[key].label}
                </span>
                <span className="asc-row-value" role="cell">
                  {formatNumber(toDisplay(result.exact, key))} <span className="asc-row-unit">{unitTable[key].short}</span>
                </span>
              </div>
            ))}
          </div>

          {diagram && (
            <div className="asc-diagram-wrap">
              <svg
                className="asc-diagram-svg"
                viewBox={`0 0 ${diagram.width} ${diagram.height}`}
                role="img"
                aria-label={`Schematic diagram of the observer, object, and subtended angle of ${formatNumber(radToAngle(result.thetaRad, thetaUnit))} ${ANGLE_UNITS[thetaUnit].short}`}
              >
                <line
                  x1={diagram.observerX} y1={diagram.observerY}
                  x2={diagram.width - 12} y2={diagram.observerY}
                  className="asc-diagram-centerline"
                />
                <line x1={diagram.observerX} y1={diagram.observerY} x2={diagram.topX} y2={diagram.topY} className="asc-diagram-ray" />
                <line x1={diagram.observerX} y1={diagram.observerY} x2={diagram.bottomX} y2={diagram.bottomY} className="asc-diagram-ray" />

                <path
                  d={`M ${diagram.arcTopX} ${diagram.arcTopY} A ${diagram.arcR} ${diagram.arcR} 0 0 1 ${diagram.arcBottomX} ${diagram.arcBottomY}`}
                  className="asc-diagram-arc"
                />
                <text x={diagram.observerX + diagram.arcR + 10} y={diagram.observerY + 4} className="asc-diagram-theta-label">
                  θ = {formatNumber(radToAngle(result.thetaRad, thetaUnit))} {ANGLE_UNITS[thetaUnit].short}
                </text>

                <circle cx={diagram.observerX} cy={diagram.observerY} r="4" className="asc-diagram-observer" />
                <text x={diagram.observerX} y={diagram.observerY + 22} className="asc-diagram-small-label" textAnchor="middle">
                  observer
                </text>

                <line x1={diagram.topX} y1={diagram.topY} x2={diagram.bottomX} y2={diagram.bottomY} className="asc-diagram-object" />
                <circle cx={diagram.topX} cy={diagram.topY} r="4" className="asc-diagram-object-end" />
                <circle cx={diagram.bottomX} cy={diagram.bottomY} r="4" className="asc-diagram-object-end" />
                <text x={diagram.dLabelX} y={(diagram.topY + diagram.bottomY) / 2 + 4} className="asc-diagram-big-label">
                  D (physical size)
                </text>

                <text x={(diagram.observerX + diagram.topX) / 2} y={(diagram.observerY + diagram.topY) / 2 - 10} className="asc-diagram-small-label">
                  d
                </text>
              </svg>
              <p className="asc-diagram-caption">
                Schematic — the angle is exaggerated for visibility and this is not drawn to true
                scale (real θ ranges from arcseconds to well over the diagram's own angle). The
                printed θ is the actual computed value.
              </p>
            </div>
          )}

          <div className="asc-approx-card">
            <div className="asc-approx-row">
              <span className="asc-approx-label">Exact (trigonometric)</span>
              <span className="asc-approx-value">
                {formatNumber(toDisplay(result.exact, headlineUnit))} {unitTable[headlineUnit].short}
              </span>
            </div>
            <div className="asc-approx-row">
              <span className="asc-approx-label">Small-angle approximation</span>
              <span className="asc-approx-value">
                {formatNumber(toDisplay(result.approx, headlineUnit))} {unitTable[headlineUnit].short}
              </span>
            </div>
            <div className="asc-approx-row">
              <span className="asc-approx-label">Difference</span>
              <span className={`asc-quality-badge asc-quality-badge--${quality.tone}`}>
                {Math.abs(result.percentError).toFixed(2)}% — {quality.label}
              </span>
            </div>
          </div>
        </>
      )}

      <div className="asc-footer-row">
        <CalculatorVote slug="angular-size-calculator" />
        <CalculatorTests
          title="Angular Size & Physical Size Calculator — Tests"
          columns={ANGULAR_SIZE_TEST_COLUMNS}
          rows={testRows}
          sources={ANGULAR_SIZE_TEST_SOURCES}
        />
        <button type="button" className="asc-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
