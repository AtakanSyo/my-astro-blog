import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';
import remarkSlug from 'remark-slug';
import remarkAutolinkHeadings from 'remark-autolink-headings';
import remarkInternalLinks from './src/plugins/remark-internal-links.js';

export default defineConfig({
  site: 'https://astrosyo.com',
  integrations: [
    mdx({
      remarkPlugins: [
        remarkSlug,
        remarkAutolinkHeadings,
      ],
    }),
    sitemap(),
    react(),
    icon({ collections: ['logos','bi','feather','ion'] }),
  ],
  vite: { plugins: [tailwindcss()] },
});