#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { IdeaSwarmOrchestrator } from "./core/swarm.js";
import { IdeaInput } from "./types/index.js";

const program = new Command();

program
  .name("dossier")
  .description("Adversarial multi-agent idea intelligence platform on TrueForge harness")
  .version("0.1.0");

program
  .command("evaluate")
  .description("Compile an intelligence dossier on an idea through the adversarial agent swarm")
  .option("-t, --title <title>", "Idea title", "Autonomous Micro-SaaS Agent")
  .option("-s, --summary <summary>", "Idea summary description", "AI swarm that validates startup ideas before building.")
  .option("-a, --audience <audience>", "Target audience", "Founders, indie hackers, venture builders")
  .option("-m, --monetization <monetization>", "Monetization model", "$49/month subscription or per-evaluation pass")
  .option("-p, --pricing <number>", "Monthly price in USD", "49")
  .option("-c, --cac <number>", "Estimated customer acquisition cost in USD", "150")
  .action(async (options) => {
    console.log(pc.cyan("\n======================================================="));
    console.log(pc.bold(pc.yellow("  ⚡ DOSSIER — ADVERSARIAL IDEA INTELLIGENCE")));
    console.log(pc.dim("  Powered by TrueForge Harness (File TF-007)"));
    console.log(pc.cyan("=======================================================\n"));

    const ideaInput: IdeaInput = {
      title: options.title,
      summary: options.summary,
      targetAudience: options.audience,
      monetization: options.monetization
    };

    console.log(pc.bold("Target Concept:"), pc.green(ideaInput.title));
    console.log(pc.bold("Audience:      "), ideaInput.targetAudience);
    console.log(pc.bold("Monetization:  "), ideaInput.monetization);
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
    console.log(pc.bold(pc.cyan("📊 SWARM VERDICT & KILL SCORE:")));
    const verdictColor = dossier.killScore >= 60 ? pc.green : pc.red;
    console.log(`  Resilience Score : ${verdictColor(pc.bold(`${dossier.killScore}/100`))}`);
    console.log(`  Consensus Verdict: ${verdictColor(pc.bold(dossier.overallVerdict))}\n`);

    console.log(pc.bold("👥 AGENT ASSESSMENTS:"));
    for (const [role, report] of Object.entries(dossier.roleAssessments)) {
      if (role === "synthesizer") continue;
      console.log(`\n  ${pc.bold(pc.yellow(`• ${report.roleTitle}`))}: ${pc.cyan(`${report.score}/100`)} (${report.verdict})`);
      console.log(`    ${pc.dim("Rationale:")} ${report.rationale}`);
      if (report.fatalFlaws.length > 0) {
        console.log(`    ${pc.red("Fatal Flaw:")} ${report.fatalFlaws[0]}`);
      }
    }

    console.log(pc.bold("\n⚔️  ADVERSARIAL DEBATE HIGHLIGHTS:"));
    for (const challenge of dossier.debateTrail) {
      console.log(`  [${pc.red(challenge.challenger.toUpperCase())} vs ${pc.green(challenge.target.toUpperCase())}]`);
      console.log(`  - Challenge: ${challenge.challengePoint}`);
      if (challenge.rebuttal) {
        console.log(`  - Rebuttal:  ${pc.dim(challenge.rebuttal)}`);
      }
    }

    console.log(pc.bold("\n📈 SANDBOXED UNIT ECONOMICS:"));
    console.log(`  • Est. LTV / CAC : ${pc.bold(`${dossier.simulation.ltvCacRatio}x`)} (LTV: $${dossier.simulation.ltvEstimateUsd} / CAC: $${dossier.simulation.cacEstimateUsd})`);
    console.log(`  • Payback Period : ${dossier.simulation.estimatedPaybackMonths} months`);
    console.log(`  • Monthly Infra  : $${dossier.simulation.monthlyInfraCostUsd}`);
    console.log(`  • Sandbox Proof  : ${pc.dim(dossier.simulation.sandboxExecutionProof.runtime)} (exit ${dossier.simulation.sandboxExecutionProof.exitCode})`);

    console.log(pc.bold("\n🛑 HUMAN-IN-THE-LOOP APPROVAL GATES (TrueForge Safety):"));
    for (const gate of dossier.approvalGates) {
      console.log(`  • [${pc.yellow(gate.status)}] ${gate.summary}`);
      console.log(`    Action Type: ${gate.actionType}`);
    }

    console.log(pc.bold("\n🚀 7-DAY VALIDATION ROADMAP:"));
    console.log(`  Day 1–2: ${dossier.validationRoadmap.day1to2.join(" | ")}`);
    console.log(`  Day 3–5: ${dossier.validationRoadmap.day3to5.join(" | ")}`);
    console.log(`  Day 6–7: ${dossier.validationRoadmap.day6to7.join(" | ")}`);

    console.log(pc.green("\n✔ Full validation dossier compiled successfully.\n"));
  });

program.parse(process.argv);
