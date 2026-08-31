import { useEffect, useMemo, useState } from "react";
import {
  DARK_ADAPTED_EYE_PUPIL_MM,
  MOON_ANGULAR_DIAMETER_DEG,
  magnification,
  exitPupilMm,
  trueFieldDeg,
  focalRatio,
  maxUsefulMagnification,
  minUsefulMagnification,
  classifyMagnification,
} from "./telescopeMagnification";
import { TELESCOPE_MAGNIFICATION_TEST_COLUMNS, TELESCOPE_MAGNIFICATION_TEST_SOURCES, getTelescopeMagnificationTestRows } from "./telescopeMagnificationTests";
import "../../../styles/telescopeMagnificationCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import CalculatorTests from "../../CalculatorTests.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";

// Real, well-known gear where possible — the 114mm/1000mm combo is the
// exact spec of the Celestron AstroMaster 114EQ, a widely-sold beginner
// scope whose bundled 4mm eyepiece is a textbook case of empty
// magnification.
const PRESETS = [
  { label: "Beginner reflector + 4mm eyepiece (empty magnification)", D: "114", F: "1000", f: "4", AFOV: "25" },
  { label: "Same scope + 25mm eyepiece (well matched)", D: "114", F: "1000", f: "25", AFOV: "52" },
  { label: "10\" Dobsonian + 32mm eyepiece (near max exit pupil)", D: "250", F: "1200", f: "32", AFOV: "50" },
  { label: "80mm travel refractor + 40mm eyepiece (wasted light)", D: "80", F: "400", f: "40", AFOV: "43" },
];

const VERDICTS = {
  empty: {
    tone: "bad",
    title: "Empty magnification",
    text: (M, maxM) =>
      `At ${fmtX(M)}×, you're past the roughly ${fmtX(maxM)}× useful ceiling for this aperture. Atmospheric seeing and the eye's own acuity almost never let more magnification reveal more real detail past this point — you get a bigger, dimmer, softer image of the same information, not a more detailed one.`,
  },
  "wide-pupil": {
    tone: "warn",
    title: "Exit pupil wider than your eye can use",
    text: (M, maxM, minM, exitPupil) =>
      `The exit pupil here is ${fmtX(exitPupil)} mm — wider than a fully dark-adapted eye's ~${DARK_ADAPTED_EYE_PUPIL_MM} mm pupil can ever open to. Some of the light this eyepiece delivers is missing your eye entirely; a shorter eyepiece (down to about ${fmtX(minM)}×) would give an equally bright, equally detailed view.`,
  },
  good: {
    tone: "good",
    title: "Within the useful range",
    text: (M, maxM) =>
      `${fmtX(M)}× sits comfortably between the exit-pupil floor and the empty-magnification ceiling (~${fmtX(maxM)}×) for this aperture — a genuinely usable magnification, seeing permitting.`,
  },
};

function trimTrailingZeros(s) {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}
function fmtX(n) {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n === 0) return "0";
  const decimals = n >= 100 ? 0 : n >= 10 ? 1 : n >= 1 ? 2 : 3;
  return trimTrailingZeros(n.toFixed(decimals));
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const D = params.get("d");
  if (D === null || !Number.isFinite(parseFloat(D))) return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  return {
    D,
    F: num("f_", "400"),
    f: num("f", "4"),
    AFOV: num("afov", ""),
  };
}

