// src/components/SearchPosts.jsx
import React, { useState, useMemo, useEffect } from 'react';

export default function SearchPosts({ posts = [], limit = 50 }) {
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
        onSubmit={(e) => e.preventDefault()}
      >
        <input
          type="search"
          placeholder="🔎 Search posts…"
          value={q}
          maxLength={100}
          onChange={(e) => setQ(e.currentTarget.value.slice(0, 100))}
          className="search-input"
        />
      </form>

      <div className="search-count">
        Showing {filtered.length} of {posts.length} posts
      </div>

<div className="post-grid">
  {filtered.map((p) => {
    const fm = p.frontmatter || {};
    const cats = normalizeCats(fm); // should return lowercased array

    const isP5     = cats.includes('simulation');
    const isReview = cats.includes('reviews') || cats.includes('review');
    const isInfo   = cats.includes('informational') || cats.includes('info');
    const isNasa   = cats.includes('nasa');

    const ctaText =
      isP5 ? 'Go to the simulation →'
      : isReview ? 'Read the review →'
      : isInfo ? 'Read the guide →'
      : isNasa ? 'See the article →'
      : 'Read full post →';

    return (
      <div className="post-card" key={p.url}>
        <a href={p.url} className="post-card-link">
          {/* Title with highlights */}
            <div class="post-card-info">
              
            <div className="post-card-title">
              {highlightText(fm.title ?? '', q)}
            </div>

            {/* Meta: Writer with highlights + date */}
            <div className="post-card-meta">
              By {highlightText(fm.writer ?? 'Unknown', q)} — {p.dateStr}
            </div>

            {/* Description with highlights */}
            {fm.description && (
              <p className="post-card-desc">
                {highlightText(fm.description, q)}
              </p>
            )}

            {/* Footer: badges (left) + CTA (right) */}
            <div className={`post-card-footer ${(isP5 || isReview || isInfo || isNasa) ? 'has-badge' : ''}`}>
              <div className="post-card-badges">
                {isP5 && <span className="p5-badge">Simulation</span>}
                {isReview && <span className="review-badge">Review</span>}
                {isInfo && <span className="info-badge">Info</span>}
                {isNasa && <span className="nasa-badge">NASA</span>}
              </div>
              <div className="read-post">{ctaText}</div>
            </div>
          </div>
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
