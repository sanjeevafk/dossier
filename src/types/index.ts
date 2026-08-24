export type SwarmRole =
  | "analyst"
  | "customer"
  | "architect"
  | "investor"
  | "redteam"
  | "expert"
  | "synthesizer";

export interface IdeaInput {
  title: string;
  summary: string;
  targetAudience: string;
  monetization: string;
  projectType?: "Startup" | "Hackathon" | "Product" | "Research" | "Other";
  techStack?: string;
  unclearAssumptions?: string[];
}

export type Verdict = "BUILD" | "REFINE" | "KILL" | "STRONG_KILL" | "LEAN_KILL" | "PIVOT_REQUIRED" | "VIABLE_WITH_RISK" | "STRONG_PURSUE";
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

export interface EvidenceItem {
  id: string;
  claim: string;
  source: string;
  indicator: "SUPPORTING" | "CONTRADICTING" | "NEUTRAL";
  confidence: string; // e.g. "84%"
}

export interface DebateChallenge {
  challenger: SwarmRole;
  target: SwarmRole;
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
  actionType: "COLD_OUTREACH_EMAIL" | "SMOKE_TEST_LANDING_PAGE" | "COMMUNITY_POST" | "SURVEY_DISTRIBUTION";
  summary: string;
  payload: Record<string, any>;
  requiresApproval: true;
  status: "PENDING_HUMAN_APPROVAL" | "APPROVED" | "REJECTED";
}

export interface IdeaDossier {
  id: string;
  dossierCode: string; // e.g. "TF-007"
  timestamp: string;
  idea: IdeaInput;
  killScore: number; // 0 to 100
  confidenceScore: number; // e.g. 78%
  overallVerdict: "BUILD" | "REFINE" | "KILL";
  riskLevel: RiskLevel;
  executiveSummary: string;
  roleAssessments: Record<SwarmRole, AgentOpinion>;
  keyAssumptions: KeyAssumption[];
  contradictions: Contradiction[];
  evidenceFeed: EvidenceItem[];
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
  simulation: SimulationResult;
  validationRoadmap: {
    day1to2: string[];
    day3to5: string[];
    day6to7: string[];
  };
  approvalGates: ApprovalAction[];
}
