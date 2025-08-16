// src/components/simcanvas.client.ts
export async function probe(id: string, slug: string) {
  console.log('[SimCanvas] probe start. id:', id, 'slug:', slug);

  const allLoaders = import.meta.glob('/src/interactive/**/loader.{js,ts}');
  console.log('[SimCanvas] discovered loaders:', Object.keys(allLoaders));

  const path = Object.keys(allLoaders).find(p => p.includes(`/${slug}/loader.`));
  console.log('[SimCanvas] resolved path:', path);
  if (!path) return;

  const mod = await allLoaders[path]();
  console.log('[SimCanvas] module imported. keys:', Object.keys(mod));
  const init = (mod as any).default;
  console.log('[SimCanvas] default is function?', typeof init === 'function');
  if (typeof init !== 'function') return;

  const canvas   = document.getElementById(id) as HTMLCanvasElement | null;
  const pauseBtn = document.getElementById(`pause-${id}`);
  const stage    = document.getElementById(`stage-${id}`);
  if (!canvas) {
    console.error('[SimCanvas] canvas not found for id:', id);
    return;
  }

  // ---- init FIRST
  let api: any = null;
  try {
    api = await init(canvas, { button: pauseBtn, stage });
  } catch (e) {
    console.error('[SimCanvas] loader init failed:', e);
    return;
  }

  // ---- then wire controls (api now initialized)
  if (pauseBtn) {
    let running = true;
    pauseBtn.textContent = 'Pause';
    pauseBtn.onclick = () => {
      running = !running;
      if (running) { api?.start?.(); pauseBtn.textContent = 'Pause'; }
      else         { api?.stop?.();  pauseBtn.textContent = 'Play';  }
    };
  }
}