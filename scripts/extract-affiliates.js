#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import slugify from 'slugify';

const POSTS_DIR = path.join(process.cwd(), 'src/pages/posts'); // adjust if needed
const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.mdx'));

const rows = [];

for (const file of files) {
  const fullPath = path.join(POSTS_DIR, file);
  const raw = fs.readFileSync(fullPath, 'utf8');
  const { data } = matter(raw);

  // Skip if not reviews/telescopes
  if (data.category !== 'reviews' && data.subcategory !== 'telescopes') continue;

  const title = data.title || '(no title)';
  const slug  = data.slug || slugify(title, { lower: true, strict: true });
  const aff   = data.affiliate || {};

  rows.push({
    title,
    slug,
    amazon: aff.amazon || '',
    astroshop: aff.astroshop || '',
    highpoint: aff.highpointscientific || '',
  });
}

// Create Markdown table
const mdTable = [
  '| Title | Slug | Amazon URL | Astroshop URL | HighpointScientific URL |',
  '|-------|------|------------|---------------|--------------------------|',
  ...rows.map(row =>
    `| ${row.title} | ${row.slug} | ${row.amazon} | ${row.astroshop} | ${row.highpoint} |`
  )
].join('\n');

fs.writeFileSync('affiliate-links.md', mdTable, 'utf8');
console.log('✅ Written to affiliate-links.md');