import { useEffect, useMemo, useState } from "react";
import "../../../styles/xrayHardnessRatioCalculator.css";

const PRESETS = [
  { label: "Soft source (corona-like)", soft: "200", hard: "30" },
  { label: "Balanced", soft: "100", hard: "100" },
  { label: "Hard source (absorbed AGN-like)", soft: "20", hard: "150" },
];

const LOW_COUNT_THRESHOLD = 20;

function classify(hr) {
  if (hr < -0.5) return "Very soft";
  if (hr < -0.1) return "Soft";
  if (hr <= 0.1) return "Balanced";
  if (hr <= 0.5) return "Hard";
  return "Very hard";
}

function toNumber(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : NaN;
}

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

    if (!Number.isFinite(S) || !Number.isFinite(H) || S < 0 || H < 0 || S + H <= 0) {
      return { valid: false };
    }

    const sigmaS = useCustom && sigmaSoftInput !== "" ? toNumber(sigmaSoftInput) : Math.sqrt(S);
    const sigmaH = useCustom && sigmaHardInput !== "" ? toNumber(sigmaHardInput) : Math.sqrt(H);

    const denom = H + S;
    const HR = (H - S) / denom;

    let sigmaHR = null;
    if (Number.isFinite(sigmaS) && Number.isFinite(sigmaH) && sigmaS >= 0 && sigmaH >= 0) {
      sigmaHR =
        (2 / (denom * denom)) *
        Math.sqrt(S * S * sigmaH * sigmaH + H * H * sigmaS * sigmaS);
    }

    const ratio = S > 0 ? H / S : Infinity;
    const lowCounts = S < LOW_COUNT_THRESHOLD || H < LOW_COUNT_THRESHOLD;

    return {
      valid: true,
      S,
      H,
      sigmaS,
      sigmaH,
      HR,
      sigmaHR,
      ratio,
      lowCounts,
      label: classify(HR),
    };
  }, [soft, hard, useCustom, sigmaSoftInput, sigmaHardInput]);

  const applyPreset = (preset) => {
    setSoft(preset.soft);
    setHard(preset.hard);
    setUseCustom(false);
    setSigmaSoftInput("");
    setSigmaHardInput("");
  };

  const copyLink = async () => {
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
            Soft-band counts (S)
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
            Hard-band counts (H)
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
            <label htmlFor="hrc-sigma-soft">σ(S) — leave blank for √S</label>
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
            <label htmlFor="hrc-sigma-hard">σ(H) — leave blank for √H</label>
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
              H/S ratio: <strong>{Number.isFinite(result.ratio) ? result.ratio.toFixed(3) : "∞"}</strong>
            </span>
            <span>
              σ(S): <strong>{Number.isFinite(result.sigmaS) ? result.sigmaS.toFixed(2) : "—"}</strong>
            </span>
            <span>
              σ(H): <strong>{Number.isFinite(result.sigmaH) ? result.sigmaH.toFixed(2) : "—"}</strong>
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
              One of your bands has fewer than {LOW_COUNT_THRESHOLD} counts. The Gaussian (√N)
              error propagation used here becomes unreliable at low counts — consider a Bayesian
              estimator such as BEHR (Park et al. 2006) instead of this linearized formula.
            </p>
          )}

          <div className="hrc-footer-row">
            <button type="button" className="hrc-copy-btn" onClick={copyLink}>
              {copied ? "Link copied" : "Copy shareable link"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
