// The Drake equation: a back-of-envelope estimate of the number of
// currently-detectable communicating civilizations in the Milky Way.
//
//   N = R* · fp · ne · fl · fi · fc · L
//
// It isn't a physical law — it's a way of factoring one hard, unanswerable
// question ("how many?") into seven smaller, individually more tractable
// ones. The honest problem with it, and the whole point of this
// calculator, is that those seven factors are not equally uncertain.
// The first three (R*, fp, ne) describe star and planet formation and are
// now measured, roughly, by real surveys. The last four (fl, fi, fc, L)
// describe how often chemistry becomes biology, biology becomes minds,
// minds become technology, and how long that technology lasts — and for
// every one of those, humanity has exactly one data point (itself), which
// is not enough to measure a rate or a probability from at all. The
// plausible bounds below reflect that split: narrow for the astrophysical
// terms, spanning many orders of magnitude for the rest.

export const DRAKE_FACTORS = [
  {
    key: "rStar",
    symbol: "R*",
    label: "Star formation rate",
    unit: "stars/year",
    min: 0.4,
    max: 10,
    default: 1.5,
    tier: "measured",
    note: "New stars forming in the Milky Way per year — estimated from surveys of star-forming regions, one of the better-constrained terms here.",
  },
  {
    key: "fp",
    symbol: "fp",
    label: "Fraction of stars with planets",
    unit: "",
    min: 0.3,
    max: 1,
    default: 0.9,
    tier: "measured",
    note: "Kepler and later exoplanet surveys suggest most stars host at least one planet.",
  },
  {
    key: "ne",
    symbol: "nₑ",
    label: "Habitable planets per system",
    unit: "",
    min: 0.1,
    max: 2,
    default: 0.4,
    tier: "measured",
    note: "Average number of roughly right-sized planets per system orbiting in the habitable zone, from occurrence-rate studies.",
  },
  {
    key: "fl",
    symbol: "fl",
    label: "Fraction developing life",
    unit: "",
    min: 1e-10,
    max: 1,
    default: 0.1,
    tier: "unconstrained",
    note: "No second example of life's origin exists to measure this from. Estimates genuinely span from \"near-inevitable\" to \"vanishingly rare.\"",
  },
  {
    key: "fi",
    symbol: "fi",
    label: "Fraction developing intelligence",
    unit: "",
    min: 1e-9,
    max: 1,
    default: 0.01,
    tier: "unconstrained",
    note: "Earth took ~4 billion years and produced exactly one technological lineage. Whether that's typical or a fluke is unknown.",
  },
  {
    key: "fc",
    symbol: "fc",
    label: "Fraction developing detectable technology",
    unit: "",
    min: 1e-3,
    max: 1,
    default: 0.2,
    tier: "unconstrained",
    note: "Of intelligent species, how many build technology whose signals actually cross interstellar distances.",
  },
  {
    key: "L",
    symbol: "L",
    label: "Civilization signal lifetime",
    unit: "years",
    min: 10,
    max: 1e10,
    default: 10000,
    tier: "unconstrained",
    note: "How long a civilization keeps broadcasting detectable signals. Our own track record so far is about a century.",
  },
];

/** N = product of every factor's current value. */
export function computeN(values) {
  return DRAKE_FACTORS.reduce((acc, f) => acc * (values[f.key] ?? f.default), 1);
}

/** log10(max/min) for one factor — its own contribution to total uncertainty, in orders of magnitude. */
export function decadeSpan(factor) {
  return Math.log10(factor.max) - Math.log10(factor.min);
}

/** The full plausible range of N implied by every factor's own min/max bounds. */
export function plausibleRangeN() {
  let min = 1;
  let max = 1;
  for (const f of DRAKE_FACTORS) {
    min *= f.min;
    max *= f.max;
  }
  return { min, max };
}

export function interpretN(N) {
  if (!Number.isFinite(N) || N <= 0) return "Not a valid combination.";
  if (N < 0.01) {
    return "Essentially alone: this combination predicts far less than one detectable civilization in the galaxy at any given time — including, on these numbers, a slightly improbable us.";
  }
  if (N < 1) {
    return "Rare: under these assumptions, we're plausibly the only detectable civilization in the Milky Way right now.";
  }
  if (N < 10) {
    return "In the neighborhood of Drake's own 1961 back-of-envelope estimate — a handful of detectable civilizations.";
  }
  if (N < 10000) {
    return "Hundreds to thousands of detectable civilizations, by this combination of assumptions.";
  }
  return "The galaxy should be teeming with detectable civilizations under these numbers — which is exactly the Fermi paradox: then where is everybody?";
}
