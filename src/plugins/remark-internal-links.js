// src/plugins/remark-internal-links.js
import { visit } from 'unist-util-visit';
import { getKeywordMap } from '../utils/keyword-map.js';
import path from 'path';

export default function remarkInternalLinks() {
  return (tree, file) => {
    // 1) Build keyword -> URL map (your existing util)
    const keywordMap = getKeywordMap();

    // 2) Derive current slug without reading from disk
    // Astro exposes frontmatter at file.data.astro.frontmatter (if present)
    const fm = file?.data?.astro?.frontmatter ?? {};
    const filename = path.basename(file.path || '');
    const inferred = filename.replace(/\.(md|mdx)$/i, '');
    const slug = (typeof fm.slug === 'string' && fm.slug.trim()) ? fm.slug.trim() : inferred;
    const currentUrl = `/posts/${slug}`;

    // 3) Prepare sorted keywords (longest first), excluding self-links
    const sorted = Object.keys(keywordMap)
      .sort((a, b) => b.length - a.length)
      .map(text => ({ text, url: keywordMap[text] }))
      .filter(({ url }) => url !== currentUrl);

    let injected = false;

    // 4) Walk text nodes and inject links (skip inside existing links)
    visit(tree, 'text', (node, index, parent) => {
      if (!parent || parent.type === 'link') return;

      let text = node.value;
      const newNodes = [];

      while (text) {
        let matched = false;
        for (const { text: kw, url } of sorted) {
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

      if (injected) parent.children.splice(index, 1, ...newNodes);
    });

    if (injected) {
      console.log(`🔗 [remark-internal-links] injected links in: ${file.path}`);
    }
  };
}