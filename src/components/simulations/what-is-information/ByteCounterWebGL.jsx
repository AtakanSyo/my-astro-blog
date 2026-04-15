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
            <span>Speed</span>
            <input
              type="range"
              min="100"
              max="2000"
              step="100"
              value={2100 - delayMs}
              onChange={(e) => setDelayMs(2100 - Number(e.target.value))}
              aria-label="Counter speed"
              style={{ width: "100%" }}
            />
            <span>{(delayMs / 1000).toFixed(1)}s</span>
          </div>
        </>
      }
    />
  );
}
