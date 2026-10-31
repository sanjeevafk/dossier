import test from "node:test";
import assert from "node:assert/strict";
import { EpistemicRobustVerifier, StanfordRobustVerifier } from "../dist/core/verifier.js";
import { classifyIdeaDomain } from "../dist/core/classifier.js";

test("Epistemic Robust Verifier (and StanfordRobustVerifier alias) audits subagents and applies test-time self-correction", () => {
  assert.equal(StanfordRobustVerifier, EpistemicRobustVerifier, "StanfordRobustVerifier must be an alias for EpistemicRobustVerifier");
  const verifier = new EpistemicRobustVerifier();
  const idea = {
    title: "AI Clinical Triage Assistant",
    summary: "Clinical triage app for rural clinics with WHO IMCI rules.",
    targetAudience: "Rural clinicians and patients",
    monetization: "District Grant"
  };

  const domain = classifyIdeaDomain(idea);

  const mockOpinions = {
    analyst: {
      role: "analyst", roleNumber: "01", roleTitle: "HEALTH SYSTEM ANALYST", verdict: "STRONG_PURSUE", score: 95,
      status: "COMPLETE", fatalFlaws: [], keyAssumptions: ["Universal adoption"], competitiveRisks: [], mustTestBeforeBuilding: [], rationale: "Great freemium product for doctors."
    },
    customer: {
      role: "customer", roleNumber: "02", roleTitle: "CLINICIAN ADVOCATE", verdict: "VIABLE_WITH_RISK", score: 70,
      status: "COMPLETE", fatalFlaws: ["Habit inertia"], keyAssumptions: [], competitiveRisks: [], mustTestBeforeBuilding: [], rationale: "Clinicians are busy."
    },
    architect: {
      role: "architect", roleNumber: "03", roleTitle: "CLINICAL ARCHITECT", verdict: "STRONG_PURSUE", score: 85,
      status: "COMPLETE", fatalFlaws: [], keyAssumptions: [], competitiveRisks: [], mustTestBeforeBuilding: [], rationale: "Deterministic offline rules."
    },
    investor: {
      role: "investor", roleNumber: "04", roleTitle: "PUBLIC HEALTH ECONOMIST", verdict: "STRONG_PURSUE", score: 92,
      status: "COMPLETE", fatalFlaws: [], keyAssumptions: [], competitiveRisks: [], mustTestBeforeBuilding: [], rationale: "High revenue projections."
    },
    redteam: {
      role: "redteam", roleNumber: "05", roleTitle: "RED TEAM CLINICAL ADVERSARY", verdict: "LEAN_KILL", score: 40,
      status: "COMPLETE", fatalFlaws: ["Field pilot abandonment"], keyAssumptions: [], competitiveRisks: [], mustTestBeforeBuilding: [], rationale: "High churn hazard."
    },
    expert: {
      role: "expert", roleNumber: "06", roleTitle: "WHO REGULATORY SPECIALIST", verdict: "STRONG_PURSUE", score: 80,
      status: "COMPLETE", fatalFlaws: [], keyAssumptions: [], competitiveRisks: [], mustTestBeforeBuilding: [], rationale: "Complies with WHO protocols."
    },
    synthesizer: {
      role: "synthesizer", roleNumber: "00", roleTitle: "EXECUTIVE SYNTHESIZER", verdict: "REFINE", score: 75,
      status: "COMPLETE", fatalFlaws: [], keyAssumptions: [], competitiveRisks: [], mustTestBeforeBuilding: [], rationale: "Swarm synthesis."
    }
  };

  const mockSandbox = {
    cacEstimateUsd: 500,
    ltvEstimateUsd: 1000,
    ltvCacRatio: 2.0,
    estimatedPaybackMonths: 6.0,
    monthlyInfraCostUsd: 200,
    tamEstimateUsd: "$10M",
    sandboxExecutionProof: { runtime: "python3", exitCode: 0, stdout: "" }
  };

  const { verifiedOpinions, audit } = verifier.verifySwarmOpinions(idea, domain, mockOpinions, mockSandbox, []);

  assert.equal(audit.verifierProtocol, "EPISTEMIC_ROBUST_VERIFIER");
  assert.ok(audit.testTimeSelfCorrections > 0, "Must apply self-corrections to ungrounded scores");
  assert.ok(audit.hallucinationsBlocked > 0, "Must block mathematical and prior hallucinations");
  assert.ok(verifiedOpinions.investor.score <= 70, "Investor score must be corrected downward due to 2.0x LTV/CAC");
  assert.ok(verifiedOpinions.analyst.score < 90, "Inflated 95 score must be capped under anti-sycophancy invariant");
  assert.ok(audit.auditItems.some((item) => item.id === "VERIFY-REGULATORY-01" && item.verdict === "CORRECTED"), "Regulatory claim without primary evidence must remain unverified");
});

