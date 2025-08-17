import fs from "fs";
import path from "path";
import matter from "gray-matter";

const dir = "./src/pages/posts"; // adjust if needed

fs.readdirSync(dir).forEach(file => {
  if (!file.endsWith(".mdx")) return;

  const fullPath = path.join(dir, file);
  const raw = fs.readFileSync(fullPath, "utf8");
  const parsed = matter(raw);

  if (
    parsed.data.category === "reviews" &&
    parsed.data.subcategory === "telescopes"
  ) {
    let type = null;

    if (parsed.data.writer === "Zane Landers") {
      type = "hands-on";
    } else if (parsed.data.writer === "Astrosyo") {
      type = "research";
    }

    if (type) {
      parsed.data.reviewType = type;

      // Keep category → subcategory → reviewType → others
      const newFrontmatter = {
        category: parsed.data.category,
        subcategory: parsed.data.subcategory,
        reviewType: parsed.data.reviewType,
        ...Object.fromEntries(
          Object.entries(parsed.data).filter(
            ([k]) =>
              !["category", "subcategory", "reviewType"].includes(k)
          )
        ),
      };

      const updated = matter.stringify(parsed.content, newFrontmatter);
      fs.writeFileSync(fullPath, updated);
      console.log(`🔄 Fixed reviewType (${type}) in: ${file}`);
    } else {
      console.log(`ℹ️ No writer rule matched for: ${file}`);
    }
  }
});