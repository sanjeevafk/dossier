#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { IdeaSwarmOrchestrator } from "./core/swarm.js";
import { IdeaInput } from "./types/index.js";

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
  .action(async (options) => {
    console.log(pc.cyan("\n======================================================="));
    console.log(pc.bold(pc.yellow("  ⚡ DOSSIER — EVIDENCE-FIRST ADVERSARIAL SWARM")));
    console.log(pc.dim("  TrueForge Harness (File TF-007) • Zero Sycophancy"));
    console.log(pc.cyan("=======================================================\n"));

    const ideaInput: IdeaInput = {
      title: options.title,
      summary: options.summary,
      targetAudience: options.audience,
      monetization: options.monetization
    };

    console.log(pc.bold("Target Concept: "), pc.green(ideaInput.title));
    console.log(pc.bold("Target Audience:"), ideaInput.targetAudience);
    console.log(pc.bold("Monetization:   "), ideaInput.monetization);
    console.log(pc.dim("\n-------------------------------------------------------"));

    const orchestrator = new IdeaSwarmOrchestrator();

    const dossier = await orchestrator.evaluateIdea(ideaInput, {
      pricingMonthlyUsd: parseFloat(options.pricing),
      estimatedCacUsd: parseFloat(options.cac),
      onProgress: (stage, detail) => {
        console.log(`[${pc.magenta(stage)}] ${detail}`);
      }
    });

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
    console.log(`  Composite Resilience: ${verdictColor(pc.bold(`${dossier.killScore}/100`))} (Confidence: ${dossier.confidenceScore}%, Risk: ${dossier.riskLevel === "LOW" ? pc.green(dossier.riskLevel) : pc.yellow(dossier.riskLevel)})`);
    
    if (dossier.epistemicSummary) {
      const es = dossier.epistemicSummary;
      console.log(`  Epistemic Balance  : ${pc.cyan(`${es.verifiedFactsCount} Verified Facts`)} | ${pc.green(`${es.verifiedComputationsCount} Verified Computations`)} | ${pc.yellow(`${es.modelledAssumptionsCount} Modelled Assumptions`)} | ${pc.red(`${es.unknownsCount} Unknowns`)}`);
      if (es.hasUnvalidatedFatalAssumptions && dossier.overallVerdict === "BUILD_IF_VALIDATED") {
        console.log(pc.yellow(`  ⚠️  Verdict Constrained: Unresolved fatal assumptions prevent unconditional BUILD until validated.`));
      }
    }
    console.log();

    const rb = dossier.resilienceBreakdown;
    console.log(pc.bold("  Dimensional Score Breakdown (Traceable Attribution):"));
    console.log(`  1. Technical Feasibility (20%)     : ${pc.green(`${rb.technicalFeasibility}/100`)} — ${pc.dim(rb.dimensionRationales.technicalFeasibility)}`);
    if (rb.dimensionTraces) {
      console.log(`     ${pc.dim("Trace:")} ${rb.dimensionTraces.technicalFeasibility.factors.map(f => `${f.impact > 0 ? pc.green(`+${f.impact}`) : pc.red(`${f.impact}`)} [${f.groundingTier}] ${f.description}`).join(pc.dim(" • "))}`);
    }
    console.log(`  2. Demand & Adoption (25%)         : ${pc.yellow(`${rb.demandAndAdoption}/100`)} — ${pc.dim(rb.dimensionRationales.demandAndAdoption)}`);
    if (rb.dimensionTraces) {
      console.log(`     ${pc.dim("Trace:")} ${rb.dimensionTraces.demandAndAdoption.factors.map(f => `${f.impact > 0 ? pc.green(`+${f.impact}`) : pc.red(`${f.impact}`)} [${f.groundingTier}] ${f.description}`).join(pc.dim(" • "))}`);
    }
    console.log(`  3. Unit Economics & Capital (20%)  : ${pc.green(`${rb.economicsAndCapitalEfficiency}/100`)} — ${pc.dim(rb.dimensionRationales.economicsAndCapitalEfficiency)}`);
    if (rb.dimensionTraces) {
      console.log(`     ${pc.dim("Trace:")} ${rb.dimensionTraces.economicsAndCapitalEfficiency.factors.map(f => `${f.impact > 0 ? pc.green(`+${f.impact}`) : pc.red(`${f.impact}`)} [${f.groundingTier}] ${f.description}`).join(pc.dim(" • "))}`);
    }
    console.log(`  4. Defensibility & Moat (15%)      : ${pc.cyan(`${rb.defensibilityAndMoat}/100`)} — ${pc.dim(rb.dimensionRationales.defensibilityAndMoat)}`);
    if (rb.dimensionTraces) {
      console.log(`     ${pc.dim("Trace:")} ${rb.dimensionTraces.defensibilityAndMoat.factors.map(f => `${f.impact > 0 ? pc.green(`+${f.impact}`) : pc.red(`${f.impact}`)} [${f.groundingTier}] ${f.description}`).join(pc.dim(" • "))}`);
    }
    console.log(`  5. Adversarial Resilience (20%)    : ${pc.red(`${rb.adversarialResilience}/100`)} — ${pc.dim(rb.dimensionRationales.adversarialResilience)}`);
    if (rb.dimensionTraces) {
      console.log(`     ${pc.dim("Trace:")} ${rb.dimensionTraces.adversarialResilience.factors.map(f => `${f.impact > 0 ? pc.green(`+${f.impact}`) : pc.red(`${f.impact}`)} [${f.groundingTier}] ${f.description}`).join(pc.dim(" • "))}`);
    }
    console.log();

    // Domain Specialist Agents
    console.log(pc.bold("👥 DOMAIN SPECIALIST ASSESSMENTS:"));
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

    // Evidence & Assumptions
    console.log(pc.bold("\n🔬 EVIDENCE & WEAKEST ASSUMPTION:"));
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
  });

program.parse(process.argv);
