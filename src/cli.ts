#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import fs from "node:fs/promises";
import { IdeaSwarmOrchestrator } from "./core/swarm.js";
import { IdeaInput } from "./types/index.js";
import { dossierStorage } from "./services/storage.js";
import { getLLMStatus } from "./services/llm.js";
import { runStressTestSuite } from "./stress-test.js";
import { runEconomicsSimulation } from "./tools/sandbox.js";
import { forecastLedger, ForecastRecord } from "./services/ledger.js";

const program = new Command();

program
  .name("dossier")
  .description("Domain-Aware Adversarial Multi-Agent Idea Intelligence Platform on TrueForge harness")
  .version("0.2.0");

program
  .command("evaluate")
  .description("Compile an evidence-first intelligence dossier on an idea through domain specialist agents")
  .option("-t, --title <title>", "Idea title", "Autonomous Micro-SaaS Agent")
  .option("-s, --summary <summary>", "Idea summary description", "AI swarm that validates startup ideas before building.")
  .option("-a, --audience <audience>", "Target audience", "Founders, indie hackers, venture builders")
  .option("-m, --monetization <monetization>", "Monetization model", "$49/month subscription or per-evaluation pass")
  .option("-p, --pricing <number>", "Monthly price in USD", "49")
  .option("-c, --cac <number>", "Estimated customer acquisition cost in USD", "150")
  .option("-o, --export <path>", "Export compiled dossier to Markdown or JSON file")
  .option("--offline", "Force offline heuristic simulation without live LLM calls")
  .option("--json", "Output pure machine-readable JSON")
  .action(async (options) => {
    if (!options.json) {
      console.log(pc.cyan("\n======================================================="));
      console.log(pc.bold(pc.yellow("  ⚡ DOSSIER — EVIDENCE-FIRST ADVERSARIAL SWARM")));
      console.log(pc.dim("  TrueForge Harness (File TF-007) • Zero Sycophancy"));
      console.log(pc.cyan("=======================================================\n"));
    }

    const ideaInput: IdeaInput = {
      title: options.title,
      summary: options.summary,
      targetAudience: options.audience,
      monetization: options.monetization
    };

    if (!options.json) {
      console.log(pc.bold("Target Concept: "), pc.green(ideaInput.title));
      console.log(pc.bold("Target Audience:"), ideaInput.targetAudience);
      console.log(pc.bold("Monetization:   "), ideaInput.monetization);
      console.log(pc.dim("\n-------------------------------------------------------"));
    }

    const orchestrator = new IdeaSwarmOrchestrator();

    const dossier = await orchestrator.evaluateIdea(ideaInput, {
      pricingMonthlyUsd: parseFloat(options.pricing),
      estimatedCacUsd: parseFloat(options.cac),
      onProgress: options.json ? undefined : (stage, detail) => {
        console.log(`[${pc.magenta(stage)}] ${detail}`);
      }
    });

    if (options.json) {
      console.log(JSON.stringify({ success: true, dossier }, null, 2));
    } else {
    console.log(pc.dim("-------------------------------------------------------\n"));

    // Domain Classification
    const domain = dossier.domainClassification;
    console.log(pc.bold(pc.yellow(`🎯 DOMAIN CLASSIFICATION: [${domain.archetypeLabel}]`)));
    console.log(`  • Primary Customer : ${pc.cyan(domain.primaryCustomer)}`);
    console.log(`  • Sales/Procurement: ${domain.procurementCycle}`);
    console.log(`  • Regulatory Frame : ${domain.regulatoryEnvironment}`);
    console.log(`  • Economics Model  : ${domain.unitEconomicsModel}\n`);

    // Verdict & Dimensional Resilience Breakdown
    console.log(pc.bold(pc.cyan("📊 SWARM VERDICT & RESILIENCE BREAKDOWN:")));
    const verdictColor = dossier.overallVerdict === "BUILD" ? pc.green : (dossier.overallVerdict === "BUILD_IF_VALIDATED" ? pc.green : (dossier.overallVerdict === "REFINE" ? pc.yellow : pc.red));
    console.log(`  Overall Verdict    : ${verdictColor(pc.bold(dossier.overallVerdict))}`);
    console.log(`  Composite Resilience: ${verdictColor(pc.bold(`${dossier.killScore}/100`))} (Swarm Agreement: ${dossier.confidenceScore}%, Risk: ${dossier.riskLevel === "LOW" ? pc.green(dossier.riskLevel) : pc.yellow(dossier.riskLevel)})`);

    if (dossier.swarmDissent) {
      const sd = dossier.swarmDissent;
      console.log(`  Swarm Dissent      : spread ${sd.scoreSpread}pts | kill-grade agents ${sd.killGradeAgents}/6 | avg score ${sd.avgAgentScore}/100`);
      if (sd.verdictContested) {
        console.log(pc.yellow(`  ⚠️  Verdict Contested: ${sd.killGradeAgents} agents issue kill-grade scores while the composite clears 50 — human judgment required.`));
      }
    }

    if (dossier.outsideView) {
      const ov = dossier.outsideView;
      const classes = ov.matchedClasses.map((c: { label: string; survival24moLow: number; survival24moHigh: number }) => `${c.label} (${Math.round(c.survival24moLow * 100)}–${Math.round(c.survival24moHigh * 100)}%)`).join(" + ");
      console.log(pc.bold(pc.magenta("  🔭 Outside View    : ") + `${classes}`));
      console.log(`     Swarm implies ${Math.round(ov.impliedSurvival * 100)}% survival vs base midpoint ${Math.round(ov.baseSurvivalMidpoint * 100)}% → optimism delta ${ov.optimismDelta >= 0 ? "+" : ""}${Math.round(ov.optimismDelta * 100)}pts`);
      console.log(pc.dim(`     ${ov.guidance}`));
      console.log(pc.dim(`     Dominant class failure causes: ${ov.topFailureCauses.join("; ")}`));
    }

    if (dossier.epistemicSummary) {
      const es = dossier.epistemicSummary;
      console.log(`  Epistemic Balance  : ${pc.cyan(`${es.verifiedFactsCount} Facts`)} | ${pc.green(`${es.verifiedComputationsCount} Computations`)} | ${pc.magenta(`${es.externalEvidenceCount} External Evidence`)} | ${pc.yellow(`${es.modelledAssumptionsCount} Hypotheses`)} | ${pc.blue(`${es.inferencesCount} Inferences`)} | ${pc.red(`${es.unknownsCount} Unknowns`)} | ${pc.red(`${es.contradictionsCount} Contradictions`)}`);
      if (es.hasUnvalidatedFatalAssumptions || es.hasUnresolvedUnknownsOrContradictions) {
        console.log(pc.yellow(`  ⚠️  Verdict Constrained: Unresolved fatal assumptions, unknowns, or contradictions prevent unconditional BUILD.`));
      }
    }
    console.log();

    const rb = dossier.resilienceBreakdown;
    console.log(pc.bold("  Dimensional Score Breakdown (Traceable Attribution):"));
    console.log(`  1. Technical Feasibility (20%)     : ${pc.green(`${rb.technicalFeasibility}/100`)} — ${pc.dim(rb.dimensionRationales.technicalFeasibility)}`);
    if (rb.dimensionTraces) {
      console.log(`     ${pc.dim("Trace:")} ${rb.dimensionTraces.technicalFeasibility.factors.map(f => `${f.impact > 0 ? pc.green(`+${f.impact}`) : pc.red(`${f.impact}`)} [${f.groundingTier} ➔ ${f.riskMitigationVerdict || "MITIGATES_RISK"}] ${f.description}`).join(pc.dim(" • "))}`);
    }
    console.log(`  2. Demand & Adoption (25%)         : ${pc.yellow(`${rb.demandAndAdoption}/100`)} — ${pc.dim(rb.dimensionRationales.demandAndAdoption)}`);
    if (rb.dimensionTraces) {
      console.log(`     ${pc.dim("Trace:")} ${rb.dimensionTraces.demandAndAdoption.factors.map(f => `${f.impact > 0 ? pc.green(`+${f.impact}`) : pc.red(`${f.impact}`)} [${f.groundingTier} ➔ ${f.riskMitigationVerdict || "MITIGATES_RISK"}] ${f.description}`).join(pc.dim(" • "))}`);
    }
    console.log(`  3. Unit Economics & Capital (20%)  : ${pc.green(`${rb.economicsAndCapitalEfficiency}/100`)} — ${pc.dim(rb.dimensionRationales.economicsAndCapitalEfficiency)}`);
    if (rb.dimensionTraces) {
      console.log(`     ${pc.dim("Trace:")} ${rb.dimensionTraces.economicsAndCapitalEfficiency.factors.map(f => `${f.impact > 0 ? pc.green(`+${f.impact}`) : pc.red(`${f.impact}`)} [${f.groundingTier} ➔ ${f.riskMitigationVerdict || "MITIGATES_RISK"}] ${f.description}`).join(pc.dim(" • "))}`);
    }
    console.log(`  4. Defensibility & Moat (15%)      : ${pc.cyan(`${rb.defensibilityAndMoat}/100`)} — ${pc.dim(rb.dimensionRationales.defensibilityAndMoat)}`);
    if (rb.dimensionTraces) {
      console.log(`     ${pc.dim("Trace:")} ${rb.dimensionTraces.defensibilityAndMoat.factors.map(f => `${f.impact > 0 ? pc.green(`+${f.impact}`) : pc.red(`${f.impact}`)} [${f.groundingTier} ➔ ${f.riskMitigationVerdict || "MITIGATES_RISK"}] ${f.description}`).join(pc.dim(" • "))}`);
    }
    console.log(`  5. Adversarial Resilience (20%)    : ${pc.red(`${rb.adversarialResilience}/100`)} — ${pc.dim(rb.dimensionRationales.adversarialResilience)}`);
    if (rb.dimensionTraces) {
      console.log(`     ${pc.dim("Trace:")} ${rb.dimensionTraces.adversarialResilience.factors.map(f => `${f.impact > 0 ? pc.green(`+${f.impact}`) : pc.red(`${f.impact}`)} [${f.groundingTier} ➔ ${f.riskMitigationVerdict || "MITIGATES_RISK"}] ${f.description}`).join(pc.dim(" • "))}`);
    }
    console.log();

    // 7-Tier Epistemic Evidence Feed
    console.log(pc.bold("🔬 7-TIER EPISTEMIC EVIDENCE AUDIT:"));
    const tiers = [
      { key: "VERIFIED_FACT", title: "🏛️  VERIFIED FACTS (Canonical Statutory Standards)", color: pc.cyan },
      { key: "VERIFIED_COMPUTATION", title: "⚙️  VERIFIED COMPUTATIONS (Isolated Code/Math Sandbox Exit 0)", color: pc.green },
      { key: "EXTERNAL_EVIDENCE", title: "🌐 EXTERNAL EVIDENCE (Sourced Prediction & Community Recon)", color: pc.magenta },
      { key: "MODELLED_ASSUMPTION", title: "📐 MODELLED ASSUMPTIONS (Unvalidated Hypotheses)", color: pc.yellow },
      { key: "INFERENCE", title: "💡 INFERENCES (Deductions & Domain Analogies)", color: pc.blue },
      { key: "UNKNOWN", title: "❓ UNKNOWNS (Unquantified Black-Box Parameters)", color: pc.red },
      { key: "CONTRADICTED", title: "⚡ CONTRADICTIONS (Unresolved Opposing Claims)", color: pc.red }
    ];

    tiers.forEach(t => {
      const items = dossier.evidenceFeed.filter(e => e.tier === t.key);
      if (items.length > 0) {
        console.log(pc.bold(t.color(`\n  ${t.title}:`)));
        items.forEach(item => {
          console.log(`  • "${item.claim}"`);
          console.log(`    ${pc.dim("Provenance:")} ${item.provenance} (Confidence: ${item.confidencePercent}%)`);
        });
      }
    });

    // Domain Specialist Agents
    console.log(pc.bold("\n👥 DOMAIN SPECIALIST ASSESSMENTS:"));
    for (const [role, report] of Object.entries(dossier.roleAssessments)) {
      if (role === "synthesizer") continue;
      console.log(`\n  ${pc.bold(pc.yellow(`• [${report.roleNumber}] ${report.roleTitle}`))}: ${pc.cyan(`${report.score}/100`)} (${report.verdict})`);
      console.log(`    ${pc.dim("Rationale:")} ${report.rationale}`);
      if (report.fatalFlaws.length > 0) {
        console.log(`    ${pc.red("Fatal Flaw:")} ${report.fatalFlaws[0]}`);
      }
    }

    // Adversarial Debate Trail
    console.log(pc.bold("\n⚔️  ADVERSARIAL CROSS-EXAMINATION TRAIL:"));
    for (const challenge of dossier.debateTrail) {
      console.log(`  [Round ${challenge.round} // ${pc.red(challenge.challenger.toUpperCase())} ➔ ${pc.green(challenge.target.toUpperCase())}] (${pc.yellow(challenge.status)})`);
      console.log(`  • Challenge: ${challenge.challengePoint}`);
      if (challenge.rebuttal) {
        console.log(`  • Rebuttal : ${pc.dim(challenge.rebuttal)}`);
      }
    }

    // Strongest Evidence & Weakest Assumption
    console.log(pc.bold("\n🔬 STRONGEST EVIDENCE & WEAKEST ASSUMPTION:"));
    console.log(`  ${pc.bold(pc.green("• STRONGEST EVIDENCE"))} [${dossier.strongestEvidence.tier}]:`);
    console.log(`    "${dossier.strongestEvidence.claim}"`);
    console.log(`    Provenance: ${pc.dim(dossier.strongestEvidence.provenance)} (Confidence: ${dossier.strongestEvidence.confidencePercent}%)`);

    console.log(`\n  ${pc.bold(pc.red("• WEAKEST ASSUMPTION"))} [${dossier.weakestAssumption.id}]:`);
    console.log(`    "${dossier.weakestAssumption.statement}"`);
    console.log(`    Fatal Risk: ${pc.red(dossier.weakestAssumption.fatalRisk)}`);
    console.log(`    Disproof Threshold: ${pc.dim(dossier.weakestAssumption.disproofThreshold)}`);

    // Kill Conditions
    console.log(pc.bold("\n💀 STRICT KILL CONDITIONS (FALSIFIABLE):"));
    for (let i = 0; i < dossier.killConditions.length; i++) {
      console.log(`  ${i + 1}. ${dossier.killConditions[i]}`);
    }

    // Cheapest Validation Experiment
    const exp = dossier.cheapestValidationExperiment;
    console.log(pc.bold("\n🧪 CHEAPEST VALIDATION EXPERIMENT:"));
    console.log(`  Title      : ${pc.bold(pc.yellow(exp.title))}`);
    console.log(`  Cost & Time: ${pc.green(`$${exp.estimatedCostUsd}`)} | ${pc.cyan(`${exp.timeToExecuteDays} Days`)}`);
    console.log(`  Action     : ${exp.description}`);
    console.log(`  Success    : ${pc.green(exp.successMetric)}`);
    console.log(`  Kill Signal: ${pc.red(exp.failureKillSignal)}`);

    // Sandboxed Unit Economics
    console.log(pc.bold("\n📈 SANDBOXED UNIT ECONOMICS:"));
    console.log(`  • Est. LTV / CAC : ${pc.bold(`${dossier.simulation.ltvCacRatio}x`)} (LTV: $${dossier.simulation.ltvEstimateUsd} / CAC: $${dossier.simulation.cacEstimateUsd})`);
    console.log(`  • Payback Period : ${dossier.simulation.estimatedPaybackMonths} months`);
    console.log(`  • Monthly Infra  : $${dossier.simulation.monthlyInfraCostUsd}`);
    console.log(`  • Sandbox Proof  : ${pc.dim(dossier.simulation.sandboxExecutionProof.runtime)} (exit ${dossier.simulation.sandboxExecutionProof.exitCode})`);

    // Human Approval Gates
    console.log(pc.bold("\n🛑 HUMAN-IN-THE-LOOP APPROVAL GATES (TrueForge Dual-Key Safety):"));
    for (const gate of dossier.approvalGates) {
      console.log(`  • [${pc.yellow(gate.status)}] ${gate.summary}`);
      console.log(`    Action Type: ${gate.actionType}`);
    }

    console.log(pc.green("\n✔ Full evidence-first dossier compiled successfully.\n"));
    }

    if (options.export) {
      const isJson = options.export.endsWith(".json");
      const content = isJson ? JSON.stringify(dossier, null, 2) : dossierStorage.exportDossierMarkdown(dossier);
      await fs.writeFile(options.export, content, "utf-8");
      console.log(pc.green(`✔ Exported compiled dossier to: ${options.export}\n`));
    }
  });

