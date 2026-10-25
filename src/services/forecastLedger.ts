import fs from "node:fs";
import path from "node:path";
import { CalibrationSummary, ForecastRecord, IdeaDossier } from "../types/index.js";
import { extractForecasts, PROBABILITY_MAPPING_NOTE } from "../core/ledger.js";

/**
 * B1 — Calibration ledger service.
 *
 * Event-sourced, append-only JSONL store: each line is either a forecast
 * creation or a resolution. The fold gives the current forecast state; the raw
 * log doubles as an immutable audit trail (who recorded what, when, and how it
 * resolved) — the same dual-key audit ethos as the approval gates.
 */

type LedgerEvent =
  | { type: "forecast"; record: ForecastRecord }
  | { type: "resolution"; id: string; outcome: boolean; notes?: string; resolvedAt: string; resolvedBy?: string };

const RELIABILITY_BUCKETS: Array<[number, number]> = [
  [0, 0.2],
  [0.2, 0.4],
  [0.4, 0.6],
  [0.6, 0.8],
  [0.8, 1.0]
];

export class ForecastLedgerService {
  private events: LedgerEvent[] = [];
  private loaded = false;
  private readonly storagePath: string;

  constructor(storagePath?: string) {
    this.storagePath = storagePath || path.resolve(process.cwd(), "reports", "forecast_ledger.jsonl");
  }

  private load(): void {
    if (this.loaded) return;
    try {
      if (fs.existsSync(this.storagePath)) {
        const lines = fs.readFileSync(this.storagePath, "utf-8").split("\n").filter((l) => l.trim());
        for (const line of lines) {
          try {
            this.events.push(JSON.parse(line));
          } catch {
            // Skip malformed lines — a corrupt line must not poison the ledger.
          }
        }
      }
    } catch {
      // Unreadable store behaves like an empty ledger; appends will recreate it.
    }
    this.loaded = true;
  }

  private appendEvent(event: LedgerEvent): void {
    this.load();
    this.events.push(event);
    try {
      fs.mkdirSync(path.dirname(this.storagePath), { recursive: true });
      fs.appendFileSync(this.storagePath, `${JSON.stringify(event)}\n`, "utf-8");
    } catch (err: any) {
      // Storage failure must not break evaluation; the in-memory state stays usable.
      console.warn(`[ForecastLedger] append failed: ${err?.message || err}`);
    }
  }

  private fold(): Map<string, ForecastRecord> {
    this.load();
    const byId = new Map<string, ForecastRecord>();
    for (const event of this.events) {
      if (event.type === "forecast") {
        byId.set(event.record.id, event.record);
      } else if (event.type === "resolution") {
        const record = byId.get(event.id);
        if (record) {
          record.resolved = {
            outcome: event.outcome,
            notes: event.notes,
            resolvedAt: event.resolvedAt,
            resolvedBy: event.resolvedBy
          };
        }
      }
    }
    return byId;
  }

  /**
   * Extract and record all forecasts for a dossier. Idempotent per dossierId:
   * re-evaluations or replays never duplicate entries.
   */
  public recordDossierForecasts(dossier: IdeaDossier): number {
    this.load();
    const alreadyRecorded = this.events.some(
      (e) => e.type === "forecast" && e.record.dossierId === dossier.id
    );
    if (alreadyRecorded) return 0;

    const records = extractForecasts(dossier);
    for (const record of records) {
      this.appendEvent({ type: "forecast", record });
    }
    return records.length;
  }

  public resolveForecast(id: string, outcome: boolean, notes?: string, resolvedBy?: string): ForecastRecord {
    const byId = this.fold();
    const record = byId.get(id);
    if (!record) throw new Error(`Forecast '${id}' not found in ledger`);
    if (record.resolved) throw new Error(`Forecast '${id}' is already resolved — resolutions are immutable`);
    this.appendEvent({
      type: "resolution",
      id,
      outcome,
      notes,
      resolvedAt: new Date().toISOString(),
      resolvedBy
    });
    return this.fold().get(id)!;
  }

  public listForecasts(filter: { status?: "pending" | "resolved"; archetype?: string } = {}): ForecastRecord[] {
    const byId = this.fold();
    let records = [...byId.values()];
    if (filter.status === "pending") records = records.filter((r) => !r.resolved);
    if (filter.status === "resolved") records = records.filter((r) => r.resolved);
    if (filter.archetype) records = records.filter((r) => r.archetype === filter.archetype);
    return records.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  public getForecast(id: string): ForecastRecord | null {
    return this.fold().get(id) || null;
  }

  /** Mean Brier score over resolved forecasts that carry a probability estimate. */
  public calibrationSummary(): CalibrationSummary {
    const byId = this.fold();
    const records = [...byId.values()];
    const resolved = records.filter((r) => r.resolved);
    const scoreable = resolved.filter((r) => typeof r.probabilityEstimate === "number");

    const brier = scoreable.length
      ? scoreable.reduce((acc, r) => acc + Math.pow(r.probabilityEstimate! - (r.resolved!.outcome ? 1 : 0), 2), 0) / scoreable.length
      : null;

    const archetypeMap = new Map<string, ForecastRecord[]>();
    for (const r of records) {
      const list = archetypeMap.get(r.archetype) || [];
      list.push(r);
      archetypeMap.set(r.archetype, list);
    }
    const byDomain = [...archetypeMap.entries()].map(([archetype, list]) => {
      const res = list.filter((r) => r.resolved && typeof r.probabilityEstimate === "number");
      const b = res.length
        ? res.reduce((acc, r) => acc + Math.pow(r.probabilityEstimate! - (r.resolved!.outcome ? 1 : 0), 2), 0) / res.length
        : null;
      const rate = res.length ? res.filter((r) => r.resolved!.outcome).length / res.length : null;
      return { archetype, recorded: list.length, resolved: res.length, brier: b === null ? null : Number(b.toFixed(4)), observedOutcomeRate: rate === null ? null : Number(rate.toFixed(4)) };
    });

    const reliability = RELIABILITY_BUCKETS.map(([lo, hi]) => {
      const inBucket = scoreable.filter((r) => r.probabilityEstimate! >= lo && (hi === 1.0 ? r.probabilityEstimate! <= hi : r.probabilityEstimate! < hi));
      return {
        bucket: [lo, hi] as [number, number],
        count: inBucket.length,
        predicted: inBucket.length ? Number((inBucket.reduce((a, r) => a + r.probabilityEstimate!, 0) / inBucket.length).toFixed(4)) : 0,
        observed: inBucket.length ? Number((inBucket.filter((r) => r.resolved!.outcome).length / inBucket.length).toFixed(4)) : 0
      };
    });

    return {
      totals: { recorded: records.length, resolved: resolved.length, pending: records.length - resolved.length },
      brierOverall: brier === null ? null : Number(brier.toFixed(4)),
      byDomain,
      reliability,
      mappingNote: PROBABILITY_MAPPING_NOTE
    };
  }
}

export const forecastLedger = new ForecastLedgerService();
