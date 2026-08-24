export type SwarmRole =
  | "skeptic"
  | "investor"
  | "architect"
  | "analyst"
  | "customer"
  | "synthesizer";

export interface IdeaInput {
  title: string;
  summary: string;
  targetAudience: string;
  monetization: string;
  techStack?: string;
  unclearAssumptions?: string[];
}

export type Verdict = "STRONG_KILL" | "LEAN_KILL" | "PIVOT_REQUIRED" | "VIABLE_WITH_RISK" | "STRONG_PURSUE";

export interface AgentOpinion {
  role: SwarmRole;
  roleTitle: string;
  verdict: Verdict;
  score: number; // 0 (Fatal) - 100 (Unstoppable)
  fatalFlaws: string[];
  keyAssumptions: string[];
  competitiveRisks: string[];
  mustTestBeforeBuilding: string[];
  rationale: string;
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
  timestamp: string;
  idea: IdeaInput;
  killScore: number; // 0 (Dead on arrival) to 100 (Exceptional resilience)
  overallVerdict: Verdict;
  executiveSummary: string;
  roleAssessments: Record<SwarmRole, AgentOpinion>;
  debateTrail: DebateChallenge[];
  simulation: SimulationResult;
  validationRoadmap: {
    day1to2: string[];
    day3to5: string[];
    day6to7: string[];
  };
  approvalGates: ApprovalAction[];
}
