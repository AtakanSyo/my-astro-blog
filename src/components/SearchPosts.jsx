// src/components/SearchPosts.jsx
import React, { useState, useMemo } from 'react';

export default function SearchPosts({ posts = [], initialQuery = '', limit = 50 }) {
  // ➊ seed our input state from the URL‐passed initialQuery
  const [q, setQ] = useState(initialQuery.slice(0, 60));

  // ➋ filter whenever `q` or `posts` changes
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return posts
      .filter((p) => {
        const t = p.frontmatter.title.toLowerCase();
        const d = (p.frontmatter.description ?? '').toLowerCase();
        return term === '' || t.includes(term) || d.includes(term);
      })
      .slice(0, limit);
  }, [q, posts, limit]);
  return (
    <div className="search-container">
      <form
        className="search-form"
        onSubmit={(e) => {
          e.preventDefault();
          // optionally: window.history.replaceState(null, '', `?q=${encodeURIComponent(q)}`);
        }}
      >
        <input
          type="search"
          placeholder="🔎 Search posts…"
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          className="search-input"
        />
      </form>

      <div className="post-grid">
        {filtered.map((p) => (
          <div className="post-card" key={p.url}>
            <a href={p.url} className="post-card-link">
              <div className="post-card-title">{p.frontmatter.title}</div>
              <div className="post-card-meta">
                By {p.frontmatter.writer} —{' '}
                {new Date(p.frontmatter.pubDate).toLocaleDateString()}
              </div>
              {p.frontmatter.description && (
                <p className="post-card-desc">{p.frontmatter.description}</p>
              )}
              <div className="read-post">Read full post →</div>
            </a>
          </div>
        ))}
        {filtered.length === 0 && <p className="no-results">No results found.</p>}
      </div>
    </div>
  );
}