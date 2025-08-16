export async function probe(id: string, slug: string) {
  console.log('[SimCanvas] probe start. id:', id, 'slug:', slug);

  // Vite transforms this (because this file is under /src and is bundled)
  const allLoaders = import.meta.glob('/src/interactive/**/loader.{js,ts}');
  console.log('[SimCanvas] discovered loaders:', Object.keys(allLoaders));

  const path = Object.keys(allLoaders).find(p => p.includes(`/${slug}/loader.`));
  console.log('[SimCanvas] resolved path:', path);

  if (!path) return;

  const mod = await allLoaders[path]();
  console.log('[SimCanvas] module imported. keys:', Object.keys(mod));
  console.log('[SimCanvas] default is function?', typeof ((mod as any).default || mod) === 'function');
}