#!/usr/bin/env node

import fs     from 'fs';
import path   from 'path';
import matter from 'gray-matter';

// 1️⃣ Point this at your posts folder:
const POSTS_DIR = path.join(process.cwd(), 'src/pages/posts');

fs.readdirSync(POSTS_DIR)
  .filter((f) => /\.(mdx?|md)$/i.test(f))
  .forEach((file) => {
    const fullPath = path.join(POSTS_DIR, file);
    const raw      = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(raw);

    // 2️⃣ Grab the title (fallback to filename if missing)
    const title = typeof data.title === 'string'
      ? data.title
      : path.basename(file, path.extname(file));

    // 3️⃣ Derive keyword by stripping a trailing " Review"
    const keyword = title.endsWith(' Review')
      ? title.slice(0, -' Review'.length)
      : title;

    // 4️⃣ Build/merge the keywords array (keyword first, no dupes)
    const existing = Array.isArray(data.keywords) ? data.keywords : [];
    const keywords = [keyword, ...existing.filter((k) => k !== keyword)];

    // 5️⃣ Write back only the updated keywords field
    const newData = { ...data, keywords };
    const newFile = matter.stringify(content, newData);

    fs.writeFileSync(fullPath, newFile, 'utf8');
    console.log(`✔ Injected keywords into ${file}`);
  });