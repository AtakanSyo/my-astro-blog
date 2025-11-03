// src/plugins/remark-internal-links.js
import { visit } from 'unist-util-visit';
import { getKeywordMap } from '../utils/keyword-map.js';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

// Helper to get the posts directory
const postsDir = fileURLToPath(new URL('../pages/posts', import.meta.url));

export default function remarkInternalLinks() {
  return (tree, file) => {
    // Build keyword->URL map for all posts
    const keywordMap = getKeywordMap();

    // Derive current file's slug from its frontmatter
    const filename = path.basename(file.path);
    const fullPath = path.join(postsDir, filename);
    let currentUrl = null;
    try {
      const raw = fs.readFileSync(fullPath, 'utf8');
      const { data } = matter(raw);
      const slug = data.slug || filename.replace(/\.(md|mdx)$/, '');
      currentUrl = `/posts/${slug}`;
    } catch {
      // fallback: do not filter if error
      currentUrl = null;
    }

    // Prepare sorted list of keywords longest-first
    const sorted = Object.keys(keywordMap)
      .sort((a, b) => b.length - a.length)
      .map(text => ({ text, url: keywordMap[text] }));

    // Filter out entries pointing to the current post
    const entries = currentUrl
      ? sorted.filter(({ url }) => url !== currentUrl)
      : sorted;

    let injected = false;

    // Walk text nodes and replace keywords with links
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || parent.type === 'link') return;
      let text = node.value;
      const newNodes = [];

      while (text) {
        let matched = false;
        for (const { text: kw, url } of entries) {
          const pos = text.indexOf(kw);
          if (pos !== -1) {
            const before = text.slice(0, pos);
            const match = text.slice(pos, pos + kw.length);
            const after = text.slice(pos + kw.length);

            if (before) newNodes.push({ type: 'text', value: before });
            newNodes.push({ type: 'link', url, children: [{ type: 'text', value: match }] });

            text = after;
            injected = true;
            matched = true;
            break;
          }
        }
        if (!matched) {
          newNodes.push({ type: 'text', value: text });
          break;
        }
      }

      if (injected) {
        parent.children.splice(index, 1, ...newNodes);
      }
    });

    if (injected) {
      console.log(`🔗 [remark-internal-links] injected links in: ${file.path}`);
    }
  };
}
