/**
 * Calibration metrics for the ledger (review §4.2, §8).
 * Brier = mean squared error of probabilistic forecasts.
 * ECE = binned |confidence − accuracy| (expected calibration error).
 * Until the ledger holds >= 20 resolved outcomes, report n/a — never
 * pass/fail on the old sigma-dispersion gate.
 */

export interface CalibrationResult {
  n: number;
  brier: number | null;
  ece: number | null;
  vetoRate: number | null;
  meanScore: number | null;
}

export function brierScore(probs: number[], outcomes: number[]): number | null {
  if (probs.length === 0 || probs.length !== outcomes.length) return null;
  const mse = probs.reduce((acc, p, i) => acc + Math.pow(p - outcomes[i], 2), 0) / probs.length;
  return Math.round(mse * 10000) / 10000;
}

export function expectedCalibrationError(
  probs: number[],
  outcomes: number[],
  bins = 10
): number | null {
  if (probs.length === 0 || probs.length !== outcomes.length) return null;
  const counts = new Array(bins).fill(0) as number[];
  const confSums = new Array(bins).fill(0) as number[];
  const accSums = new Array(bins).fill(0) as number[];
  probs.forEach((p, i) => {
    const b = Math.min(bins - 1, Math.floor(Math.max(0, Math.min(1, p)) * bins));
    counts[b] += 1;
    confSums[b] += p;
    accSums[b] += outcomes[i];
  });
  let ece = 0;
  for (let b = 0; b < bins; b++) {
    if (counts[b] === 0) continue;
    ece += (counts[b] / probs.length) * Math.abs(confSums[b] / counts[b] - accSums[b] / counts[b]);
  }
  return Math.round(ece * 10000) / 10000;
}

export function summarizeCalibration(
  rows: Array<{ score: number; outcome: string | null; redteamKill?: boolean }>
): CalibrationResult {
  const resolved = rows.filter(
    r => r.outcome === "built" || r.outcome === "killed" || r.outcome === "pivoted"
  );
  const vetos = rows.filter(r => r.redteamKill === true).length;
  const meanScore =
    rows.length > 0 ? Math.round((rows.reduce((a, r) => a + r.score, 0) / rows.length) * 10) / 10 : null;
  if (resolved.length < 20) {
    return {
      n: resolved.length,
      brier: null,
      ece: null,
      vetoRate: rows.length > 0 ? Math.round((vetos / rows.length) * 10000) / 10000 : null,
      meanScore
    };
  }
  const probs = resolved.map(r => Math.max(0, Math.min(1, r.score / 100)));
  const outcomes = resolved.map(r => (r.outcome === "built" ? 1 : 0));
  return {
    n: resolved.length,
    brier: brierScore(probs, outcomes),
    ece: expectedCalibrationError(probs, outcomes),
    vetoRate: rows.length > 0 ? Math.round((vetos / rows.length) * 10000) / 10000 : null,
    meanScore
  };
}
