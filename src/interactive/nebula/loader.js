// Hybrid loader: WebGPU if available (and ./webgpu.js exists), else WebGL2 (./runtime.js)
export default async function init(canvas, pauseBtn, opts = {}) {
  if (!canvas) return;

  // ---- Pause toggle ----
  let paused = true;
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      paused = !paused;
      pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    });
  }

  // ---- Fit canvas (cap DPR for perf) ----
  const DPR_CAP = opts.dprCap ?? 1.5;
  const fit = () => {
    const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w)  canvas.width  = w;
    if (canvas.height !== h) canvas.height = h;
  };
  const ro = new ResizeObserver(fit);
  ro.observe(canvas);
  fit();

  const pausedRef = () => paused;

  // ---- URL overrides: ?gpu=1 (force WebGPU), ?gpu=0 (force WebGL2) ----
  const q = new URLSearchParams(location.search);
  const force = q.get('gpu'); // "1" | "0" | null

  async function tryWebGPU() {
    if (!('gpu' in navigator)) return false;
    let adapter;
    try { adapter = await navigator.gpu.requestAdapter(); } catch { /* ignore */ }
    if (!adapter) return false;

    try {
      // If webgpu.js is missing (404) or errors, this will throw — we’ll fall back.
      const mod = await import('./webgpu.js');
      if (typeof mod.run !== 'function') throw new Error('webgpu.js missing export run()');
      await mod.run(canvas, { pausedRef, adapter, options: opts });
      console.info('[loader] WebGPU path active');
      return true;
    } catch (e) {
      console.warn('[loader] WebGPU path unavailable → fallback to WebGL2', e?.message || e);
      return false;
    }
  }

  // ---- Decide & run ----
  try {
    let ran = false;

    if (force === '1') {
      ran = await tryWebGPU();
      if (!ran) console.warn('[loader] Forced WebGPU failed; falling back to WebGL2');
    } else if (force === '0') {
      ran = false; // skip GPU path
    } else {
      // Auto: prefer WebGPU if it actually works (and file exists)
      ran = await tryWebGPU();
    }

    if (!ran) {
      const mod = await import('./runtime.js'); // WebGL2 / Three.js
      if (typeof mod.run !== 'function') throw new Error('runtime.js missing export run()');
      await mod.run(canvas, { pausedRef, options: opts });
      console.info('[loader] WebGL2 (Three.js) path active');
    }
  } catch (err) {
    console.error('[loader] init failed:', err);
    // Last-resort: draw a tiny message so users don’t see a blank box
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0a0f16'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff'; ctx.font = '12px system-ui';
      ctx.fillText('Could not load the simulation.', 14, 24);
    }
  }

  // Optional cleanup for SPA navigations
  return () => ro.disconnect();
}