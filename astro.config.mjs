import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';
import remarkSlug from 'remark-slug';
import remarkAutolinkHeadings from 'remark-autolink-headings';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import forceUtf8ForHtml from "./src/plugins/vite-plugin-force-utf8.js";

export default defineConfig({
  site: 'https://astrosyo.com',
  integrations: [
    mdx({
      remarkPlugins: [
        [remarkMath, { singleDollarTextMath: false }], // << disable $...$ inline math
        remarkSlug,
        remarkAutolinkHeadings,
      ],
      rehypePlugins: [
        rehypeKatex,
      ],
    }),
    sitemap(),
    react(),
    icon({ collections: ['logos','bi','feather','ion'] }),
  ],
  vite: {
    plugins: [
      tailwindcss(),
      forceUtf8ForHtml(),
    ],
    esbuild: {
      charset: "utf8",
    },
  },
  alias: {
    '@layouts': './src/layouts',
    '@components': './src/components',
  },
});