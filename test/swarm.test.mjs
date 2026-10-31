import test from "node:test";
import assert from "node:assert/strict";
import { runEconomicsSimulation } from "../dist/tools/sandbox.js";
import { IdeaSwarmOrchestrator } from "../dist/core/swarm.js";
import { buildMutationProposals } from "../dist/core/mutator.js";
import { classifyIdeaDomain } from "../dist/core/classifier.js";

test("Mutation Engine generates three distinct strategic pivots on a collapsed score", () => {
  const idea = {
    title: "ChatNotes: AI Chrome Extension for Meeting Summaries",
    summary: "A Chrome extension that records Google Meet audio and sends transcripts to OpenAI to output bulleted notes.",
    targetAudience: "General remote workers",
    monetization: "Freemium with $10/mo Pro subscription"
  };
  const domain = classifyIdeaDomain(idea);
  const proposals = buildMutationProposals(idea, domain, {
    killScore: 30,
    fatalFlaw: "Zero structural defensibility: thin wrapper architecture.",
    pricing: 10,
    churn: 0.28,
    cac: 45,
    survival24Mo: 0.26,
    ltvCacRatio: 0.65
  });

  assert.equal(proposals.length, 3, "Exactly three pivots must be generated");
  const strategies = new Set(proposals.map((p) => p.strategy));
  assert.ok(strategies.has("WEDGE_PIVOT"), "Wedge Pivot must be present");
  assert.ok(strategies.has("MODEL_INVERSION"), "Business Model Inversion must be present");
  assert.ok(strategies.has("TROJAN_DISTRIBUTION"), "Trojan Distribution must be present");
  proposals.forEach((p) => {
    assert.ok(p.mutatedIdea.title, `Pivot ${p.id} must carry a mutated title`);
    assert.ok(
      !/\b(and|that|with|for)\s+(edition|platform|acquisition)\b/i.test(p.mutatedIdea.title),
      `Pivot ${p.id} title must strip stop-words: got "${p.mutatedIdea.title}"`
    );
    assert.ok(p.mutatedIdea.summary.length > 40, `Pivot ${p.id} must carry a substantive summary`);
    assert.ok(p.mutatedIdea.monetization.match(/\$/), `Pivot ${p.id} monetization must be concrete`);
  });
});

test("Sandbox Economics Simulation runs successfully", async () => {
  const sim = await runEconomicsSimulation(49.0, 0.05, 150.0, 500, 1500, 30);
  assert.ok(sim.metrics.cacEstimateUsd > 0, "CAC must be positive");
  assert.ok(sim.metrics.ltvEstimateUsd > 0, "LTV must be positive");
  assert.ok(sim.metrics.ltvCacRatio > 0, "LTV/CAC must be computed");
  assert.ok(sim.runtime, "Runtime proof must exist");
});

