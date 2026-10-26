import { IdeaSwarmOrchestrator } from "./core/swarm.js";
import { getLLMStatus } from "./services/llm.js";
import { IdeaInput } from "./types/index.js";
import * as fs from "node:fs";
import * as path from "node:path";

interface BenchmarkCase {
  id: string;
  category: string;
  idea: IdeaInput;
  pricing: number;
  cac: number;
  expectedVerdictRange: ("BUILD" | "REFINE" | "KILL")[];
}

const BENCHMARK_SUITE: BenchmarkCase[] = [
  {
    id: "BM-01",
    category: "B2B Enterprise SaaS",
    idea: {
      title: "AutoSOC2: Continuous AI Security Compliance Auditor",
      summary: "Autonomous agent pipeline that connects to AWS, GitHub, and Okta to continuously generate SOC2 Type II audit evidence and remediation PRs.",
      targetAudience: "B2B SaaS CTOs and Security Engineers (Series A-C)",
      monetization: "Enterprise SaaS ($1,200/mo per organization)"
    },
    pricing: 1200,
    cac: 3500,
    expectedVerdictRange: ["BUILD", "REFINE"]
  },
  {
    id: "BM-02",
    category: "Rural HealthTech / B2G",
    idea: {
      title: "SwaraSetu: Offline Indic Clinical Triage (SIH26133)",
      summary: "Offline-first, voice-native clinical triage for 22+ Indic languages via Sarvam AI and deterministic WHO IMCI decision trees across WhatsApp and ASHA tablets.",
      targetAudience: "ASHA Health Workers, Rural Patients, State Health Missions",
      monetization: "B2G / NGO District Licensing ($1,200/yr per district)"
    },
    pricing: 100,
    cac: 350,
    expectedVerdictRange: ["REFINE"]
  },
  {
    id: "BM-03",
    category: "DeepTech / Hardware Swarm",
    idea: {
      title: "VanRakshak: Autonomous Drone Forest Patrolling",
      summary: "AI-powered autonomous multi-drone swarm for real-time forest fire detection, anti-poaching, and illegal logging prevention using edge YOLOv8 vision.",
      targetAudience: "State Forest Departments & National Wildlife Parks",
      monetization: "B2G Drone-as-a-Service ($1,500/mo per reserve)"
    },
    pricing: 1500,
    cac: 2500,
    expectedVerdictRange: ["REFINE"]
  },
  {
    id: "BM-04",
    category: "AI Wrapper / Zero Moat",
    idea: {
      title: "ChatNotes: AI Chrome Extension for Meeting Summaries",
      summary: "A Chrome extension that records Google Meet audio and sends transcripts to OpenAI GPT-4o to output bulleted notes into Google Docs.",
      targetAudience: "General remote workers and college students",
      monetization: "Freemium with $10/mo Pro subscription"
    },
    pricing: 10,
    cac: 45,
    expectedVerdictRange: ["KILL", "REFINE"]
  },
  {
    id: "BM-05",
    category: "Web3 / DeFi Infrastructure",
    idea: {
      title: "FreelanceShield: Milestone Escrow Smart Contracts",
      summary: "Non-custodial smart contract escrow with multi-sig milestone releases and automated dispute resolution oracles for cross-border software freelancers.",
      targetAudience: "Global software contractors and remote-first Web3 agencies",
      monetization: "1.5% fee on settled escrow milestones"
    },
    pricing: 50,
    cac: 120,
    expectedVerdictRange: ["REFINE"]
  },
  {
    id: "BM-06",
    category: "Vertical SMB SaaS",
    idea: {
      title: "PlateCost: Restaurant Wholesale Supplier Price Auditor",
      summary: "SMS & OCR agent that ingests paper wholesale food invoices, flags silent supplier price creep across distributors, and auto-negotiates refunds.",
      targetAudience: "Independent restaurant owners and executive chefs",
      monetization: "$149/mo flat SaaS per restaurant location"
    },
    pricing: 149,
    cac: 400,
    expectedVerdictRange: ["BUILD", "REFINE"]
  },
  {
    id: "BM-07",
    category: "Developer Tools",
    idea: {
      title: "VeriCode: Formal Verification PR Review Agent",
      summary: "Continuous integration bot executing formal mathematical invariants and symbolic execution on pull requests to catch concurrency and security bugs.",
      targetAudience: "FinTech, Aerospace, and High-Reliability Software Teams",
      monetization: "$499/mo per GitHub organization + compute usage"
    },
    pricing: 499,
    cac: 1200,
    expectedVerdictRange: ["BUILD"]
  },
  {
    id: "BM-08",
    category: "Marketplace / CleanTech",
    idea: {
      title: "VoltShare: Residential EV Charger Peer Sharing",
      summary: "Hardware plug-in and mobile marketplace allowing EV owners with home Level-2 chargers to rent driveways to neighbors overnight.",
      targetAudience: "Suburban homeowners and EV commuters lacking garage parking",
      monetization: "15% platform fee on kilowatt-hours sold"
    },
    pricing: 25,
    cac: 80,
    expectedVerdictRange: ["REFINE"]
  },
  {
    id: "BM-09",
    category: "Field Vertical SaaS",
    idea: {
      title: "TruckDesk: Voice-First CRM for Roofers & Plumbers",
      summary: "Hands-free voice assistant running on truck dashboard mounts that dictates job estimates, invoices clients, and schedules crews while driving.",
      targetAudience: "Solo trade contractors, plumbers, electricians, and roofers",
      monetization: "$79/mo per contractor truck"
    },
    pricing: 79,
    cac: 180,
    expectedVerdictRange: ["BUILD", "REFINE"]
  },
  {
    id: "BM-10",
    category: "FinTech Micro-SaaS",
    idea: {
      title: "DunningBot: Smart Stripe Churn Recovery Agent",
      summary: "AI dunning engine that analyzes card decline codes and dynamically triggers personalized SMS/WhatsApp payment updater links with high recovery rates.",
      targetAudience: "Bootstrapped B2B SaaS founders with $5k-$50k MRR",
      monetization: "10% of recovered revenue + $29/mo base"
    },
    pricing: 49,
    cac: 110,
    expectedVerdictRange: ["BUILD"]
  },
  {
    id: "BM-11",
    category: "Free Platform / No Monetization",
    idea: {
      title: "CommuniAid: City-Wide Volunteer Relief Coordination",
      summary: "Free coordination hub matching volunteers with shelters and community kitchens: shift scheduling, supply lists, and SMS alerts, funded entirely by donors.",
      targetAudience: "Community volunteers, shelters, and mutual-aid organizers",
      monetization: "Free forever — no monetization model, donor-funded only"
    },
    pricing: 0,
    cac: 60,
    expectedVerdictRange: ["KILL"]
  },
  {
    id: "BM-12",
    category: "AI Wrapper / Zero Moat",
    idea: {
      title: "ViralThreads: AI Tweet Composer Chrome Extension",
      summary: "A Chrome extension that drafts viral tweet threads from any article URL using GPT to rewrite headlines into punchy copy for creators.",
      targetAudience: "Indie creators and ghostwriters on Twitter/X",
      monetization: "Freemium with $9/mo Pro plan"
    },
    pricing: 9,
    cac: 30,
    expectedVerdictRange: ["KILL"]
  },
  {
    id: "BM-13",
    category: "Developer Tools",
    idea: {
      title: "LedgerIQ: Revenue Leak Anomaly Copilot",
      summary: "Continuously reconciles billing, usage, and invoicing data to surface silent revenue leaks (unbilled overages, discount drift, dunning gaps) with one-click credit memos.",
      targetAudience: "RevOps and Finance leaders at Series B-D companies",
      monetization: "$499/mo per organization priced on ARR coverage"
    },
    pricing: 499,
    cac: 420,
    expectedVerdictRange: ["BUILD", "REFINE"]
  },
  {
    id: "BM-14",
    category: "Insurance Vertical SaaS",
    idea: {
      title: "ClaimPilot: AI Claim Pre-Fill for P&C Adjusters",
      summary: "Ingests photos, weather data, and policy PDFs to pre-fill property damage claim estimates with carrier-compliant line items, cutting desk handling from 40 to 6 minutes.",
      targetAudience: "Property & Casualty claims desks at regional insurers",
      monetization: "$850/mo per claims desk with accuracy-backed SLA"
    },
    pricing: 850,
    cac: 520,
    expectedVerdictRange: ["BUILD", "REFINE"]
  }
];

