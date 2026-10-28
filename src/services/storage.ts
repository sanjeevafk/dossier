import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { IdeaDossier, ApprovalAction } from "../types/index.js";

const require = createRequire(import.meta.url);

const DATA_DIR = process.env.DOSSIER_DATA_DIR
  ? path.resolve(process.env.DOSSIER_DATA_DIR)
  : process.env.NODE_ENV === "test"
  ? path.resolve(process.cwd(), "data/test")
  : path.resolve(process.cwd(), "data");
const STORAGE_DIR = path.join(DATA_DIR, "reports");
const DB_PATH = path.join(DATA_DIR, "dossiers.db");

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface DossierSummary {
  id: string;
  dossierCode: string;
  title: string;
  archetype: string;
  archetypeLabel: string;
  verdict: string;
  score: number;
  riskLevel: string;
  timestamp: string;
}

type SqliteDb = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    run: (...args: unknown[]) => void;
    get: (...args: unknown[]) => Record<string, unknown> | undefined;
    all: (...args: unknown[]) => Record<string, unknown>[];
  };
};

export class DossierStorageService {
  private static instance: DossierStorageService;
  private static readonly MAX_CACHE_SIZE = 25;
  private memoryCache: Map<string, IdeaDossier> = new Map();
  private db: SqliteDb | null = null;

