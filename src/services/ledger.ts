import fs from "node:fs/promises";
import path from "node:path";
import { IdeaDossier } from "../types/index.js";

/**
 * Dossier Forecast Ledger — the calibration memory of the platform.
 *
 * Every kill condition, weakest assumption, and validation experiment becomes a
 * DATED, FALSIFIABLE forecast at dossier compile time, with a verdict-implied
 * probability. When outcomes resolve, Brier scoring produces the per-domain and
 * per-model calibration track record that no prompt wrapper can replicate.
 *
 * Honesty contract: probabilities are MODELING CHOICES derived from swarm scores
 * (documented below), never presented as measured frequencies. They only become
 * meaningful once resolved forecasts accumulate.
 */

const LEDGER_DIR = path.resolve(process.cwd(), "reports", "forecasts");

export type ForecastKind = "KILL_CONDITION" | "WEAKEST_ASSUMPTION" | "VALIDATION_EXPERIMENT";
export type ForecastOutcome = "HIT" | "MISS";

export interface ForecastRecord {
  id: string;
  dossierId: string;
  createdAt: string;
  dueDate: string;
  kind: ForecastKind;
  /** The falsifiable claim, phrased as an observable event. */
  statement: string;
  /** How an operator observes the outcome in the field. */
  resolutionProxy: string;
  /**
   * Verdict-implied P(event) at creation time. Modeling choice:
   *  - KILL_CONDITION / WEAKEST_ASSUMPTION: P(trigger) = (100 - relevant agent score) / 100
   *  - VALIDATION_EXPERIMENT: P(success) = customer-advocate score / 100
   * Clamped to [0.05, 0.95] to keep Brier scores finite at the extremes.
   */
  probability: number;
  status: "PENDING" | "HIT" | "MISS" | "EXPIRED";
  resolvedAt?: string;
  notes?: string;
  domainArchetype: string;
  evaluationMode?: string;
  modelId?: string;
  killScore: number;
  overallVerdict: string;
}

function clampProbability(p: number): number {
  return Math.max(0.05, Math.min(0.95, Number(p.toFixed(4)) || 0.5));
}

function extractDueDays(text: string, fallbackDays: number): number {
  const match = /within (\d+) days?/i.exec(text) || /(\d+)\s*(?:day|days)\b/i.exec(text);
  return match ? Math.max(1, Math.min(365, parseInt(match[1], 10))) : fallbackDays;
}

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

/** Extract the forecast set from a compiled dossier. */
export function extractForecasts(dossier: IdeaDossier): ForecastRecord[] {
  const createdAt = dossier.timestamp;
  const domain = dossier.domainClassification.archetypeLabel;
  const modelId = dossier.roleAssessments?.synthesizer?.telemetryMetadata?.modelId;
  const records: ForecastRecord[] = [];
  let seq = 0;
  const nextId = () => `FC-${dossier.id.replace(/[^A-Z0-9]/gi, "")}-${String(++seq).padStart(2, "0")}`;

  const base = {
    dossierId: dossier.id,
    createdAt,
    domainArchetype: domain,
    evaluationMode: dossier.evaluationMode,
    modelId,
    killScore: dossier.killScore,
    overallVerdict: dossier.overallVerdict
  };

  // Kill conditions → trigger forecasts. Relevant-agent mapping:
  // adoption/pilot → customer advocate, regulatory → domain expert, economics → investor.
  const killAgentScores = [
    dossier.roleAssessments?.customer?.score ?? 50,
    dossier.roleAssessments?.expert?.score ?? 50,
    dossier.roleAssessments?.investor?.score ?? 50
  ];
  (dossier.killConditions || []).forEach((statement, i) => {
    const dueDays = extractDueDays(statement, 45);
    records.push({
      ...base,
      id: nextId(),
      kind: "KILL_CONDITION",
      statement,
      resolutionProxy: `Operator observes in the field whether the stated condition comes true within ${dueDays} days of ${createdAt.slice(0, 10)}.`,
      probability: clampProbability((100 - (killAgentScores[i] ?? 50)) / 100),
      dueDate: addDays(createdAt, dueDays),
      status: "PENDING"
    });
  });

  // Weakest assumption → trigger forecast keyed to the Red Team's severity.
  const wa = dossier.weakestAssumption;
  if (wa) {
    const dueDays = extractDueDays(wa.disproofThreshold || "", 14);
    records.push({
      ...base,
      id: nextId(),
      kind: "WEAKEST_ASSUMPTION",
      statement: wa.statement,
      resolutionProxy: `${wa.disproofThreshold} (Red Team fatal risk: "${wa.fatalRisk}")`,
      probability: clampProbability((100 - (dossier.roleAssessments?.redteam?.score ?? 50)) / 100),
      dueDate: addDays(createdAt, dueDays),
      status: "PENDING"
    });
  }

  // Validation experiment → success forecast.
  const exp = dossier.cheapestValidationExperiment;
  if (exp) {
    records.push({
      ...base,
      id: nextId(),
      kind: "VALIDATION_EXPERIMENT",
      statement: `${exp.title}: ${exp.successMetric}`,
      resolutionProxy: `Run the experiment (${exp.estimatedCostUsd === 0 ? "$0" : `$${exp.estimatedCostUsd}`} budget). Kill signal: ${exp.failureKillSignal}`,
      probability: clampProbability((dossier.roleAssessments?.customer?.score ?? 50) / 100),
      dueDate: addDays(createdAt, Math.max(1, exp.timeToExecuteDays || 14)),
      status: "PENDING"
    });
  }

  return records;
}