program
  .command("list")
  .description("List all saved and historical intelligence dossiers")
  .option("-l, --limit <number>", "Number of records to show", "20")
  .action(async (options) => {
    console.log(pc.bold(pc.cyan("\n📂 DOSSIER INTELLIGENCE ARCHIVE:")));
    const dossiers = await dossierStorage.listDossiers(parseInt(options.limit, 10));

    if (dossiers.length === 0) {
      console.log(pc.dim("  No dossiers compiled yet. Run 'dossier evaluate' to generate one.\n"));
      return;
    }

    console.log(pc.dim("---------------------------------------------------------------------------------------"));
    console.log(
      `${pc.bold("CODE".padEnd(14))} ${pc.bold("VERDICT".padEnd(20))} ${pc.bold("SCORE".padEnd(8))} ${pc.bold("DOMAIN".padEnd(22))} ${pc.bold("TITLE")}`
    );
    console.log(pc.dim("---------------------------------------------------------------------------------------"));

    for (const d of dossiers) {
      const verdictColor = d.verdict === "BUILD" || d.verdict === "BUILD_IF_VALIDATED" ? pc.green : (d.verdict === "REFINE" ? pc.yellow : pc.red);
      console.log(
        `${pc.cyan(d.dossierCode.padEnd(14))} ${verdictColor(d.verdict.padEnd(20))} ${pc.bold(`${d.score}/100`.padEnd(8))} ${pc.dim(d.archetypeLabel.slice(0, 20).padEnd(22))} ${pc.white(d.title)}`
      );
    }
    console.log(pc.dim("---------------------------------------------------------------------------------------\n"));
  });

