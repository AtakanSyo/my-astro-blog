// Shared umami event tracking. Every calculator page loads umami
// globally (see Layout.astro), but only in production, and there's no
// guarantee `window.umami` has finished loading by the time someone
// clicks — so every call here is defensive: no-op outside the browser,
// no-op if umami isn't present yet, and never throws into the caller.
//
// `pagePath`/`pageSlug` are attached automatically so every event is
// self-identifying without every call site needing to know its own
// slug — see simStage.jsx for the original version of this pattern,
// which this centralizes for the calculator components.
export function trackEvent(name, data = {}) {
  try {
    if (typeof window === "undefined" || !window.umami?.track) return;
    const pagePath = window.location.pathname;
    const pageSlug = pagePath === "/" ? "home" : pagePath.split("/").filter(Boolean).pop();
    window.umami.track(name, { pagePath, pageSlug, ...data });
  } catch {
    // Analytics errors should never break the UI.
  }
}
