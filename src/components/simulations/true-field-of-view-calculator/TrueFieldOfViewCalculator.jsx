import { useEffect, useMemo, useState } from "react";
import {
  DEEP_SKY_OBJECTS,
  magnification,
  tfovSimpleDeg,
  tfovFieldStopDeg,
  degToArcmin,
} from "./trueFieldOfView";
import { TRUE_FIELD_OF_VIEW_TEST_COLUMNS, TRUE_FIELD_OF_VIEW_TEST_SOURCES, getTrueFieldOfViewTestRows } from "./trueFieldOfViewTests";
import "../../../styles/trueFieldOfViewCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import CalculatorTests from "../../CalculatorTests.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";

// The Tele Vue Panoptic 24mm's published specs (68° AFOV, 27mm field
// stop) are real, and the ~5% gap between what the simple and
// field-stop methods give it is a genuine, commonly-cited example of
// why the field-stop number is the one to trust for wide-field eyepiece
// designs — a good default first view for a calculator whose whole
// point is that gap.
const PRESETS = [
  { label: "Tele Vue Panoptic 24mm (real eyepiece, field-stop gap)", F: "1200", f: "24", AFOV: "68", fieldStop: "27" },
  { label: "32mm wide-field, everything fits", F: "400", f: "32", AFOV: "50", fieldStop: "27.9" },
  { label: "10mm planetary eyepiece, nothing fits — not even the Moon", F: "2000", f: "10", AFOV: "50", fieldStop: "" },
  { label: "20mm, mixed results", F: "750", f: "20", AFOV: "60", fieldStop: "" },
];

function trimTrailingZeros(s) {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}
function fmtDeg(n) {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n === 0) return "0";
  const decimals = n >= 100 ? 0 : n >= 10 ? 1 : n >= 1 ? 3 : 4;
  return trimTrailingZeros(n.toFixed(decimals));
}
function fmtArcmin(n) {
  if (!Number.isFinite(n) || n < 0) return "—";
  const decimals = n >= 100 ? 0 : n >= 10 ? 1 : 2;
  return trimTrailingZeros(n.toFixed(decimals));
}
function percentDiff(a, b) {
  if (b === 0) return a === 0 ? 0 : Infinity;
  return Math.abs((a - b) / b) * 100;
}
function objectExtentDeg(obj) {
  if (obj.shape === "circle") return obj.diameterDeg / 2;
  if (obj.shape === "ellipse") return obj.majorDeg / 2;
  return (obj.separationDeg + obj.diameterDeg) / 2; // "double"
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const F = params.get("F");
  if (F === null || !Number.isFinite(parseFloat(F))) return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  const objParam = params.get("obj");
  return {
    F,
    f: num("f", "24"),
    AFOV: num("afov", "68"),
    fieldStop: params.get("fs") !== null && Number.isFinite(parseFloat(params.get("fs"))) ? params.get("fs") : "27",
    enabled: objParam ? new Set(objParam.split(",")) : null,
  };
}

