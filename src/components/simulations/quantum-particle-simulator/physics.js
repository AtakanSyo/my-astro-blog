// 1D time-dependent Schrödinger equation — numerical engine.
//
// Units: natural/dimensionless simulation units with ħ = 1, matching
// standard practice for pedagogical QM simulators (e.g. PhET's "Quantum
// Bound States"). Position, momentum, energy, and time are all expressed
// in these simulation units, not SI — real photon/electron wave packets
// live on length/time scales far too small to animate directly on a
// screen. See the post text for the full equations and rationale.
//
// Method: Crank-Nicolson finite differences on a fixed spatial grid.
//   iħ ∂ψ/∂t = Ĥψ = -ħ²/(2m) ∂²ψ/∂x² + V(x)ψ
// discretized as
//   (I + i(dt/2ħ)Ĥ) ψ(t+dt) = (I - i(dt/2ħ)Ĥ) ψ(t)
// which is unconditionally stable and exactly norm-preserving (unitary)
// wherever Ĥ is Hermitian — chosen specifically so a user can drag any
// slider live, at any timestep, without the simulation ever blowing up.
// Ĥ is tridiagonal (3-point second-derivative stencil), so each step is
// an O(N) complex tridiagonal solve (Thomas algorithm) — cheap enough to
// run many times per animation frame in plain JS.
//
// Open boundaries are approximated with a complex absorbing potential
// (CAP): a smooth -iη(x) term added only in a thin layer at each edge of
// the grid, which drains probability that reaches the edge instead of
// letting it reflect or wrap around. This is what makes "the particle
// leaves the simulated region" (e.g. a transmitted or reflected packet
// eventually exiting) look like absorption rather than a numerical
// artifact — and it's also why the total norm can decrease over time.

export const HBAR = 1;

// --- grid -------------------------------------------------------------

export function makeGrid(xmin, xmax, n) {
  const dx = (xmax - xmin) / (n - 1);
  const x = new Float64Array(n);
  for (let j = 0; j < n; j++) x[j] = xmin + j * dx;
  return { x, dx, n, xmin, xmax };
}

// --- potentials: V(x_j), real-valued -----------------------------------

export function potentialFree(grid) {
  return new Float64Array(grid.n);
}

// A literal infinite well can't be represented on a finite-difference
// grid, so this uses a wall many times taller than any energy scale in
// the sliders — "numerically infinite." Leakage through it is negligible
// but not exactly zero, which is the honest numerical story.
export function potentialInfiniteWell(grid, halfWidth, wallHeight) {
  const V = new Float64Array(grid.n);
  for (let j = 0; j < grid.n; j++) {
    V[j] = Math.abs(grid.x[j]) > halfWidth ? wallHeight : 0;
  }
  return V;
}

export function potentialFiniteWell(grid, halfWidth, depth) {
  const V = new Float64Array(grid.n);
  for (let j = 0; j < grid.n; j++) {
    V[j] = Math.abs(grid.x[j]) <= halfWidth ? -depth : 0;
  }
  return V;
}

export function potentialHarmonic(grid, k) {
  const V = new Float64Array(grid.n);
  for (let j = 0; j < grid.n; j++) {
    V[j] = 0.5 * k * grid.x[j] * grid.x[j];
  }
  return V;
}

export function potentialStep(grid, height, location) {
  const V = new Float64Array(grid.n);
  for (let j = 0; j < grid.n; j++) {
    V[j] = grid.x[j] > location ? height : 0;
  }
  return V;
}

export function potentialBarrier(grid, height, width, center) {
  const V = new Float64Array(grid.n);
  const half = width / 2;
  for (let j = 0; j < grid.n; j++) {
    V[j] = Math.abs(grid.x[j] - center) <= half ? height : 0;
  }
  return V;
}

// Quadratic complex absorbing potential (CAP) in a layer at each edge of
// the grid. η(x) is added to V as -iη, only inside `widthFrac` of the
// domain length from each boundary.
export function absorbingLayer(grid, widthFrac, strength) {
  const eta = new Float64Array(grid.n);
  const domainLen = grid.xmax - grid.xmin;
  const absWidth = domainLen * widthFrac;
  for (let j = 0; j < grid.n; j++) {
    const x = grid.x[j];
    const distFromLeft = x - grid.xmin;
    const distFromRight = grid.xmax - x;
    let s = 0;
    if (distFromLeft < absWidth) s = 1 - distFromLeft / absWidth;
    else if (distFromRight < absWidth) s = 1 - distFromRight / absWidth;
    eta[j] = strength * s * s;
  }
  return eta;
}

