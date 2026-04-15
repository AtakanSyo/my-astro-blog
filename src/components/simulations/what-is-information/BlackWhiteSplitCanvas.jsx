import { useEffect, useRef } from "react";

export default function BlackWhiteSplitCanvas({ aspect = "16 / 9", dprCap = 2 }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

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

      gl.enable(gl.SCISSOR_TEST);

      const leftWidth = Math.floor(width / 2);
      gl.scissor(0, 0, leftWidth, height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.scissor(leftWidth, 0, width - leftWidth, height);
      gl.clearColor(1, 1, 1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.disable(gl.SCISSOR_TEST);
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

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        aspectRatio: aspect,
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        aria-label="Static split canvas with black left side and white right side"
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
}
