import test from "node:test";
import assert from "node:assert/strict";
import { runEconomicsSimulation } from "../dist/tools/sandbox.js";
import { IdeaSwarmOrchestrator } from "../dist/core/swarm.js";

test("Sandbox Economics Simulation runs successfully", async () => {
  const sim = await runEconomicsSimulation(49.0, 0.05, 150.0, 500, 1500, 30);
  assert.ok(sim.metrics.cacEstimateUsd > 0, "CAC must be positive");
  assert.ok(sim.metrics.ltvEstimateUsd > 0, "LTV must be positive");
  assert.ok(sim.metrics.ltvCacRatio > 0, "LTV/CAC must be computed");
  assert.ok(sim.runtime, "Runtime proof must exist");
});

test("Dossier Orchestrator evaluates idea and generates complete intelligence dossier", async () => {
  const orchestrator = new IdeaSwarmOrchestrator();
  const dossier = await orchestrator.evaluateIdea({
    title: "AI Compliance Auditor",
    summary: "Scans cloud infra for SOC2/HIPAA violations and creates remediation PRs.",
    targetAudience: "B2B SaaS CTOs",
    monetization: "$499/mo per company"
  });

  assert.ok(dossier.id, "Dossier must have an ID");
  assert.ok(dossier.killScore >= 0 && dossier.killScore <= 100, "Kill score must be between 0 and 100");
  assert.ok(dossier.roleAssessments.redteam, "Red Team assessment must be present");
  assert.ok(dossier.roleAssessments.investor, "Investor assessment must be present");
  assert.ok(dossier.roleAssessments.architect, "Architect assessment must be present");
  assert.ok(dossier.roleAssessments.analyst, "Market Analyst assessment must be present");
  assert.ok(dossier.roleAssessments.customer, "Customer Advocate assessment must be present");
  assert.ok(dossier.roleAssessments.expert, "Domain Expert assessment must be present");
  assert.ok(dossier.keyAssumptions.length > 0, "Key assumptions must be populated");
  assert.ok(dossier.contradictions.length > 0, "Contradictions must be populated");
  assert.ok(dossier.evidenceFeed.length > 0, "Evidence feed must be populated");
  assert.ok(dossier.debateTrail.length > 0, "Debate trail must be populated");
  assert.ok(dossier.approvalGates.length > 0, "Human approval gates must be defined");
  assert.equal(dossier.approvalGates[0].status, "PENDING_HUMAN_APPROVAL");
});
