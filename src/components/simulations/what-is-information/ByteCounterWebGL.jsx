import { useEffect, useRef, useState } from "react";
import SimStage from "../lib/simStage.jsx";

export default function ByteCounterWebGL({ aspect = "16 / 9", dprCap = 2, stepMs = 1000 }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const pausedRef = useRef(true);
  const madeVisibleRef = useRef(false);
  const [paused, setPaused] = useState(true);
  const [value, setValue] = useState(0);
  const [delayMs, setDelayMs] = useState(stepMs);
  const byte = value.toString(2).padStart(8, "0");
  const sliderValue = 2100 - delayMs;
  const sliderProgress = ((sliderValue - 100) / 1900) * 100;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const gl =
      canvas.getContext("webgl", { antialias: false, alpha: false }) ||
      canvas.getContext("experimental-webgl");
    if (!gl) return;

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      const width = Math.max(1, Math.floor(container.clientWidth * dpr));
      const height = Math.max(1, Math.floor(container.clientHeight * dpr));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    };

    const ro = new ResizeObserver(fit);
    ro.observe(container);
    window.addEventListener("resize", fit, { passive: true });
    fit();

    return () => {
      try {
        ro.disconnect();
      } catch {}
      window.removeEventListener("resize", fit);
    };
  }, [dprCap]);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setValue((prev) => (prev + 1) % 256);
    }, delayMs);

    return () => window.clearInterval(timer);
  }, [delayMs, paused]);

  const onToggle = () => {
    pausedRef.current = !pausedRef.current;
    const nextPaused = pausedRef.current;
    setPaused(nextPaused);

    if (!nextPaused && !madeVisibleRef.current) {
      madeVisibleRef.current = true;
      const figure = containerRef.current?.closest("figure.sim-stage");
      if (figure && !figure.classList.contains("is-visible")) {
        figure.classList.add("is-visible");
      }
    }
  };

  return (
    <SimStage
      id="byte-counter-webgl"
      aspect={aspect}
      containerRef={containerRef}
      canvasRef={canvasRef}
      paused={paused}
      onToggle={onToggle}
      showPause={true}
      style={{ background: "#000" }}
      children={
        <>
          <div
            style={{
              position: "absolute",
              inset: "0 0 42px 0",
              display: "grid",
              placeItems: "center",
              color: "#fff",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: "clamp(1.2rem, 5vw, 2.6rem)",
              fontWeight: 700,
              letterSpacing: "0.03em",
              userSelect: "none",
              textAlign: "center",
              padding: "0 1rem",
              pointerEvents: "none",
              zIndex: 3,
            }}
          >
            {byte} = {value}
          </div>
          <div
            className="byte-counter-speed"
            style={{
              position: "absolute",
              left: "12px",
              right: "12px",
              bottom: "10px",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              color: "#fff",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: "0.82rem",
              zIndex: 4,
              pointerEvents: "auto",
            }}
          >
            <span className="byte-counter-speed-label">Speed</span>
            <input
              className="byte-counter-slider"
              type="range"
              min="100"
              max="2000"
              step="100"
              value={sliderValue}
              onChange={(e) => setDelayMs(2100 - Number(e.target.value))}
              aria-label="Counter speed"
              style={{
                "--byte-counter-progress": `${sliderProgress}%`,
              }}
            />
            <span className="byte-counter-speed-value">{(delayMs / 1000).toFixed(1)}s</span>
          </div>
          <style>{`
            .byte-counter-speed {
              --byte-counter-accent: var(--post-color, rgba(255, 255, 255, 1));
              --byte-counter-track: color-mix(in srgb, var(--byte-counter-accent) 24%, rgba(255, 255, 255, 0.12));
              --byte-counter-muted: color-mix(in srgb, var(--byte-counter-accent) 45%, rgba(255, 255, 255, 0.7));
            }

            .byte-counter-speed-label,
            .byte-counter-speed-value {
              color: var(--byte-counter-muted);
              font-size: 0.72rem;
              line-height: 1;
              opacity: 0.9;
              white-space: nowrap;
            }

            .byte-counter-slider {
              width: 100%;
              height: 18px;
              appearance: none;
              -webkit-appearance: none;
              background: transparent;
              cursor: pointer;
              outline: none;
            }

            .byte-counter-slider::-webkit-slider-runnable-track {
              height: 2px;
              border-radius: 999px;
              background: linear-gradient(
                90deg,
                var(--byte-counter-accent) 0%,
                var(--byte-counter-accent) var(--byte-counter-progress),
                var(--byte-counter-track) var(--byte-counter-progress),
                var(--byte-counter-track) 100%
              );
            }

            .byte-counter-slider::-webkit-slider-thumb {
              width: 10px;
              height: 10px;
              margin-top: -4px;
              border: 0;
              border-radius: 999px;
              background: var(--byte-counter-accent);
              -webkit-appearance: none;
              appearance: none;
            }

            .byte-counter-slider::-moz-range-track {
              height: 2px;
              border-radius: 999px;
              background: var(--byte-counter-track);
            }

            .byte-counter-slider::-moz-range-progress {
              height: 2px;
              border-radius: 999px;
              background: var(--byte-counter-accent);
            }

            .byte-counter-slider::-moz-range-thumb {
              width: 10px;
              height: 10px;
              border: 0;
              border-radius: 999px;
              background: var(--byte-counter-accent);
            }

            .byte-counter-slider:focus-visible::-webkit-slider-thumb {
              box-shadow: 0 0 0 4px color-mix(in srgb, var(--byte-counter-accent) 30%, transparent);
            }

            .byte-counter-slider:focus-visible::-moz-range-thumb {
              box-shadow: 0 0 0 4px color-mix(in srgb, var(--byte-counter-accent) 30%, transparent);
            }
          `}</style>
        </>
      }
    />
  );
}