test("Dossier Orchestrator evaluates idea and generates complete intelligence dossier", async () => {
  const orchestrator = new IdeaSwarmOrchestrator();
  const events = [];
  const dossier = await orchestrator.evaluateIdea({
    title: "AI Compliance Auditor",
    summary: "Scans cloud infra for SOC2/HIPAA violations and creates remediation PRs.",
    targetAudience: "B2B SaaS CTOs",
    monetization: "$499/mo per company"
  }, {
    useLiveLLM: false,
    onEvent: (e) => events.push(e)
  });

  assert.ok(dossier.id, "Dossier must have an ID");
  assert.equal(dossier.evaluationMode, "HEURISTIC_ENGINE", "Offline evaluation must be labeled as heuristic engine");
  assert.ok(dossier.decisionEvaluation, "Dossier must carry the fast decision model evaluation");
  assert.ok(["BUILD", "REFINE", "KILL"].includes(dossier.decisionEvaluation.verdict), "Decision model must issue a valid verdict");
  assert.ok(dossier.decisionEvaluation.answers.moat, "Decision model must have moat evaluation");
  assert.ok(events.some((e) => e.type === "decision_gate"), "Orchestrator must emit a decision_gate event");
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
  assert.ok(dossier.cheapestValidationExperiment, "Cheapest validation experiment must be defined");
  assert.ok(dossier.cheapestValidationExperiment.title, "Validation experiment must have a title");

  // Honesty invariants: no fabricated external evidence, no synthetic telemetry.
  const evidenceText = dossier.evidenceFeed.map((e) => `${e.provenance} ${e.claim}`).join(" ");
  assert.ok(!evidenceText.includes("Agent Reach Community Reconnaissance"), "Fabricated community recon must not appear");
  const communityItems = dossier.evidenceFeed.filter((e) => /^EV-04C/.test(e.id));
  const noReconItem = dossier.evidenceFeed.find((e) => e.id.startsWith("EV-04") && !/^EV-04C/.test(e.id));
  if (communityItems.length === 0) {
    assert.ok(noReconItem, "With no community evidence, the EV-04 absence record must exist");
    assert.equal(noReconItem.tier, "UNKNOWN", "Without external evidence, EV-04 must be UNKNOWN, not EXTERNAL_EVIDENCE");
    assert.ok(noReconItem.claim.includes("No live external evidence"), "EV-04 must state the absence honestly");
  } else {
    for (const item of communityItems) {
      assert.equal(item.tier, "EXTERNAL_EVIDENCE", "Community items must be labeled EXTERNAL_EVIDENCE");
      assert.ok(item.provenance.startsWith("http"), "Community evidence must carry a real source URL");
    }
  }
  assert.ok(Array.isArray(dossier.externalEvidenceSources), "externalEvidenceSources must be present");
  for (const [, op] of Object.entries(dossier.roleAssessments)) {
    const t = op.telemetryMetadata || {};
    assert.equal(typeof t.latencyMs, "number", "Agent latency must be measured, not random");
    assert.ok(t.latencyMs >= 0 && t.latencyMs < 120000, "Agent latency must be plausible");
    assert.ok(t.modelId, "Every agent opinion must pin the model/backend that produced it");
    assert.equal(t.modelId, "deterministic-heuristics", "Heuristic-mode opinions must carry the deterministic-heuristics model id");
  }
  // Debate trail must cite the red team's actual fatal flaw, not a fixed narrative.
  const rtClash = dossier.debateTrail.find((c) => c.challenger === "redteam");
  assert.ok(rtClash, "Red team must appear as challenger");
  const rtFlaw = dossier.roleAssessments.redteam.fatalFlaws[0] || "";
  assert.ok(
    !rtFlaw || rtClash.challengePoint.includes(rtFlaw.split(" ").slice(0, 4).join(" ")),
    "Round-1 challenge must cite the red team's actual fatal flaw"
  );

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

  // Honest swarm-agreement signal (dissent-as-signal, replaces cosmetic confidence)
  assert.ok(dossier.swarmDissent, "swarmDissent must be present");
  const sd = dossier.swarmDissent;
  const agentScores = ["analyst", "customer", "architect", "investor", "redteam", "expert"]
    .map((r) => dossier.roleAssessments[r].score);
  assert.equal(sd.scoreSpread, Math.max(...agentScores) - Math.min(...agentScores), "scoreSpread must equal real agent spread");
  assert.equal(sd.killGradeAgents, agentScores.filter((s) => s < 40).length, "killGradeAgents must count real kill-grade scores");
  assert.equal(sd.avgAgentScore, Math.round(agentScores.reduce((a, b) => a + b, 0) / agentScores.length), "avgAgentScore must be the real mean");
  assert.equal(typeof sd.verdictContested, "boolean");
  assert.equal(sd.verdictContested, sd.killGradeAgents >= 2 && dossier.killScore >= 50, "verdictContested must follow its definition");
  assert.ok(dossier.confidenceScore >= 25 && dossier.confidenceScore <= 92, "Agreement score must stay in the honest band");

  // Phase 2: crossfire round 2 with tool traces
  if (dossier.debateRoundsExecuted === 2) {
    const roundTwo = dossier.debateTrail.find((d) => d.round === 2);
    assert.ok(roundTwo, "Round 2 crossfire entry must exist when escalation triggers");
    assert.ok(Array.isArray(dossier.crossfireToolTraces) && dossier.crossfireToolTraces.length > 0, "Crossfire must record tool execution traces");
    const crossfire = dossier.contradictions.find((c) => c.id === "C-CROSSFIRE-02");
    assert.ok(crossfire && Array.isArray(crossfire.debateHistory) && crossfire.debateHistory.length > 0, "Crossfire contradiction must carry the full debate history");
  }
});