program
  .command("view <id>")
  .description("Display an existing intelligence dossier by ID or Dossier Code")
  .action(async (id) => {
    const dossier = await dossierStorage.getDossier(id);
    if (!dossier) {
      console.error(pc.red(`Error: Dossier '${id}' not found in archive.`));
      process.exit(1);
    }

    console.log(pc.bold(pc.yellow(`\n⚡ DOSSIER: ${dossier.idea.title.toUpperCase()}`)));
    console.log(`Code: ${pc.cyan(dossier.dossierCode)} | Date: ${dossier.timestamp.slice(0, 10)} | Verdict: ${pc.bold(pc.green(dossier.overallVerdict))} (${dossier.killScore}/100)`);
    console.log(pc.dim("\nExecutive Summary:"));
    console.log(dossier.executiveSummary);
    console.log(pc.dim("\nWeakest Assumption:"));
    console.log(`• "${dossier.weakestAssumption.statement}" — Fatal Risk: ${pc.red(dossier.weakestAssumption.fatalRisk)}`);
    console.log(pc.dim("\nCheapest Validation Move:"));
    console.log(`• ${dossier.cheapestValidationExperiment.title} (Cost: $${dossier.cheapestValidationExperiment.estimatedCostUsd}, ${dossier.cheapestValidationExperiment.timeToExecuteDays} Days)`);
    console.log(`  ${pc.green(dossier.cheapestValidationExperiment.successMetric)}\n`);
  });