  private setCache(id: string, dossier: IdeaDossier): void {
    if (this.memoryCache.has(id)) {
      this.memoryCache.delete(id);
    } else if (this.memoryCache.size >= DossierStorageService.MAX_CACHE_SIZE) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) this.memoryCache.delete(oldestKey);
    }
    this.memoryCache.set(id, dossier);
  }

  private constructor() {}

  public static getInstance(): DossierStorageService {
    if (!DossierStorageService.instance) {
      DossierStorageService.instance = new DossierStorageService();
    }
    return DossierStorageService.instance;
  }

  private getDb(): SqliteDb {
    if (this.db) return this.db;
    fsSync.mkdirSync(DATA_DIR, { recursive: true });
    const Database = require("better-sqlite3");
    const db: SqliteDb = new Database(DB_PATH);
    db.exec(`
      CREATE TABLE IF NOT EXISTS dossiers (
        id TEXT PRIMARY KEY,
        code TEXT,
        title TEXT,
        archetype TEXT,
        verdict TEXT,
        score INTEGER,
        risk TEXT,
        mode TEXT,
        created_at TEXT,
        dossier_json TEXT
      );
      CREATE TABLE IF NOT EXISTS recon_cache (
        query_key TEXT PRIMARY KEY,
        provider TEXT,
        response_json TEXT,
        expires_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS ledger (
        dossier_id TEXT PRIMARY KEY,
        score INTEGER,
        archetype TEXT,
        mode TEXT,
        outcome TEXT,
        revenue_usd REAL,
        pilots INTEGER,
        created_at TEXT,
        outcome_at TEXT
      );
      CREATE TABLE IF NOT EXISTS monitor_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dossier_id TEXT,
        source TEXT,
        url TEXT,
        summary TEXT,
        created_at TEXT
      );
    `);
    this.db = db;
    return db;
  }

  public getReconCache(queryKey: string): { provider: string; response: unknown } | null {
    try {
      const row = this.getDb()
        .prepare("SELECT provider, response_json, expires_at FROM recon_cache WHERE query_key = ?")
        .get(queryKey.toLowerCase()) as { provider: string; response_json: string; expires_at: number } | undefined;
      if (!row || row.expires_at < Date.now()) return null;
      return { provider: row.provider, response: JSON.parse(row.response_json) };
    } catch {
      return null;
    }
  }

  public setReconCache(queryKey: string, provider: string, response: unknown): void {
    try {
      this.getDb()
        .prepare("INSERT OR REPLACE INTO recon_cache (query_key, provider, response_json, expires_at) VALUES (?, ?, ?, ?)")
        .run(queryKey.toLowerCase(), provider, JSON.stringify(response), Date.now() + ONE_WEEK_MS);
    } catch {
      // cache write failure must never break evaluation
    }
  }

  public recordLedger(dossier: IdeaDossier): void {
    try {
      this.getDb()
        .prepare(
          "INSERT OR IGNORE INTO ledger (dossier_id, score, archetype, mode, outcome, created_at) VALUES (?, ?, ?, ?, NULL, ?)"
        )
        .run(
          dossier.id,
          dossier.killScore,
          dossier.domainClassification?.archetype ?? "general_startup",
          (dossier as { evaluationMode?: string }).evaluationMode ?? "HEURISTIC_ENGINE",
          dossier.timestamp
        );
    } catch {
      // ledger write failure must never break evaluation
    }
  }

  public listLedger(): Array<Record<string, unknown>> {
    try {
      return this.getDb().prepare("SELECT * FROM ledger ORDER BY created_at DESC LIMIT 500").all();
    } catch {
      return [];
    }
  }

  public appendMonitorAlerts(
    alerts: Array<{ dossierId: string; source: string; url: string; summary: string; at?: string }>
  ): void {
    if (alerts.length === 0) return;
    try {
      const db = this.getDb();
      const stmt = db.prepare(
        "INSERT INTO monitor_alerts (dossier_id, source, url, summary, created_at) VALUES (?, ?, ?, ?, ?)"
      );
      for (const a of alerts) {
        stmt.run(a.dossierId, a.source, a.url, a.summary, a.at ?? new Date().toISOString());
      }
    } catch {
      // alert persistence must never break the monitor
    }
  }

  public listMonitorAlerts(dossierId?: string, limit = 50): Array<Record<string, unknown>> {
    try {
      if (dossierId) {
        return this.getDb()
          .prepare("SELECT * FROM monitor_alerts WHERE dossier_id = ? ORDER BY created_at DESC LIMIT ?")
          .all(dossierId, Math.max(1, Math.min(200, limit)));
      }
      return this.getDb()
        .prepare("SELECT * FROM monitor_alerts ORDER BY created_at DESC LIMIT ?")
        .all(Math.max(1, Math.min(200, limit)));
    } catch {
      return [];
    }
  }

  public updateOutcome(
    dossierId: string,
    outcome: string,
    revenueUsd?: number,
    pilots?: number
  ): boolean {
    try {
      this.getDb()
        .prepare("UPDATE ledger SET outcome = ?, revenue_usd = ?, pilots = ?, outcome_at = ? WHERE dossier_id = ?")
        .run(outcome, revenueUsd ?? null, pilots ?? null, new Date().toISOString(), dossierId);
      return true;
    } catch {
      return false;
    }
  }

  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
    } catch {
      // directory already exists
    }
  }

  /**
   * Persist a compiled idea dossier to disk and memory cache.
   */
  public async saveDossier(dossier: IdeaDossier): Promise<void> {
    await this.ensureStorageDir();
    this.setCache(dossier.id, dossier);

    try {
      this.getDb()
        .prepare(
          "INSERT OR REPLACE INTO dossiers (id, code, title, archetype, verdict, score, risk, mode, created_at, dossier_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .run(
          dossier.id,
          dossier.dossierCode,
          dossier.idea?.title ?? "Untitled Concept",
          dossier.domainClassification?.archetype ?? "general_startup",
          dossier.overallVerdict,
          dossier.killScore,
          dossier.riskLevel,
          (dossier as { evaluationMode?: string }).evaluationMode ?? "HEURISTIC_ENGINE",
          dossier.timestamp,
          JSON.stringify(dossier)
        );
      this.recordLedger(dossier);
    } catch {
      // SQLite write failure falls through to JSON backup below
    }

    const safeId = dossier.id.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filePath = path.join(STORAGE_DIR, `dossier_${safeId}.json`);

    try {
      await fs.writeFile(filePath, JSON.stringify(dossier, null, 2), "utf-8");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[Storage] Failed to write dossier to disk: ${message}`);
    }
  }

  /**
   * Retrieve a dossier by ID.
   */
  public async getDossier(id: string): Promise<IdeaDossier | null> {
    if (this.memoryCache.has(id)) {
      const cached = this.memoryCache.get(id)!;
      // Refresh MRU position
      this.memoryCache.delete(id);
      this.memoryCache.set(id, cached);
      return cached;
    }

    try {
      const row = this.getDb()
        .prepare("SELECT dossier_json FROM dossiers WHERE id = ? OR code = ?")
        .get(id, id) as { dossier_json: string } | undefined;
      if (row?.dossier_json) {
        const dossier: IdeaDossier = JSON.parse(row.dossier_json);
        this.setCache(dossier.id, dossier);
        return dossier;
      }
    } catch {
      // fall through to JSON backup
    }

    await this.ensureStorageDir();
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filePath = path.join(STORAGE_DIR, `dossier_${safeId}.json`);

    try {
      const data = await fs.readFile(filePath, "utf-8");
      const dossier: IdeaDossier = JSON.parse(data);
      this.setCache(id, dossier);
      return dossier;
    } catch {
      // Also search through all json files in reports/
      const files = await fs.readdir(STORAGE_DIR).catch(() => []);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        try {
          const content = await fs.readFile(path.join(STORAGE_DIR, file), "utf-8");
          const parsed = JSON.parse(content);
          const target = parsed.dossier || parsed;
          if (target.id === id || target.dossierCode === id) {
            this.setCache(id, target);
            return target;
          }
        } catch {}
      }
      return null;
    }
  }

  /**
   * List recent dossiers with metadata summaries.
   */
  public async listDossiers(limit: number = 20): Promise<DossierSummary[]> {
    await this.ensureStorageDir();
    const summaries: DossierSummary[] = [];
    const seenIds = new Set<string>();

    try {
      const rows = this.getDb()
        .prepare("SELECT id, code, title, archetype, verdict, score, risk, created_at FROM dossiers ORDER BY created_at DESC LIMIT ?")
        .all(Math.max(1, Math.min(500, limit))) as Array<{
        id: string; code: string; title: string; archetype: string;
        verdict: string; score: number; risk: string; created_at: string;
      }>;
      const archetypeLabels: Record<string, string> = {
        b2b_saas: "B2B Enterprise & Vertical SaaS",
        b2g_govtech: "Government Technology & Civic Systems (B2G)",
        healthcare_clinical: "Healthcare & Clinical Systems",
        hardware_robotics: "Hardware, Robotics & Autonomous Systems",
        consumer_social: "Consumer & Social Applications",
        deeptech_research: "DeepTech & Formal Research",
        web3_defi: "Web3 & Decentralized Infrastructure",
        general_startup: "General Commercial"
      };
      for (const r of rows) {
        if (!r?.id || seenIds.has(r.id)) continue;
        seenIds.add(r.id);
        summaries.push({
          id: r.id,
          dossierCode: r.code || "TF-001",
          title: r.title || "Untitled Concept",
          archetype: r.archetype || "general_startup",
          archetypeLabel: archetypeLabels[r.archetype] || "General Commercial",
          verdict: r.verdict || "BUILD_IF_VALIDATED",
          score: r.score ?? 75,
          riskLevel: r.risk || "MEDIUM",
          timestamp: r.created_at || new Date().toISOString()
        });
      }
      if (summaries.length > 0) return summaries.slice(0, limit);
    } catch {
      // fall through to memory + disk scan
    }

    // 1. From memory cache
    for (const d of this.memoryCache.values()) {
      seenIds.add(d.id);
      summaries.push({
        id: d.id,
        dossierCode: d.dossierCode,
        title: d.idea.title,
        archetype: d.domainClassification?.archetype || "general_startup",
        archetypeLabel: d.domainClassification?.archetypeLabel || "General Commercial",
        verdict: d.overallVerdict,
        score: d.killScore,
        riskLevel: d.riskLevel,
        timestamp: d.timestamp
      });
    }

    // 2. From disk reports
    try {
      const files = await fs.readdir(STORAGE_DIR);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        try {
          const content = await fs.readFile(path.join(STORAGE_DIR, file), "utf-8");
          const parsed = JSON.parse(content);
          const d: IdeaDossier = parsed.dossier || parsed;

          if (d && d.id && !seenIds.has(d.id)) {
            seenIds.add(d.id);
            this.setCache(d.id, d);
            summaries.push({
              id: d.id,
              dossierCode: d.dossierCode || "TF-001",
              title: d.idea?.title || "Untitled Concept",
              archetype: d.domainClassification?.archetype || "general_startup",
              archetypeLabel: d.domainClassification?.archetypeLabel || "General Commercial",
              verdict: d.overallVerdict || "BUILD_IF_VALIDATED",
              score: d.killScore ?? 75,
              riskLevel: d.riskLevel || "MEDIUM",
              timestamp: d.timestamp || new Date().toISOString()
            });
          }
        } catch {}
      }
    } catch {}

    // Sort descending by timestamp
    summaries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return summaries.slice(0, limit);
  }

  /**
   * Update the status of a human approval gate action persistently across dossiers.
   */
  public async updateApprovalStatus(
    actionId: string,
    decision: "APPROVED" | "REJECTED"
  ): Promise<{ updated: boolean; dossierId?: string; action?: ApprovalAction }> {
    const newStatus = decision === "APPROVED" ? "APPROVED" : "REJECTED";

    // Search cache and disk
    await this.listDossiers(50); // hydrate cache

    for (const [id, dossier] of this.memoryCache.entries()) {
      const gate = dossier.approvalGates?.find(g => g.id === actionId);
      if (gate) {
        gate.status = newStatus;
        await this.saveDossier(dossier);
        return { updated: true, dossierId: id, action: gate };
      }
    }

    return { updated: false };
  }

  /**
   * Export a dossier as clean GitHub Flavored Markdown.
   */
  public exportDossierMarkdown(d: IdeaDossier): string {
    const domain = d.domainClassification;
    const rb = d.resilienceBreakdown;
    const exp = d.cheapestValidationExperiment;

    return `# DOSSIER REPORT: ${d.idea.title.toUpperCase()}
> **Dossier Code:** \`${d.dossierCode}\` | **ID:** \`${d.id}\` | **Date:** \`${d.timestamp.slice(0, 10)}\`  
> **Status:** \`COMPILED\` | **Harness:** \`Dossier Autonomous Swarm\` | **Protocol:** \`Epistemic Robust Verifier\`

---

## 1. Executive Summary & Swarm Consensus

**Overall Verdict:** \`${d.overallVerdict}\`  
**Composite Resilience Score:** \`${d.killScore}/100\` (Confidence: \`${d.confidenceScore}%\`, Risk: \`${d.riskLevel}\`)  

${d.executiveSummary}

### Domain Classification
- **Domain Archetype:** ${domain.archetypeLabel}
- **Primary Customer:** ${domain.primaryCustomer}
- **Procurement & Sales Cycle:** ${domain.procurementCycle}
- **Regulatory Framework:** ${domain.regulatoryEnvironment}
- **Unit Economics Model:** ${domain.unitEconomicsModel}

---

## 2. Transparent 5-Dimensional Resilience Breakdown

| Dimension | Weight | Score | Evaluation Rationale |
|:---|:---:|:---:|:---|
| **Technical Feasibility** | 20% | **${rb.technicalFeasibility}%** | ${rb.dimensionRationales.technicalFeasibility} |
| **Demand & Adoption** | 25% | **${rb.demandAndAdoption}%** | ${rb.dimensionRationales.demandAndAdoption} |
| **Economics & Capital** | 20% | **${rb.economicsAndCapitalEfficiency}%** | ${rb.dimensionRationales.economicsAndCapitalEfficiency} |
| **Defensibility & Moat** | 15% | **${rb.defensibilityAndMoat}%** | ${rb.dimensionRationales.defensibilityAndMoat} |
| **Adversarial Resilience** | 20% | **${rb.adversarialResilience}%** | ${rb.dimensionRationales.adversarialResilience} |

---

## 3. 6-Agent Adversarial Swarm Perspectives

${Object.entries(d.roleAssessments)
  .filter(([role]) => role !== "synthesizer")
  .map(([_, report]) => `### [${report.roleNumber}] ${report.roleTitle}
- **Verdict:** \`${report.verdict}\` (${report.score}/100)
- **Rationale:** ${report.rationale}
${report.fatalFlaws.length > 0 ? `- **Fatal Flaw:** ${report.fatalFlaws.join("; ")}` : ""}
${report.mustTestBeforeBuilding.length > 0 ? `- **Must Test Before Building:** ${report.mustTestBeforeBuilding.join("; ")}` : ""}
`).join("\n")}

