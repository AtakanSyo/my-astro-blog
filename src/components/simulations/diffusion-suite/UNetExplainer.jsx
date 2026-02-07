import { useEffect, useRef, useState } from "react";

// Simple monochrome U-Net explainer with a progress slider
export default function UNetExplainer({
  id = "unet-explainer",
  aspect = "16 / 9",
  depth = 4, // encoder levels
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [progress, setProgress] = useState(0.3); // 0 encoder, 1 decoder

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
      g.addColorStop(1, "#121212");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const padX = w * 0.08;
      const padY = h * 0.12;
      const usableW = w - padX * 2;
      const usableH = h - padY * 2;

      const levels = depth;
      const totalStages = levels * 2 + 1; // enc levels + bottleneck + dec levels
      const activeStage = Math.round(progress * (totalStages - 1));
      const blockW = usableW / (levels * 2 + 1);
      const blockHBase = usableH * 0.6;

      const alphaHighlight = 0.9;
      const alphaDim = 0.25;

      ctx.lineWidth = 2;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Encoder blocks
      for (let i = 0; i < levels; i++) {
        const x = padX + i * blockW;
        const scale = 1 - i * 0.15;
        const bh = blockHBase * scale;
        const y = padY + (usableH - bh) / 2;
        const active = activeStage === i;
        ctx.fillStyle = `rgba(255,255,255,${active ? alphaHighlight : alphaDim})`;
        ctx.strokeStyle = `rgba(255,255,255,${active ? alphaHighlight : alphaDim})`;
        ctx.beginPath();
        ctx.roundRect(x, y, blockW * 0.9, bh, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = active ? "#000" : "rgba(0,0,0,0.6)";
        ctx.font = `${Math.max(10, h * 0.03)}px "Inter", system-ui, sans-serif`;
        ctx.fillText(`Conv ${i + 1}`, x + blockW * 0.45, y + bh / 2);

        // Down arrow
        ctx.strokeStyle = `rgba(255,255,255,${alphaDim})`;
        ctx.beginPath();
        ctx.moveTo(x + blockW * 0.45, y + bh + 8);
        ctx.lineTo(x + blockW * 0.45, y + bh + 24);
        ctx.lineTo(x + blockW * 0.35, y + bh + 14);
        ctx.moveTo(x + blockW * 0.45, y + bh + 24);
        ctx.lineTo(x + blockW * 0.55, y + bh + 14);
        ctx.stroke();
      }

      // Decoder blocks
      for (let i = 0; i < levels; i++) {
        const x = padX + (levels + 1 + i) * blockW;
        const scale = 1 - (levels - 1 - i) * 0.15;
        const bh = blockHBase * scale;
        const y = padY + (usableH - bh) / 2;
        const active = activeStage === levels + 1 + i;
        ctx.fillStyle = `rgba(255,255,255,${active ? alphaHighlight : alphaDim})`;
        ctx.strokeStyle = `rgba(255,255,255,${active ? alphaHighlight : alphaDim})`;
        ctx.beginPath();
        ctx.roundRect(x, y, blockW * 0.9, bh, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = active ? "#000" : "rgba(0,0,0,0.6)";
        ctx.font = `${Math.max(10, h * 0.03)}px "Inter", system-ui, sans-serif`;
        ctx.fillText(`Up ${i + 1}`, x + blockW * 0.45, y + bh / 2);

        // Up arrow
        ctx.strokeStyle = `rgba(255,255,255,${alphaDim})`;
        ctx.beginPath();
        ctx.moveTo(x + blockW * 0.45, y - 24);
        ctx.lineTo(x + blockW * 0.45, y - 8);
        ctx.lineTo(x + blockW * 0.35, y - 18);
        ctx.moveTo(x + blockW * 0.45, y - 8);
        ctx.lineTo(x + blockW * 0.55, y - 18);
        ctx.stroke();
      }

      // Bottleneck
      const midX = padX + levels * blockW;
      const bScale = 1 - (levels - 1) * 0.15 - 0.05;
      const bH = blockHBase * bScale;
      const bY = padY + (usableH - bH) / 2;
      const bottleneckActive = activeStage === levels;
      ctx.fillStyle = `rgba(255,255,255,${bottleneckActive ? alphaHighlight : alphaDim})`;
      ctx.strokeStyle = `rgba(255,255,255,${bottleneckActive ? alphaHighlight : alphaDim})`;
      ctx.beginPath();
      ctx.roundRect(midX, bY, blockW * 0.9, bH, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = bottleneckActive ? "#000" : "rgba(0,0,0,0.6)";
      ctx.font = `${Math.max(10, h * 0.03)}px "Inter", system-ui, sans-serif`;
      ctx.fillText("Bottleneck", midX + blockW * 0.45, bY + bH / 2);

      // Skip connections
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < levels; i++) {
        const encX = padX + i * blockW + blockW * 0.9;
        const encY = padY + (usableH - blockHBase * (1 - i * 0.15)) / 2 + blockHBase * (1 - i * 0.15) / 2;
        const decX = padX + (levels + 1 + (levels - 1 - i)) * blockW;
        const decY = padY + (usableH - blockHBase * (1 - i * 0.15)) / 2 + blockHBase * (1 - i * 0.15) / 2;
        ctx.beginPath();
        ctx.moveTo(encX, encY);
        ctx.lineTo(decX, decY);
        ctx.stroke();
      }

      // Labels
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.textAlign = "left";
      ctx.font = `${Math.max(14, h * 0.025)}px "Inter", system-ui, sans-serif`;
      ctx.fillText("Encoder", padX, padY * 0.7);
      ctx.textAlign = "right";
      ctx.fillText("Decoder", w - padX, padY * 0.7);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [aspect, depth, progress]);

  return (
    <div className="unet-explainer" ref={containerRef}>
      <div className="controls">
        <label htmlFor={`${id}-progress`}>Forward / reverse pass</label>
        <input
          id={`${id}-progress`}
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={progress}
          onChange={(e) => setProgress(Number(e.target.value))}
        />
        <div className="legend">
          <span>Left: downsampling encoder.</span>
          <span>Right: upsampling decoder with skip links.</span>
        </div>
      </div>
      <div className="canvas-wrap" style={{ aspectRatio: aspect }}>
        <canvas ref={canvasRef} />
      </div>
      <style jsx>{`
        .unet-explainer { width: 100%; display: flex; flex-direction: column; gap: 0.75rem; }
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