// --- initial state: normalized Gaussian wave packet ---------------------

export function gaussianWavePacket(grid, x0, p0, sigma) {
  const n = grid.n;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  const norm = Math.pow(2 * Math.PI * sigma * sigma, -0.25);
  for (let j = 0; j < n; j++) {
    const dx = grid.x[j] - x0;
    const envelope = norm * Math.exp(-(dx * dx) / (4 * sigma * sigma));
    const phase = (p0 * grid.x[j]) / HBAR;
    re[j] = envelope * Math.cos(phase);
    im[j] = envelope * Math.sin(phase);
  }
  normalizeInPlace(re, im, grid.dx);
  return { re, im };
}

export function normalizeInPlace(re, im, dx) {
  let s = 0;
  for (let j = 0; j < re.length; j++) s += re[j] * re[j] + im[j] * im[j];
  s *= dx;
  const norm = Math.sqrt(s);
  if (norm > 0) {
    for (let j = 0; j < re.length; j++) {
      re[j] /= norm;
      im[j] /= norm;
    }
  }
}

// --- Crank-Nicolson operator -------------------------------------------
//
// Ĥ is tridiagonal: diagonal H_jj = 2κ + V_j - iη_j, off-diagonal
// (constant) H_{j,j±1} = -κ, where κ = ħ²/(2m·dx²) comes from the 3-point
// second-derivative stencil. With β = dt/(2ħ):
//   A = I + iβĤ   (solved against)
//   B = I - iβĤ   (applied to build the right-hand side)
// Both are tridiagonal with the same constant off-diagonal magnitude, so
// the whole step is one real "build b = B·ψ" pass plus one complex
// Thomas-algorithm solve of A·ψ' = b.

export function buildHamiltonianCoeffs(grid, Vreal, eta, mass, dt) {
  const n = grid.n;
  const kappa = (HBAR * HBAR) / (2 * mass * grid.dx * grid.dx);
  const beta = dt / (2 * HBAR);
  const diagAre = new Float64Array(n);
  const diagAim = new Float64Array(n);
  const diagBre = new Float64Array(n);
  const diagBim = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    const Hjj = 2 * kappa + Vreal[j];
    diagAre[j] = 1 + beta * eta[j];
    diagAim[j] = beta * Hjj;
    diagBre[j] = 1 - beta * eta[j];
    diagBim[j] = -beta * Hjj;
  }
  // Off-diagonal of A is purely imaginary: iβ·(-κ) = -iβκ.
  return { diagAre, diagAim, diagBre, diagBim, coupRe: 0, coupIm: -beta * kappa, n };
}

export function createSolverScratch(n) {
  return {
    bRe: new Float64Array(n),
    bIm: new Float64Array(n),
    cPrimeRe: new Float64Array(n),
    cPrimeIm: new Float64Array(n),
    dPrimeRe: new Float64Array(n),
    dPrimeIm: new Float64Array(n),
  };
}