---

## 4. Adversarial Cross-Examination Trail

${d.debateTrail.map(t => `- **Round ${t.round} [${t.challenger.toUpperCase()} ➔ ${t.target.toUpperCase()}]** (\`${t.status}\`):
  - *Challenge:* "${t.challengePoint}"
  ${t.rebuttal ? `  - *Rebuttal:* "${t.rebuttal}"` : ""}`).join("\n\n")}

---

## 5. Epistemic Evidence Feed & Provable Ground Truth

| ID | Epistemic Tier | Claim | Provenance | Confidence |
|:---|:---|:---|:---|:---:|
${d.evidenceFeed.map(e => `| \`${e.id}\` | \`${e.tier}\` | ${e.claim.replace(/\|/g, "/")} | ${e.provenance} | ${e.confidencePercent}% |`).join("\n")}

### Strongest Verified Evidence
> **[${d.strongestEvidence.tier}]** "${d.strongestEvidence.claim}"  
> *Provenance:* ${d.strongestEvidence.provenance} (Confidence: ${d.strongestEvidence.confidencePercent}%)

### Weakest Fatal Assumption
> **[${d.weakestAssumption.id}]** "${d.weakestAssumption.statement}"  
> **Fatal Risk:** ${d.weakestAssumption.fatalRisk}  
> **Disproof Threshold:** ${d.weakestAssumption.disproofThreshold}