test("Thin-wrapper false positive prevention: legitimate format products with enterprise defensibility are not killed", async () => {
  const orchestrator = new IdeaSwarmOrchestrator();
  const legitimateIdea = {
    title: "ScribeEHR: Browser Extension Clinical Assistant",
    summary: "A Chrome extension and desktop assistant that automates EHR clinical documentation with bi-directional Epic Systems and Cerner integration, HIPAA compliance, and proprietary medical fine-tuned models.",
    targetAudience: "Enterprise hospital health systems and outpatient clinics",
    monetization: "$250/mo per licensed clinician"
  };

  const dossier = await orchestrator.evaluateIdea(legitimateIdea, { useLiveLLM: false });

  // Must NOT trigger thin wrapper hard kill ceilings
  assert.notEqual(dossier.overallVerdict, "KILL", "Legitimate enterprise extension must not be killed as a thin wrapper");
  assert.ok(dossier.killScore >= 60, `Score must remain viable (got ${dossier.killScore}, expected >= 60)`);
  assert.notEqual(dossier.roleAssessments.investor.verdict, "STRONG_KILL", "Investor must not issue STRONG_KILL on defensible enterprise workflow");
  assert.ok(dossier.roleAssessments.investor.score > 35, `Investor score must exceed wrapper ceiling (got ${dossier.roleAssessments.investor.score})`);
  assert.notEqual(dossier.roleAssessments.redteam.verdict, "STRONG_KILL", "Red Team must not issue STRONG_KILL based solely on format");
  assert.ok(dossier.roleAssessments.redteam.score > 25, `Red Team score must exceed wrapper ceiling (got ${dossier.roleAssessments.redteam.score})`);
});

test("Economic degraded-state propagation: unavailable simulation does not collapse economics to zero", async () => {
  const orchestrator = new IdeaSwarmOrchestrator();
  const idea = {
    title: "Enterprise Fleet Telematics Optimizer",
    summary: "Hardware sensor telemetry platform optimizing commercial trucking routes and fuel compliance.",
    targetAudience: "Logistics fleets",
    monetization: "$500/mo per fleet"
  };

  // We can simulate an environment where python sandbox execution fails / is degraded
  const degradedSim = {
    runtime: "unavailable",
    exitCode: 1,
    stdout: "",
    stderr: "Subprocess timeout: python3 runtime unavailable",
    degraded: true,
    status: "unavailable",
    metrics: {
      cacEstimateUsd: 1200,
      ltvEstimateUsd: 0,
      ltvCacRatio: 0,
      estimatedPaybackMonths: 0,
      monthlyInfraCostUsd: 0,
      tamEstimateUsd: "UNKNOWN — simulation unavailable"
    }
  };

  // Evaluate heuristic opinion directly with degraded sandbox to verify Rule: unavailable != zero
  const domain = classifyIdeaDomain(idea);
  const invariants = {
    isPromptInjection: false,
    isImpossiblePhysics: false,
    isNoMonetization: false,
    hasFormatRisk: false,
    isThinWrapper: false
  };

  const investorOpinion = orchestrator["generateHeuristicOpinion"](
    "investor",
    idea,
    domain,
    { rawResults: [], dataSource: "none" },
    degradedSim,
    500,
    1200,
    invariants
  );

  assert.notEqual(investorOpinion.verdict, "STRONG_KILL", "Investor must not issue STRONG_KILL for unavailable economics");
  assert.equal(investorOpinion.verdict, "VIABLE_WITH_RISK", "Investor must issue VIABLE_WITH_RISK for unverified economics");
  assert.ok(investorOpinion.score >= 50, `Investor score must reflect viable fundamentals, not zero economics (got ${investorOpinion.score})`);
  assert.ok(
    investorOpinion.fatalFlaws.some((f) => f.includes("unverified") || f.includes("unavailable")),
    "Investor fatal flaw must note unverified simulation status, not inverted math"
  );
  assert.ok(
    !investorOpinion.fatalFlaws.some((f) => f.includes("Every user burns capital")),
    "Investor must NOT claim every user burns capital when simulation is unavailable"
  );

  const redteamOpinion = orchestrator["generateHeuristicOpinion"](
    "redteam",
    idea,
    domain,
    { rawResults: [], dataSource: "none" },
    degradedSim,
    500,
    1200,
    invariants
  );

  assert.notEqual(redteamOpinion.verdict, "STRONG_KILL", "Red Team must not issue STRONG_KILL for unavailable economics");
  assert.ok(
    !redteamOpinion.fatalFlaws.some((f) => f.includes("Terminal unit economics insolvency")),
    "Red Team must NOT claim terminal insolvency when simulation is unavailable"
  );
});
