import katex from "katex";

/**
 * React sibling of Katex.astro — same idea (render one KaTeX expression via
 * katex.renderToString, `{ tex, display }` props), but as an actual React
 * component, since a UI-framework component (.jsx) cannot import an Astro
 * component (.astro) — Astro components only compile inside Astro's own
 * pipeline (.astro/.mdx files).
 *
 * Use this inside interactive React calculators; use Katex.astro for MDX
 * post prose. Both take the same { tex, display? } props so the calling
 * convention matches even though they're two separate small implementations.
 */
export default function Katex({ tex, display = false }) {
  const html = katex.renderToString(tex, { throwOnError: false, displayMode: display });
  return <span className="katex-inline" dangerouslySetInnerHTML={{ __html: html }} />;
}