test("Epistemic Robust Verifier: evidence without primary-source URL demotes to UNKNOWN", () => {
  const verifier = new EpistemicRobustVerifier();
  const idea = {
    title: "AI Compliance Auditor",
    summary: "Automated audit tool for enterprise security",
    targetAudience: "Security teams",
    monetization: "$500/mo"
  };
  const domain = classifyIdeaDomain(idea);
  const mockOpinions = {
    analyst: { role: "analyst", roleNumber: "01", roleTitle: "ANALYST", verdict: "VIABLE_WITH_RISK", score: 70, status: "COMPLETE", fatalFlaws: [], keyAssumptions: [], competitiveRisks: [], mustTestBeforeBuilding: [], rationale: "Feasible" },
    customer: { role: "customer", roleNumber: "02", roleTitle: "CUSTOMER", verdict: "VIABLE_WITH_RISK", score: 70, status: "COMPLETE", fatalFlaws: [], keyAssumptions: [], competitiveRisks: [], mustTestBeforeBuilding: [], rationale: "Feasible" },
    architect: { role: "architect", roleNumber: "03", roleTitle: "ARCHITECT", verdict: "VIABLE_WITH_RISK", score: 70, status: "COMPLETE", fatalFlaws: [], keyAssumptions: [], competitiveRisks: [], mustTestBeforeBuilding: [], rationale: "Feasible" },
    investor: { role: "investor", roleNumber: "04", roleTitle: "INVESTOR", verdict: "VIABLE_WITH_RISK", score: 70, status: "COMPLETE", fatalFlaws: [], keyAssumptions: [], competitiveRisks: [], mustTestBeforeBuilding: [], rationale: "Feasible" },
    redteam: { role: "redteam", roleNumber: "05", roleTitle: "RED TEAM", verdict: "VIABLE_WITH_RISK", score: 70, status: "COMPLETE", fatalFlaws: ["Market adoption inertia"], keyAssumptions: [], competitiveRisks: [], mustTestBeforeBuilding: [], rationale: "Feasible" },
    expert: { role: "expert", roleNumber: "06", roleTitle: "EXPERT", verdict: "VIABLE_WITH_RISK", score: 70, status: "COMPLETE", fatalFlaws: [], keyAssumptions: [], competitiveRisks: [], mustTestBeforeBuilding: [], rationale: "Feasible" },
    synthesizer: { role: "synthesizer", roleNumber: "00", roleTitle: "SYNTHESIZER", verdict: "REFINE", score: 70, status: "COMPLETE", fatalFlaws: [], keyAssumptions: [], competitiveRisks: [], mustTestBeforeBuilding: [], rationale: "Feasible" }
  };
  const mockSandbox = {
    cacEstimateUsd: 500,
    ltvEstimateUsd: 2000,
    ltvCacRatio: 4.0,
    estimatedPaybackMonths: 3.0,
    monthlyInfraCostUsd: 100,
    tamEstimateUsd: "$1B",
    sandboxExecutionProof: { runtime: "python3", exitCode: 0, stdout: "" }
  };

  const evidenceFeed = [
    {
      id: "EV-UNSOURCED-FACT",
      claim: "SOC2 Type II requires annual third-party external penetration tests.",
      tier: "VERIFIED_FACT",
      claimType: "VERIFIED_FACT",
      provenance: "Internal Compliance Checklist", // No primary URL!
      indicator: "SUPPORTING",
      confidencePercent: 90
    },
    {
      id: "EV-SOURCED-FACT",
      claim: "HIPAA Security Rule 45 CFR Part 160 requires audit controls.",
      tier: "VERIFIED_FACT",
      claimType: "VERIFIED_FACT",
      provenance: "https://www.hhs.gov/hipaa/for-professionals/security/laws-regulations/index.html",
      indicator: "SUPPORTING",
      confidencePercent: 95
    },
    {
      id: "EV-UNSOURCED-EXT",
      claim: "Competitor MarketShare is 45% in enterprise compliance.",
      tier: "EXTERNAL_EVIDENCE",
      claimType: "EXTERNAL_EVIDENCE",
      provenance: "Industry rumor without link", // No primary URL!
      indicator: "NEUTRAL",
      confidencePercent: 60
    }
  ];

  const { audit } = verifier.verifySwarmOpinions(idea, domain, mockOpinions, mockSandbox, evidenceFeed);

  const unsourcedFact = evidenceFeed.find((e) => e.id === "EV-UNSOURCED-FACT");
  assert.equal(unsourcedFact.tier, "UNKNOWN", "Fact without primary-source URL must be demoted to UNKNOWN");

  const unsourcedExt = evidenceFeed.find((e) => e.id === "EV-UNSOURCED-EXT");
  assert.equal(unsourcedExt.tier, "UNKNOWN", "External evidence without URL must be demoted to UNKNOWN");

  const sourcedFact = evidenceFeed.find((e) => e.id === "EV-SOURCED-FACT");
  assert.equal(sourcedFact.tier, "VERIFIED_FACT", "Fact with valid primary URL must remain VERIFIED_FACT");

  assert.ok(audit.auditItems.some((i) => i.id === "VERIFY-SOURCE-EV-UNSOURCED-FACT" && i.verdict === "CORRECTED"));
  assert.ok(audit.auditItems.some((i) => i.id === "VERIFY-SOURCE-EV-UNSOURCED-EXT" && i.verdict === "CORRECTED"));
});
