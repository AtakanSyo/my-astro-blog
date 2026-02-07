import { useEffect, useMemo, useRef, useState } from "react";

// Monochrome Markov chain explainer with adjustable transition probabilities
export default function MarkovChainExplainer({
  id = "markov-chain-explainer",
  aspect = "16 / 9",
  states = ["A", "B", "C"],
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [pAB, setPab] = useState(0.5);
  const [pBC, setPbc] = useState(0.5);
  const [pCA, setPca] = useState(0.5);
  const [steps, setSteps] = useState(6);
  const [path, setPath] = useState([]);

  const positions = useMemo(() => {
    // Arrange states on a circle
    return states.map((_, i) => {
      const angle = (i / states.length) * Math.PI * 2 - Math.PI / 2;
      return { angle };
    });
  }, [states.length]);

  useEffect(() => {
    setPath(generatePath());
  }, [pAB, pBC, pCA, steps]);

  function generatePath() {
    // Start at state 0 (A)
    const out = [0];
    const probs = [
      [1 - pAB, pAB, 0], // A -> A or B
      [0, 1 - pBC, pBC], // B -> B or C
      [pCA, 0, 1 - pCA], // C -> A or C
    ];
    for (let i = 0; i < steps - 1; i++) {
      const cur = out[out.length - 1];
      const r = Math.random();
      let acc = 0;
      for (let j = 0; j < states.length; j++) {
        acc += probs[cur][j] || 0;
        if (r <= acc) {
          out.push(j);
          break;
        }
      }
    }
    return out;
  }

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

      // Background
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#080808");
      g.addColorStop(1, "#111");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const radius = Math.min(w, h) * 0.28;
      const cx = w / 2;
      const cy = h / 2;

      // State positions
      const statePos = positions.map((p) => ({
        x: cx + radius * Math.cos(p.angle),
        y: cy + radius * Math.sin(p.angle),
      }));

      // Transitions (directed)
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.6;
      const drawArrow = (x1, y1, x2, y2, weight) => {
        if (weight <= 0) return;
        const alpha = 0.2 + weight * 0.8;
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = 1 + weight * 3;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const ah = 8 + weight * 6;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - ah * Math.cos(angle - Math.PI / 7), y2 - ah * Math.sin(angle - Math.PI / 7));
        ctx.lineTo(x2 - ah * Math.cos(angle + Math.PI / 7), y2 - ah * Math.sin(angle + Math.PI / 7));
        ctx.closePath();
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
      };

      // A->B, B->C, C->A
      drawArrow(statePos[0].x, statePos[0].y, statePos[1].x, statePos[1].y, pAB);
      drawArrow(statePos[1].x, statePos[1].y, statePos[2].x, statePos[2].y, pBC);
      drawArrow(statePos[2].x, statePos[2].y, statePos[0].x, statePos[0].y, pCA);

      // Self loops
      const loop = (i, weight) => {
        const { x, y } = statePos[i];
        const r = 26;
        ctx.strokeStyle = `rgba(255,255,255,${0.15 + weight * 0.5})`;
        ctx.lineWidth = 1 + weight * 2;
        ctx.beginPath();
        ctx.arc(x + 6, y - 6, r, Math.PI * 0.2, Math.PI * 1.7);
        ctx.stroke();
      };
      loop(0, 1 - pAB);
      loop(1, 1 - pBC);
      loop(2, 1 - pCA);

      // States
      statePos.forEach((p, i) => {
        const isStart = i === 0;
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.font = `${Math.max(13, h * 0.03)}px "Inter", system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(states[i], p.x, p.y - 6);
        ctx.fillText(isStart ? "start" : "", p.x, p.y + 12);
      });

      // Sampled path
      if (path.length > 1) {
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        const first = statePos[path[0]];
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < path.length; i++) {
          const p = statePos[path[i]];
          ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();

        path.forEach((idx, i) => {
          const p = statePos[idx];
          ctx.fillStyle = i === path.length - 1 ? "#ffffff" : "rgba(255,255,255,0.8)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Labels
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = `${Math.max(13, h * 0.025)}px "Inter", system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.fillText("Markov chain transitions", 14, 24);
      ctx.textAlign = "right";
      ctx.fillText(`steps shown: ${steps}`, w - 14, 24);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [aspect, pAB, pBC, pCA, path, positions, states.length, steps]);

  return (
    <div className="mc-explainer" ref={containerRef}>
      <div className="controls">
        <label htmlFor={`${id}-pab`}>P(A→B)</label>
        <input
          id={`${id}-pab`}
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={pAB}
          onChange={(e) => setPab(Number(e.target.value))}
        />
        <label htmlFor={`${id}-pbc`}>P(B→C)</label>
        <input
          id={`${id}-pbc`}
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={pBC}
          onChange={(e) => setPbc(Number(e.target.value))}
        />
        <label htmlFor={`${id}-pca`}>P(C→A)</label>
        <input
          id={`${id}-pca`}
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={pCA}
          onChange={(e) => setPca(Number(e.target.value))}
        />
        <label htmlFor={`${id}-steps`}>Steps</label>
        <input
          id={`${id}-steps`}
          type="range"
          min={3}
          max={12}
          step={1}
          value={steps}
          onChange={(e) => setSteps(Number(e.target.value))}
        />
        <div className="legend">
          <span>Adjust transition weights.</span>
          <span>Path shows one sampled trajectory.</span>
        </div>
      </div>
      <div className="canvas-wrap" style={{ aspectRatio: aspect }}>
        <canvas ref={canvasRef} />
      </div>
      <style jsx>{`
        .mc-explainer { width: 100%; display: flex; flex-direction: column; gap: 0.75rem; }
        .controls { display: flex; flex-direction: column; gap: 0.25rem; color: #f0f0f0; }
        label { font-size: 0.9rem; color: #d8d8d8; }
        input[type="range"] { width: 100%; accent-color: #ffffff; }
        .legend { display: flex; justify-content: space-between; font-size: 0.85rem; color: #b5b5b5; flex-wrap: wrap; gap: 0.25rem; }
        .canvas-wrap { width: 100%; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; overflow: hidden; background: #050505; }
        canvas { width: 100%; height: 100%; display: block; }
      `}</style>
    </div>
  );
}
