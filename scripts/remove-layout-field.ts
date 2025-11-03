// scripts/remove-layout-field.ts
import fs from "node:fs";
import path from "node:path";
import glob from "fast-glob";

const ROOT = "./src/content";

(async () => {
  const files = await glob(`${ROOT}/**/*.{md,mdx}`);

  for (const file of files) {
    let text = fs.readFileSync(file, "utf8");

    // remove line `layout: something`
    const updated = text.replace(/^layout:.*$/m, "").trim() + "\n";

    if (updated !== text) {
      fs.writeFileSync(file, updated, "utf8");
      console.log(`✅ removed layout field from: ${file}`);
    }
  }

  console.log("\n✨ Done. All layout fields removed.\n");
})();