---

## 5b. Unified Prediction Market Oracle Consensus

${d.predictionMarkets && d.predictionMarkets.marketsFound.length > 0 ? `
> **Oracle Source:** ${d.predictionMarkets.source}  
> **Consensus Takeaway:** ${d.predictionMarkets.keyTakeaway}  
> **Macro Sentiment:** \`${d.predictionMarkets.macroSentiment}\`

| Platform | Market Question | Probability | Volume | Link |
|:---|:---|:---:|:---:|:---|
${d.predictionMarkets.marketsFound.map(m => `| \`${m.title.match(/\[([A-Z]+)\]/)?.[1] || "MARKET"}\` | ${m.title.replace(/\[[A-Z]+\]\s*/, "").replace(/\|/g, "/")} | **${m.probabilityYesPercent}%** | $${m.volumeUsd.toLocaleString()} | [View Market](${m.marketUrl}) |`).join("\n")}
` : `*No correlated prediction markets found.*`}

---

## 6. Sandboxed Unit Economics (Python3 Subprocess Exit 0)

- **Modeled LTV / CAC Ratio:** \`${d.simulation.ltvCacRatio}x\`
- **Customer Lifetime Value (LTV):** \`$${d.simulation.ltvEstimateUsd}\`
- **Customer Acquisition Cost (CAC):** \`$${d.simulation.cacEstimateUsd}\`
- **Estimated Payback Horizon:** \`${d.simulation.estimatedPaybackMonths} months\`
- **Projected Monthly Infra Cost:** \`$${d.simulation.monthlyInfraCostUsd}\`
- **Sandbox Proof:** \`${d.simulation.sandboxExecutionProof.runtime} (exit code ${d.simulation.sandboxExecutionProof.exitCode})\`

---

## 7. Falsifiable Kill Conditions & Cheapest Validation Experiment

### Strict Kill Conditions
${d.killConditions.map((c, i) => `${i + 1}. **KILL** ${c}`).join("\n")}

### Cheapest 7-Day Validation Experiment
- **Title:** ${exp.title}
- **Cost & Turnaround:** \`$${exp.estimatedCostUsd}\` | \`${exp.timeToExecuteDays} Days\`
- **Methodology:** ${exp.description}
- **Success Gate:** ${exp.successMetric}
- **Failure Kill Signal:** ${exp.failureKillSignal}

---

## 8. Dual-Key Human Approval Gates (Safety Invariant)

${d.approvalGates.map(gate => `- **[${gate.status}]** \`${gate.id}\` (${gate.actionType})
  - *Summary:* ${gate.summary}
  - *Requires Explicit Human Authorization:* Yes`).join("\n\n")}

---

## 9. Epistemic Robustness Invariant Audit Trail

> **Protocol:** \`${d.verificationAudit?.verifierProtocol || "EPISTEMIC_ROBUST_VERIFIER"}\`  
> **Claims Audited:** \`${d.verificationAudit?.totalClaimsAudited || d.verificationAudit?.auditItems?.length || 0}\` | **Contradictions / Hallucinations Intercepted:** \`${d.verificationAudit?.hallucinationsBlocked || 0}\`

| Claim / Subagent Assertion | Verdict | Verification Rationale |
|:---|:---:|:---|
${(d.verificationAudit?.auditItems || []).map(item => `| ${item.claimOrOpinion.replace(/\|/g, "/")} | \`${item.verdict}\` | ${item.rationale.replace(/\|/g, "/")} |`).join("\n")}

---
*Report generated by Dossier Adversarial Multi-Agent Idea Intelligence Platform.*
`;
  }
}

export const dossierStorage = DossierStorageService.getInstance();
