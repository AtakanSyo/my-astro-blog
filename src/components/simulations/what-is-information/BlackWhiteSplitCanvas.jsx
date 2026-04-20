import { useEffect, useRef } from "react";

export default function BlackWhiteSplitCanvas({ aspect = "16 / 9", dprCap = 2, animate = true }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const startTimeRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const fract = (v) => v - Math.floor(v);
    const hash2 = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
    const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      const width = Math.max(1, Math.floor(container.clientWidth * dpr));
      const height = Math.max(1, Math.floor(container.clientHeight * dpr));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      ctx.imageSmoothingEnabled = false;
    };

    const render = (t) => {
      if (!startTimeRef.current) startTimeRef.current = t;
      const elapsed = (t - startTimeRef.current) / 1000;

      const width = Math.max(1, canvas.width);
      const height = Math.max(1, canvas.height);
      const dividerPx = Math.floor(width * 0.5);
      const leftW = Math.max(1, dividerPx);
      const rightW = Math.max(1, width - dividerPx);

      ctx.fillStyle = "#05070f";
      ctx.fillRect(0, 0, width, height);

      // Left field: cool tones.
      const leftBase = ctx.createLinearGradient(0, 0, leftW, height);
      leftBase.addColorStop(0, "hsl(220 70% 10%)");
      leftBase.addColorStop(0.55, "hsl(246 70% 18%)");
      leftBase.addColorStop(1, "hsl(278 80% 26%)");
      ctx.fillStyle = leftBase;
      ctx.fillRect(0, 0, leftW, height);

      // Right field: warm tones.
      const rightBase = ctx.createLinearGradient(dividerPx, 0, width, height);
      rightBase.addColorStop(0, "hsl(10 88% 34%)");
      rightBase.addColorStop(0.55, "hsl(34 96% 50%)");
      rightBase.addColorStop(1, "hsl(56 90% 58%)");
      ctx.fillStyle = rightBase;
      ctx.fillRect(dividerPx, 0, rightW, height);

      // Pixel field: slow flicker and hue drift.
      const cell = clamp(Math.floor(width / 92), 8, 22);
      const flickerStep = Math.floor(elapsed * 1.2);
      const yDrift = elapsed * 0.07;

      for (let py = 0; py < height; py += cell) {
        for (let px = 0; px < width; px += cell) {
          const gx = Math.floor(px / cell);
          const gy = Math.floor(py / cell);
          const side = px < dividerPx ? 0 : 1;
          const pulse = Math.sin(gx * 0.45 + gy * 0.37 + yDrift);
          const seeded = hash2(gx + flickerStep * 0.73, gy - flickerStep * 0.51);
          const twinkle = seeded * 0.8 + (pulse * 0.5 + 0.5) * 0.2;
          if (twinkle < 0.54) continue;

          const brightness = (twinkle - 0.54) / 0.46;
          const alpha = 0.035 + brightness * 0.28;
          const hue = side === 0 ? 192 + pulse * 46 + seeded * 22 : 18 + pulse * 34 + seeded * 20;
          const sat = side === 0 ? 88 : 94;
          const light = side === 0 ? 58 + brightness * 20 : 60 + brightness * 16;

          ctx.fillStyle = `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
          ctx.fillRect(px, py, cell - 1, cell - 1);
        }
      }

      // Neon divider and glow.
      const glow = ctx.createLinearGradient(0, 0, 0, height);
      glow.addColorStop(0, "hsla(194,100%,74%,0.95)");
      glow.addColorStop(0.5, "hsla(0,0%,100%,1)");
      glow.addColorStop(1, "hsla(45,100%,72%,0.95)");
      const lineWidth = Math.max(2, Math.floor(width * 0.004));
      ctx.shadowColor = "rgba(255,255,255,0.7)";
      ctx.shadowBlur = Math.max(12, Math.floor(width * 0.018));
      ctx.fillStyle = glow;
      ctx.fillRect(dividerPx - lineWidth / 2, 0, lineWidth, height);
      ctx.shadowBlur = 0;

      // Soft vignette.
      const vignette = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.15,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.7,
      );
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.38)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

      rafRef.current = requestAnimationFrame(render);
    };

    const ro = new ResizeObserver(fit);
    ro.observe(container);
    window.addEventListener("resize", fit, { passive: true });
    fit();
    rafRef.current = requestAnimationFrame(render);

    return () => {
      try {
        ro.disconnect();
      } catch {}
      window.removeEventListener("resize", fit);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [animate, dprCap]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        aspectRatio: aspect,
        borderRadius: "12px",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <canvas
        ref={canvasRef}
        aria-label="Interactive split canvas with black left side and white right side"
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
}