export default function TelescopeMagnificationCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders
  // these. Any URL-encoded state is applied client-side, after mount,
  // below.
  const [D, setD] = useState("114");
  const [F, setF] = useState("400");
  const [f, setF2] = useState("4");
  const [AFOV, setAFOV] = useState("25");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setD(initial.D);
      setF(initial.F);
      setF2(initial.f);
      setAFOV(initial.AFOV);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("d", D);
      params.set("f_", F);
      params.set("f", f);
      if (AFOV) params.set("afov", AFOV);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, D, F, f, AFOV]);

  const result = useMemo(() => {
    const Dnum = parseFloat(D);
    const Fnum = parseFloat(F);
    const fnum = parseFloat(f);
    const AFOVnum = parseFloat(AFOV);

    if (!(Dnum > 0) || !(Fnum > 0) || !(fnum > 0)) {
      return { valid: false, reason: "Enter a positive aperture, telescope focal length, and eyepiece focal length." };
    }

    const M = magnification(Fnum, fnum);
    const exitPupil = exitPupilMm(Dnum, M);
    const fRatio = focalRatio(Fnum, Dnum);
    const classification = classifyMagnification(M, Dnum);
    const trueField = Number.isFinite(AFOVnum) && AFOVnum > 0 ? trueFieldDeg(AFOVnum, M) : null;

    return { valid: true, D: Dnum, M, exitPupil, fRatio, classification, trueField };
  }, [D, F, f, AFOV]);

  // --- magnification gauge: 0 → wasted-light zone → useful zone → empty-magnification zone ---
  const gauge = useMemo(() => {
    if (!result.valid || !result.classification) return null;
    const { minM, maxM } = result.classification;
    const domainMax = Math.max(maxM * 1.3, result.M * 1.15);
    const width = 640;
    const height = 96;
    const marginLeft = 10;
    const marginRight = 10;
    const y = 44;
    const plotWidth = width - marginLeft - marginRight;
    const xScale = (m) => marginLeft + (Math.max(0, Math.min(domainMax, m)) / domainMax) * plotWidth;

    return {
      width, height, y, plotWidth, marginLeft,
      minX: xScale(minM), maxX: xScale(maxM), endX: marginLeft + plotWidth,
      pointX: xScale(result.M),
      minM, maxM, domainMax,
    };
  }, [result]);

  // --- exit pupil circles, drawn to a shared mm-to-px scale ---
  const pupils = useMemo(() => {
    if (!result.valid || !(result.exitPupil > 0)) return null;
    const pxPerMm = 12;
    const maxRadiusPx = 60;
    const scopeR = Math.min(maxRadiusPx, (result.exitPupil / 2) * pxPerMm);
    const eyeR = Math.min(maxRadiusPx, (DARK_ADAPTED_EYE_PUPIL_MM / 2) * pxPerMm);
    return { scopeR: Math.max(scopeR, 1.5), eyeR };
  }, [result]);

  const applyPreset = (preset) => {
    setD(preset.D);
    setF(preset.F);
    setF2(preset.f);
    setAFOV(preset.AFOV);
  };

  const testRows = useMemo(() => getTelescopeMagnificationTestRows(), []);

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

  const verdict = result.valid && result.classification ? VERDICTS[result.classification.level] : null;

  return (
    <div className="tmc" aria-label="Telescope magnification and eyepiece calculator">
      <div className="tmc-header">
        <p className="tmc-title">Telescope magnification &amp; eyepiece calculator</p>
        <div className="tmc-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="tmc-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="tmc-explainer">
        <code>M = F / f</code> — telescope focal length over eyepiece focal length. The number
        alone doesn't tell you whether it's a good idea; the verdict below does.
      </p>

      <div className="tmc-fields">
        <div className="tmc-field">
          <label htmlFor="tmc-d">Aperture (D)</label>
          <div className="tmc-input-row">
            <input id="tmc-d" className="tmc-input" type="number" min="0" step="any" inputMode="decimal" value={D} onChange={(e) => setD(e.target.value)} />
            <span className="tmc-static-unit">mm</span>
          </div>
        </div>
        <div className="tmc-field">
          <label htmlFor="tmc-F">Telescope focal length (F)</label>
          <div className="tmc-input-row">
            <input id="tmc-F" className="tmc-input" type="number" min="0" step="any" inputMode="decimal" value={F} onChange={(e) => setF(e.target.value)} />
            <span className="tmc-static-unit">mm</span>
          </div>
        </div>
        <div className="tmc-field">
          <label htmlFor="tmc-f">Eyepiece focal length (f)</label>
          <div className="tmc-input-row">
            <input id="tmc-f" className="tmc-input" type="number" min="0" step="any" inputMode="decimal" value={f} onChange={(e) => setF2(e.target.value)} />
            <span className="tmc-static-unit">mm</span>
          </div>
        </div>
        <div className="tmc-field">
          <label htmlFor="tmc-afov">Eyepiece apparent field (AFOV) — optional, for true field</label>
          <div className="tmc-input-row">
            <input id="tmc-afov" className="tmc-input" type="number" min="0" step="any" inputMode="decimal" value={AFOV} onChange={(e) => setAFOV(e.target.value)} />
            <span className="tmc-static-unit">°</span>
          </div>
        </div>
      </div>

      {!result.valid ? (
        <p className="tmc-note tmc-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className={`tmc-headline-card tmc-tone-${verdict?.tone ?? "good"}`}>
            <div className="tmc-headline">M = {fmtX(result.M)}×</div>
            <div className="tmc-headline-sub">
              Exit pupil {fmtX(result.exitPupil)} mm · f/{fmtX(result.fRatio)}
              {result.trueField !== null && (
                <> · True field {fmtX(result.trueField)}° (≈{fmtX(result.trueField / MOON_ANGULAR_DIAMETER_DEG)}× the Moon's width)</>
              )}
            </div>
            {verdict && (
              <div className="tmc-verdict">
                <span className="tmc-verdict-title">{verdict.title}.</span>{" "}
                {verdict.text(result.M, result.classification.maxM, result.classification.minM, result.exitPupil)}
                {result.classification.level === "empty" && (
                  <>
                    {" "}See the{" "}
                    <a href="/posts/telescope-angular-resolution-calculator">Telescope Angular Resolution Calculator</a>{" "}
                    for the diffraction-limited detail this aperture can actually deliver, no matter the eyepiece.
                  </>
                )}
              </div>
            )}
          </div>

          {gauge && (
            <div className="tmc-chart-wrap">
              <svg
                className="tmc-gauge-svg"
                viewBox={`0 0 ${gauge.width} ${gauge.height}`}
                role="img"
                aria-label={`Magnification gauge: ${fmtX(result.M)}× against a useful range of roughly ${fmtX(gauge.minM)}× to ${fmtX(gauge.maxM)}×`}
              >
                <rect x={gauge.marginLeft} y={gauge.y - 10} width={gauge.minX - gauge.marginLeft} height="20" className="tmc-zone-wide" />
                <rect x={gauge.minX} y={gauge.y - 10} width={Math.max(0, gauge.maxX - gauge.minX)} height="20" className="tmc-zone-good" />
                <rect x={gauge.maxX} y={gauge.y - 10} width={Math.max(0, gauge.endX - gauge.maxX)} height="20" className="tmc-zone-empty" />

                <line x1={gauge.minX} x2={gauge.minX} y1={gauge.y - 16} y2={gauge.y + 16} className="tmc-gauge-boundary" />
                <line x1={gauge.maxX} x2={gauge.maxX} y1={gauge.y - 16} y2={gauge.y + 16} className="tmc-gauge-boundary" />

                <text x={(gauge.marginLeft + gauge.minX) / 2} y={gauge.y + 32} className="tmc-gauge-label" textAnchor="middle">wasted light</text>
                <text x={(gauge.minX + gauge.maxX) / 2} y={gauge.y + 32} className="tmc-gauge-label" textAnchor="middle">useful range</text>
                <text x={(gauge.maxX + gauge.endX) / 2} y={gauge.y + 32} className="tmc-gauge-label" textAnchor="middle">empty magnification</text>

                <text x={gauge.minX} y={gauge.y - 22} className="tmc-gauge-boundary-label" textAnchor="middle">{fmtX(gauge.minM)}×</text>
                <text x={gauge.maxX} y={gauge.y - 22} className="tmc-gauge-boundary-label" textAnchor="middle">{fmtX(gauge.maxM)}×</text>

                <polygon
                  points={`${gauge.pointX - 7},${gauge.y - 26} ${gauge.pointX + 7},${gauge.y - 26} ${gauge.pointX},${gauge.y - 14}`}
                  className="tmc-gauge-marker"
                />
              </svg>
              <p className="tmc-chart-caption">
                Where {fmtX(result.M)}× falls between an exit pupil too wide to use and the point where
                more power stops showing more detail.
              </p>
            </div>
          )}

          {pupils && (
            <div className="tmc-chart-wrap tmc-pupil-wrap">
              <svg className="tmc-pupil-svg" viewBox="0 0 640 160" role="img" aria-label={`Exit pupil ${fmtX(result.exitPupil)} millimeters compared to a dark-adapted eye's roughly ${DARK_ADAPTED_EYE_PUPIL_MM} millimeter pupil`}>
                <circle cx="220" cy="80" r={pupils.eyeR} className="tmc-eye-pupil" />
                <text x="220" y="150" className="tmc-pupil-label" textAnchor="middle">dark-adapted eye ≈ {DARK_ADAPTED_EYE_PUPIL_MM} mm</text>

                <circle cx="420" cy="80" r={pupils.scopeR} className="tmc-scope-pupil" />
                <text x="420" y="150" className="tmc-pupil-label" textAnchor="middle">this setup ≈ {fmtX(result.exitPupil)} mm</text>
              </svg>
              <p className="tmc-chart-caption">
                Circles drawn to the same scale. When the exit pupil circle is bigger than the eye's,
                light is missing the eye entirely; when it's much smaller, the image is dim and the
                view is past the useful magnification.
              </p>
            </div>
          )}
        </>
      )}

      <div className="tmc-footer-row">
        <CalculatorVote slug="telescope-magnification-calculator" />
        <CalculatorTests
          title="Telescope Magnification &amp; Eyepiece Calculator — Tests"
          columns={TELESCOPE_MAGNIFICATION_TEST_COLUMNS}
          rows={testRows}
          sources={TELESCOPE_MAGNIFICATION_TEST_SOURCES}
        />
        <button type="button" className="tmc-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
