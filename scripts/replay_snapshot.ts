#!/usr/bin/env node
/**
 * Verdict-replay snapshot (plan B2): run the golden benchmark suite ONCE under the
 * currently-configured LLM backend and persist a per-concept verdict snapshot.
 *
 * Usage:
 *   DOSSIER_REPLAY_LABEL=orcarouter-baseline pnpm replay:snapshot
 *   DOSSIER_LLM_BACKEND=agy pnpm replay:snapshot
 *
 * Snapshots land in reports/replay/ (gitignored). Pair with replay:diff to see
 * exactly which verdicts flip when prompts, models, or backends change.
 */
import { IdeaSwarmOrchestrator } from "../src/core/swarm.js";
import { BENCHMARK_SUITE } from "../src/benchmark.js";
import { getLLMStatus } from "../src/services/llm.js";
import fs from "node:fs";
import path from "node:path";

interface SnapshotEntry {
  id: string;
  title: string;
  verdict: string;
  score: number;
  dims: { feasibility: number; demand: number; economics: number; moat: number; adversarial: number };
  convergenceRounds: number;
  latencyMs: number;
  fatalRisk: string;
}

function stdDev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / values.length);
}

async function main() {
  const llm = getLLMStatus();
  const label = process.env.DOSSIER_REPLAY_LABEL || `${llm.activeProvider}:${llm.activeModel}`;
  console.log(`\n📋 Dossier verdict-replay snapshot — backend: ${label}\n`);

  const orchestrator = new IdeaSwarmOrchestrator();
  const entries: SnapshotEntry[] = [];

  for (const item of BENCHMARK_SUITE) {
    const t0 = Date.now();
    try {
      const dossier = await orchestrator.evaluateIdea(item.idea, {
        pricingMonthlyUsd: item.pricing,
        estimatedCacUsd: item.cac,
        useLiveLLM: process.env.DOSSIER_REPLAY_OFFLINE !== "1"
      });
      const rb = dossier.resilienceBreakdown;
      entries.push({
        id: item.id,
        title: item.idea.title,
        verdict: dossier.overallVerdict,
        score: dossier.killScore,
        dims: {
          feasibility: rb.technicalFeasibility,
          demand: rb.demandAndAdoption,
          economics: rb.economicsAndCapitalEfficiency,
          moat: rb.defensibilityAndMoat,
          adversarial: rb.adversarialResilience
        },
        convergenceRounds: dossier.convergenceRounds || 1,
        latencyMs: Date.now() - t0,
        fatalRisk: dossier.weakestAssumption.fatalRisk
      });
      console.log(`  ${item.id}  ${String(dossier.overallVerdict).padEnd(20)} ${dossier.killScore}/100  (${Date.now() - t0}ms)`);
    } catch (err: any) {
      console.error(`  ${item.id}  FAILED: ${err?.message || "evaluation error"}`);
    }
  }

  const scores = entries.map((e) => e.score);
  const snapshot = {
    label,
    timestamp: new Date().toISOString(),
    llmStatus: llm,
    sigma: Number(stdDev(scores).toFixed(2)),
    meanScore: Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)),
    entries
  };

  const dir = path.join(process.cwd(), "reports", "replay");
  fs.mkdirSync(dir, { recursive: true });
  const safeLabel = label.replace(/[^a-zA-Z0-9._-]/g, "_");
  const file = path.join(dir, `snapshot_${safeLabel}_${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2), "utf-8");
  console.log(`\n✔ Snapshot saved: ${file}`);
  console.log(`  verdicts: ${entries.length} | σ ${snapshot.sigma} | mean ${snapshot.meanScore}\n`);
}

main().catch((err) => {
  console.error("Replay snapshot failed:", err);
  process.exit(1);
});