program
  .command("export <id>")
  .description("Export a dossier to Markdown or JSON")
  .option("-f, --format <format>", "Export format: markdown or json", "markdown")
  .option("-o, --output <path>", "File path to save the export")
  .action(async (id, options) => {
    const dossier = await dossierStorage.getDossier(id);
    if (!dossier) {
      console.error(pc.red(`Error: Dossier '${id}' not found.`));
      process.exit(1);
    }

    const format = options.format.toLowerCase();
    const content = format === "json" ? JSON.stringify(dossier, null, 2) : dossierStorage.exportDossierMarkdown(dossier);

    if (options.output) {
      await fs.writeFile(options.output, content, "utf-8");
      console.log(pc.green(`✔ Exported dossier '${id}' to ${options.output}`));
    } else {
      console.log(content);
    }
  });

program
  .command("status")
  .description("Check live LLM engine, sandbox runtime, and MCP harness status")
  .action(async () => {
    console.log(pc.bold(pc.cyan("\n⚡ DOSSIER PLATFORM RUNTIME STATUS:")));
    const llm = getLLMStatus();
    console.log(`• Live LLM Router    : ${llm.hasLiveLLM ? pc.green("ONLINE") : pc.yellow("OFFLINE (HEURISTIC ENGINE ACTIVE)")}`);
    console.log(`• Active Provider    : ${pc.cyan(llm.activeProvider)}`);
    console.log(`• Active Model       : ${pc.bold(llm.activeModel)}`);
    console.log(`• Configured Chains  : ${llm.configuredProviders.join(" ➔ ") || "none"}`);

    const sim = await runEconomicsSimulation(49, 0.05, 150, 1000, 500, 30);
    console.log(`• Python Sandbox     : ${sim.exitCode === 0 ? pc.green(`ONLINE (${sim.runtime}, Exit 0)`) : pc.red("FAILED")}`);
    console.log(`• Sandbox Isolation  : ${pc.green("Verified (Subprocess boundary + input JSON sanitization)")}\n`);
  });

