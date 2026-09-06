// Test cases for the "Tests" popup on the Proper Motion / Tangential
// Velocity Calculator. These run the calculator's real properMotion.js
// functions against known reference stars, internal scaling/round-trip
// checks, and edge cases, so this table is a genuine live check — not a
// hardcoded, unverified table — and would visibly show failures on this
// page if the underlying math ever broke.
//
// This module owns all the domain-specific work; the shared
// CalculatorTests component (components/CalculatorTests.jsx) only renders
// whatever columns/rows it's handed. Follow this same split — a
// "<mathModule>Tests.js" per calculator, computing rows from that
// calculator's own math module — to add the Tests popup to another
// calculator.

import {
  totalProperMotion,
  tangentialVelocity,
  properMotionFromVelocityDistance,
  distancePcFromVelocityProperMotion,
  distancePcFromParallaxArcsec,
  totalSpaceVelocity,
} from "./properMotion";

export const PROPER_MOTION_TEST_COLUMNS = [
  { key: "test", label: "Test" },
  { key: "inputs", label: "Inputs" },
  { key: "expected", label: "Expected" },
  { key: "computed", label: "Computed" },
  { key: "result", label: "Result" },
];

// User-facing version of the source notes above the reference stars
// below — rendered at the bottom of the Tests popup by CalculatorTests.
// Keep these two in sync when either changes.
export const PROPER_MOTION_TEST_SOURCES = [
  {
    title: "Barnard's Star",
    text: "Proper motion components (μ_α* = −798.71, μ_δ = 10328.12 mas/yr), parallax (546.98 mas), and radial velocity (−110.6 km/s) are the same commonly cited, Gaia-based astrometric figures already used as this calculator's own Barnard's Star preset.",
    url: "https://simbad.cds.unistra.fr/simbad/sim-basic?Ident=Barnard%27s+star",
    urlLabel: "SIMBAD — Barnard's Star",
  },
  {
    title: "Proxima Centauri",
    text: "Total proper motion (3775 mas/yr) and parallax (768.5 mas) are the same commonly cited, Gaia-based astrometric figures already used as this calculator's own Proxima Centauri preset.",
    url: "https://simbad.cds.unistra.fr/simbad/sim-basic?Ident=Proxima+Centauri",
    urlLabel: "SIMBAD — Proxima Centauri",
  },
  {
    title: "What these rows actually prove",
    text: "The reference rows confirm the exact v_t = 4.74047·μ·d formula reproduces the commonly cited tangential and total space velocity for these two real, nearby, fast-moving stars — not that the underlying proper motion, parallax, and radial velocity figures are independently re-measured here. The scaling, round-trip, and edge-case rows below don't depend on any external citation at all — they confirm the conversion functions behave exactly as the algebra predicts on their own terms.",
  },
];

function fmt(n, digits = 4) {
  if (Number.isNaN(n)) return "NaN";
  if (n === Infinity) return "∞";
  if (n === -Infinity) return "−∞";
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e6 || abs < 1e-3)) return n.toExponential(4);
  const rounded = Number(n.toFixed(digits));
  return String(rounded);
}

function percentDiff(a, b) {
  if (b === 0) return a === 0 ? 0 : Infinity;
  return Math.abs((a - b) / b) * 100;
}

// Reference values are commonly cited literature/catalog figures (a
// handful of significant figures), so a fraction-of-a-percent round-trip
// gap is expected rounding, not a bug — a real formula error would be off
// by many percent, not hundredths.
function referenceRows() {
  const rows = [];

  // Barnard's Star: μ (from components) + distance (from parallax) -> vt.
  const barnardMuAlpha = -798.71;
  const barnardMuDelta = 10328.12;
  const barnardMuMasYr = totalProperMotion(barnardMuAlpha, barnardMuDelta);
  const barnardMuArcsecYr = barnardMuMasYr / 1000;
  const barnardDPc = distancePcFromParallaxArcsec(546.98 / 1000);
  const barnardVtExpected = 89.78; // commonly cited figure
  const barnardVtComputed = tangentialVelocity(barnardMuArcsecYr, barnardDPc);
  rows.push({
    test: "Barnard's Star — proper motion + distance to tangential velocity",
    inputs: `μ_α* = ${fmt(barnardMuAlpha)}, μ_δ = ${fmt(barnardMuDelta)} mas/yr, parallax = 546.98 mas`,
    expected: `≈ ${fmt(barnardVtExpected)} km/s`,
    computed: `${fmt(barnardVtComputed)} km/s`,
    pass: percentDiff(barnardVtComputed, barnardVtExpected) < 0.5,
  });

  // Proxima Centauri: μ (total) + distance (from parallax) -> vt.
  const proximaMuArcsecYr = 3775 / 1000;
  const proximaDPc = distancePcFromParallaxArcsec(768.5 / 1000);
  const proximaVtExpected = 23.29; // commonly cited figure
  const proximaVtComputed = tangentialVelocity(proximaMuArcsecYr, proximaDPc);
  rows.push({
    test: "Proxima Centauri — proper motion + distance to tangential velocity",
    inputs: "μ = 3775 mas/yr, parallax = 768.5 mas",
    expected: `≈ ${fmt(proximaVtExpected)} km/s`,
    computed: `${fmt(proximaVtComputed)} km/s`,
    pass: percentDiff(proximaVtComputed, proximaVtExpected) < 0.5,
  });

  // Barnard's Star total 3D space velocity — well known as one of the
  // fastest-moving stars relative to the Sun, commonly cited in the
  // ~140 km/s range (varies slightly by data source), so this row checks
  // a band rather than pinning an exact figure.
  const barnardTotalV = totalSpaceVelocity(barnardVtComputed, -110.6);
  rows.push({
    test: "Barnard's Star — total 3D space velocity (tangential + radial)",
    inputs: `v_t = ${fmt(barnardVtComputed)} km/s, v_r = −110.6 km/s`,
    expected: "commonly cited as roughly 135–150 km/s",
    computed: `${fmt(barnardTotalV)} km/s`,
    pass: barnardTotalV > 135 && barnardTotalV < 150,
  });

  return rows;
}

