/**
 * Specificity experiment: runs the labelled dev-split cases in two arms.
 *
 *   tsx scripts/run_specificity_eval.ts --generic    # original neutral pitches
 *   tsx scripts/run_specificity_eval.ts --detailed   # same pitches + founder-stated specifics
 *
 * Question: does founder-stated specificity (wedge, geography, channels, stated unit
 * economics) improve the verdict? Generic rows for the pre-lootdrop cases can be reused
 * from the plain dev run; L-cases need both arms.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.DOSSIER_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "dossier-spec-"));

const { casesFor } = await import("../src/evaluation/index.ts");
const { IdeaSwarmOrchestrator } = await import("../src/core/swarm.ts");
const { getLLMStatus } = await import("../src/services/llm.ts");
const { SPECIFICITY_VARIANTS } = await import("./specificity_variants.ts");

const args = process.argv.slice(2);
const arm = args.includes("--detailed") ? "detailed" : args.includes("--generic") ? "generic" : null;
if (!arm) {
  console.error("Pass --generic or --detailed");
  process.exit(2);
}
const concurrency = Math.max(1, Number(process.env.EVAL_CONCURRENCY ?? 3));

// Invariant-gate cases (physics, prompt injection) are decided by hard gates, not judgment;
// specificity cannot change them, so they are excluded from the comparison.
const EXCLUDED = new Set(["F6-free-energy", "F7-prompt-injection"]);

const only = args.find((a) => a.startsWith("--ids="))?.slice(6)?.split(",");
const baseCases = casesFor("dev").filter(
  (c) => c.outcome !== "ambiguous" && !EXCLUDED.has(c.id) && (!only || only.includes(c.id))
);

interface Row {
  id: string;
  outcome: string;
  expected: string[];
  arm: string;
  verdict?: string;
  score?: number;
  confidence?: number;
  mode?: string;
  llmRoles?: number;
  hit?: boolean;
  seconds?: number;
  tokens?: number;
  roles?: Record<string, { rating?: number; findings?: string[] }>;
  verdictBasis?: unknown;
  error?: string;
}

const jobs = baseCases.map((c) => c);
const rows: Row[] = [];
let next = 0;

async function worker() {
  const orchestrator = new IdeaSwarmOrchestrator();
  while (next < jobs.length) {
    const c = jobs[next++];
    const t = Date.now();
    try {
      let idea = { ...c.idea };
      if (arm === "detailed") {
        const v = SPECIFICITY_VARIANTS[c.id];
        if (!v) throw new Error(`no specificity variant for ${c.id}`);
        idea = {
          ...idea,
          summary: `${idea.summary} ${v.extra}`.trim(),
          monetization: v.monetization,
          targetAudience: v.audience ?? idea.targetAudience
        };
      }
      const d = await orchestrator.evaluateIdea(idea, { useLiveLLM: true });
      const row: Row = {
        id: c.id,
        outcome: c.outcome,
        expected: c.expected,
        arm,
        verdict: d.overallVerdict,
        score: d.killScore,
        confidence: d.confidenceScore,
        mode: d.evaluationMode,
        llmRoles: d.provenance?.llmRoles.length,
        hit: c.expected.includes(d.overallVerdict as never),
        seconds: Math.round((Date.now() - t) / 100) / 10,
        tokens: (d.llmUsage?.inputTokens ?? 0) + (d.llmUsage?.outputTokens ?? 0),
        roles: Object.fromEntries(
          Object.entries(d.roleAssessments).map(([k, o]) => [
            k,
            { rating: o.rating, findings: o.findings?.map((f) => `${f.severity}/${f.kind}/${f.evidence.type}: ${f.claim.slice(0, 140)} [${f.evidence.ref.slice(0, 80)}]`) }
          ])
        ),
        verdictBasis: d.verdictBasis
      };
      rows.push(row);
      console.log(`${row.hit ? "HIT " : "MISS"} ${c.id.padEnd(30)} ${String(row.verdict).padEnd(18)} score ${String(row.score).padStart(3)} conf ${String(row.confidence).padStart(3)} ${row.mode} (${arm})`);
    } catch (err) {
      rows.push({ id: c.id, outcome: c.outcome, expected: c.expected, arm, error: (err as Error).message });
      console.log(`ERR  ${c.id} (${arm}): ${(err as Error).message}`);
    }
  }
}

console.log(`Specificity arm ${arm} | LLM ${JSON.stringify(getLLMStatus())} | cases ${jobs.length} | concurrency ${concurrency}\n`);
await Promise.all(Array.from({ length: concurrency }, worker));

const outDir = path.resolve("reports", "eval");
fs.mkdirSync(outDir, { recursive: true });
const file = path.join(outDir, `specificity_${arm}_${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
fs.writeFileSync(file, JSON.stringify({ arm, rows }, null, 2));
console.log(`\nSaved ${file}`);
