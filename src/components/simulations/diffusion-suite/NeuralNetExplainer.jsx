import { useEffect, useRef } from "react";

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export default function NeuralNetExplainer({
  layers = [4, 7, 7, 3],
  aspect = "16 / 9",
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const boundsRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");

    function resize() {
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = w / eval(aspect);
      boundsRef.current = { w, h };
      canvas.width = w;
      canvas.height = h;
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const nodes = [];
    const maxLayerSize = Math.max(...layers);
    layers.forEach((count, i) => {
      for (let j = 0; j < count; j++) {
        nodes.push({ layer: i, idx: j, count });
      }
    });

    const connections = [];
    for (let li = 0; li < layers.length - 1; li++) {
      const aCount = layers[li];
      const bCount = layers[li + 1];
      for (let ai = 0; ai < aCount; ai++) {
        for (let bi = 0; bi < bCount; bi++) {
          connections.push({ a: { layer: li, idx: ai, count: aCount }, b: { layer: li + 1, idx: bi, count: bCount } });
        }
      }
    }

    function pos(node) {
      const { w, h } = boundsRef.current;
      const x = lerp(w * 0.08, w * 0.92, node.layer / (layers.length - 1));
      const spread = Math.min(h * 0.7, h * (node.count / maxLayerSize));
      const top = (h - spread) / 2;
      const y = top + (node.idx + 0.5) * (spread / node.count);
      return { x, y };
    }

    let t0 = performance.now();

    function draw(now) {
      const { w, h } = boundsRef.current;
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);

      // Background gradient (monochrome)
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#050505");
      g.addColorStop(1, "#111");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Connections with animated pulses
      ctx.lineWidth = 1.2;
      connections.forEach((c, idx) => {
        const a = pos(c.a);
        const b = pos(c.b);
        const pulse = (Math.sin(t * 2 + idx * 0.3) + 1) / 2;
        const alpha = 0.25 + pulse * 0.35;
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        // pulse dot
        const p = pulse * 0.7 + 0.15;
        const px = lerp(a.x, b.x, p);
        const py = lerp(a.y, b.y, p);
        const radius = 2 + pulse * 2;
        ctx.fillStyle = `rgba(255,255,255, ${0.6 + pulse * 0.4})`;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Nodes
      nodes.forEach((n, idx) => {
        const { x, y } = pos(n);
        const pulse = (Math.sin(t * 3 + idx * 0.7) + 1) / 2;
        const r = 9 + pulse * 2;
        ctx.fillStyle = "#0b0b0b";
        ctx.beginPath();
        ctx.arc(x, y, r + 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,255, ${0.6 + pulse * 0.35})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Labels
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = `${Math.max(12, h * 0.03)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText("Input", lerp(boundsRef.current.w * 0.08, boundsRef.current.w * 0.92, 0), h * 0.12);
      ctx.fillText("Hidden", lerp(boundsRef.current.w * 0.08, boundsRef.current.w * 0.92, 0.5), h * 0.12);
      ctx.fillText("Output", lerp(boundsRef.current.w * 0.08, boundsRef.current.w * 0.92, 1), h * 0.12);

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [aspect, layers]);

  return (
    <div className="nn-explainer" ref={containerRef}>
      <div className="nn-canvas-wrap" style={{ aspectRatio: aspect }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
