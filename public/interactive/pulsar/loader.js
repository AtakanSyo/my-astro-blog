// Minimal loader: always use the Three.js WebGL2 runtime for now.
export default async function init(canvas, pauseBtn) {
  if (!canvas) return;

  let paused = false;
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      paused = !paused;
      pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    });
  }

  const fit = () => {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w)  canvas.width  = w;
    if (canvas.height !== h) canvas.height = h;
  };
  const ro = new ResizeObserver(fit); ro.observe(canvas); fit();

  try {
    // NOTE: relative import within the post folder
    const mod = await import('./runtime.js');
    await mod.run(canvas, { pausedRef: () => paused });
  } catch (err) {
    console.error('nebula loader failed:', err);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0a0f16'; ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#fff'; ctx.font = '12px system-ui';
      ctx.fillText('Could not load the 3D runtime.', 14, 24);
    }
  }
}