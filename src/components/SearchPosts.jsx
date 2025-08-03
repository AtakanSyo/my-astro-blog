import React, { useState, useMemo, useEffect } from 'react';

export default function SearchPosts({ posts = [], limit = 50 }) {
  // ➊ Seed from window.location on the client
  const getInitialQ = () => {
    if (typeof window === 'undefined') return '';
    return new URL(window.location.href).searchParams.get('q') || '';
  };

  const [q, setQ] = useState(getInitialQ().slice(0, 100));

  // ➋ Whenever q changes, update the URL bar (optional)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (q) params.set('q', q);
    else params.delete('q');
    const newUrl =
      window.location.pathname + '?' + params.toString() + window.location.hash;
    window.history.replaceState(null, '', newUrl);
  }, [q]);

  // ➌ Filter & slice
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return posts
      .filter((p) => {
        const t = p.frontmatter.title.toLowerCase();
        const d = (p.frontmatter.description ?? '').toLowerCase();
        return !term || t.includes(term) || d.includes(term);
      })
      .slice(0, limit);
  }, [q, posts, limit]);

  return (
    <div className="search-container">
      <form
        className="search-form"
        onSubmit={(e) => {
          e.preventDefault(); // don’t reload
        }}
      >
        <input
          type="search"
          placeholder="🔎 Search posts…"
          value={q}
          maxLength={100}
          onChange={e => setQ(e.currentTarget.value.slice(0, 100))}
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
              <div className="post-card-title">{p.frontmatter.title}</div>
               <div className="post-card-meta">
                 By {p.frontmatter.writer} — {p.dateStr}
               </div>
              {p.frontmatter.description && (
                <p className="post-card-desc">
                  {p.frontmatter.description}
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