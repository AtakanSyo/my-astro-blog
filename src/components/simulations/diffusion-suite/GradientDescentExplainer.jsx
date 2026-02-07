import { useEffect, useMemo, useRef, useState } from "react";

// Monochrome gradient descent explainer on a 2D quadratic bowl
export default function GradientDescentExplainer({
  id = "gradient-descent-explainer",
  aspect = "16 / 9",
  steps = 18,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [lr, setLr] = useState(0.25);

  // Quadratic form parameters: f(x) = 0.5 (a x^2 + 2b xy + c y^2)
  const quad = useMemo(
    () => ({
      a: 1.0,
      b: 0.3,
      c: 0.6,
    }),
    []
  );

  const path = useMemo(() => {
    const pts = [];
    let x = 3.5;
    let y = 3.0;
    for (let i = 0; i < steps; i++) {
      pts.push({ x, y });
      const gx = quad.a * x + quad.b * y;
      const gy = quad.b * x + quad.c * y;
      x = x - lr * gx;
      y = y - lr * gy;
    }
    return pts;
  }, [lr, steps, quad]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");

    function worldToScreen(wx, wy, w, h, pad) {
      const min = -6;
      const max = 6;
      const sx = pad + ((wx - min) / (max - min)) * (w - 2 * pad);
      const sy = h - (pad + ((wy - min) / (max - min)) * (h - 2 * pad));
      return { x: sx, y: sy };
    }

    function draw() {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Background
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#080808");
      g.addColorStop(1, "#111");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const pad = Math.min(w, h) * 0.1;

      // Contour lines of the quadratic
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      const levels = [0.2, 0.6, 1.2, 2.0, 3.0];
      levels.forEach((L) => {
        ctx.beginPath();
        for (let i = 0; i <= 64; i++) {
          const theta = (i / 64) * Math.PI * 2;
          const denom =
            quad.a * Math.cos(theta) * Math.cos(theta) +
            2 * quad.b * Math.sin(theta) * Math.cos(theta) +
            quad.c * Math.sin(theta) * Math.sin(theta);
          const r = Math.sqrt((2 * L) / denom);
          const wx = r * Math.cos(theta);
          const wy = r * Math.sin(theta);
          const { x, y } = worldToScreen(wx, wy, w, h, pad);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      });

      // Path of gradient descent
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      path.forEach((p, i) => {
        const { x, y } = worldToScreen(p.x, p.y, w, h, pad);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Steps as nodes
      path.forEach((p, i) => {
        const { x, y } = worldToScreen(p.x, p.y, w, h, pad);
        const r = i === 0 ? 7 : 5;
        ctx.fillStyle = i === 0 ? "#ffffff" : "rgba(255,255,255,0.8)";
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        if (i < path.length - 1) {
          const { x: nx, y: ny } = worldToScreen(
            path[i + 1].x,
            path[i + 1].y,
            w,
            h,
            pad
          );
          const angle = Math.atan2(ny - y, nx - x);
          const ah = 8;
          ctx.beginPath();
          ctx.moveTo(nx, ny);
          ctx.lineTo(
            nx - ah * Math.cos(angle - Math.PI / 7),
            ny - ah * Math.sin(angle - Math.PI / 7)
          );
          ctx.lineTo(
            nx - ah * Math.cos(angle + Math.PI / 7),
            ny - ah * Math.sin(angle + Math.PI / 7)
          );
          ctx.closePath();
          ctx.fill();
        }
      });

      // Axes
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad, h / 2);
      ctx.lineTo(w - pad, h / 2);
      ctx.moveTo(w / 2, pad);
      ctx.lineTo(w / 2, h - pad);
      ctx.stroke();

      // Labels
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = `${Math.max(13, h * 0.025)}px "Inter", system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText("f(x,y) = 0.5 (xᵀ H x)", pad, pad * 0.8);
      ctx.textAlign = "right";
      ctx.fillText(`learning rate = ${lr.toFixed(2)}`, w - pad, pad * 0.8);
    }

    function resize() {
      const w = container.clientWidth;
      const h = w / eval(aspect);
      canvas.width = w;
      canvas.height = h;
      draw();
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [aspect, lr, path, quad]);

  return (
    <div className="gd-explainer" ref={containerRef}>
      <div className="controls">
        <label htmlFor={`${id}-lr`}>Learning rate</label>
        <input
          id={`${id}-lr`}
          type="range"
          min={0.02}
          max={1.6}
          step={0.02}
          value={lr}
          onChange={(e) => setLr(Number(e.target.value))}
        />
        <div className="legend">
          <span>Small lr → slow but stable.</span>
          <span>Large lr → overshoots past the minimum.</span>
        </div>
      </div>
      <div className="canvas-wrap" style={{ aspectRatio: aspect }}>
        <canvas ref={canvasRef} />
      </div>
      <style jsx>{`
        .gd-explainer { width: 100%; display: flex; flex-direction: column; gap: 0.75rem; }
        .controls { display: flex; flex-direction: column; gap: 0.35rem; color: #f0f0f0; }
        label { font-size: 0.9rem; color: #d8d8d8; }
        input[type="range"] { width: 100%; accent-color: #ffffff; }
        .legend { display: flex; justify-content: space-between; font-size: 0.85rem; color: #b5b5b5; flex-wrap: wrap; gap: 0.25rem; }
        .canvas-wrap { width: 100%; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; overflow: hidden; background: #050505; }
        canvas { width: 100%; height: 100%; display: block; }
      `}</style>
    </div>
  );
}
