#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";
const GLOB = process.argv[2] || "src/**/*.{md,mdx}";
const MARKER = "<!-- zane-disclaimer -->";
const TODAY = "September 1, 2025"; // keep absolute date
const SITE = "TelescopestoBuy.com";

const DISCLAIMER = `${MARKER}
> **Authorship note (added ${TODAY}):** This article was originally written by **Zane Landers** for **${SITE}** and is republished here with permission.  
> New contributions from Zane on this site from **September 2025** onward are original to this site unless otherwise stated.

`;

(async () => {
  const files = await fg(GLOB, { dot: false, onlyFiles: true });
  if (files.length === 0) {
    console.log(`No files match glob: ${GLOB}`);
    process.exit(0);
  }

  let touched = 0;
  for (const file of files) {
    const raw = await fs.readFile(file, "utf8");

    // quick skip if marker already present
    if (raw.includes(MARKER)) continue;

    const parsed = matter(raw);
    const fm = parsed.data || {};

    // Only target Zane's posts
    const writer = String(fm.writer ?? "").trim().toLowerCase();
    if (writer !== "zane landers") continue;

    // Decide insertion point:
    // 1) If body starts with a heading (# ...), put disclaimer right after the first heading line.
    // 2) Else, put disclaimer at the very top of the body.
    let body = parsed.content;
    let newBody;
    const lines = body.split(/\r?\n/);
    if (lines[0]?.match(/^#\s+/)) {
      // after first line (H1)
      newBody = [lines[0], "", DISCLAIMER, ...lines.slice(1)].join("\n");
    } else {
      newBody = DISCLAIMER + body;
    }

    const rebuilt = matter.stringify(newBody, parsed.data);

    // backup
    await fs.copyFile(file, `${file}.bak`);
    await fs.writeFile(file, rebuilt, "utf8");
    touched++;
    console.log(`Updated: ${file}`);
  }

  console.log(`\nDone. Modified ${touched} file(s). Backups saved as *.bak`);
})();