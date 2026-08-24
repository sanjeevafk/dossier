export type SwarmRole =
  | "analyst"
  | "customer"
  | "architect"
  | "investor"
  | "redteam"
  | "expert"
  | "synthesizer";

export type IdeaDomainArchetype =
  | "b2b_saas"
  | "b2g_govtech"
  | "healthcare_clinical"
  | "hardware_robotics"
  | "consumer_social"
  | "deeptech_research"
  | "web3_defi"
  | "general_startup";

export interface DomainClassification {
  archetype: IdeaDomainArchetype;
  archetypeLabel: string;
  primaryCustomer: string;
  procurementCycle: string;
  regulatoryEnvironment: string;
  unitEconomicsModel: string;
  specialistRoleLabels: {
    analyst: { number: string; title: string; mandate: string };
    customer: { number: string; title: string; mandate: string };
    architect: { number: string; title: string; mandate: string };
    investor: { number: string; title: string; mandate: string };
    redteam: { number: string; title: string; mandate: string };
    expert: { number: string; title: string; mandate: string };
  };
}

export interface IdeaInput {
  title: string;
  summary: string;
  targetAudience: string;
  monetization: string;
  projectType?: "Startup" | "Hackathon" | "Product" | "Research" | "Other";
  techStack?: string;
  unclearAssumptions?: string[];
}

export type Verdict = "BUILD" | "BUILD_IF_VALIDATED" | "REFINE" | "KILL" | "STRONG_KILL" | "LEAN_KILL" | "PIVOT_REQUIRED" | "VIABLE_WITH_RISK" | "STRONG_PURSUE";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface AgentOpinion {
  role: SwarmRole;
  roleNumber: string;
  roleTitle: string;
  verdict: Verdict;
  score: number; // 0 to 100
  status: "IDLE" | "INITIALIZING" | "RESEARCHING" | "DEBATING" | "VERIFYING" | "COMPLETE" | "BLOCKED";
  fatalFlaws: string[];
  keyAssumptions: string[];
  competitiveRisks: string[];
  mustTestBeforeBuilding: string[];
  rationale: string;
  telemetryMetadata?: {
    latencyMs?: number;
    claimsVerified?: number;
    threatSeverity?: string;
  };
}

export interface KeyAssumption {
  id: string; // e.g. "A01"
  statement: string;
  evidenceStatus: "VERIFIED" | "UNVERIFIED" | "HIGH_RISK" | "REJECTED";
  riskLevel: RiskLevel;
  disproofCondition: string;
}

export interface Contradiction {
  id: string;
  agentA: string;
  claimA: string;
  agentB: string;
  claimB: string;
  resolutionStatus: "UNRESOLVED CONFLICT // REQUIRES VALIDATION" | "RESOLVED // ASSUMPTION MITIGATED";
  guidance: string;
}

export type EpistemicState = 
  | "VERIFIED_FACT"        // Independently verified empirical ground truth (official regulations, confirmed competitor data)
  | "VERIFIED_COMPUTATION" // Deterministic computation executed in isolated environment (Python3 subprocess exit 0) — input assumptions remain separately labelled
  | "EXTERNAL_EVIDENCE"    // Sourced external data that has not been independently verified (Polymarket Gamma odds, community recon)
  | "MODELLED_ASSUMPTION"  // Explicit hypotheses & projections not yet tested with empirical field trials
  | "INFERENCE"            // Deductions drawn by an agent based on models or domain analogies
  | "UNKNOWN"              // Unquantified black-box risk or missing parameter
  | "CONTRADICTED";        // Disproved or conflicting claims with direct counter-evidence

export type EpistemicTier = EpistemicState; // Backward-compatible alias

export interface EvidenceItem {
  id: string;
  claim: string;
  tier: EpistemicState;
  claimType: EpistemicState; // Backwards compatible alias
  provenance: string; // e.g. "Polymarket Gamma API", "Agent Reach", "Python3 Sandbox", "Official DGCA Standard"
  indicator: "SUPPORTING" | "CONTRADICTING" | "NEUTRAL";
  confidencePercent: number; // 0 to 100
  falsificationCriteria?: string;
}

export interface ScoreFactor {
  impact: number; // e.g. +30 or -15
  description: string;
  groundingTier: EpistemicState;
  riskMitigationVerdict?: "MITIGATES_RISK" | "PARTIAL_MITIGATION" | "DOES_NOT_MITIGATE";
}

export interface DimensionScoreTrace {
  score: number;
  factors: ScoreFactor[];
  rationale: string;
}

