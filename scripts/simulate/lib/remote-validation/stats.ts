/**
 * Remote-validation harness — statistics primitives.
 *
 * Deliberately self-contained (no dependency on a stats package) so the
 * harness is deterministic and auditable in CI. The correlation primitives
 * mirror `scripts/simulate/validate-derived-chemistry.ts`; the regression and
 * p-value code is new and is verified by the harness self-test against
 * planted coefficients (`simulate:remote-validation:fixture`).
 */

export function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function sd(xs: number[]): number {
  return Math.sqrt(variance(xs));
}

export function variance(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return xs.reduce((s, v) => s + (v - m) ** 2, 0) / xs.length;
}

export function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n === 0) return 0;
  const mx = mean(x);
  const my = mean(y);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  return dx === 0 || dy === 0 ? 0 : num / Math.sqrt(dx * dy);
}

/** Average-rank (tie-corrected) encoding. */
export function rank(x: number[]): number[] {
  const order = x.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const ranks = new Array(x.length).fill(0);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[order[k][1]] = avg;
    i = j + 1;
  }
  return ranks;
}

export function spearman(x: number[], y: number[]): number {
  return pearson(rank(x), rank(y));
}

/** Fisher z transform of a correlation. */
export function fisherZ(r: number): number {
  const clamped = Math.max(-0.999999, Math.min(0.999999, r));
  return 0.5 * Math.log((1 + clamped) / (1 - clamped));
}

/** 95% CI for a correlation via the Fisher z transform. */
export function pearsonCI(r: number, n: number, z = 1.959964): [number, number] {
  if (n < 4) return [Number.NaN, Number.NaN];
  const se = 1 / Math.sqrt(n - 3);
  const zr = fisherZ(r);
  const lo = Math.tanh(zr - z * se);
  const hi = Math.tanh(zr + z * se);
  return [lo, hi];
}

// ── Student-t distribution (for regression coefficient p-values) ──────
// Regularized incomplete beta via the Numerical Recipes continued fraction.
// Needed because a panel is 300–500 respondents (df large but not infinite)
// and a normal approximation would overstate significance at small df.

function logGamma(x: number): number {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += cof[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200;
  const EPS = 3e-12;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function regularizedIncompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Two-sided p-value for a t statistic with df degrees of freedom. */
export function studentTPValue(t: number, df: number): number {
  if (df <= 0 || !Number.isFinite(t)) return Number.NaN;
  const x = df / (df + t * t);
  return regularizedIncompleteBeta(df / 2, 0.5, x);
}

export interface RegressionTerm {
  name: string;
  beta: number;
  se: number;
  t: number;
  p: number;
}

export interface RegressionResult {
  terms: RegressionTerm[];
  intercept: number;
  r2: number;
  adjR2: number;
  n: number;
  df: number;
}

/**
 * Ordinary least squares with intercept. Predictors are used as supplied (the
 * caller standardizes when beta comparability matters). Standard errors are
 * the classical OLS estimates; p-values are two-sided Student-t.
 */
export function ols(y: number[], predictors: number[][]): RegressionResult {
  const n = y.length;
  const k = predictors.length;
  const X: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row = [1];
    for (let j = 0; j < k; j++) row.push(predictors[j][i]);
    X.push(row);
  }
  const cols = k + 1;

  const XtX = Array.from({ length: cols }, () => new Array(cols).fill(0));
  const Xty = new Array(cols).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < cols; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < cols; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }

  const inv = invertMatrix(XtX);
  const beta = inv.map((row) => row.reduce((s, v, j) => s + v * Xty[j], 0));

  let ssRes = 0;
  const yhat = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let a = 0; a < cols; a++) yhat[i] += X[i][a] * beta[a];
    ssRes += (y[i] - yhat[i]) ** 2;
  }
  const yMean = mean(y);
  const ssTot = y.reduce((s, v) => s + (v - yMean) ** 2, 0);
  const df = n - cols;
  const sigma2 = df > 0 ? ssRes / df : 0;

  const terms: RegressionTerm[] = [];
  for (let a = 1; a < cols; a++) {
    const se = Math.sqrt(Math.max(0, sigma2 * inv[a][a]));
    const t = se === 0 ? 0 : beta[a] / se;
    terms.push({ name: `x${a}`, beta: beta[a], se, t, p: studentTPValue(t, df) });
  }

  return {
    terms,
    intercept: beta[0],
    r2: ssTot === 0 ? 0 : 1 - ssRes / ssTot,
    adjR2: ssTot === 0 ? 0 : 1 - (1 - (1 - ssRes / ssTot)) * ((n - 1) / Math.max(1, df)),
    n,
    df,
  };
}

/** Gauss-Jordan inversion with partial pivoting. */
function invertMatrix(m: number[][]): number[][] {
  const n = m.length;
  const a = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) throw new Error('Singular matrix in OLS — predictors are collinear.');
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const pv = a[col][col];
    for (let j = 0; j < 2 * n; j++) a[col][j] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = a[r][col];
      for (let j = 0; j < 2 * n; j++) a[r][j] -= factor * a[col][j];
    }
  }
  return a.map((row) => row.slice(n));
}

/** Standardize to mean 0 / sd 1 (returns zeros for a constant vector). */
export function zscore(xs: number[]): number[] {
  const m = mean(xs);
  const s = sd(xs);
  return s === 0 ? xs.map(() => 0) : xs.map((v) => (v - m) / s);
}

/** Floor a numeric value for display so reports never print `-0.000`. */
export function round(x: number, digits = 3): number {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}
