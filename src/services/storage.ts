import fs from "node:fs/promises";
import path from "node:path";
import { IdeaDossier, ApprovalAction } from "../types/index.js";

const STORAGE_DIR = path.resolve(process.cwd(), "reports");

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

export class DossierStorageService {
  private static instance: DossierStorageService;
  private memoryCache: Map<string, IdeaDossier> = new Map();

  private constructor() {}

  public static getInstance(): DossierStorageService {
    if (!DossierStorageService.instance) {
      DossierStorageService.instance = new DossierStorageService();
    }
    return DossierStorageService.instance;
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
    this.memoryCache.set(dossier.id, dossier);

    const safeId = dossier.id.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filePath = path.join(STORAGE_DIR, `dossier_${safeId}.json`);

    try {
      await fs.writeFile(filePath, JSON.stringify(dossier, null, 2), "utf-8");
    } catch (err: any) {
      console.warn(`[Storage] Failed to write dossier to disk: ${err.message}`);
    }
  }

  /**
   * Retrieve a dossier by ID.
   */
  public async getDossier(id: string): Promise<IdeaDossier | null> {
    if (this.memoryCache.has(id)) {
      return this.memoryCache.get(id)!;
    }

    await this.ensureStorageDir();
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filePath = path.join(STORAGE_DIR, `dossier_${safeId}.json`);

    try {
      const data = await fs.readFile(filePath, "utf-8");
      const dossier: IdeaDossier = JSON.parse(data);
      this.memoryCache.set(id, dossier);
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
            this.memoryCache.set(id, target);
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
            this.memoryCache.set(d.id, d);
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

    return `# ⚡ DOSSIER REPORT: ${d.idea.title.toUpperCase()}
> **Dossier Code:** \`${d.dossierCode}\` | **ID:** \`${d.id}\` | **Date:** \`${d.timestamp.slice(0, 10)}\`  
> **Status:** \`COMPILED\` | **Harness:** \`TrueForge (File TF-007)\` | **Protocol:** \`Stanford CS329A\`

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

## 8. Dual-Key Human Approval Gates (TrueForge Safety)

${d.approvalGates.map(gate => `- **[${gate.status}]** \`${gate.id}\` (${gate.actionType})
  - *Summary:* ${gate.summary}
  - *Requires Explicit Human Authorization:* Yes`).join("\n\n")}

---
*Report generated by Dossier Adversarial Multi-Agent Idea Intelligence Platform.*
`;
  }
}

export const dossierStorage = DossierStorageService.getInstance();