function stdDev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / values.length);
}

function modalVerdict(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

const SCORE_DISPERSION_GATE = 18;
const REPLAY_SNAPSHOT_PATH = path.join(process.cwd(), "reports", "benchmark_last.json");

type VerdictBand = "BUILD" | "REFINE" | "KILL";
function verdictBand(v: string): VerdictBand {
  const normalized = v === "BUILD_IF_VALIDATED" ? "BUILD" : v;
  return normalized === "BUILD" ? "BUILD" : normalized === "REFINE" ? "REFINE" : "KILL";
}

export async function runDossierBenchmark(options: { replay?: boolean } = {}): Promise<void> {
  const replay = options.replay === true;
  const RUNS = replay ? 1 : Math.max(1, Math.min(5, Number.parseInt(process.env.BENCHMARK_RUNS || "3", 10) || 3));

  const suite = process.env.BENCHMARK_LIMIT
    ? BENCHMARK_SUITE.slice(0, Number.parseInt(process.env.BENCHMARK_LIMIT, 10))
    : BENCHMARK_SUITE;

  console.log("\n=======================================================");
  console.log("  ⚡ DOSSIER DOMAIN-AWARE BENCHMARK SUITE");
  console.log(`  ${suite.length} Diverse-Merit Concepts × ${RUNS} Runs (de-noised dispersion)`);
  console.log("=======================================================\n");

  const orchestrator = new IdeaSwarmOrchestrator();
  const startTimeTotal = Date.now();

  // Aggregation bookkeeping keyed by benchmark case id.
  const scoresById = new Map<string, number[]>();
  const verdictsById = new Map<string, string[]>();
  const latenciesById = new Map<string, number[]>();
  const dimsById = new Map<string, { feasi: number[]; demand: number[]; econ: number[]; adv: number[]; rounds: number[] }>();
  const metaById = new Map<string, { title: string; domainArchetype: string; category: string; weakestAssumption: string; sandboxExit: number }>();
  const perRunStdDevs: number[] = [];

  for (let run = 1; run <= RUNS; run++) {
    console.log(`\n──────── Run ${run}/${RUNS} ────────`);
    const runScores: number[] = [];

    for (const item of suite) {
      console.log(`[run ${run}] Evaluating ${item.id}: "${item.idea.title}" (${item.category})...`);

      try {
        const t0 = Date.now();
        const dossier = await orchestrator.evaluateIdea(item.idea, {
          pricingMonthlyUsd: item.pricing,
          estimatedCacUsd: item.cac,
          useLiveLLM: true
        });
        const elapsed = Date.now() - t0;
        const rb = dossier.resilienceBreakdown;

        if (!scoresById.has(item.id)) scoresById.set(item.id, []);
        if (!verdictsById.has(item.id)) verdictsById.set(item.id, []);
        if (!latenciesById.has(item.id)) latenciesById.set(item.id, []);
        if (!dimsById.has(item.id)) dimsById.set(item.id, { feasi: [], demand: [], econ: [], adv: [], rounds: [] });
        scoresById.get(item.id)!.push(dossier.killScore);
        verdictsById.get(item.id)!.push(dossier.overallVerdict);
        latenciesById.get(item.id)!.push(elapsed);
        const dims = dimsById.get(item.id)!;
        dims.feasi.push(rb.technicalFeasibility);
        dims.demand.push(rb.demandAndAdoption);
        dims.econ.push(rb.economicsAndCapitalEfficiency);
        dims.adv.push(rb.adversarialResilience);
        dims.rounds.push(dossier.convergenceRounds || 1);
        metaById.set(item.id, {
          title: item.idea.title,
          domainArchetype: dossier.domainClassification.archetypeLabel,
          category: item.category,
          weakestAssumption: dossier.weakestAssumption.fatalRisk,
          sandboxExit: dossier.simulation.sandboxExecutionProof.exitCode
        });

        runScores.push(dossier.killScore);
        console.log(`       ➔ Domain: [${dossier.domainClassification.archetypeLabel}] | Verdict: ${dossier.overallVerdict} (${dossier.killScore}/100) | Rounds: ${dossier.convergenceRounds || 1} | Latency: ${elapsed}ms`);
      } catch (err: any) {
        console.log(`       ✗ FAILED: ${err?.message || "evaluation error"} — excluded from aggregation`);
      }
    }

    if (runScores.length > 0) {
      perRunStdDevs.push(stdDev(runScores));
    }
  }

  // De-noised aggregation: per-concept means across runs define gate and table.
  const results = suite
    .filter((item) => (scoresById.get(item.id)?.length ?? 0) > 0)
    .map((item) => {
      const scores = scoresById.get(item.id)!;
      const dims = dimsById.get(item.id)!;
      const meta = metaById.get(item.id)!;
      const verdict = modalVerdict(verdictsById.get(item.id)!);
      const normalizedVerdict = verdict === "BUILD_IF_VALIDATED" ? "BUILD" : verdict;
      const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
      return {
        id: item.id,
        title: meta.title,
        domainArchetype: meta.domainArchetype,
        category: meta.category,
        verdict,
        score: Math.round(mean(scores)),
        feasiScore: Math.round(mean(dims.feasi)),
        demandScore: Math.round(mean(dims.demand)),
        econScore: Math.round(mean(dims.econ)),
        advScore: Math.round(mean(dims.adv)),
        convergenceRounds: Math.max(...dims.rounds),
        weakestAssumption: meta.weakestAssumption,
        latencyMs: Math.round(mean(latenciesById.get(item.id)!)),
        sandboxExit: meta.sandboxExit,
        expectedRangeMatch: item.expectedVerdictRange.includes(normalizedVerdict as "BUILD" | "REFINE" | "KILL")
      };
    });

  if (results.length === 0) {
    console.error("\n✗ BENCHMARK FAILED: no concept produced a usable dossier in any run.\n");
    process.exitCode = 1;
    return;
  }

  const scores = results.map((r) => r.score);
  const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const scoreStdDev = stdDev(scores);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const avgLatency = Math.round(results.reduce((a, b) => a + b.latencyMs, 0) / results.length);
  const sandboxPassRate = Math.round((results.filter(r => r.sandboxExit === 0).length / results.length) * 100);
  const killOrRefineRate = Math.round((results.filter(r => r.verdict !== "BUILD").length / results.length) * 100);
  const expectationMatchRate = Math.round((results.filter(r => r.expectedRangeMatch).length / results.length) * 100);
  const totalTimeSec = ((Date.now() - startTimeTotal) / 1000).toFixed(2);
  const dispersionGatePassed = scoreStdDev >= SCORE_DISPERSION_GATE;

  console.log("\n==========================================================================================================");
  console.log(`  📊 DE-NOISED BENCHMARK SUMMARY (mean of ${RUNS} runs per concept)`);
  console.log("==========================================================================================================");
  console.log(`ID     | DOMAIN ARCHETYPE         | SCORE | VERDICT            | FEAS | DMND | ECON | ADV  | ROUNDS | LATENCY`);
  console.log(`-------+--------------------------+-------+--------------------+------+------+------+------+--------+---------`);

  for (const r of results) {
    const id = r.id.padEnd(6);
    const dom = r.domainArchetype.slice(0, 24).padEnd(24);
    const score = `${r.score}/100`.padEnd(5);
    const verdict = r.verdict.padEnd(18);
    const feas = `${r.feasiScore}`.padEnd(4);
    const dmnd = `${r.demandScore}`.padEnd(4);
    const econ = `${r.econScore}`.padEnd(4);
    const adv = `${r.advScore}`.padEnd(4);
    const rounds = `${r.convergenceRounds}`.padEnd(6);
    const lat = `${r.latencyMs}ms`.padEnd(7);
    console.log(`${id} | ${dom} | ${score} | ${verdict} | ${feas} | ${dmnd} | ${econ} | ${adv} | ${rounds} | ${lat}`);
  }

  console.log("==========================================================================================================");
  console.log(`📈 OVERALL DOMAIN-AWARE BENCHMARK METRICS (de-noised over ${RUNS} runs):`);
  console.log(`  • Concepts Aggregated     : ${results.length}/${suite.length}`);
  console.log(`  • Average Latency per Idea: ${avgLatency} ms`);
  console.log(`  • Total Benchmark Runtime : ${totalTimeSec} seconds`);
  console.log(`  • Sandboxed Subprocess    : ${sandboxPassRate}% Isolated Exit Code 0`);
  console.log(`  • Adversarial Filter Rate : ${killOrRefineRate}% (Killed or Refined under stress)`);
  console.log(`  • Verdict Expectation Fit : ${expectationMatchRate}% of concepts inside the plan's expected verdict range`);
  console.log(`  • Score Range             : ${minScore}–${maxScore} (mean ${meanScore.toFixed(1)})`);
  console.log(`  • Per-Run Dispersion σ    : ${perRunStdDevs.map((s) => s.toFixed(1)).join(" / ")}`);
  console.log(`  • De-Noised Dispersion σ  : ${scoreStdDev.toFixed(1)} — Gate ≥ ${SCORE_DISPERSION_GATE} → ${dispersionGatePassed ? "PASSED" : "FAILED"}`);
  console.log("==========================================================================================================");

  if (dispersionGatePassed) {
    console.log(`\n✓ QUALITY GATE 3 PASSED: de-noised score dispersion σ=${scoreStdDev.toFixed(1)} ≥ ${SCORE_DISPERSION_GATE}.\n`);
  } else {
    console.error(`\n✗ QUALITY GATE 3 FAILED: de-noised score dispersion σ=${scoreStdDev.toFixed(1)} < ${SCORE_DISPERSION_GATE}. Break the mid-band separation further or enrich the benchmark suite's merit diversity.\n`);
    process.exitCode = 1;
  }

  // ── INVARIANT ASSERTIONS (Hamel Husain Eval Pattern) ──
  const invariantViolations: string[] = [];

  // 1. Zero-Moat Invariant: Thin wrappers must never clear score 40 or get BUILD
  const thinWrappers = results.filter((r) => ["BM-04", "BM-12"].includes(r.id));
  for (const tw of thinWrappers) {
    if (tw.score >= 40 || tw.verdict.includes("BUILD")) {
      invariantViolations.push(`Zero-Moat Invariant Violated: ${tw.id} scored ${tw.score} with verdict ${tw.verdict} (must be < 40 and KILL)`);
    }
  }

  // 2. Unmonetized Invariant: Non-monetized project must be KILL
  const unmonetized = results.find((r) => r.id === "BM-11");
  if (unmonetized && (unmonetized.score >= 40 || !unmonetized.verdict.includes("KILL"))) {
    invariantViolations.push(`Monetization Invariant Violated: BM-11 scored ${unmonetized.score} with verdict ${unmonetized.verdict} (must be KILL)`);
  }

  // 3. Dispersion Invariant
  if (!dispersionGatePassed) {
    invariantViolations.push(`Dispersion Gate Violated: σ=${scoreStdDev.toFixed(1)} < ${SCORE_DISPERSION_GATE}`);
  }

  if (invariantViolations.length > 0) {
    console.error("\n❌ HARNESS EVALUATION INVARIANTS FAILED:");
    for (const v of invariantViolations) console.error(`  • ${v}`);
    process.exitCode = 1;
  } else {
    console.log("✅ ALL HARNESS EVALUATION INVARIANTS PASSED (Zero-Moat, Monetization, and Dispersion Gates satisfied).\n");
  }

  if (replay) {
    // Verdict-replay regression: diff this run against the last recorded snapshot.
    let previous: { results?: Array<{ id: string; score: number; verdict: string }> } | null = null;
    try {
      previous = JSON.parse(fs.readFileSync(REPLAY_SNAPSHOT_PATH, "utf-8"));
    } catch {
      console.error("\n✗ REPLAY ABORTED: no recorded snapshot at reports/benchmark_last.json — run the full benchmark once first.\n");
      process.exitCode = 1;
      return;
    }
    const prevById = new Map((previous?.results || []).map((r) => [r.id, r]));
    console.log("\n🔍 VERDICT REPLAY DIFF (vs recorded snapshot):");
    let flips = 0;
    for (const r of results) {
      const prev = prevById.get(r.id);
      if (!prev) {
        console.log(`  ${r.id.padEnd(6)} NEW — no previous record`);
        continue;
      }
      const prevBand = verdictBand(prev.verdict);
      const nowBand = verdictBand(r.verdict);
      const delta = r.score - prev.score;
      const flipped = prevBand !== nowBand;
      if (flipped) flips++;
      console.log(`  ${r.id.padEnd(6)} ${String(prev.score).padStart(3)}/100 ${prevBand.padEnd(6)} → ${String(r.score).padStart(3)}/100 ${nowBand.padEnd(6)} (Δ ${delta >= 0 ? "+" : ""}${delta}) ${flipped ? "⚠ VERDICT FLIP" : "ok"}`);
    }
    if (flips > 0) {
      console.error(`\n✗ REPLAY FAILED: ${flips} verdict band flip(s) — a prompt/model change altered outcomes. Investigate before shipping.\n`);
      process.exitCode = 1;
    } else {
      console.log("\n✓ REPLAY PASSED: no verdict band flips.\n");
    }
    return;
  }

  // Record the machine-readable snapshot future replays diff against.
  try {
    fs.mkdirSync(path.dirname(REPLAY_SNAPSHOT_PATH), { recursive: true });
    fs.writeFileSync(REPLAY_SNAPSHOT_PATH, JSON.stringify({
      timestamp: new Date().toISOString(),
      provider: getLLMStatus(),
      runs: RUNS,
      results: results.map((r) => ({ id: r.id, score: r.score, verdict: r.verdict, verdictBand: verdictBand(r.verdict) }))
    }, null, 2));
    console.log(`✔ Replay snapshot saved: ${REPLAY_SNAPSHOT_PATH}`);
  } catch (err: any) {
    console.warn(`⚠ Could not save replay snapshot: ${err?.message}`);
  }

  // Export to Markdown Report
  const mdReport = `# Dossier Domain-Aware Adversarial Benchmark Report

**Execution Date:** ${new Date().toISOString()}  
**Agent Harness:** Dossier Multi-Agent Runtime (File TF-007)  
**De-Noising:** ${RUNS} full runs per concept; Quality Gate 3 evaluates σ of per-concept mean scores  
**Overall Benchmark Runtime:** ${totalTimeSec} seconds  
**Average Latency:** ${avgLatency} ms per full 6-agent adversarial evaluation  
**Verdict Expectation Fit:** ${expectationMatchRate}% inside the plan's expected verdict range  
**Score Range:** ${minScore}–${maxScore} (mean ${meanScore.toFixed(1)})  
**Per-Run Dispersion σ:** ${perRunStdDevs.map((s) => s.toFixed(1)).join(" / ")}  
**De-Noised Dispersion (σ):** ${scoreStdDev.toFixed(1)} ${dispersionGatePassed ? `— QUALITY GATE 3 PASSED (≥ ${SCORE_DISPERSION_GATE})` : `— ⚠ QUALITY GATE 3 FAILED (< ${SCORE_DISPERSION_GATE})`}  

---

## 1. Summary Benchmark Matrix (With Dimensional Breakdown)

| ID | Project / Concept | Domain Archetype | Resilience Score | Swarm Verdict | Feasibility (20%) | Demand (25%) | Economics (20%) | Adversarial (20%) | Rounds | Latency | Fatal Risk Flagged |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
${results.map(r => `| **${r.id}** | ${r.title} | ${r.domainArchetype} | **${r.score}/100** | \`${r.verdict}\` | ${r.feasiScore}% | ${r.demandScore}% | ${r.econScore}% | ${r.advScore}% | ${r.convergenceRounds} | ${r.latencyMs}ms | ${r.weakestAssumption} |`).join("\n")}

