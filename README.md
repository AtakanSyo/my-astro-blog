# Astrosyo

Astrosyo is an Astro-powered site for interactive astrophysics calculators and simulations — React islands (Three.js / p5) covering things like angular size, orbital mechanics, redshift, and stellar properties, each with an anonymous thumbs up/down vote on the page.

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
| `npm test` | Run the test suite (vitest) |
| `npm run check` | Type-check with `astro check` |

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

### Calculator votes schema

Anonymous thumbs up/down voting on each calculator page is backed by `public.calculator_votes`, accessed only through two `SECURITY DEFINER` RPCs (`get_calculator_votes`, `cast_calculator_vote`) — see `src/lib/supabase/calculatorVotes.js`.

## Content

- Calculator pages: `src/pages/posts/*.mdx` (each renders an interactive React component from `src/components/simulations/`)
- Additional locale: `src/pages/zh/posts/`
- Index/listing page: `src/pages/interactives.astro`

Frontmatter conventions:
- `title`, `description`, `pubDate`, `writer`, `category`, `slug` (the `slug` wires up the vote widget)
- Images typically come from `public/images/<slug>/` (e.g. `cover.webp`, `thumbnail.webp`)

## Layouts & styling

- Base layout + global SEO/analytics: `src/layouts/Layout.astro`
- Calculator/post layout: `src/layouts/simLayout.astro`
- CSS lives under `src/styles/` and is imported per-page/layout.