export default function TrueFieldOfViewCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders
  // these (the Panoptic 24mm preset). Any URL-encoded state is applied
  // client-side, after mount, below.
  const [F, setF] = useState("1200");
  const [f, setF2] = useState("24");
  const [AFOV, setAFOV] = useState("68");
  const [fieldStop, setFieldStop] = useState("27");
  const [enabled, setEnabled] = useState(() => new Set(DEEP_SKY_OBJECTS.map((o) => o.key)));
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setF(initial.F);
      setF2(initial.f);
      setAFOV(initial.AFOV);
      setFieldStop(initial.fieldStop);
      if (initial.enabled) setEnabled(initial.enabled);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("F", F);
      params.set("f", f);
      params.set("afov", AFOV);
      if (fieldStop) params.set("fs", fieldStop);
      params.set("obj", Array.from(enabled).join(","));
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, F, f, AFOV, fieldStop, enabled]);

  const result = useMemo(() => {
    const Fnum = parseFloat(F);
    const fnum = parseFloat(f);
    const AFOVnum = parseFloat(AFOV);
    const fieldStopNum = parseFloat(fieldStop);

    if (!(Fnum > 0) || !(fnum > 0)) {
      return { valid: false, reason: "Enter a positive telescope focal length and eyepiece focal length." };
    }
    const M = magnification(Fnum, fnum);
    const simple = Number.isFinite(AFOVnum) && AFOVnum > 0 ? tfovSimpleDeg(AFOVnum, M) : null;
    const accurate = Number.isFinite(fieldStopNum) && fieldStopNum > 0 ? tfovFieldStopDeg(fieldStopNum, Fnum) : null;

    if (simple === null && accurate === null) {
      return { valid: false, reason: "Enter the eyepiece's apparent field of view, its field stop diameter, or both." };
    }

    const primary = accurate ?? simple;
    const pctDiff = simple !== null && accurate !== null ? percentDiff(simple, accurate) : null;

    return { valid: true, M, simple, accurate, primary, pctDiff };
  }, [F, f, AFOV, fieldStop]);

  // --- field-of-view overlay: FOV circle plus deep-sky objects, all to
  // the same angular scale, centered together so "does it fit" is a
  // direct visual overlap test rather than a number.
  const overlay = useMemo(() => {
    if (!result.valid) return null;
    const activeObjects = DEEP_SKY_OBJECTS.filter((o) => enabled.has(o.key));
    const objectExtents = activeObjects.map(objectExtentDeg);
    const domainRadiusDeg = Math.max(result.primary / 2, ...objectExtents, 0.05) * 1.15;

    const size = 480;
    const cx = size / 2;
    const cy = size / 2;
    const plotRadiusPx = 200;
    const scale = plotRadiusPx / domainRadiusDeg; // px per degree

    const fovRadiusPx = (result.primary / 2) * scale;

    const objects = activeObjects.map((obj) => {
      const extent = objectExtentDeg(obj);
      const fits = extent <= result.primary / 2 + 1e-9;
      if (obj.shape === "circle") {
        return { ...obj, fits, r: (obj.diameterDeg / 2) * scale };
      }
      if (obj.shape === "ellipse") {
        return { ...obj, fits, rx: (obj.majorDeg / 2) * scale, ry: (obj.minorDeg / 2) * scale };
      }
      const sepPx = (obj.separationDeg / 2) * scale;
      const rPx = (obj.diameterDeg / 2) * scale;
      return { ...obj, fits, sepPx, rPx };
    });

    return { size, cx, cy, plotRadiusPx, fovRadiusPx, objects, domainRadiusDeg };
  }, [result, enabled]);

  const applyPreset = (preset) => {
    setF(preset.F);
    setF2(preset.f);
    setAFOV(preset.AFOV);
    setFieldStop(preset.fieldStop);
  };

  const toggleObject = (key) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const testRows = useMemo(() => getTrueFieldOfViewTestRows(), []);

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
    <div className="tfv" aria-label="True field of view calculator">
      <div className="tfv-header">
        <p className="tfv-title">True field of view calculator</p>
        <div className="tfv-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="tfv-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="tfv-explainer">
        <code>TFOV ≈ AFOV / M</code> from the eyepiece's apparent field, or the more accurate{" "}
        <code>TFOV = 57.2958 × field stop / F</code> when the eyepiece's physical field stop is
        known. The number matters less than the picture: how much sky actually fits.
      </p>

      <div className="tfv-fields">
        <div className="tfv-field">
          <label htmlFor="tfv-F">Telescope focal length (F)</label>
          <div className="tfv-input-row">
            <input id="tfv-F" className="tfv-input" type="number" min="0" step="any" inputMode="decimal" value={F} onChange={(e) => setF(e.target.value)} />
            <span className="tfv-static-unit">mm</span>
          </div>
        </div>
        <div className="tfv-field">
          <label htmlFor="tfv-f">Eyepiece focal length (f)</label>
          <div className="tfv-input-row">
            <input id="tfv-f" className="tfv-input" type="number" min="0" step="any" inputMode="decimal" value={f} onChange={(e) => setF2(e.target.value)} />
            <span className="tfv-static-unit">mm</span>
          </div>
        </div>
        <div className="tfv-field">
          <label htmlFor="tfv-afov">Eyepiece apparent field (AFOV)</label>
          <div className="tfv-input-row">
            <input id="tfv-afov" className="tfv-input" type="number" min="0" step="any" inputMode="decimal" value={AFOV} onChange={(e) => setAFOV(e.target.value)} />
            <span className="tfv-static-unit">°</span>
          </div>
        </div>
        <div className="tfv-field">
          <label htmlFor="tfv-fs">Field stop — optional, more accurate</label>
          <div className="tfv-input-row">
            <input id="tfv-fs" className="tfv-input" type="number" min="0" step="any" inputMode="decimal" value={fieldStop} onChange={(e) => setFieldStop(e.target.value)} />
            <span className="tfv-static-unit">mm</span>
          </div>
        </div>
      </div>

      {!result.valid ? (
        <p className="tfv-note tfv-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="tfv-headline-card">
            <div className="tfv-headline">
              TFOV ≈ {fmtDeg(result.primary)}° ({fmtArcmin(degToArcmin(result.primary))}′)
            </div>
            <div className="tfv-headline-sub">at {fmtDeg(result.M)}× magnification</div>
            {result.simple !== null && result.accurate !== null && (
              <div className="tfv-compare-row">
                <span>Simple (AFOV/M): <strong>{fmtDeg(result.simple)}°</strong></span>
                <span>Field-stop: <strong>{fmtDeg(result.accurate)}°</strong></span>
                <span className="tfv-compare-diff">{fmtDeg(result.pctDiff)}% apart</span>
              </div>
            )}
          </div>

          {overlay && (
            <div className="tfv-overlay-wrap">
              <svg
                className="tfv-overlay-svg"
                viewBox={`0 0 ${overlay.size} ${overlay.size}`}
                role="img"
                aria-label={`Field of view of ${fmtDeg(result.primary)} degrees, shown to scale against selected deep-sky objects`}
              >
                <circle cx={overlay.cx} cy={overlay.cy} r={overlay.fovRadiusPx} className="tfv-fov-circle" />
                <text x={overlay.cx} y={overlay.cy - overlay.fovRadiusPx - 8} className="tfv-fov-label" textAnchor="middle">
                  eyepiece field — {fmtDeg(result.primary)}°
                </text>

                {overlay.objects.map((obj) => {
                  if (obj.shape === "circle") {
                    return (
                      <circle
                        key={obj.key}
                        cx={overlay.cx}
                        cy={overlay.cy}
                        r={obj.r}
                        style={{ stroke: obj.color }}
                        className="tfv-object-shape"
                      />
                    );
                  }
                  if (obj.shape === "ellipse") {
                    return (
                      <ellipse
                        key={obj.key}
                        cx={overlay.cx}
                        cy={overlay.cy}
                        rx={obj.rx}
                        ry={obj.ry}
                        style={{ stroke: obj.color }}
                        className="tfv-object-shape"
                      />
                    );
                  }
                  return (
                    <g key={obj.key}>
                      <circle cx={overlay.cx - obj.sepPx} cy={overlay.cy} r={obj.rPx} style={{ stroke: obj.color }} className="tfv-object-shape" />
                      <circle cx={overlay.cx + obj.sepPx} cy={overlay.cy} r={obj.rPx} style={{ stroke: obj.color }} className="tfv-object-shape" />
                    </g>
                  );
                })}

                <circle cx={overlay.cx} cy={overlay.cy} r="2.5" className="tfv-center-dot" />
              </svg>

              <ul className="tfv-legend">
                {DEEP_SKY_OBJECTS.map((obj) => {
                  const on = enabled.has(obj.key);
                  const extent = objectExtentDeg(obj);
                  const fits = result.valid && extent <= result.primary / 2 + 1e-9;
                  return (
                    <li key={obj.key} className="tfv-legend-row">
                      <label className="tfv-legend-check">
                        <input type="checkbox" checked={on} onChange={() => toggleObject(obj.key)} />
                        <span className="tfv-legend-swatch" style={{ background: obj.color }} />
                        <span className="tfv-legend-name">{obj.label}</span>
                      </label>
                      <span className="tfv-legend-size">{obj.note}</span>
                      {on && (
                        <span className={fits ? "tfv-fit-badge tfv-fit-badge--yes" : "tfv-fit-badge tfv-fit-badge--no"}>
                          {fits ? "Fits" : "Too wide"}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="tfv-chart-caption">
                Every shape is drawn to the same angular scale as the field-of-view circle — an
                object that pokes outside it genuinely doesn't fit in one view, no diagram trick.
              </p>
            </div>
          )}
        </>
      )}

      <div className="tfv-footer-row">
        <CalculatorVote slug="true-field-of-view-calculator" />
        <CalculatorTests
          title="True Field of View Calculator — Tests"
          columns={TRUE_FIELD_OF_VIEW_TEST_COLUMNS}
          rows={testRows}
          sources={TRUE_FIELD_OF_VIEW_TEST_SOURCES}
        />
        <button type="button" className="tfv-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
