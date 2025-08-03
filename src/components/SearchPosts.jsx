import React, { useState, useMemo, useEffect, useCallback } from 'react';

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

  // ➌ Filter & slice (now including `writer`)
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return posts
      .filter((p) => {
        const t = p.frontmatter.title.toLowerCase();
        const d = (p.frontmatter.description ?? '').toLowerCase();
        const w = (p.frontmatter.writer ?? '').toLowerCase();
        return (
          !term ||
          t.includes(term) ||
          d.includes(term) ||
          w.includes(term)
        );
      })
      .slice(0, limit);
  }, [q, posts, limit]);

  // ➍ Highlight helper
  const highlightText = useCallback((text, term) => {
    if (!term) return text;
    const escaped = term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.split(regex).map((chunk, i) =>
      regex.test(chunk) ? <mark key={i}>{chunk}</mark> : chunk
    );
  }, []);

  return (
    <div className="search-container">
      <form
        className="search-form"
        onSubmit={(e) => {
          e.preventDefault();
        }}
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
        {filtered.map((p) => (
          <div className="post-card" key={p.url}>
            <a href={p.url} className="post-card-link">
              {/* Title with highlights */}
              <div className="post-card-title">
                {highlightText(p.frontmatter.title, q)}
              </div>

              {/* Meta: Writer with highlights + date */}
              <div className="post-card-meta">
                By{' '}
                {highlightText(p.frontmatter.writer ?? 'Unknown', q)}{' '}
                — {p.dateStr}
              </div>

              {/* Description with highlights */}
              {p.frontmatter.description && (
                <p className="post-card-desc">
                  {highlightText(p.frontmatter.description, q)}
                </p>
              )}

              <div className="read-post">Read full post →</div>
            </a>
          </div>
        ))}

        {filtered.length === 0 && <p>No results found.</p>}
      </div>
    </div>
  );
}