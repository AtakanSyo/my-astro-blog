// Moves MD/MDX from src/pages/posts → src/content/<category>/
// ❗ Never rewrites file contents (frontmatter untouched).
// DRY=1  => preview (default)
// DRY=0  => execute
// USE_FILENAME=1 => ignore frontmatter.slug and keep original filename

import { readFile, mkdir, rename, stat } from "node:fs/promises";
import { dirname, join, parse } from "node:path";
import matter from "gray-matter";
import { globby } from "globby";

type Cat = "reviews" | "nasa" | "tools" | "simulations" | "informational";
const DRY = process.env.DRY !== "0";
const USE_FILENAME = process.env.USE_FILENAME === "1";

const KNOWN = new Set(["review","reviews","nasa","tools","simulations","simulation","informational"]);
const TAG_MAP: Record<Cat, string[]> = {
  reviews: ["review","hands-on","product","gear","test","inceleme"],
  nasa: ["nasa","mission","clipper","jwst","hubble","iss","europa","artemis"],
  tools: ["tool","calculator","fov","magnification","finder","utility","eyepiece"],
  simulations: ["sim","simulation","three.js","transit","orbit","visualization","webgl"],
  informational: [],
};

function toFolderCategory(raw: string | undefined): Cat | undefined {
  if (!raw) return undefined;
  const v = raw.toLowerCase().trim();
  if (!KNOWN.has(v)) return undefined;
  if (v === "review") return "reviews";
  if (v === "simulation") return "simulations";
  return v as Cat;
}

function decideCategory(front: any): Cat {
  const viaCategory = toFolderCategory(front?.category);
  if (viaCategory) return viaCategory;
  const tags: string[] = Array.isArray(front?.tags) ? front.tags.map((t: any)=>String(t).toLowerCase()) : [];
  for (const [cat, keys] of Object.entries(TAG_MAP) as [Cat,string[]][]) {
    if (keys.some(k => tags.includes(k))) return cat;
  }
  return "informational";
}

function slugify(s: string) {
  return s.toLowerCase().trim()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueDestPath(baseDir: string, baseName: string) {
  let i = 0;
  while (true) {
    const name = i === 0 ? `${baseName}.mdx` : `${baseName}-${i+1}.mdx`;
    const dest = join(baseDir, name);
    try { await stat(dest); i++; } catch { return dest; }
  }
}

async function run() {
  // ensure target dirs
  const dirs: Cat[] = ["reviews","nasa","tools","simulations","informational"];
  await Promise.all(dirs.map((d) => mkdir(join("src/content", d), { recursive: true })));

  const files = await globby(["src/pages/posts/**/*.{md,mdx}"]);
  if (!files.length) { console.log("No MD/MDX under src/pages/posts"); return; }

  for (const fp of files) {
    const raw = await readFile(fp, "utf8");
    const { data: front } = matter(raw); // read only, we won't write back

    const cat = decideCategory(front);
    const originalName = parse(fp).name; // filename without ext
    const desiredBase = USE_FILENAME
      ? slugify(originalName)
      : (front?.slug ? slugify(String(front.slug)) : slugify(originalName));

    const destDir = join("src/content", cat);
    const dest = await uniqueDestPath(destDir, desiredBase);

    if (DRY) {
      console.log(`[DRY] ${fp} -> ${dest}  (category=${cat})`);
    } else {
      await mkdir(dirname(dest), { recursive: true });
      await rename(fp, dest); // move file as-is, no content changes
      console.log(`Moved: ${fp} -> ${dest}`);
    }
  }

  console.log(DRY ? "\nDry-run complete. Run with DRY=0 to execute."
                  : "\nDone. Frontmatter untouched.");
}

run().catch(e => { console.error(e); process.exit(1); });