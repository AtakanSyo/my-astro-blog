import { useEffect, useMemo, useState } from "react";
import { Efunc, lookbackTimeGyr, ageOfUniverseTodayGyr } from "./cosmology";
import "../../../styles/cosmologicalLookbackTimeCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";

// Each preset sets a full, self-consistent state (redshift + cosmology),
// so applying one and then tweaking a field afterward always starts from
// a sane baseline. The last preset deliberately repeats z=1 under a very
// different cosmology, to make the point explicit: this result depends
// on the assumed model, not just on z.
const PRESETS = [
  { label: "z = 1, Planck 2018", z: 1, H0: 67.4, Om: 0.315, flat: true, OL: 0.685 },
  { label: "z = 0.5, WMAP9", z: 0.5, H0: 69.32, Om: 0.2865, flat: true, OL: 0.7135 },
  { label: "Cosmic noon (z = 2)", z: 2, H0: 67.4, Om: 0.315, flat: true, OL: 0.685 },
  { label: "Reionization-era quasar (z = 7)", z: 7, H0: 67.4, Om: 0.315, flat: true, OL: 0.685 },
  { label: "Same z=1, Einstein–de Sitter", z: 1, H0: 70, Om: 1.0, flat: true, OL: 0 },
];

function niceStep(span, targetCount = 5) {
  if (!(span > 0)) return 1;
  const raw = span / targetCount;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
  return step * mag;
}
function formatGyr(n) {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs < 0.01 && abs > 0) return `${(n * 1000).toFixed(1)} Myr`;
  if (abs >= 100) return `${n.toFixed(0)} Gyr`;
  if (abs >= 10) return `${n.toFixed(1)} Gyr`;
  return `${n.toFixed(2)} Gyr`;
}
function formatPlain(n, digits = 3) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits).replace(/\.?0+$/, (m) => (m === "." ? "" : m.replace(/0+$/, "") || ""));
}

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const z = params.get("z");
  if (z === null || !Number.isFinite(parseFloat(z))) return null;
  const num = (key, fallback) => {
    const raw = params.get(key);
    return raw !== null && Number.isFinite(parseFloat(raw)) ? raw : fallback;
  };
  return {
    z,
    H0: num("h0", "67.4"),
    Om: num("om", "0.315"),
    flat: params.get("flat") !== "0",
    OL: num("ol", "0.685"),
  };
}

export default function CosmologicalLookbackTimeCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Any URL-encoded state is applied client-side, after mount, below.
  const [z, setZ] = useState("1");
  const [H0, setH0] = useState("67.4");
  const [Om, setOm] = useState("0.315");
  const [flatUniverse, setFlatUniverse] = useState(true);
  const [OLInput, setOLInput] = useState("0.685");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setZ(initial.z);
      setH0(initial.H0);
      setOm(initial.Om);
      setFlatUniverse(initial.flat);
      setOLInput(initial.OL);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams();
      params.set("z", z);
      params.set("h0", H0);
      params.set("om", Om);
      params.set("flat", flatUniverse ? "1" : "0");
      if (!flatUniverse) params.set("ol", OLInput);
      const query = params.toString();
      const url = `${window.location.pathname}?${query}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [hydrated, z, H0, Om, flatUniverse, OLInput]);

  const result = useMemo(() => {
    const zNum = parseFloat(z);
    const H0Num = parseFloat(H0);
    const OmNum = parseFloat(Om);
    if (!(zNum >= 0) || !(H0Num > 0) || !(OmNum >= 0)) {
      return { valid: false, reason: "Enter a non-negative redshift, a positive H₀, and a non-negative Ωm." };
    }
    const OLNum = flatUniverse ? 1 - OmNum : parseFloat(OLInput);
    if (!Number.isFinite(OLNum)) return { valid: false, reason: "Enter a valid ΩΛ." };
    const Ok = 1 - OmNum - OLNum;
    const lookback = lookbackTimeGyr(zNum, OmNum, OLNum, Ok, H0Num);
    if (lookback === null) {
      return { valid: false, reason: "This combination of Ωm, ΩΛ doesn't give a physical expansion history out to this redshift." };
    }
    const age0 = ageOfUniverseTodayGyr(OmNum, OLNum, Ok, H0Num);
    if (age0 === null) return { valid: false, reason: "Couldn't compute the age of the universe for these parameters." };
    return { valid: true, z: zNum, H0: H0Num, Om: OmNum, OL: OLNum, Ok, lookback, age0, ageAtZ: age0 - lookback };
  }, [z, H0, Om, flatUniverse, OLInput]);

  // --- cosmic timeline ---
  // Places the emission time directly on a bar spanning the Big Bang to
  // today, next to a few landmark cosmic epochs — turns "5.8 Gyr" into a
  // point in a story you already roughly know the shape of.
  const timeline = useMemo(() => {
    if (!result.valid) return null;
    const { age0, ageAtZ } = result;
    const width = 640;
    const height = 168;
    const marginLeft = 26;
    const marginRight = 26;
    const y = 66;
    const plotWidth = width - marginLeft - marginRight;
    const xScale = (t) => marginLeft + (Math.max(0, Math.min(age0, t)) / age0) * plotWidth;

    const rawLandmarks = [
      { label: "Big Bang", t: 0, special: true },
      { label: "CMB (~380,000 yr)", t: 0.000378 },
      { label: "First galaxies", t: 0.4 },
      { label: "Solar System forms", t: age0 - 4.6 },
      { label: "Today", t: age0, special: true },
    ].filter((lm) => lm.t >= -1e-6 && lm.t <= age0 + 1e-6);

    const landmarks = rawLandmarks.map((lm) => ({ ...lm, x: xScale(lm.t) }));
    const emissionX = xScale(ageAtZ);
    const todayX = xScale(age0);

    return { width, height, marginLeft, plotWidth, y, landmarks, emissionX, todayX };
  }, [result]);

  // --- integrand / area-under-the-curve chart ---
  // t_L(z) is a genuine integral, not algebra — this plots the actual
  // integrand 1/[(1+z')E(z')] and shades the region from 0 to z whose
  // area, times the Hubble time, IS the lookback time.
  const areaChart = useMemo(() => {
    if (!result.valid) return null;
    const { z: zVal, Om, OL, Ok } = result;
    const zMax = Math.max(zVal * 1.25, zVal + 0.5, 1);
    const N = 140;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const zp = (zMax * i) / N;
      const e = Efunc(zp, Om, OL, Ok);
      const f = Number.isFinite(e) && e > 0 ? 1 / ((1 + zp) * e) : 0;
      pts.push({ zp, f });
    }
    const maxF = Math.max(...pts.map((p) => p.f), 1e-9);

    const width = 640;
    const height = 280;
    const marginLeft = 58;
    const marginRight = 20;
    const marginTop = 20;
    const marginBottom = 40;
    const plotWidth = width - marginLeft - marginRight;
    const plotHeight = height - marginTop - marginBottom;
    const xScale = (zp) => marginLeft + (zp / zMax) * plotWidth;
    const yScale = (f) => marginTop + (1 - f / maxF) * plotHeight;

    const curvePoints = pts.map((p) => `${xScale(p.zp)},${yScale(p.f)}`).join(" ");
    const eAtZ = Efunc(zVal, Om, OL, Ok);
    const fAtZ = Number.isFinite(eAtZ) && eAtZ > 0 ? 1 / ((1 + zVal) * eAtZ) : 0;
    const shaded = pts.filter((p) => p.zp <= zVal + 1e-9);
    const areaPath =
      `M ${xScale(0)} ${yScale(0)} ` +
      shaded.map((p) => `L ${xScale(p.zp)} ${yScale(p.f)}`).join(" ") +
      ` L ${xScale(zVal)} ${yScale(0)} Z`;

    const xStep = niceStep(zMax, 5);
    const xTicks = [];
    for (let t = 0; t <= zMax + 1e-9; t += xStep) xTicks.push(Math.round(t / xStep) * xStep);
    const yStep = niceStep(maxF, 4);
    const yTicks = [];
    for (let t = 0; t <= maxF + 1e-9; t += yStep) yTicks.push(Math.round(t / yStep) * yStep);

    return {
      width, height, marginLeft, marginRight, marginTop, marginBottom, plotWidth, plotHeight,
      xScale, yScale, curvePoints, areaPath, xTicks, yTicks,
      point: { x: xScale(zVal), y: yScale(fAtZ) },
    };
  }, [result]);

  const applyPreset = (preset) => {
    setZ(String(preset.z));
    setH0(String(preset.H0));
    setOm(String(preset.Om));
    setFlatUniverse(preset.flat);
    setOLInput(String(preset.OL));
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
    <div className="clc" aria-label="Cosmological lookback time calculator">
      <div className="clc-header">
        <p className="clc-title">Cosmological lookback time calculator</p>
        <div className="clc-presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" className="clc-preset-btn" onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="clc-explainer">
        Unlike a plain magnitude or distance conversion, lookback time is a genuine{" "}
        <strong>integral</strong> over the universe's expansion history:{" "}
        <code>t_L(z) = (1/H₀) ∫₀^z dz′ / [(1+z′)E(z′)]</code>, with{" "}
        <code>E(z) = √(Ωm(1+z)³ + Ωk(1+z)² + ΩΛ)</code>. It's evaluated here by numerical
        integration (Simpson's rule) and checked against Astropy — see the note below the
        calculator. The answer depends explicitly on the cosmology you assume, not just on z.
      </p>

      <div className="clc-fields">
        <div className="clc-field">
          <label htmlFor="clc-z">Redshift (z)</label>
          <input id="clc-z" className="clc-input" type="number" min="0" step="any" inputMode="decimal" value={z} onChange={(e) => setZ(e.target.value)} />
        </div>
        <div className="clc-field">
          <label htmlFor="clc-h0">H₀ (km/s/Mpc)</label>
          <input id="clc-h0" className="clc-input" type="number" min="0" step="any" inputMode="decimal" value={H0} onChange={(e) => setH0(e.target.value)} />
        </div>
        <div className="clc-field">
          <label htmlFor="clc-om">Ωm (matter density)</label>
          <input id="clc-om" className="clc-input" type="number" min="0" step="any" inputMode="decimal" value={Om} onChange={(e) => setOm(e.target.value)} />
        </div>
        <div className="clc-field">
          <label htmlFor="clc-ol">ΩΛ (dark energy density)</label>
          {flatUniverse ? (
            <div className="clc-computed">{formatPlain(1 - (parseFloat(Om) || 0), 4)} (flat: 1 − Ωm)</div>
          ) : (
            <input id="clc-ol" className="clc-input" type="number" step="any" inputMode="decimal" value={OLInput} onChange={(e) => setOLInput(e.target.value)} />
          )}
        </div>
      </div>

      <div className="clc-flat-row">
        <button
          type="button"
          className={flatUniverse ? "clc-flat-toggle active" : "clc-flat-toggle"}
          onClick={() => {
            if (flatUniverse) setOLInput(formatPlain(1 - (parseFloat(Om) || 0), 4));
            setFlatUniverse((v) => !v);
          }}
        >
          {flatUniverse ? "✓ Flat universe (Ωk = 0)" : "Allow curvature (edit ΩΛ freely)"}
        </button>
        {result.valid && Math.abs(result.Ok) > 1e-6 && (
          <span className="clc-ok-note">Ωk = {formatPlain(result.Ok, 4)} (non-flat model)</span>
        )}
      </div>

      {!result.valid ? (
        <p className="clc-note clc-note--warn" role="alert">{result.reason}</p>
      ) : (
        <>
          <div className="clc-headline-card">
            <div className="clc-headline">Lookback time: ~{formatGyr(result.lookback)}</div>
            <div className="clc-headline-sub">
              You are seeing this object as it was ~{formatGyr(result.ageAtZ)} after the Big Bang
              (universe is {formatGyr(result.age0)} old today).
            </div>
          </div>

          {timeline && (
            <div className="clc-chart-wrap">
              <svg
                className="clc-timeline-svg"
                viewBox={`0 0 ${timeline.width} ${timeline.height}`}
                role="img"
                aria-label={`Cosmic timeline; this object emitted its light ${formatGyr(result.ageAtZ)} after the Big Bang, ${formatGyr(result.lookback)} ago`}
              >
                <line x1={timeline.marginLeft} x2={timeline.marginLeft + timeline.plotWidth} y1={timeline.y} y2={timeline.y} className="clc-timeline-axis" />

                {timeline.landmarks.map((lm) => (
                  <g key={lm.label}>
                    <line x1={lm.x} x2={lm.x} y1={timeline.y - 5} y2={timeline.y + 5} className={lm.special ? "clc-landmark-tick clc-landmark-tick--special" : "clc-landmark-tick"} />
                    <text x={lm.x} y={timeline.y + 44} className="clc-landmark-label" textAnchor="middle">{lm.label}</text>
                  </g>
                ))}

                <line x1={timeline.emissionX} x2={timeline.todayX} y1={timeline.y - 26} y2={timeline.y - 26} className="clc-timeline-bracket" />
                <line x1={timeline.emissionX} x2={timeline.emissionX} y1={timeline.y - 26} y2={timeline.y - 18} className="clc-timeline-bracket" />
                <line x1={timeline.todayX} x2={timeline.todayX} y1={timeline.y - 26} y2={timeline.y - 18} className="clc-timeline-bracket" />
                <text x={(timeline.emissionX + timeline.todayX) / 2} y={timeline.y - 32} className="clc-timeline-bracket-label" textAnchor="middle">
                  lookback: {formatGyr(result.lookback)}
                </text>

                <circle cx={timeline.emissionX} cy={timeline.y} r="6" className="clc-timeline-marker" />
                <text x={timeline.emissionX} y={timeline.y + 22} className="clc-timeline-marker-label" textAnchor="middle">light emitted</text>
              </svg>
              <p className="clc-chart-caption">
                Cosmic timeline from the Big Bang (left) to today (right). The marked point is
                where this object's light was emitted; the bracket is exactly the lookback time.
              </p>
            </div>
          )}

          {areaChart && (
            <div className="clc-chart-wrap">
              <svg
                className="clc-area-svg"
                viewBox={`0 0 ${areaChart.width} ${areaChart.height}`}
                role="img"
                aria-label="Plot of the lookback-time integrand versus redshift, with the area from 0 to z shaded"
              >
                {areaChart.yTicks.map((t) => (
                  <g key={`y${t}`}>
                    <line x1={areaChart.marginLeft} x2={areaChart.marginLeft + areaChart.plotWidth} y1={areaChart.yScale(t)} y2={areaChart.yScale(t)} className="clc-chart-gridline" />
                    <text x={areaChart.marginLeft - 8} y={areaChart.yScale(t) + 4} className="clc-chart-axis-label" textAnchor="end">{formatPlain(t, 2)}</text>
                  </g>
                ))}
                {areaChart.xTicks.map((t) => (
                  <g key={`x${t}`}>
                    <line x1={areaChart.xScale(t)} x2={areaChart.xScale(t)} y1={areaChart.marginTop} y2={areaChart.marginTop + areaChart.plotHeight} className="clc-chart-gridline" />
                    <text x={areaChart.xScale(t)} y={areaChart.height - 12} className="clc-chart-axis-label" textAnchor="middle">z′={formatPlain(t, 2)}</text>
                  </g>
                ))}
                <line x1={areaChart.marginLeft} x2={areaChart.marginLeft} y1={areaChart.marginTop} y2={areaChart.marginTop + areaChart.plotHeight} className="clc-chart-axis-line" />
                <line x1={areaChart.marginLeft} x2={areaChart.marginLeft + areaChart.plotWidth} y1={areaChart.marginTop + areaChart.plotHeight} y2={areaChart.marginTop + areaChart.plotHeight} className="clc-chart-axis-line" />

                <path d={areaChart.areaPath} className="clc-area-fill" />
                <polyline points={areaChart.curvePoints} className="clc-area-curve" />
                <circle cx={areaChart.point.x} cy={areaChart.point.y} r="4.5" className="clc-area-point" />
              </svg>
              <p className="clc-chart-caption">
                The integrand 1/[(1+z′)E(z′)] versus z′. The shaded area from 0 to z, multiplied by
                the Hubble time 1/H₀, <em>is</em> the lookback time — an area, not an algebraic formula.
              </p>
            </div>
          )}
        </>
      )}

      <p className="clc-validation-note">
        Validated against Astropy's <code>FlatLambdaCDM</code> (matter+Λ, no radiation) across a
        range of z and cosmologies — lookback times and ages agree to better than 1 part in 10⁶.
      </p>

      <div className="clc-footer-row">
        <CalculatorVote slug="cosmological-lookback-time-calculator" />
        <button type="button" className="clc-copy-btn" onClick={copyLink}>
          {copied ? "Link copied" : "Copy shareable link"}
        </button>
      </div>
    </div>
  );
}
