#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

// 1️⃣ Adjust this to point at where your .mdx lives
const POSTS_DIR = path.join(process.cwd(), 'src/pages/posts')

const files = fs.readdirSync(POSTS_DIR)
  .filter(f => f.endsWith('.mdx') || f.endsWith('.md'))

const reviews   = []
const telescopes = []

for (const file of files) {
  const content = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8')
  const { data } = matter(content)
  if (!data.title || !data.category) continue

  if (data.category === 'reviews')       reviews.push(data.title)
  else if (data.category === 'telescopes') telescopes.push(data.title)
}

// 2️⃣ Build the markdown
let md = [];
md.push('## 🚀 Posts to Update\n');
md.push('### 🔖 Reviews');
 reviews.forEach(title => {
   md.push(`- [ ] ${title}`);
   md.push(`    - [ ] Images`);
   md.push(`    - [ ] Affiliate links`);
   md.push(`    - [ ] Text Corrections`);
 });

md.push('\n### 🔭 Telescopes');
telescopes.forEach(t => md.push(`- [ ] ${t}`));

// 3️⃣ Print it out
console.log(md.join('\n'));