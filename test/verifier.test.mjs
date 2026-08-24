import test from "node:test";
import assert from "node:assert/strict";
import { StanfordRobustVerifier } from "../dist/core/verifier.js";
import { classifyIdeaDomain } from "../dist/core/classifier.js";

test("Stanford CS329A Robust Verifier audits subagents and applies test-time self-correction", () => {
  const verifier = new StanfordRobustVerifier();
  const idea = {
    title: "AI Clinical Triage Assistant",
    summary: "Clinical triage app for rural clinics with WHO IMCI rules.",
    targetAudience: "Rural clinicians and patients",
    monetization: "District Grant"
  };

  const domain = classifyIdeaDomain(idea);

  const mockOpinions = {
    analyst: {
      role: "analyst",
      roleNumber: "01",
      roleTitle: "HEALTH SYSTEM ANALYST",
      verdict: "STRONG_PURSUE",
      score: 95, // Inflated unearned score
      status: "COMPLETE",
      fatalFlaws: [],
      keyAssumptions: ["Universal adoption"],
      competitiveRisks: [],
      mustTestBeforeBuilding: [],
      rationale: "Great freemium product for doctors." // Generic prior violation
    },
    customer: {
      role: "customer",
      roleNumber: "02",
      roleTitle: "CLINICIAN ADVOCATE",
      verdict: "VIABLE_WITH_RISK",
      score: 70,
      status: "COMPLETE",
      fatalFlaws: ["Habit inertia"],
      keyAssumptions: [],
      competitiveRisks: [],
      mustTestBeforeBuilding: [],
      rationale: "Clinicians are busy."
    },
    architect: {
      role: "architect",
      roleNumber: "03",
      roleTitle: "CLINICAL ARCHITECT",
      verdict: "STRONG_PURSUE",
      score: 85,
      status: "COMPLETE",
      fatalFlaws: [],
      keyAssumptions: [],
      competitiveRisks: [],
      mustTestBeforeBuilding: [],
      rationale: "Deterministic offline rules."
    },
    investor: {
      role: "investor",
      roleNumber: "04",
      roleTitle: "PUBLIC HEALTH ECONOMIST",
      verdict: "STRONG_PURSUE",
      score: 92, // Mathematical mismatch with LTV/CAC < 3.0
      status: "COMPLETE",
      fatalFlaws: [],
      keyAssumptions: [],
      competitiveRisks: [],
      mustTestBeforeBuilding: [],
      rationale: "High revenue projections."
    },
    redteam: {
      role: "redteam",
      roleNumber: "05",
      roleTitle: "RED TEAM CLINICAL ADVERSARY",
      verdict: "LEAN_KILL",
      score: 40,
      status: "COMPLETE",
      fatalFlaws: ["Field pilot abandonment"],
      keyAssumptions: [],
      competitiveRisks: [],
      mustTestBeforeBuilding: [],
      rationale: "High churn hazard."
    },
    expert: {
      role: "expert",
      roleNumber: "06",
      roleTitle: "WHO REGULATORY SPECIALIST",
      verdict: "STRONG_PURSUE",
      score: 80,
      status: "COMPLETE",
      fatalFlaws: [],
      keyAssumptions: [],
      competitiveRisks: [],
      mustTestBeforeBuilding: [],
      rationale: "Complies with WHO protocols."
    },
    synthesizer: {
      role: "synthesizer",
      roleNumber: "00",
      roleTitle: "EXECUTIVE SYNTHESIZER",
      verdict: "REFINE",
      score: 75,
      status: "COMPLETE",
      fatalFlaws: [],
      keyAssumptions: [],
      competitiveRisks: [],
      mustTestBeforeBuilding: [],
      rationale: "Swarm synthesis."
    }
  };

  const mockSandbox = {
    cacEstimateUsd: 500,
    ltvEstimateUsd: 1000,
    ltvCacRatio: 2.0, // Low LTV/CAC
    estimatedPaybackMonths: 6.0,
    monthlyInfraCostUsd: 200,
    tamEstimateUsd: "$10M",
    sandboxExecutionProof: { runtime: "python3", exitCode: 0, stdout: "" }
  };

  const { verifiedOpinions, audit } = verifier.verifySwarmOpinions(
    idea,
    domain,
    mockOpinions,
    mockSandbox,
    []
  );

  assert.equal(audit.verifierProtocol, "STANFORD_CS329A_ROBUST_VERIFIER");
  assert.ok(audit.testTimeSelfCorrections > 0, "Must apply self-corrections to ungrounded scores");
  assert.ok(audit.hallucinationsBlocked > 0, "Must block mathematical and prior hallucinations");
  assert.ok(verifiedOpinions.investor.score <= 70, "Investor score must be corrected downward due to 2.0x LTV/CAC");
  assert.ok(verifiedOpinions.analyst.score < 90, "Inflated 95 score must be capped under anti-sycophancy invariant");
});
