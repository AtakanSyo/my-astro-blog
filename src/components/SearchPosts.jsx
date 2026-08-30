// src/components/SearchPosts.jsx
import { useState, useMemo, useEffect } from 'react';

/**
 * @typedef {{
 *   url: string;
 *   frontmatter?: {
 *     title?: string;
 *     description?: string;
 *     writer?: string;
 *     category?: string | string[];
 *     categories?: string | string[];
 *     thumbnail?: string;
 *     postColor?: string;
 *   };
 *   dateStr?: string;
 * }} SearchPost
 */

/** @param {{ posts?: SearchPost[]; limit?: number }} props */
export default function SearchPosts({ posts = /** @type {SearchPost[]} */ ([]), limit = 50 }) {
  // ➊ Seed from URL
  const getInitialQ = () => {
    if (typeof window === 'undefined') return '';
    return new URL(window.location.href).searchParams.get('q') || '';
  };
  const [q, setQ] = useState(getInitialQ().slice(0, 100));

  // ➋ Sync URL bar
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (q) params.set('q', q);
    else params.delete('q');
    const newUrl =
      window.location.pathname +
      (params.toString() ? `?${params.toString()}` : '') +
      window.location.hash;
    window.history.replaceState(null, '', newUrl);
  }, [q]);

  // ➌ Filter & slice (now includes `writer` + categories)
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const scored = posts
      .map((p, idx) => ({ ...p, _idx: idx }))
      .filter((p) => {
        const fm = p.frontmatter || {};
        const title = (fm.title || '').toLowerCase();
        const desc  = (fm.description || '').toLowerCase();
        const writ  = (fm.writer || '').toLowerCase();
        const cats  = normalizeCats(fm).join(' ');
        return (
          !term ||
          title.includes(term) ||
          desc.includes(term) ||
          writ.includes(term) ||
          cats.includes(term)
        );
      })
      .map((p) => {
        const title = (p.frontmatter?.title || '').toLowerCase();
        const titleHit = term && title.includes(term) ? 1 : 0;
        return { ...p, _score: titleHit };
      })
      .sort((a, b) => {
        if (b._score !== a._score) return b._score - a._score;
        return a._idx - b._idx; // preserve original order when scores tie
      })
      .slice(0, limit)
      .map(({ _idx, _score, ...rest }) => rest);
    return scored;
  }, [q, posts, limit]);

  // ➍ Highlight helper disabled (returns plain text)
  const highlightText = (text) => text;

  return (
    <div className="search-container">
      <form
        className="search-form"
        role="search"
        onSubmit={(e) => e.preventDefault()}
      >
        <input
          type="search"
          placeholder="🔎 Search posts…"
          aria-label="Search posts"
          value={q}
          maxLength={100}
          onChange={(e) => setQ(e.currentTarget.value.slice(0, 100))}
          className="search-input"
        />
      </form>

      <div className="search-count">
        Showing {filtered.length} of {posts.length} posts
      </div>

<div className="search-results">
  {filtered.map((p) => {
    const fm = p.frontmatter || {};
    const hasThumb = Boolean(fm.thumbnail);
    const cardClass = `post-card post-card--row post-card--compact${hasThumb ? '' : ' post-card--no-thumb'}`;

    return (
      <div className={cardClass} style={getCardStyle(fm.postColor)} key={p.url}>
        <a href={p.url} className="post-card-link post-card-link--row post-card-link--compact">
          {hasThumb && (
            <div className="post-card-thumb">
              <img
                src={fm.thumbnail}
                alt={fm.title ?? ''}
                loading="lazy"
                decoding="async"
              />
            </div>
          )}

          <div className="post-card-info centered_flex">
            <div className="post-card-title">
              {highlightText(fm.title ?? '', q)}
            </div>

            {fm.description && (
              <p className="post-card-desc">
                {highlightText(fm.description, q)}
              </p>
            )}
          </div>

          <span className="post-card-row-arrow" aria-hidden="true">→</span>
        </a>
      </div>
    );
  })}

  {filtered.length === 0 && <p>No results found.</p>}
</div>
    </div>
  );
}

/* Helpers */
function normalizeCats(frontmatter) {
  const raw = frontmatter?.category ?? frontmatter?.categories ?? [];
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.toLowerCase());
  if (typeof raw === 'string') return [raw.toLowerCase()];
  return [];
}

function getCardStyle(rawPostColor) {
  if (typeof rawPostColor !== 'string') return undefined;
  const postColor = rawPostColor.trim();
  const match = postColor.match(
    /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+)\s*\)$/i
  );
  if (!match) return undefined;

  const red = Number(match[1]);
  const green = Number(match[2]);
  const blue = Number(match[3]);
  const alpha = Number(match[4]);
  if (![red, green, blue].every((value) => value >= 0 && value <= 255) || alpha < 0 || alpha > 1) {
    return undefined;
  }

  return {
    '--post-card-bg': postColor,
    '--post-card-bg-inverse': `rgba(${255 - red},${255 - green},${255 - blue},1)`,
  };
}