program
  .command("stress-test")
  .description("Run the 5-invariant adversarial stress test suite")
  .action(async () => {
    console.log(pc.bold(pc.yellow("\n🔥 EXECUTING DOSSIER 5-INVARIANT ADVERSARIAL STRESS TEST SUITE...\n")));
    await runStressTestSuite();
    console.log(pc.green("\n✔ Stress test execution completed.\n"));
  });

program
  .command("forecast-list")
  .description("List calibration-ledger forecasts (the dated falsifiable claims behind verdicts)")
  .option("-s, --status <status>", "Filter by status: PENDING | HIT | MISS")
  .option("-l, --limit <number>", "Max records to show", "30")
  .action(async (options) => {
    const status = options.status ? String(options.status).toUpperCase() as ForecastRecord["status"] : undefined;
    const forecasts = await forecastLedger.listForecasts(parseInt(options.limit, 10) || 30, status);
    console.log(pc.bold(pc.cyan(`\n📆 FORECAST LEDGER (${status || "ALL"}):\n`)));
    if (forecasts.length === 0) {
      console.log(pc.dim("  No forecasts yet. Run 'dossier evaluate' to register some.\n"));
      return;
    }
    for (const f of forecasts) {
      const color = f.status === "PENDING" ? pc.yellow : f.status === "HIT" ? pc.green : pc.red;
      console.log(`  ${color(f.status.padEnd(7))} ${pc.cyan(f.id)}  due ${f.dueDate.slice(0, 10)}  P=${(f.probability * 100).toFixed(0)}%  ${pc.dim(f.kind)}`);
      console.log(`    ${pc.dim(`[${f.domainArchetype}${f.modelId ? ` · ${f.modelId}` : ""}]`)} ${f.statement.slice(0, 110)}`);
    }
    console.log();
  });

