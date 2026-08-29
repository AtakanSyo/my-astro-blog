import { chromium } from "playwright";
const outDir = "/private/tmp/claude-501/-Users-atakansarac-Desktop-WorkStation-my-astro-blog/2dd7793e-2962-4d3d-92d0-65184dc21e75/scratchpad";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1000, height: 1400 } });
await page.goto("http://localhost:4321/posts/proper-motion-velocity-calculator", { waitUntil: "networkidle" });
await page.waitForSelector(".pmc-solve-toggle", { timeout: 15000 });
await page.locator(".pmc").screenshot({ path: `${outDir}/pmc-default.png` });
await browser.close();
