import { useEffect, useMemo, useState } from "react";
import "../../../styles/xrayHardnessRatioCalculator.css";
import CalculatorVote from "../../CalculatorVote.jsx";
import CalculatorTests from "../../CalculatorTests.jsx";
import { trackEvent } from "../../../lib/analytics/trackEvent";
import { toNumber, computeHardnessRatio, LOW_COUNT_THRESHOLD } from "./hardnessRatio";
import { HARDNESS_RATIO_TEST_COLUMNS, HARDNESS_RATIO_TEST_SOURCES, getHardnessRatioTestRows } from "./hardnessRatioTests";
import Katex from "../../Katex.jsx";

const PRESETS = [
  { label: "Soft source (corona-like)", soft: "200", hard: "30" },
  { label: "Balanced", soft: "100", hard: "100" },
  { label: "Hard source (absorbed AGN-like)", soft: "20", hard: "150" },
];

function readInitialFromUrl() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const s = params.get("s");
  const h = params.get("h");
  if (s === null && h === null) return null;
  return {
    soft: s ?? "100",
    hard: h ?? "40",
    sigmaSoft: params.get("ss") ?? "",
    sigmaHard: params.get("sh") ?? "",
    custom: params.get("ss") !== null || params.get("sh") !== null,
  };
}

export default function HardnessRatioCalculator() {
  // Always start from these fixed defaults — this is a statically-built
  // page, so the server never sees a request URL and always renders these.
  // Reading window.location.search into the initial state here would make
  // the client's first render diverge from that static HTML (a React
  // hydration mismatch) whenever the page is loaded with a query string —
  // e.g. via this component's own "shareable link" feature. Any URL-encoded
  // state is applied client-side, after mount, in the effect below instead.
  const [soft, setSoft] = useState("100");
  const [hard, setHard] = useState("40");
  const [useCustom, setUseCustom] = useState(false);
  const [sigmaSoftInput, setSigmaSoftInput] = useState("");
  const [sigmaHardInput, setSigmaHardInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initial = readInitialFromUrl();
    if (initial) {
      setSoft(initial.soft);
      setHard(initial.hard);
      setUseCustom(initial.custom);
      setSigmaSoftInput(initial.sigmaSoft);
      setSigmaHardInput(initial.sigmaHard);
    }
    setHydrated(true);
  }, []);

  // Keep the URL shareable without forcing a navigation/reload.
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (soft !== "") params.set("s", soft);
    if (hard !== "") params.set("h", hard);
    if (useCustom && sigmaSoftInput !== "") params.set("ss", sigmaSoftInput);
    if (useCustom && sigmaHardInput !== "") params.set("sh", sigmaHardInput);
    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", url);
  }, [hydrated, soft, hard, useCustom, sigmaSoftInput, sigmaHardInput]);

  const result = useMemo(() => {
    const S = toNumber(soft);
    const H = toNumber(hard);
    const sigmaS = useCustom && sigmaSoftInput !== "" ? toNumber(sigmaSoftInput) : Math.sqrt(S);
    const sigmaH = useCustom && sigmaHardInput !== "" ? toNumber(sigmaHardInput) : Math.sqrt(H);

    return computeHardnessRatio(S, H, sigmaS, sigmaH);
  }, [soft, hard, useCustom, sigmaSoftInput, sigmaHardInput]);

  // Self-check rows: runs the real hardnessRatio.js functions against
  // definitional reference values and edge cases — independent of the
  // fields above.
  const testRows = useMemo(() => getHardnessRatioTestRows(), []);

  const applyPreset = (preset) => {
    setSoft(preset.soft);
    setHard(preset.hard);
    setUseCustom(false);
    setSigmaSoftInput("");
    setSigmaHardInput("");
  };

  const copyLink = async () => {
    trackEvent("calculator-copy-link");
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API can fail silently (permissions, insecure context) — no-op.
    }
  };

  const markerPct = result.valid ? Math.min(100, Math.max(0, ((result.HR + 1) / 2) * 100)) : 50;
  const bandHalfWidthPct =
    result.valid && Number.isFinite(result.sigmaHR) ? Math.min(50, (result.sigmaHR / 2) * 100) : 0;

  return (
    <div className="hrc" aria-label="X-ray hardness ratio calculator">
      <div className="hrc-header">
        <p className="hrc-title">Hardness ratio calculator</p>
        <div className="hrc-presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="hrc-preset-btn"
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="hrc-grid">
        <div className="hrc-field hrc-field--soft">
          <label htmlFor="hrc-soft">
            <span className="hrc-band-dot" aria-hidden="true" />
            Soft-band counts (<Katex tex="S" />)
          </label>
          <input
            id="hrc-soft"
            className="hrc-input"
            type="number"
            min="0"
            inputMode="decimal"
            value={soft}
            onChange={(e) => setSoft(e.target.value)}
          />
        </div>

        <div className="hrc-field hrc-field--hard">
          <label htmlFor="hrc-hard">
            <span className="hrc-band-dot" aria-hidden="true" />
            Hard-band counts (<Katex tex="H" />)
          </label>
          <input
            id="hrc-hard"
            className="hrc-input"
            type="number"
            min="0"
            inputMode="decimal"
            value={hard}
            onChange={(e) => setHard(e.target.value)}
          />
        </div>
      </div>

      <div className="hrc-toggle-row">
        <input
          id="hrc-custom-toggle"
          type="checkbox"
          checked={useCustom}
          onChange={(e) => setUseCustom(e.target.checked)}
        />
        <label htmlFor="hrc-custom-toggle">
          Use custom count uncertainties (default: Poisson, √N)
        </label>
      </div>

      {useCustom && (
        <div className="hrc-grid">
          <div className="hrc-field hrc-field--soft">
            <label htmlFor="hrc-sigma-soft"><Katex tex="\sigma(S)" /> — leave blank for <Katex tex="\sqrt{S}" /></label>
            <input
              id="hrc-sigma-soft"
              className="hrc-input"
              type="number"
              min="0"
              inputMode="decimal"
              placeholder={result.valid ? result.sigmaS?.toFixed(2) : ""}
              value={sigmaSoftInput}
              onChange={(e) => setSigmaSoftInput(e.target.value)}
            />
          </div>
          <div className="hrc-field hrc-field--hard">
            <label htmlFor="hrc-sigma-hard"><Katex tex="\sigma(H)" /> — leave blank for <Katex tex="\sqrt{H}" /></label>
            <input
              id="hrc-sigma-hard"
              className="hrc-input"
              type="number"
              min="0"
              inputMode="decimal"
              placeholder={result.valid ? result.sigmaH?.toFixed(2) : ""}
              value={sigmaHardInput}
              onChange={(e) => setSigmaHardInput(e.target.value)}
            />
          </div>
        </div>
      )}

      <hr className="hrc-divider" />

      {!result.valid ? (
        <p className="hrc-note hrc-note--warn" role="alert">
          Enter non-negative soft and hard counts (not both zero) to compute a hardness ratio.
        </p>
      ) : (
        <div className="hrc-result" aria-live="polite">
          <div className="hrc-result-top">
            <div>
              <span className="hrc-hr-value">
                {result.HR.toFixed(3)}
                {Number.isFinite(result.sigmaHR) && (
                  <span className="hrc-hr-sigma"> ± {result.sigmaHR.toFixed(3)}</span>
                )}
              </span>
            </div>
            <span className="hrc-badge">{result.label}</span>
          </div>

          <div className="hrc-secondary-stats">
            <span>
              <Katex tex="H/S" /> ratio: <strong>{Number.isFinite(result.ratio) ? result.ratio.toFixed(3) : "∞"}</strong>
            </span>
            <span>
              <Katex tex="\sigma(S)" />: <strong>{Number.isFinite(result.sigmaS) ? result.sigmaS.toFixed(2) : "—"}</strong>
            </span>
            <span>
              <Katex tex="\sigma(H)" />: <strong>{Number.isFinite(result.sigmaH) ? result.sigmaH.toFixed(2) : "—"}</strong>
            </span>
          </div>

          <div className="hrc-gauge-wrap">
            <div className="hrc-gauge-track">
              {bandHalfWidthPct > 0 && (
                <div
                  className="hrc-gauge-band"
                  style={{
                    left: `${Math.max(0, markerPct - bandHalfWidthPct)}%`,
                    right: `${Math.max(0, 100 - Math.min(100, markerPct + bandHalfWidthPct))}%`,
                  }}
                />
              )}
              <div className="hrc-gauge-marker" style={{ left: `${markerPct}%` }} />
            </div>
            <div className="hrc-gauge-labels">
              <span>−1 (soft)</span>
              <span>0</span>
              <span>+1 (hard)</span>
            </div>
          </div>

          {result.lowCounts && (
            <p className="hrc-note hrc-note--warn">
              One of your bands has fewer than {LOW_COUNT_THRESHOLD} counts. The Gaussian (<Katex tex="\sqrt{N}" />)
              error propagation used here becomes unreliable at low counts — consider a Bayesian
              estimator such as BEHR (Park et al. 2006) instead of this linearized formula.
            </p>
          )}

          <div className="hrc-footer-row">
            <CalculatorVote slug="xray-hardness-ratio-calculator" />
            <CalculatorTests
              title="X-ray Hardness Ratio Calculator — Tests"
              columns={HARDNESS_RATIO_TEST_COLUMNS}
              rows={testRows}
              sources={HARDNESS_RATIO_TEST_SOURCES}
            />
            <button type="button" className="hrc-copy-btn" onClick={copyLink}>
              {copied ? "Link copied" : "Copy shareable link"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