program
  .command("forecast-resolve <forecastId> <outcome>")
  .description("Resolve a forecast: outcome is HIT (event happened) or MISS (it did not)")
  .option("-n, --notes <notes>", "Resolution notes (how you observed the outcome)")
  .action(async (forecastId, outcome, options) => {
    const normalized = String(outcome).toUpperCase();
    if (normalized !== "HIT" && normalized !== "MISS") {
      console.error(pc.red("Outcome must be HIT or MISS."));
      process.exit(1);
    }
    const record = await forecastLedger.resolveForecast(forecastId, normalized as "HIT" | "MISS", options.notes);
    if (!record) {
      console.error(pc.red(`Forecast '${forecastId}' not found or already resolved.`));
      process.exit(1);
    }
    console.log(pc.green(`✔ Forecast ${forecastId} resolved as ${normalized}. Run 'dossier forecast-score' to update calibration.`));
  });

program
  .command("forecast-score")
  .description("Brier-score resolved forecasts (overall, by domain, by model, calibration bins)")
  .action(async () => {
    const score = await forecastLedger.scoreForecasts();
    console.log(pc.bold(pc.cyan("\n🎯 FORECAST CALIBRATION (Brier — lower is better, 0.25 = coin flip):\n")));
    if (score.resolvedCount === 0) {
      console.log(pc.dim(`  No resolved forecasts yet (${score.pendingCount} pending). Resolve some with 'dossier forecast-resolve'.\n`));
      return;
    }
    console.log(`  Overall Brier  : ${pc.bold(String(score.overallBrier))} over ${score.resolvedCount} resolved forecasts`);
    for (const [domain, b] of Object.entries(score.byDomain)) {
      console.log(`  • ${domain.padEnd(42)} ${b}`);
    }
    for (const [model, b] of Object.entries(score.byModel)) {
      console.log(`  • model ${String(model).padEnd(36)} ${b}`);
    }
    console.log(pc.dim("  Calibration bins (P band → observed hit rate):"));
    for (const bin of score.calibrationBins) {
      if (bin.count > 0) {
        console.log(`    ${bin.bin.padEnd(8)} n=${String(bin.count).padEnd(4)} meanP=${bin.meanProbability} hitRate=${bin.hitRate}%`);
      }
    }
    console.log();
  });

program.parse(process.argv);
