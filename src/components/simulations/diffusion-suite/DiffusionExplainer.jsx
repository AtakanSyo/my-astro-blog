import { useEffect, useMemo, useRef, useState } from 'react';

// Tiny seeded PRNG so noise is deterministic per render
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makeNoiseCanvas(w, h, seed = 1) {
  const noise = document.createElement('canvas');
  noise.width = w;
  noise.height = h;
  const ctx = noise.getContext('2d');
  const img = ctx.createImageData(w, h);
  const rand = mulberry32(seed);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = Math.floor(rand() * 255);
    img.data[i] = n;
    img.data[i + 1] = n;
    img.data[i + 2] = n;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return noise;
}

export default function DiffusionExplainer({
  id = 'diffusion-explainer',
  aspect = '16 / 9',
  steps = 12,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [step, setStep] = useState(Math.floor(steps / 2));
  const [seed] = useState(() => Math.floor(Math.random() * 1e6));

  const memoSteps = Math.max(2, steps);

  const baseDraw = useMemo(() => {
    return (ctx, w, h) => {
      // Background
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#0a0a0a');
      grad.addColorStop(1, '#121212');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Signal: concentric blobs + text to represent "data"
      const cx = w * 0.5;
      const cy = h * 0.5;
      const radius = Math.min(w, h) * 0.22;

      const radial = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 1.4);
      radial.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      radial.addColorStop(0.4, 'rgba(255, 255, 255, 0.45)');
      radial.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
      ctx.fillStyle = radial;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `${Math.max(22, Math.min(w, h) * 0.05)}px "Inter", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('data', cx, cy + 8);

      // Small dots to hint at structure
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 26; i++) {
        const t = i / 26 * Math.PI * 2;
        const r = radius * (0.5 + (i % 5) * 0.07);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(t) * r, cy + Math.sin(t) * r, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    let noise = makeNoiseCanvas(32, 32, seed);

    function resize() {
      const { width } = container.getBoundingClientRect();
      const targetW = width;
      const targetH = width / (eval(aspect));
      canvas.width = targetW;
      canvas.height = targetH;
      // Upscale a small noise texture for speed
      noise = makeNoiseCanvas(Math.max(64, Math.floor(targetW / 4)), Math.max(64, Math.floor(targetH / 4)), seed);
      draw();
    }

    function draw() {
      const w = canvas.width;
      const h = canvas.height;
      const progress = step / (memoSteps - 1); // 0 noisy -> 1 clean
      const noiseLevel = 1 - progress;

      baseDraw(ctx, w, h);

      ctx.save();
      ctx.globalAlpha = noiseLevel;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(noise, 0, 0, w, h);
      ctx.restore();

      // Overlay labels
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '14px "Inter", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Step ${step} / ${memoSteps - 1}`, 12, h - 14);
      ctx.textAlign = 'right';
      ctx.fillText(noiseLevel > 0.5 ? 'Forward: add noise' : 'Reverse: denoise', w - 12, h - 14);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => {
      ro.disconnect();
    };
  }, [aspect, baseDraw, memoSteps, seed, step]);

  return (
    <div className="diffusion-explainer" ref={containerRef}>
      <div className="controls">
        <label htmlFor={`${id}-slider`}>Reverse step</label>
        <input
          id={`${id}-slider`}
          type="range"
          min={0}
          max={memoSteps - 1}
          step={1}
          value={step}
          onChange={(e) => setStep(Number(e.target.value))}
        />
        <div className="legend">
          <span>
            t = {memoSteps - 1 - step}
            {memoSteps - 1 - step === memoSteps - 1
              ? ' (noisiest)'
              : memoSteps - 1 - step === 0
              ? ' (clean)'
              : ''}
          </span>
          <span>→</span>
          <span>clean sample</span>
        </div>
      </div>
      <div className="canvas-wrap" style={{ aspectRatio: aspect }}>
        <canvas ref={canvasRef} />
      </div>
      <style>{`
        .diffusion-explainer { width: 100%; display: flex; flex-direction: column; gap: 0.75rem; }
        .controls { display: flex; flex-direction: column; gap: 0.25rem; color: #f0f0f0; }
        label { font-size: 0.9rem; color: #d8d8d8; }
        input[type="range"] {
          width: 100%;
          accent-color: #ffffff;
          height: 10px;
          background: linear-gradient(90deg, #000 0%, #fff 100%);
          border-radius: 999px;
          outline: none;
        }
        input[type="range"]::-webkit-slider-runnable-track {
          height: 10px;
          background: linear-gradient(90deg, #000 0%, #fff 100%);
          border-radius: 999px;
          border: 1px solid #1a1a1a;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #ffffff;
          border: 2px solid #000000;
          margin-top: -4px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
        }
        input[type="range"]::-moz-range-track {
          height: 10px;
          background: linear-gradient(90deg, #000 0%, #fff 100%);
          border-radius: 999px;
          border: 1px solid #1a1a1a;
        }
        input[type="range"]::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #ffffff;
          border: 2px solid #000000;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
        }
        .legend { display: flex; justify-content: space-between; font-size: 0.85rem; color: #b5b5b5; }
        .canvas-wrap { width: 100%; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; overflow: hidden; background: #050505; }
        canvas { width: 100%; height: 100%; display: block; }
        .caption { color: #dcdcdc; font-size: 0.95rem; line-height: 1.45; }
      `}</style>
    </div>
  );
}