/** Advance ψ (re, im — mutated in place) by one Crank-Nicolson step. */
export function crankNicolsonStep(re, im, coeffs, scratch) {
  const { diagAre, diagAim, diagBre, diagBim, coupRe, coupIm, n } = coeffs;
  const { bRe, bIm, cPrimeRe, cPrimeIm, dPrimeRe, dPrimeIm } = scratch;

  // b = B·ψ (tridiagonal matrix-vector product). B's off-diagonal is the
  // negative of A's off-diagonal (I - iβĤ vs I + iβĤ).
  const bOffRe = -coupRe;
  const bOffIm = -coupIm;
  for (let j = 0; j < n; j++) {
    let br = diagBre[j] * re[j] - diagBim[j] * im[j];
    let bi = diagBre[j] * im[j] + diagBim[j] * re[j];
    let sRe = 0;
    let sIm = 0;
    if (j > 0) {
      sRe += re[j - 1];
      sIm += im[j - 1];
    }
    if (j < n - 1) {
      sRe += re[j + 1];
      sIm += im[j + 1];
    }
    br += bOffRe * sRe - bOffIm * sIm;
    bi += bOffRe * sIm + bOffIm * sRe;
    bRe[j] = br;
    bIm[j] = bi;
  }

  // Complex Thomas algorithm for A·x = b, A tridiagonal with constant
  // off-diagonal (coupRe, coupIm) and per-row diagonal (diagAre, diagAim).
  {
    const mRe = diagAre[0];
    const mIm = diagAim[0];
    const denom = mRe * mRe + mIm * mIm;
    cPrimeRe[0] = (coupRe * mRe + coupIm * mIm) / denom;
    cPrimeIm[0] = (coupIm * mRe - coupRe * mIm) / denom;
    dPrimeRe[0] = (bRe[0] * mRe + bIm[0] * mIm) / denom;
    dPrimeIm[0] = (bIm[0] * mRe - bRe[0] * mIm) / denom;
  }
  for (let j = 1; j < n; j++) {
    const prodRe = coupRe * cPrimeRe[j - 1] - coupIm * cPrimeIm[j - 1];
    const prodIm = coupRe * cPrimeIm[j - 1] + coupIm * cPrimeRe[j - 1];
    const mRe = diagAre[j] - prodRe;
    const mIm = diagAim[j] - prodIm;
    const denom = mRe * mRe + mIm * mIm;
    cPrimeRe[j] = (coupRe * mRe + coupIm * mIm) / denom;
    cPrimeIm[j] = (coupIm * mRe - coupRe * mIm) / denom;
    const rhsRe = bRe[j] - (coupRe * dPrimeRe[j - 1] - coupIm * dPrimeIm[j - 1]);
    const rhsIm = bIm[j] - (coupRe * dPrimeIm[j - 1] + coupIm * dPrimeRe[j - 1]);
    dPrimeRe[j] = (rhsRe * mRe + rhsIm * mIm) / denom;
    dPrimeIm[j] = (rhsIm * mRe - rhsRe * mIm) / denom;
  }

  re[n - 1] = dPrimeRe[n - 1];
  im[n - 1] = dPrimeIm[n - 1];
  for (let j = n - 2; j >= 0; j--) {
    const prodRe = cPrimeRe[j] * re[j + 1] - cPrimeIm[j] * im[j + 1];
    const prodIm = cPrimeRe[j] * im[j + 1] + cPrimeIm[j] * re[j + 1];
    re[j] = dPrimeRe[j] - prodRe;
    im[j] = dPrimeIm[j] - prodIm;
  }
}

// --- observables ---------------------------------------------------------
// Raw (unnormalized against the *current* norm) integrals — callers divide
// by the current norm themselves, since whether to condition on "the
// particle is still in the box" is a display choice, not a physics one.

export function computeNorm(re, im, dx) {
  let s = 0;
  for (let j = 0; j < re.length; j++) s += re[j] * re[j] + im[j] * im[j];
  return s * dx;
}

export function computeExpectationX(re, im, x, dx) {
  let s = 0;
  for (let j = 0; j < re.length; j++) s += (re[j] * re[j] + im[j] * im[j]) * x[j];
  return s * dx;
}

// <p> = ħ·Im(∫ ψ* ∂ψ/∂x dx), via central differences at interior points.
export function computeExpectationP(re, im, dx) {
  const n = re.length;
  let s = 0;
  for (let j = 1; j < n - 1; j++) {
    const dRe = (re[j + 1] - re[j - 1]) / (2 * dx);
    const dIm = (im[j + 1] - im[j - 1]) / (2 * dx);
    s += re[j] * dIm - im[j] * dRe;
  }
  return HBAR * s * dx;
}

// <T> = (ħ²/2m)∫|∂ψ/∂x|² dx, via forward differences — manifestly ≥ 0.
export function computeExpectationKinetic(re, im, mass, dx) {
  const n = re.length;
  let s = 0;
  for (let j = 0; j < n - 1; j++) {
    const dRe = re[j + 1] - re[j];
    const dIm = im[j + 1] - im[j];
    s += dRe * dRe + dIm * dIm;
  }
  return ((HBAR * HBAR) / (2 * mass * dx)) * s;
}

// <V> uses the real potential only — the CAP's -iη is a numerical
// absorption device, not physical potential energy.
export function computeExpectationV(re, im, Vreal, dx) {
  let s = 0;
  for (let j = 0; j < re.length; j++) s += (re[j] * re[j] + im[j] * im[j]) * Vreal[j];
  return s * dx;
}

/** Probability currently to the left / right of x = dividerX. */
export function computeSplitProbabilities(re, im, x, dividerX, dx) {
  let left = 0;
  let right = 0;
  for (let j = 0; j < re.length; j++) {
    const p = re[j] * re[j] + im[j] * im[j];
    if (x[j] < dividerX) left += p;
    else right += p;
  }
  return { left: left * dx, right: right * dx };
}
