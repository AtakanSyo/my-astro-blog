import fs from "fs";
import path from "path";
import matter from "gray-matter";

// directory where your posts live
const dir = "./src/pages/posts"; 

// grab slug from command line argument
const slugToFind = process.argv[2];
if (!slugToFind) {
  console.error("❌ Please provide a slug, e.g.: node findBySlug.js skywatcher-heritage-130p-overview");
  process.exit(1);
}

let found = false;

fs.readdirSync(dir).forEach(file => {
  if (!file.endsWith(".mdx")) return;

  const fullPath = path.join(dir, file);
  const raw = fs.readFileSync(fullPath, "utf8");
  const parsed = matter(raw);

  if (parsed.data.slug === slugToFind) {
    console.log(`✅ Found slug in: ${file}\n`);
    console.log(raw);   // output the whole MDX file
    found = true;
  }
});

if (!found) {
  console.error(`⚠️ No post found with slug: ${slugToFind}`);
}