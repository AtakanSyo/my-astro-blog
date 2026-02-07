import { useEffect, useRef, useState } from "react";

export default function GateExplainer({
  gate = "ReLU",
  inputs = [1, 0],
  aspect = "16 / 9",
  id = "gate-explainer",
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");

    function resize() {
      const { width } = container.getBoundingClientRect();
      const w = width;
      const h = width / eval(aspect);
      canvas.width = w;
      canvas.height = h;
      draw();
    }

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    let lastPulse = performance.now();

    function draw(timestamp) {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // bg
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);

      const gateX = w * 0.5;
      const gateY = h * 0.5;
      const gateW = Math.min(140, w * 0.25);
      const gateH = Math.min(120, h * 0.3);

      // inputs positions
      const inputPositions = inputs.map((_, idx) => {
        const spread = inputs.length > 1 ? (inputs.length - 1) : 1;
        const y = gateY + (idx - spread / 2) * (gateH / Math.max(inputs.length, 2));
        return { x: w * 0.2, y };
      });
      const outputPos = { x: w * 0.8, y: gateY };

      // synchronized pulses
      const cycle = 2500; // ms
      const phase = ((timestamp || 0) % cycle) / cycle; // 0..1
      const inputT = Math.min(phase / 0.5, 1); // 0->1 in first half
      const outputT = phase <= 0.5 ? 0 : Math.min((phase - 0.5) / 0.5, 1); // start after inputs arrive

      // wires
      ctx.lineWidth = 3;
      inputPositions.forEach((p) => {
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(gateX - gateW * 0.5, p.y);
        ctx.stroke();

        // pulse moving toward gate in sync
        const px = p.x + (gateX - gateW * 0.5 - p.x) * inputT;
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(px, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
      });

      // gate box
      ctx.fillStyle = "#0d0d0d";
      ctx.strokeStyle = "white";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.rect(gateX - gateW * 0.5, gateY - gateH * 0.5, gateW, gateH);
      ctx.fill();
      ctx.stroke();

      // gate text
      ctx.fillStyle = "white";
      ctx.font = `${Math.max(20, gateW * 0.24)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("ReLU", gateX, gateY);

      // output wire
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.moveTo(gateX + gateW * 0.5, gateY);
      ctx.lineTo(outputPos.x, outputPos.y);
      ctx.stroke();

      // output pulse
      const ox = gateX + gateW * 0.5 + (outputPos.x - (gateX + gateW * 0.5)) * outputT;
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(ox, outputPos.y, 7, 0, Math.PI * 2);
      ctx.fill();

      // small ReLU plot in bottom-right
      const summed = inputs.reduce((a, b) => a + b, 0);
      const relu = Math.max(0, summed);
      const plotW = Math.min(180, w * 0.28);
      const plotH = Math.min(120, h * 0.22);
      const plotX = w - plotW - 16;
      const plotY = h - plotH - 16;

      ctx.save();
      ctx.translate(plotX, plotY);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); // axes
      ctx.moveTo(0, plotH);
      ctx.lineTo(plotW, plotH);
      ctx.moveTo(plotW * 0.25, plotH * 0.95);
      ctx.lineTo(plotW * 0.25, 0);
      ctx.stroke();

      // ReLU curve
      ctx.strokeStyle = "white";
      ctx.beginPath();
      ctx.moveTo(0, plotH);
      ctx.lineTo(plotW * 0.25, plotH);
      ctx.lineTo(plotW, 0);
      ctx.stroke();

      // plot point for current sum
      const normX = Math.max(-1, Math.min(3, summed));
      const px = plotW * 0.25 + (normX / 3) * (plotW * 0.75);
      const py = normX < 0 ? plotH : plotH - (Math.max(0, normX) / 3) * plotH;
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();

      // output value as bar
      const barH = (relu / 3) * plotH;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(plotW + 8, plotH - barH, 8, barH);
      ctx.restore();

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    const pulseInterval = setInterval(() => setTick((t) => t + 1), 1200);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearInterval(pulseInterval);
      ro.disconnect();
    };
  }, [aspect, gate, inputs]);

  return (
    <div className="nn-explainer" ref={containerRef}>
      <div className="nn-canvas-wrap" style={{ aspectRatio: aspect }}>
        <canvas ref={canvasRef} aria-label={`${gate} logic gate visualization`} />
      </div>
      <p className="nn-caption">
        A single {gate.toUpperCase()} gate: signals enter from the left, combine in the gate, and produce one output on the right.
      </p>
    </div>
  );
}