export interface EpistemicTaxonomySummary {
  verifiedFactsCount: number;
  verifiedComputationsCount: number;
  externalEvidenceCount: number;
  modelledAssumptionsCount: number;
  inferencesCount: number;
  unknownsCount: number;
  contradictionsCount: number;
  hasUnvalidatedFatalAssumptions: boolean;
  hasUnresolvedUnknownsOrContradictions: boolean;
}

export type ValidationVerdict = "BUILD" | "BUILD_IF_VALIDATED" | "REFINE" | "KILL";

export interface DebateChallenge {
  challenger: SwarmRole;
  target: SwarmRole;
  round: number; // 1 or 2
  challengePoint: string;
  rebuttal?: string;
  status: "OPEN" | "REBUTTED" | "CONCEDED";
}

export interface SimulationResult {
  cacEstimateUsd: number;
  ltvEstimateUsd: number;
  ltvCacRatio: number;
  estimatedPaybackMonths: number;
  monthlyInfraCostUsd: number;
  tamEstimateUsd: string;
  sandboxExecutionProof: {
    runtime: string;
    exitCode: number;
    stdout: string;
  };
}

export interface ApprovalAction {
  id: string;
  actionType: "COLD_OUTREACH_EMAIL" | "SMOKE_TEST_LANDING_PAGE" | "COMMUNITY_POST" | "SURVEY_DISTRIBUTION" | "PILOT_LOI_DRAFT";
  summary: string;
  payload: Record<string, any>;
  requiresApproval: true;
  status: "PENDING_HUMAN_APPROVAL" | "APPROVED" | "REJECTED";
}

export interface ResilienceScoreBreakdown {
  technicalFeasibility: number; // 20%
  demandAndAdoption: number; // 25%
  economicsAndCapitalEfficiency: number; // 20%
  defensibilityAndMoat: number; // 15%
  adversarialResilience: number; // 20%
  compositeScore: number; // 0 to 100
  dimensionRationales: {
    technicalFeasibility: string;
    demandAndAdoption: string;
    economicsAndCapitalEfficiency: string;
    defensibilityAndMoat: string;
    adversarialResilience: string;
  };
  dimensionTraces?: {
    technicalFeasibility: DimensionScoreTrace;
    demandAndAdoption: DimensionScoreTrace;
    economicsAndCapitalEfficiency: DimensionScoreTrace;
    defensibilityAndMoat: DimensionScoreTrace;
    adversarialResilience: DimensionScoreTrace;
  };
}

export interface CheapestValidationExperiment {
  title: string;
  description: string;
  estimatedCostUsd: number;
  timeToExecuteDays: number;
  successMetric: string;
  failureKillSignal: string;
}

export interface VerificationAuditItem {
  id: string;
  claimOrOpinion: string;
  verdict: "VERIFIED_PASS" | "CORRECTED" | "REJECTED_UNGROUNDED";
  rationale: string;
  confidencePercent: number;
}

export interface VerificationAudit {
  verifierProtocol: "STANFORD_CS329A_ROBUST_VERIFIER";
  totalClaimsAudited: number;
  hallucinationsBlocked: number;
  testTimeSelfCorrections: number;
  verificationConfidencePercent: number;
  auditItems: VerificationAuditItem[];
}

export interface IdeaDossier {
  id: string;
  dossierCode: string; // e.g. "TF-007"
  timestamp: string;
  idea: IdeaInput;
  domainClassification: DomainClassification;
  epistemicSummary?: EpistemicTaxonomySummary;
  verificationAudit?: VerificationAudit;
  killScore: number; // 0 to 100 (composite resilience score)
  confidenceScore: number; // e.g. 78%
  overallVerdict: ValidationVerdict;
  riskLevel: RiskLevel;
  executiveSummary: string;
  roleAssessments: Record<SwarmRole, AgentOpinion>;
  keyAssumptions: KeyAssumption[];
  contradictions: Contradiction[];
  evidenceFeed: EvidenceItem[];
  strongestEvidence: EvidenceItem;
  weakestAssumption: {
    id: string;
    statement: string;
    fatalRisk: string;
    disproofThreshold: string;
  };
  killConditions: string[];
  cheapestValidationExperiment: CheapestValidationExperiment;
  resilienceBreakdown: ResilienceScoreBreakdown;
  predictionMarkets?: {
    source: string;
    macroSentiment: string;
    keyTakeaway: string;
    marketsFound: Array<{
      title: string;
      probabilityYesPercent: number;
      volumeUsd: number;
      marketUrl: string;
    }>;
  };
  debateTrail: DebateChallenge[];
  convergenceRounds: number;
  debateRoundsExecuted: number;
  simulation: SimulationResult;
  validationRoadmap: {
    day1to2: string[];
    day3to5: string[];
    day6to7: string[];
  };
  approvalGates: ApprovalAction[];
}
