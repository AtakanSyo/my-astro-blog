#!/usr/bin/env node

import fs    from 'fs';
import path  from 'path';
import matter from 'gray-matter';
import slugify from 'slugify';

// 1️⃣ Adjust this to wherever your MDX lives:
const POSTS_DIR = path.join(process.cwd(), 'src/pages/posts');

fs.readdirSync(POSTS_DIR)
  .filter(f => /\.(mdx?|md)$/i.test(f))
  .forEach((file) => {
    const fullPath = path.join(POSTS_DIR, file);
    const raw      = fs.readFileSync(fullPath, 'utf8');
    const { data, content } = matter(raw);

    // 2️⃣ Compute slug:
    //    • if frontmatter already has a slug field, use it
    //    • otherwise slugify the filename (without extension)
    const baseName = path.basename(file, path.extname(file));
    const slug     = data.slug
      ? data.slug
      : slugify(baseName, { lower: true, strict: true });

    // 3️⃣ Derive imageDir if missing
    const imageDir = data.imageDir
      ? data.imageDir
      : `/images/${slug}`;

    // 4️⃣ Merge frontmatter & stringify back
    const newData = { ...data, slug, imageDir };
    const newFile = matter.stringify(content, newData);

    fs.writeFileSync(fullPath, newFile, 'utf8');
    console.log(`✔  Updated frontmatter in ${file}`);
  });