---

## 2. Key Observations & Adversarial Defense

1. **Domain-Specific Prior Tuning:**
   * **B2G & Healthcare concepts** were evaluated against **public tender timelines, WHO guidelines, and field worker cognitive load**, rather than irrelevant consumer freemium metrics.
   * **Hardware & Drone concepts** were audited on **on-device YOLOv8 latency, GPS-denied SLAM, and battery cycle economics**.

2. **Stochastic Sandbox & Crossfire:**
   * **Monte Carlo percentiles (survival, P10 insolvency tail, payback spread) differentiate concept economics beyond point estimates.**
   * **Round 2 crossfire cites stressed sandbox replays and competitor recon as tool evidence; defeated defenders concede confidence points.**

3. **Multi-Round Convergence:**
   * Escalated to **Round 2 adversarial cross-examination** whenever score disparities exceeded 25 points or fatal flaws remained unmitigated.
`;

  const reportPath = path.join(process.cwd(), "docs", "BENCHMARK_RESULTS.md");
  fs.writeFileSync(reportPath, mdReport, "utf-8");
  console.log(`✔ Benchmark report exported to: ${reportPath}\n`);
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith("benchmark.ts") || process.argv[1]?.endsWith("benchmark.js")) {
  runDossierBenchmark({ replay: process.argv.includes("--replay") }).catch((err) => {
    console.error("Benchmark failed:", err);
    process.exit(1);
  });
}
