#!/usr/bin/env node
/**
 * Verdict-replay diff (plan B2): compare two replay snapshots and surface every
 * verdict flip and score movement caused by a prompt, model, or backend change.
 *
 * Usage: pnpm replay:diff reports/replay/snapshot_A.json reports/replay/snapshot_B.json
 */
import fs from "node:fs";

interface SnapshotEntry {
  id: string;
  title: string;
  verdict: string;
  score: number;
  latencyMs: number;
}
interface Snapshot {
  label: string;
  timestamp: string;
  sigma: number;
  meanScore: number;
  entries: SnapshotEntry[];
}

function load(file: string): Snapshot {
  const snap = JSON.parse(fs.readFileSync(file, "utf-8"));
  if (!Array.isArray(snap?.entries)) throw new Error(`${file} is not a replay snapshot`);
  return snap;
}

function stdDev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / values.length);
}

function main() {
  const [fileA, fileB] = process.argv.slice(2);
  if (!fileA || !fileB) {
    console.error("Usage: tsx scripts/replay_diff.ts <snapshotA.json> <snapshotB.json>");
    process.exit(2);
  }

  const a = load(fileA);
  const b = load(fileB);
  const byIdA = new Map(a.entries.map((e) => [e.id, e]));
  const byIdB = new Map(b.entries.map((e) => [e.id, e]));

  console.log(`\n🔬 Verdict replay diff`);
  console.log(`  A: ${a.label} @ ${a.timestamp}  (σ ${a.sigma}, mean ${a.meanScore})`);
  console.log(`  B: ${b.label} @ ${b.timestamp}  (σ ${b.sigma}, mean ${b.meanScore})\n`);

  let flips = 0;
  const KILL_SIDE = new Set(["KILL"]);
  const BUILD_SIDE = new Set(["BUILD", "BUILD_IF_VALIDATED"]);
  for (const [id, ea] of byIdA) {
    const eb = byIdB.get(id);
    if (!eb) {
      console.log(`  ${id}: missing in B`);
      continue;
    }
    const delta = eb.score - ea.score;
    const verdictChanged = ea.verdict !== eb.verdict;
    // A "hard flip" crosses the KILL / BUILD boundary in either direction.
    const hardFlip =
      (KILL_SIDE.has(ea.verdict) && BUILD_SIDE.has(eb.verdict)) ||
      (KILL_SIDE.has(eb.verdict) && BUILD_SIDE.has(ea.verdict));
    if (verdictChanged) flips++;
    const marker = hardFlip ? "‼️  HARD FLIP" : verdictChanged ? "⚠️  flip " : "         ";
    console.log(
      `  ${marker} ${id}  ${String(ea.verdict).padEnd(20)} ${String(ea.score).padStart(3)} → ${String(eb.score).padStart(3)} (${delta >= 0 ? "+" : ""}${delta})${verdictChanged ? `  → ${eb.verdict}` : ""}`
    );
  }

  const sigmaDelta = Number((stdDev(b.entries.map((e) => e.score)) - stdDev(a.entries.map((e) => e.score))).toFixed(2));
  console.log(`\n  verdict flips: ${flips}/${a.entries.size || a.entries.length}`);
  console.log(`  dispersion Δσ: ${sigmaDelta >= 0 ? "+" : ""}${sigmaDelta}`);
  console.log(`  mean score Δ : ${Number((b.meanScore - a.meanScore).toFixed(1))}\n`);
}

main();
