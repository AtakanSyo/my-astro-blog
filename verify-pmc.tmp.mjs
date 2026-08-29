import { chromium } from "playwright";
const outDir = "/private/tmp/claude-501/-Users-atakansarac-Desktop-WorkStation-my-astro-blog/2dd7793e-2962-4d3d-92d0-65184dc21e75/scratchpad";
const pageErrors = [];
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1000, height: 1800 } });
page.on("pageerror", (err) => pageErrors.push(err.message));
await page.goto("http://localhost:4321/posts/proper-motion-velocity-calculator", { waitUntil: "networkidle" });
await page.waitForSelector(".pmc-solve-toggle", { timeout: 15000 });

async function computedValues() {
  return page.$$eval(".pmc-computed", (nodes) => nodes.map((n) => n.textContent.trim()));
}

// 1. Default: Barnard's Star, solveFor=vt, components mode
console.log("=== Default (Barnard, vt, components) ===");
console.log("computed:", await computedValues());

// 2. Click "Solve for Proper motion" -> vt and distance become inputs
await page.getByRole("button", { name: "Solve for Proper motion", exact: true }).click();
await page.waitForTimeout(200);
console.log("=== After solve-for=mu ===");
console.log("computed:", await computedValues());

// 3. Preset: "Same speed, 55x farther" (already solveFor=mu)
await page.getByRole("button", { name: "Same speed, 55× farther", exact: true }).click();
await page.waitForTimeout(200);
console.log("=== Preset: Same speed, 55x farther (mu) ===");
console.log("computed:", await computedValues());

// 4. Preset: "Solve for distance"
await page.getByRole("button", { name: "Solve for distance", exact: true }).click();
await page.waitForTimeout(200);
console.log("=== Preset: Solve for distance ===");
console.log("computed:", await computedValues());
const distRows = await page.$$eval(".pmc-row-value", (nodes) => nodes.map((n) => n.textContent.trim()));
console.log("distance table rows:", distRows);

// 5. Preset: Proxima Centauri (solveFor=vt, total mode, parallax mode)
await page.getByRole("button", { name: "Proxima Centauri", exact: true }).click();
await page.waitForTimeout(200);
console.log("=== Preset: Proxima Centauri ===");
console.log("computed:", await computedValues());
const totalV = await page.locator(".pmc-total-value").textContent().catch(() => "MISSING");
console.log("total 3D velocity card:", totalV);

// 6. Manually toggle distance mode to parallax while solveFor=vt, check field switches
await page.getByRole("button", { name: "Barnard's Star", exact: true }).click();
await page.waitForTimeout(200);
await page.locator(".pmc-mode-toggle >> text=Parallax").click();
await page.waitForTimeout(200);
console.log("=== After switching distance mode to parallax (Barnard) ===");
console.log("computed:", await computedValues());

// 7. Toggle mu mode to Total while solveFor=vt
await page.locator(".pmc-mode-toggle >> text=Total").first().click();
await page.waitForTimeout(200);
console.log("=== After switching mu mode to total (Barnard) ===");
console.log("computed:", await computedValues());

console.log("\npage errors:", pageErrors.length === 0 ? "NONE" : pageErrors);
await browser.close();
