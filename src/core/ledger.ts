import {
  ForecastRecord,
  ForecastSourceField,
  IdeaDossier,
  ValidationVerdict
} from "../types/index.js";

/**
 * B1 — Calibration ledger extraction (pure).
 *
 * Every dossier is, at its core, a set of dated falsifiable forecasts. This
 * module extracts them verbatim from the dossier's own fields — the verdict,
 * each kill condition, the weakest assumption's disproof threshold, and the
 * cheapest validation experiment — so outcomes can later be resolved against
 * exactly what the swarm claimed, and Brier-scored.
 *
 * Probability mapping (v1, documented): the swarm does not emit probabilities
 * directly, so each forecast carries an IMPLIED probability derived from the
 * composite resilience score: p = clamp(0.5 + (score − 50)/100, 0.05, 0.95).
 * This mapping is itself a calibration hypothesis — the ledger exists to test
 * and eventually replace it with an outcome-calibrated one. Never present
 * implied probabilities as model-verbatim confidence.
 */

export const PROBABILITY_MAPPING_NOTE =
  "probabilityEstimate is the swarm's implied probability from the v1 score mapping p = clamp(0.5 + (score-50)/100, 0.05, 0.95); it is a calibration hypothesis to be scored against outcomes, not model-verbatim confidence.";

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}

/**
 * Implied probability that the concept ACHIEVES its primary validation success
 * metric, derived from the composite resilience score.
 */
export function impliedSuccessProbability(killScore: number): number {
  return clamp(0.5 + (killScore - 50) / 100, 0.05, 0.95);
}

function firstDayHorizon(text: string, fallback: number): number {
  const match = /(\d+)\s*day/i.exec(text || "");
  const parsed = match ? Number.parseInt(match[1], 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 365 ? parsed : fallback;
}

function forecastId(dossierId: string, refId: string): string {
  return `FC-${dossierId}-${refId}`;
}

function baseRecord(dossier: IdeaDossier, sourceField: ForecastSourceField, refId: string) {
  return {
    id: forecastId(dossier.id, refId),
    dossierId: dossier.id,
    archetype: dossier.domainClassification?.archetypeLabel || "unknown",
    sourceField,
    refId,
    createdAt: dossier.timestamp || new Date().toISOString()
  };
}

/**
 * Extract every resolvable forecast from a dossier. All records are deduped by
 * id; the VERDICT and VALIDATION_EXPERIMENT forecasts share one event definition
 * (the experiment's success metric) so their implied probabilities can be scored
 * independently against the same real-world outcome.
 */
export function extractForecasts(dossier: IdeaDossier): ForecastRecord[] {
  const records: ForecastRecord[] = [];
  const p = impliedSuccessProbability(dossier.killScore);
  const experiment = dossier.cheapestValidationExperiment;
  const experimentDeadline = (experiment?.timeToExecuteDays ?? 4) + 7; // 7-day resolution grace

  // 1. VERDICT — the composite claim itself.
  records.push({
    ...baseRecord(dossier, "VERDICT", "VERDICT"),
    statement: `${dossier.overallVerdict}: concept ${dossier.overallVerdict === "KILL" ? "fails" : "achieves"} its primary validation test — "${experiment?.successMetric || "signed pilot commitments"}" — for "${dossier.idea?.title || "untitled"}".`,
    resolvesTrueWhen: `The success metric ("${experiment?.successMetric || "signed pilot commitments"}") is ${dossier.overallVerdict === "KILL" ? "NOT met by the deadline (verdict correct)" : "met by the deadline (verdict correct)"}.`,
    deadlineDays: firstDayHorizon(dossier.killConditions?.[0] || "", 45),
    probabilityEstimate: dossier.overallVerdict === "KILL" ? Number((1 - p).toFixed(4)) : Number(p.toFixed(4))
  });

  // 2. KILL CONDITIONS — falsifiable triggers; outcome tracking only (no
  // probability estimate, excluded from Brier aggregation).
  (dossier.killConditions || []).forEach((condition, i) => {
    records.push({
      ...baseRecord(dossier, "KILL_CONDITION", `KC-${i + 1}`),
      statement: condition,
      resolvesTrueWhen: "The stated kill-condition trigger occurs by the deadline.",
      deadlineDays: firstDayHorizon(condition, 45)
    });
  });

  // 3. WEAKEST ASSUMPTION — the swarm flags it as most likely false.
  if (dossier.weakestAssumption?.disproofThreshold) {
    records.push({
      ...baseRecord(dossier, "WEAKEST_ASSUMPTION", dossier.weakestAssumption.id || "WA-01"),
      statement: `Weakest assumption disproven: ${dossier.weakestAssumption.disproofThreshold}`,
      resolvesTrueWhen: "The disproof threshold is met by the deadline (assumption invalidated).",
      deadlineDays: firstDayHorizon(dossier.weakestAssumption.disproofThreshold, 30),
      probabilityEstimate: Number((1 - p).toFixed(4))
    });
  }

  // 4. VALIDATION EXPERIMENT — the concrete experiment the roadmap commits to.
  if (experiment?.successMetric) {
    records.push({
      ...baseRecord(dossier, "VALIDATION_EXPERIMENT", "EXP-01"),
      statement: `${experiment.title}: ${experiment.successMetric}`,
      resolvesTrueWhen: `By the deadline: ${experiment.successMetric} (success) — otherwise the failure kill signal holds: ${experiment.failureKillSignal}`,
      deadlineDays: experimentDeadline,
      probabilityEstimate: Number(p.toFixed(4))
    });
  }

  // Dedupe by id (defensive; ids are unique by construction).
  const seen = new Set<string>();
  return records.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
}

/** Verdict-family helper used by tests and the ledger service. */
export function isKillVerdict(verdict: ValidationVerdict): boolean {
  return verdict === "KILL";
}
