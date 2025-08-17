import fs from "fs";
import path from "path";
import matter from "gray-matter";

const dir = "./src/pages/posts"; // or "./pages/posts" if that's your structure

fs.readdirSync(dir).forEach(file => {
  if (!file.endsWith(".mdx")) return;

  const fullPath = path.join(dir, file);
  const raw = fs.readFileSync(fullPath, "utf8");
  const parsed = matter(raw);

  if (
    parsed.data.category === "reviews" &&
    parsed.data.subcategory === "telescopes"
  ) {
    if (!parsed.data.reviewType) {
      parsed.data.reviewType = "hands-on";

      // Keep order: category → subcategory → reviewType → others
      const newFrontmatter = {
        category: parsed.data.category,
        subcategory: parsed.data.subcategory,
        reviewType: parsed.data.reviewType,
        ...Object.fromEntries(
          Object.entries(parsed.data).filter(
            ([k]) => !["category", "subcategory", "reviewType"].includes(k)
          )
        ),
      };

      const updated = matter.stringify(parsed.content, newFrontmatter);
      fs.writeFileSync(fullPath, updated);
      console.log(`✅ Injected reviewType into: ${file}`);
    } else {
      console.log(`ℹ️ Skipped (already has reviewType): ${file}`);
    }
  }
});