// Internal-consistency checks: these don't depend on any externally cited
// figure, just on the functions responding to input exactly as the
// algebra predicts.
function consistencyRows() {
  const rows = [];

  // Combining Barnard's RA/Dec components must match its cited total μ.
  const totalMu = totalProperMotion(-798.71, 10328.12);
  rows.push({
    test: "totalProperMotion combines RA/Dec components into the cited total μ",
    inputs: "μ_α* = −798.71 mas/yr, μ_δ = 10328.12 mas/yr",
    expected: "≈ 10358.96 mas/yr",
    computed: `${fmt(totalMu, 2)} mas/yr`,
    pass: percentDiff(totalMu, 10358.96) < 0.01,
  });

  // Tangential velocity scales linearly with distance, μ fixed.
  const muFixed = 1; // arcsec/yr
  const vtAt10pc = tangentialVelocity(muFixed, 10);
  const vtAt20pc = tangentialVelocity(muFixed, 20);
  rows.push({
    test: "Tangential velocity scales linearly with distance",
    inputs: "μ = 1″/yr, d = 10 pc vs. d = 20 pc",
    expected: "ratio ≈ 2.0000",
    computed: `ratio = ${fmt(vtAt20pc / vtAt10pc)}`,
    pass: percentDiff(vtAt20pc / vtAt10pc, 2) < 1e-9,
  });

  // Round trip: given vt & d, recovering μ; given vt & μ, recovering d.
  const muOrig = 0.5; // arcsec/yr
  const dOrig = 20; // pc
  const vtFromBoth = tangentialVelocity(muOrig, dOrig);
  const muRecovered = properMotionFromVelocityDistance(vtFromBoth, dOrig);
  const dRecovered = distancePcFromVelocityProperMotion(vtFromBoth, muOrig);
  rows.push({
    test: "Round trip: (μ, d) → v_t → recovers μ and d independently",
    inputs: `μ = ${fmt(muOrig)}″/yr, d = ${fmt(dOrig)} pc → v_t = ${fmt(vtFromBoth)} km/s`,
    expected: `μ ≈ ${fmt(muOrig)}″/yr, d ≈ ${fmt(dOrig)} pc recovered`,
    computed: `μ = ${fmt(muRecovered)}″/yr, d = ${fmt(dRecovered)} pc`,
    pass: percentDiff(muRecovered, muOrig) < 1e-9 && percentDiff(dRecovered, dOrig) < 1e-9,
  });

  return rows;
}

// Edge cases: properMotion.js is pure algebra with no input validation of
// its own (that guard lives in ProperMotionCalculator.jsx's `result`
// useMemo, which requires positive proper motion/distance/parallax before
// ever calling these functions) — so these rows confirm what the
// functions actually do when handed zero, negative, or degenerate input,
// rather than asserting a rejection behavior the module doesn't
// implement.
function edgeCaseRows() {
  const rows = [];

  const dAtZeroParallax = distancePcFromParallaxArcsec(0);
  rows.push({
    test: "Zero parallax",
    inputs: "parallax = 0″",
    expected: "not rejected — division by zero gives +Infinity for distance",
    computed: `distance = ${fmt(dAtZeroParallax)}`,
    pass: dAtZeroParallax === Infinity,
  });

  const dAtNegParallax = distancePcFromParallaxArcsec(-1);
  rows.push({
    test: "Negative parallax",
    inputs: "parallax = −1″",
    expected: "not rejected — gives an unphysical negative distance (−1 pc), not an error",
    computed: `distance = ${fmt(dAtNegParallax)} pc`,
    pass: dAtNegParallax === -1,
  });

  const vtAtZeroMu = tangentialVelocity(0, 10);
  rows.push({
    test: "Zero proper motion",
    inputs: "μ = 0″/yr, d = 10 pc",
    expected: "0 km/s",
    computed: `${fmt(vtAtZeroMu)} km/s`,
    pass: vtAtZeroMu === 0,
  });

  return rows;
}

/** Computes the full Tests table for this calculator, live, on every call. */
export function getProperMotionTestRows() {
  return [...referenceRows(), ...consistencyRows(), ...edgeCaseRows()];
}
