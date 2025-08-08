export default async function init(canvas, pauseBtn, opts = {}) {
  if (!canvas) return;
  const preferGPU = opts.preferWebGPU || new URLSearchParams(location.search).get('gpu') === '1';

  // Pause
  let paused = false;
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      paused = !paused;
      pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    });
  }

  // Fit canvas
  const fit = () => {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w)  canvas.width  = w;
    if (canvas.height !== h) canvas.height = h;
  };
  const ro = new ResizeObserver(fit); ro.observe(canvas); fit();

  try {
    if (preferGPU && 'gpu' in navigator) {
      const ad = await navigator.gpu.requestAdapter();
      if (ad) {
        const mod = await import('/scripts/nebula-webgpu_core.js');
        return mod.run(canvas, { pausedRef: () => paused });
      }
    }
    // Default path (widest support): WebGL2 / Three.js
    const mod = await import('/scripts/nebula-webgl2_three.js');
    return mod.run(canvas, { pausedRef: () => paused });
  } catch (err) {
    console.error('nebula-hybrid init failed', err);
    // As a last resort, minimal 2D message:
    const mod = await import('/scripts/nebula-webgl2_fallback.js');
    return mod.run(canvas, { pausedRef: () => paused });
  }
}