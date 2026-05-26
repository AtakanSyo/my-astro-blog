import { useEffect, useRef } from "react";

export default function GateExplainer({
  gate = "ReLU",
  inputs = [1, 0],
  aspect = "16 / 9",
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

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

    function draw(timestamp) {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

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

      ctx.fillStyle = "#0d0d0d";
      ctx.strokeStyle = "white";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.rect(gateX - gateW * 0.5, gateY - gateH * 0.5, gateW, gateH);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "white";
      ctx.font = `${Math.max(20, gateW * 0.24)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(gate.toUpperCase(), gateX, gateY);

      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.moveTo(gateX + gateW * 0.5, gateY);
      ctx.lineTo(outputPos.x, outputPos.y);
      ctx.stroke();

      const gateUpper = gate.toUpperCase();
      const asBool = inputs.map((v) => v >= 0.5);
      const sum = inputs.reduce((a, b) => a + b, 0);

      let outputValue = 0;
      switch (gateUpper) {
        case "AND":
          outputValue = asBool.every(Boolean) ? 1 : 0;
          break;
        case "OR":
          outputValue = asBool.some(Boolean) ? 1 : 0;
          break;
        case "XOR":
          outputValue = asBool.filter(Boolean).length % 2;
          break;
        case "NAND":
          outputValue = asBool.every(Boolean) ? 0 : 1;
          break;
        case "NOR":
          outputValue = asBool.some(Boolean) ? 0 : 1;
          break;
        case "XNOR":
          outputValue = asBool.filter(Boolean).length % 2 ? 0 : 1;
          break;
        case "NOT":
          outputValue = asBool.length ? (asBool[0] ? 0 : 1) : 0;
          break;
        case "SIGMOID":
          outputValue = 1 / (1 + Math.exp(-sum));
          break;
        case "TANH":
          outputValue = Math.tanh(sum);
          break;
        case "SOFTPLUS":
          outputValue = Math.log1p(Math.exp(sum));
          break;
        case "RELU":
          outputValue = Math.max(0, sum);
          break;
        default:
          outputValue = sum > 0 ? 1 : 0;
      }

      const ox =
        gateX +
        gateW * 0.5 +
        (outputPos.x - (gateX + gateW * 0.5)) * outputT;
      const isActivation = ["RELU", "SIGMOID", "TANH", "SOFTPLUS"].includes(
        gateUpper
      );
      ctx.fillStyle =
        isActivation || outputValue > 0 ? "#6bf0c9" : "#666";
      ctx.beginPath();
      const pulseR = isActivation
        ? 7 + Math.min(12, Math.abs(outputValue) * 4)
        : 7;
      ctx.arc(ox, outputPos.y, pulseR, 0, Math.PI * 2);
      ctx.fill();

      const plotW = Math.min(180, w * 0.28);
      const plotH = Math.min(120, h * 0.22);
      const plotX = w - plotW - 16;
      const plotY = h - plotH - 16;

      ctx.save();
      ctx.translate(plotX, plotY);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1.3;
      ctx.fillStyle = "rgba(13,13,13,0.8)";
      ctx.fillRect(0, 0, plotW, plotH);
      ctx.strokeRect(0, 0, plotW, plotH);

      if (["RELU", "SIGMOID", "TANH", "SOFTPLUS"].includes(gateUpper)) {
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.moveTo(0, plotH - 14);
        ctx.lineTo(plotW, plotH - 14);
        ctx.moveTo(plotW * 0.18, plotH - 4);
        ctx.lineTo(plotW * 0.18, 10);
        ctx.stroke();

        ctx.strokeStyle = "white";
        ctx.beginPath();
        const samples = 48;
        for (let i = 0; i <= samples; i++) {
          const t = i / samples; // 0..1
          const x = -4 + t * 8; // map to [-4,4]
          let y = 0;
          switch (gateUpper) {
            case "SIGMOID":
              y = 1 / (1 + Math.exp(-x));
              break;
            case "TANH":
              y = Math.tanh(x);
              break;
            case "SOFTPLUS":
              y = Math.log1p(Math.exp(x));
              // normalize softplus to ~0..3 range
              y = Math.min(3, y) / 3;
              break;
            case "RELU":
            default:
              y = Math.max(0, x) / 3;
          }
          const px = plotW * 0.18 + t * (plotW * 0.78);
          const py = plotH - 14 - y * (plotH - 26);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        const normX = Math.max(-4, Math.min(4, sum));
        let normY = 0;
        switch (gateUpper) {
          case "SIGMOID":
            normY = 1 / (1 + Math.exp(-normX));
            break;
          case "TANH":
            normY = Math.tanh(normX);
            normY = (normY + 1) / 2; // shift to 0..1 for plotting
            break;
          case "SOFTPLUS":
            normY = Math.log1p(Math.exp(normX));
            normY = Math.min(3, normY) / 3;
            break;
          case "RELU":
          default:
            normY = Math.max(0, normX) / 3;
        }
        const px =
          plotW * 0.18 + ((normX + 4) / 8) * (plotW * 0.78);
        const py = plotH - 14 - normY * (plotH - 26);
        ctx.fillStyle = "#6bf0c9";
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const rows = [
          { a: 0, b: 0 },
          { a: 0, b: 1 },
          { a: 1, b: 0 },
          { a: 1, b: 1 },
        ];
        const cellH = plotH / rows.length;
        ctx.font = "12px Inter, system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        rows.forEach((row, i) => {
          const active =
            (asBool[0] ? 1 : 0) === row.a && (asBool[1] ? 1 : 0) === row.b;
          ctx.fillStyle = active ? "rgba(107,240,201,0.15)" : "transparent";
          ctx.fillRect(0, i * cellH, plotW, cellH);
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          const rowOut = (() => {
            switch (gateUpper) {
              case "AND":
                return row.a && row.b ? 1 : 0;
              case "OR":
                return row.a || row.b ? 1 : 0;
              case "XOR":
                return (row.a + row.b) % 2;
              case "NAND":
                return row.a && row.b ? 0 : 1;
              case "NOR":
                return row.a || row.b ? 0 : 1;
              case "XNOR":
                return (row.a + row.b) % 2 ? 0 : 1;
              default:
                return row.a || row.b ? 1 : 0;
            }
          })();
          const text = `${row.a} ${row.b} → ${rowOut}`;
          ctx.fillText(text, 10, i * cellH + cellH / 2);
        });
      }
      ctx.restore();

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [aspect, gate, inputs]);

  return (
    <div className="nn-explainer" ref={containerRef}>
      <div className="nn-canvas-wrap" style={{ aspectRatio: aspect }}>
        <canvas ref={canvasRef} aria-label={`${gate} logic gate visualization`} />
      </div>
    </div>
  );
}
