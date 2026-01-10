# Astrosyo

Astrosyo is an Astro-powered astronomy site featuring:
- MDX articles (informational posts, reviews, NASA posts)
- Interactive simulations (React islands with Three.js / p5)
- EN + TR routes with `hreflang` and canonical URLs

Production site: `https://astrosyo.com`

## Requirements

- Node.js `24` (see `.nvmrc` / `.node-version`)
- npm

## Commands

| Command | Action |
| :-- | :-- |
| `npm install` | Install dependencies |
| `npm run dev` | Start dev server at `http://localhost:4321` |
| `npm run build` | Build to `./dist/` |
| `npm run preview` | Preview the production build |

## Content

- English posts: `src/pages/posts/*.mdx`
- Turkish posts: `src/pages/tr/posts/*.mdx`
- Category pages: `src/pages/category/[slug].astro` and `src/pages/tr/category/[slug].astro`

Frontmatter conventions used across posts (varies by layout):
- `title`, `description`, `pubDate`, `writer`, `category`
- Images typically come from `public/images/<slug>/` (e.g. `cover.webp`, `thumbnail.webp`)

Common category keys:
- `reviews`
- `simulation`
- `informational`
- `nasa`

## Layouts & styling

- Base layout + global SEO/analytics: `src/layouts/Layout.astro`
- Post layouts: `src/layouts/ReviewPostLayout.astro`, `src/layouts/InfoPostLayout.astro`, `src/layouts/nasaLayout.astro`, `src/layouts/simLayout.astro`
- CSS lives under `src/styles/` and is imported per-page/layout.

## Scripts

Utility scripts for frontmatter/content maintenance:
- `scripts/` (Node)
- `update_frontmatter.py` (Python)
- `inject-reviewType.js`, `fix-reviewType.js` (repo root)
