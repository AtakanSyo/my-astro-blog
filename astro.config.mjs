import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';

export default defineConfig({

  site: 'https://astrosyo.com',

  integrations: [mdx(), 
    sitemap(), 
    react(),
    icon({collections: [
        'logos',   // facebook/twitter/whatsapp/instagram…
        'bi',
        'feather',
        'ion',      // bootstrap-icons (“link-45deg”)
        'simple-icons'
      ],}),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});