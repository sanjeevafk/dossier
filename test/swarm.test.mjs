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
  assert.ok(dossier.debateTrail.length >= 3, "Round 1 debate trail must be populated");
  assert.ok(dossier.approvalGates.length > 0, "Human approval gates must be defined");
  assert.equal(dossier.approvalGates[0].status, "PENDING_HUMAN_APPROVAL");

  // Phase 2: stochastic Monte Carlo sandbox coverage
  assert.ok(dossier.simulation.monteCarlo, "Monte Carlo statistics must be present");
  assert.ok(dossier.simulation.monteCarlo.iterations >= 1000, "Monte Carlo must run at least 1000 iterations");
  assert.ok(
    dossier.simulation.monteCarlo.survivalProbability24Mo >= 0 && dossier.simulation.monteCarlo.survivalProbability24Mo <= 1,
    "Survival probability must be a valid probability"
  );
  const mcPercentiles = dossier.simulation.monteCarlo.ltvCacPercentiles;
  assert.ok(
    mcPercentiles.p10 <= mcPercentiles.p50 && mcPercentiles.p50 <= mcPercentiles.p90,
    "LTV/CAC percentiles must be coherent"
  );
  assert.ok(Array.isArray(dossier.simulation.monteCarlo.sensitivity), "Tornado sensitivity data must exist");

  // Phase 2: epistemic claim DAG
  assert.ok(Array.isArray(dossier.claimDag) && dossier.claimDag.length > 0, "Claim DAG must be populated");
  const downstream = dossier.claimDag.find((n) => n.id === "EV-06");
  assert.ok(downstream && downstream.dependencies.includes("EV-01"), "Inference claim must depend on verified computation");

  // Phase 2: crossfire round 2 with tool traces
  if (dossier.debateRoundsExecuted === 2) {
    const roundTwo = dossier.debateTrail.find((d) => d.round === 2);
    assert.ok(roundTwo, "Round 2 crossfire entry must exist when escalation triggers");
    assert.ok(Array.isArray(dossier.crossfireToolTraces) && dossier.crossfireToolTraces.length > 0, "Crossfire must record tool execution traces");
    const crossfire = dossier.contradictions.find((c) => c.id === "C-CROSSFIRE-02");
    assert.ok(crossfire && Array.isArray(crossfire.debateHistory) && crossfire.debateHistory.length > 0, "Crossfire contradiction must carry the full debate history");
  }
});