export class DossierForecastLedger {
  private static instance: DossierForecastLedger;
  private constructor() {}

  public static getInstance(): DossierForecastLedger {
    if (!DossierForecastLedger.instance) {
      DossierForecastLedger.instance = new DossierForecastLedger();
    }
    return DossierForecastLedger.instance;
  }

  private filePath(id: string): string {
    return path.join(LEDGER_DIR, `${id.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`);
  }

  /** Persist forecasts extracted from a dossier. Returns the records as stored. */
  public async persistDossierForecasts(dossier: IdeaDossier): Promise<ForecastRecord[]> {
    const records = extractForecasts(dossier);
    await fs.mkdir(LEDGER_DIR, { recursive: true });
    for (const record of records) {
      await fs.writeFile(this.filePath(record.id), JSON.stringify(record, null, 2), "utf-8");
    }
    return records;
  }

  /** Retrieve a single forecast by ID directly. */
  public async getForecast(id: string): Promise<ForecastRecord | null> {
    try {
      const data = await fs.readFile(this.filePath(id), "utf-8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  public async listForecasts(limit = 50, status?: ForecastRecord["status"]): Promise<ForecastRecord[]> {
    await fs.mkdir(LEDGER_DIR, { recursive: true });
    const files = await fs.readdir(LEDGER_DIR);
    const records: ForecastRecord[] = [];
    for (const file of files.filter((f) => f.endsWith(".json"))) {
      try {
        records.push(JSON.parse(await fs.readFile(path.join(LEDGER_DIR, file), "utf-8")));
      } catch {
        // skip corrupted records
      }
    }
    records.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
    const filtered = status ? records.filter((r) => r.status === status) : records;
    return filtered.slice(0, limit);
  }

  public async resolveForecast(id: string, outcome: ForecastOutcome, notes?: string): Promise<ForecastRecord | null> {
    let record: ForecastRecord;
    try {
      record = JSON.parse(await fs.readFile(this.filePath(id), "utf-8"));
    } catch {
      return null;
    }
    if (record.status !== "PENDING") {
      return null; // already resolved — immutable once resolved
    }
    record.status = outcome;
    record.resolvedAt = new Date().toISOString();
    if (notes) record.notes = notes.slice(0, 500);
    await fs.writeFile(this.filePath(id), JSON.stringify(record, null, 2), "utf-8");
    return record;
  }

  /**
   * Brier score = mean((p - outcome)^2) over resolved forecasts, where outcome is
   * 1 for HIT and 0 for MISS. Lower is better; 0.25 = always guessing 50%.
   * Grouped by domain archetype and modelId, since calibration is model-dependent.
   */
  public async scoreForecasts(): Promise<{
    resolvedCount: number;
    pendingCount: number;
    overallBrier: number | null;
    byDomain: Record<string, number>;
    byModel: Record<string, number>;
    calibrationBins: Array<{ bin: string; count: number; meanProbability: number; hitRate: number }>;
  }> {
    const all = await this.listForecasts(10000);
    const resolved = all.filter((r) => r.status === "HIT" || r.status === "MISS");
    const brier = (rs: ForecastRecord[]) =>
      rs.length === 0
        ? null
        : rs.reduce((acc, r) => acc + Math.pow(r.probability - (r.status === "HIT" ? 1 : 0), 2), 0) / rs.length;

    const groupBy = (rs: ForecastRecord[], key: (r: ForecastRecord) => string) => {
      const out: Record<string, number> = {};
      for (const r of rs) {
        const k = key(r) || "unknown";
        const group = rs.filter((x) => (key(x) || "unknown") === k);
        const b = brier(group);
        if (b !== null) out[k] = Math.round(b * 1000) / 1000;
      }
      return out;
    };

    const binsSpec = [
      ["0-20", 0, 0.2], ["20-40", 0.2, 0.4], ["40-60", 0.4, 0.6],
      ["60-80", 0.6, 0.8], ["80-100", 0.8, 1.001]
    ] as const;
    const calibrationBins = binsSpec.map(([bin, lo, hi]) => {
      const group = resolved.filter((r) => r.probability >= lo && r.probability < hi);
      return {
        bin,
        count: group.length,
        meanProbability: group.length ? Math.round((group.reduce((a, r) => a + r.probability, 0) / group.length) * 100) / 100 : 0,
        hitRate: group.length ? Math.round((group.filter((r) => r.status === "HIT").length / group.length) * 100) : 0
      };
    });

    return {
      resolvedCount: resolved.length,
      pendingCount: all.length - resolved.length,
      overallBrier: brier(resolved),
      byDomain: groupBy(resolved, (r) => r.domainArchetype),
      byModel: groupBy(resolved, (r) => r.modelId || "unknown"),
      calibrationBins
    };
  }
}

export const forecastLedger = DossierForecastLedger.getInstance();
