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

## Supabase setup

1. Create a `.env` file based on `.env.example`.
2. Set:
   - `PUBLIC_SUPABASE_URL`
   - `PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only, optional unless you need admin operations)
3. In Vercel, add the same variables in Project Settings -> Environment Variables.

Supabase client helpers:
- Browser/client-safe: `src/lib/supabase/client.ts`
- Server helpers: `src/lib/supabase/server.ts`

For passwordless login (magic link), add redirect URLs in Supabase Authentication settings:
- `http://localhost:4321/account`
- `https://astrosyo.com/account`

### Telescope ratings schema

A ready migration exists at:
- `supabase/migrations/20260420_create_telescopes.sql`

It creates:
- `public.telescopes` (catalog + `editorial_rating` + aggregated `user_rating`)
- `public.telescope_user_ratings` (one rating per user per telescope)

It also includes:
- Rating range constraints (`0..10`)
- Aggregation triggers (auto-updates `user_rating` and `user_rating_count`)
- RLS policies for public reads and authenticated per-user rating writes

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
- Post layout: `src/layouts/simLayout.astro`
- CSS lives under `src/styles/` and is imported per-page/layout.

## Scripts

Utility scripts for frontmatter/content maintenance:
- `scripts/` (Node)
- `update_frontmatter.py` (Python)
- `inject-reviewType.js`, `fix-reviewType.js` (repo root)
