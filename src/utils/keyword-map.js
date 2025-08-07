// src/utils/keyword-map.js
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

/**
 * Builds a map of keyword -> URL by reading your posts directory.
 * Adjust the path below to match your project layout.
 */
export function getKeywordMap() {
  // Point to src/pages/posts where your .md/.mdx files live
  const postsDir = fileURLToPath(new URL('../pages/posts', import.meta.url));
  const files = fs.readdirSync(postsDir).filter((f) => /\.(md|mdx)$/i.test(f));

  const map = {};
  for (const file of files) {
    const fullPath = path.join(postsDir, file);
    const raw = fs.readFileSync(fullPath, 'utf8');
    const { data } = matter(raw);

    // Derive slug (from frontmatter or filename)
    const slug = data.slug || file.replace(/\.(md|mdx)$/, '');
    // Use /posts/ instead of /blog/
    const url = `/posts/${slug}`;

    // Add full title as a keyword
    if (typeof data.title === 'string') {
      map[data.title] = url;
    }
    // Add each existing keywords entry
    if (Array.isArray(data.keywords)) {
      data.keywords.forEach((kw) => {
        map[kw] = url;
      });
    }
  }

  return map;
}