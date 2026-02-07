import { useEffect, useMemo, useRef, useState } from "react";

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Quick Gaussian kernel for distance-based attention weights
function gaussian(dx, dy, sigma) {
  const d2 = dx * dx + dy * dy;
  const denom = 2 * sigma * sigma;
  return Math.exp(-d2 / denom);
}

export default function SelfPixelAttentionExplainer({
  id = "self-pixel-attention",
  aspect = "16 / 9",
  gridSize = 7,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [spread, setSpread] = useState(1.4); // sigma for Gaussian
  const [query, setQuery] = useState(() => ({
    x: Math.floor(gridSize / 2),
    y: Math.floor(gridSize / 2),
  }));

  const cells = useMemo(() => {
    const list = [];
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        list.push({ x, y });
      }
    }
    return list;
  }, [gridSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");

    function resize() {
      const w = container.clientWidth;
      const h = w / eval(aspect);
      canvas.width = w;
      canvas.height = h;
      draw();
    }

    function draw() {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#060606";
      ctx.fillRect(0, 0, w, h);

      // Compute layout
      const padding = Math.min(w, h) * 0.12;
      const gridW = w - padding * 2;
      const gridH = h - padding * 2;
      const cellSize = Math.min(gridW / gridSize, gridH / gridSize);
      const offsetX = (w - cellSize * gridSize) / 2;
      const offsetY = (h - cellSize * gridSize) / 2;

      // Compute weights
      let total = 0;
      const weights = cells.map((c) => {
        const dx = c.x - query.x;
        const dy = c.y - query.y;
        const w = gaussian(dx, dy, spread);
        total += w;
        return w;
      });
      // Normalize
      for (let i = 0; i < weights.length; i++) {
        weights[i] /= total || 1;
      }

      const idxFromXY = (x, y) => y * gridSize + x;
      const qIdx = idxFromXY(query.x, query.y);

      // Draw connections from query to others
      const qx = offsetX + query.x * cellSize + cellSize / 2;
      const qy = offsetY + query.y * cellSize + cellSize / 2;
      cells.forEach((c, i) => {
        if (i === qIdx) return;
        const weight = weights[i];
        const alpha = clamp(weight * 4, 0, 0.9);
        if (alpha < 0.02) return;
        const cx = offsetX + c.x * cellSize + cellSize / 2;
        const cy = offsetY + c.y * cellSize + cellSize / 2;
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 0.6 + weight * 6;
        ctx.beginPath();
        ctx.moveTo(qx, qy);
        ctx.lineTo(cx, cy);
        ctx.stroke();
      });

      // Draw cells
      cells.forEach((c, i) => {
        const weight = weights[i];
        const x = offsetX + c.x * cellSize;
        const y = offsetY + c.y * cellSize;
        const isQuery = c.x === query.x && c.y === query.y;

        ctx.fillStyle = isQuery
          ? "#ffffff"
          : `rgba(255,255,255,${0.2 + weight * 0.8})`;
        ctx.strokeStyle = isQuery ? "#ffffff" : "rgba(255,255,255,0.4)";
        ctx.lineWidth = isQuery ? 2 : 1;
        ctx.beginPath();
        ctx.rect(x, y, cellSize, cellSize);
        ctx.fill();
        ctx.stroke();

        // Weight text
        ctx.fillStyle = isQuery ? "#000" : "#000";
        ctx.font = `${Math.max(10, cellSize * 0.25)}px "Inter", system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const wt = (weight * 100).toFixed(1);
        ctx.fillText(isQuery ? "query" : wt + "%", x + cellSize / 2, y + cellSize / 2);
      });

      // Labels
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = `${Math.max(14, h * 0.025)}px "Inter", system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText("Self-attention over pixels", padding * 0.5, padding * 0.7);
      ctx.textAlign = "right";
      ctx.fillText("Weights = softmax(-distance² / 2σ²)", w - padding * 0.5, padding * 0.7);
    }

    function handleClick(e) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const w = canvas.width;
      const h = canvas.height;
      const padding = Math.min(w, h) * 0.12;
      const gridW = w - padding * 2;
      const gridH = h - padding * 2;
      const cellSize = Math.min(gridW / gridSize, gridH / gridSize);
      const offsetX = (w - cellSize * gridSize) / 2;
      const offsetY = (h - cellSize * gridSize) / 2;
      const gx = Math.floor((x - offsetX) / cellSize);
      const gy = Math.floor((y - offsetY) / cellSize);
      if (gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize) {
        setQuery({ x: gx, y: gy });
      }
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    canvas.addEventListener("click", handleClick);

    return () => {
      ro.disconnect();
      canvas.removeEventListener("click", handleClick);
    };
  }, [aspect, cells, gridSize, query, spread]);

  return (
    <div className="spa-explainer" ref={containerRef}>
      <div className="controls">
        <label htmlFor={`${id}-spread`}>Attention spread (σ)</label>
        <input
          id={`${id}-spread`}
          type="range"
          min={0.6}
          max={3}
          step={0.1}
          value={spread}
          onChange={(e) => setSpread(Number(e.target.value))}
        />
        <div className="legend">
          <span>Click any pixel to make it the query.</span>
          <span>Higher σ → flatter attention.</span>
        </div>
      </div>
      <div className="canvas-wrap" style={{ aspectRatio: aspect }}>
        <canvas ref={canvasRef} />
      </div>
      <style jsx>{`
        .spa-explainer { width: 100%; display: flex; flex-direction: column; gap: 0.75rem; }
        .controls { display: flex; flex-direction: column; gap: 0.35rem; color: #f0f0f0; }
        label { font-size: 0.9rem; color: #d8d8d8; }
        input[type="range"] { width: 100%; accent-color: #ffffff; }
        .legend { display: flex; justify-content: space-between; font-size: 0.85rem; color: #b5b5b5; flex-wrap: wrap; gap: 0.25rem; }
        .canvas-wrap { width: 100%; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; overflow: hidden; background: #050505; }
        canvas { width: 100%; height: 100%; display: block; cursor: pointer; }
      `}</style>
    </div>
  );
}
