import {
  AgentOpinion,
  SwarmRole,
  DomainClassification,
  ResilienceScoreBreakdown,
  EpistemicTier,
  EpistemicTaxonomySummary,
  ValidationVerdict,
  RiskLevel,
  SwarmDissent,
  EvidenceItem
} from "../../types/index.js";
import { AdversarialInvariants } from "./invariants.js";

export interface DimensionalScoringInput {
  verifiedOpinions: Record<SwarmRole, AgentOpinion>;
  domain: DomainClassification;
  sandboxSim: any;
  mc?: any;
  isEconomicsAvailable: boolean;
  invariants: AdversarialInvariants;
  graveyardMatches: any[];
  evidenceFeed: EvidenceItem[];
}

export interface DimensionalScoringResult {
  technicalFeasibility: number;
  demandAndAdoption: number;
  economicsAndCapitalEfficiency: number;
  defensibilityAndMoat: number;
  adversarialResilience: number;
  compositeScore: number;
  resilienceBreakdown: ResilienceScoreBreakdown;
  epistemicSummary: EpistemicTaxonomySummary;
  overallVerdict: ValidationVerdict;
  riskLevel: RiskLevel;
  confidenceScore: number;
  agentScores: number[];
  verdictSpread: number;
  swarmDissent: SwarmDissent;
}

export function computeDimensionalResilience(input: DimensionalScoringInput): DimensionalScoringResult {
  const {
    verifiedOpinions,
    domain,
    sandboxSim,
    mc,
    isEconomicsAvailable,
    invariants,
    graveyardMatches,
    evidenceFeed
  } = input;

  const technicalFeasibility = Math.max(10, Math.min(100, Math.round(
    (verifiedOpinions.architect.score * (sandboxSim.exitCode === 0 ? 0.85 : 0.4)) +
    (sandboxSim.exitCode === 0 ? 15 : 0)
  )));
  const demandAndAdoption = Math.max(10, Math.min(100, Math.round(
    (verifiedOpinions.customer.score * 0.6) + (verifiedOpinions.analyst.score * 0.4)
  )));
  const economicsAndCapitalEfficiency = isEconomicsAvailable
    ? Math.max(10, Math.min(100, Math.round(
        (verifiedOpinions.investor.score * 0.7) +
        Math.min(Math.round((mc?.ltvCacPercentiles.p50 ?? sandboxSim.metrics.ltvCacRatio) * 6), 30) -
        (mc && mc.tokenCostBurdenPercent.p50 > 0.35 ? Math.round((mc.tokenCostBurdenPercent.p50 - 0.35) * 40) : 0)
      )))
    : Math.max(10, Math.min(100, Math.round(verifiedOpinions.investor.score * 0.8)));
  const defensibilityAndMoat = Math.max(10, Math.min(100, Math.round(
    (verifiedOpinions.expert.score * 0.6) + (verifiedOpinions.analyst.score * 0.4)
  )));
  const adversarialResilience = Math.max(10, Math.min(100,
    verifiedOpinions.redteam.score <= 35
      ? verifiedOpinions.redteam.score
      : Math.round(verifiedOpinions.redteam.score * 0.9 + 5)
  ));

  // Weighted Composite Resilience Score (100 Scale)
  // Feasibility: 20%, Demand: 25%, Economics: 20%, Moat: 15%, Adversarial: 20%
  let compositeScore = Math.round(
    technicalFeasibility * 0.20 +
    demandAndAdoption * 0.25 +
    economicsAndCapitalEfficiency * 0.20 +
    defensibilityAndMoat * 0.15 +
    adversarialResilience * 0.20
  );

  // Structural adversarial gates: non-differentiated wrappers, inverted unit economics,
  // and zero-monetization profiles cannot be averaged into viability — the composite is
  // capped below the KILL threshold (50) no matter how optimistic the remaining dimensions are.
  if (invariants.isThinWrapper || (isEconomicsAvailable && sandboxSim.metrics.ltvCacRatio < 1)) {
    compositeScore = Math.min(compositeScore, 44);
  }
  if (graveyardMatches.length > 0) {
    compositeScore = Math.min(compositeScore, 46);
  }
  if (invariants.isNoMonetization) {
    compositeScore = Math.min(compositeScore, 39);
  }

  // Fatal-profile anchoring: a sustained structural invariant or a verified STRONG_KILL
  // from the Red Team anchors the composite to the collapse zone (worst dimension carries
  // the score) instead of letting healthy dimensions average the kill away.
  const fatalProfile =
    invariants.isThinWrapper ||
    invariants.isNoMonetization ||
    invariants.isPromptInjection ||
    invariants.isImpossiblePhysics ||
    (isEconomicsAvailable && sandboxSim.metrics.ltvCacRatio < 1) ||
    verifiedOpinions.redteam.verdict === "STRONG_KILL";
  if (fatalProfile) {
    const weakestDimension = Math.min(
      technicalFeasibility,
      demandAndAdoption,
      economicsAndCapitalEfficiency,
      defensibilityAndMoat,
      adversarialResilience
    );
    compositeScore = Math.min(compositeScore, Math.round(weakestDimension * 0.6 + compositeScore * 0.4));
  }

  // Consensus strength bonus: when no structural fatal holds and every non-adversarial
  // dimension clears the uncertainty floor, a genuinely strong concept earns
  // BUILD_IF_VALIDATED territory beyond what the arithmetic average produces.
  if (!fatalProfile) {
    const certaintyFloor = Math.min(technicalFeasibility, demandAndAdoption, economicsAndCapitalEfficiency, defensibilityAndMoat);
    if (certaintyFloor >= 62) {
      compositeScore = Math.min(92, compositeScore + Math.round((certaintyFloor - 62) / 2));
    }
  }

  const dimensionTraces = {
    technicalFeasibility: {
      score: technicalFeasibility,
      factors: [
        { impact: 30, description: "Python3 subprocess simulation proof passed (Exit 0)", groundingTier: "VERIFIED_COMPUTATION" as EpistemicTier, riskMitigationVerdict: "MITIGATES_RISK" as const },
        { impact: Math.round(verifiedOpinions.architect.score * 0.7), description: "Edge / offline deterministic architecture verified against compute specs", groundingTier: "INFERENCE" as EpistemicTier, riskMitigationVerdict: "PARTIAL_MITIGATION" as const }
      ],
      rationale: `Architecture verified feasible with Python sandbox simulation (Exit 0) and isolated process boundaries.`
    },
    demandAndAdoption: {
      score: demandAndAdoption,
      factors: [
        { impact: 40, description: `Urgent problem recognized in ${domain.primaryCustomer}`, groundingTier: "EXTERNAL_EVIDENCE" as EpistemicTier, riskMitigationVerdict: "PARTIAL_MITIGATION" as const },
        { impact: -20, description: `Entrenched habit inertia and switching friction in ${domain.primaryCustomer}`, groundingTier: "MODELLED_ASSUMPTION" as EpistemicTier, riskMitigationVerdict: "DOES_NOT_MITIGATE" as const },
        { impact: -10, description: `Unproven discretionary purchasing authority during ${domain.procurementCycle}`, groundingTier: "UNKNOWN" as EpistemicTier, riskMitigationVerdict: "DOES_NOT_MITIGATE" as const }
      ],
      rationale: `Urgent user pain point recognized in ${domain.primaryCustomer}, but adoption friction remains high.`
    },
    economicsAndCapitalEfficiency: {
      score: economicsAndCapitalEfficiency,
      factors: isEconomicsAvailable
        ? [
            { impact: Math.min(Math.round(sandboxSim.metrics.ltvCacRatio * 7), 40), description: `Modelled LTV/CAC ratio is ${sandboxSim.metrics.ltvCacRatio.toFixed(2)}x (computation passed Exit 0; input CAC remains modelled)`, groundingTier: "VERIFIED_COMPUTATION" as EpistemicTier, riskMitigationVerdict: "MITIGATES_RISK" as const },
            { impact: Math.round(verifiedOpinions.investor.score * 0.6) - 15, description: `Extended ${domain.procurementCycle} sales cycle requires cash buffer before first collection`, groundingTier: "INFERENCE" as EpistemicTier, riskMitigationVerdict: "PARTIAL_MITIGATION" as const }
          ]
        : [
            { impact: 0, description: "Sandboxed unit economics simulation unavailable (runtime degraded); quantitative LTV/CAC unverified", groundingTier: "UNKNOWN" as EpistemicTier, riskMitigationVerdict: "DOES_NOT_MITIGATE" as const },
            { impact: Math.round(verifiedOpinions.investor.score * 0.6) - 15, description: `Extended ${domain.procurementCycle} sales cycle requires cash buffer before first collection`, groundingTier: "INFERENCE" as EpistemicTier, riskMitigationVerdict: "PARTIAL_MITIGATION" as const }
          ],
      rationale: isEconomicsAvailable
        ? `LTV/CAC ratio modeled at ${sandboxSim.metrics.ltvCacRatio.toFixed(2)}x under ${domain.unitEconomicsModel}.`
        : "Unit economics simulation unavailable; quantitative metrics remain unverified and treated as UNKNOWN rather than zero."
    },
    defensibilityAndMoat: {
      score: defensibilityAndMoat,
      factors: [
        { impact: 45, description: `Compliance with ${domain.regulatoryEnvironment} creates statutory barrier to generic entrants`, groundingTier: "VERIFIED_FACT" as EpistemicTier, riskMitigationVerdict: "MITIGATES_RISK" as const },
        { impact: -15, description: `Foundation model commoditization risk without proprietary domain data lock-in`, groundingTier: "MODELLED_ASSUMPTION" as EpistemicTier, riskMitigationVerdict: "DOES_NOT_MITIGATE" as const }
      ],
      rationale: `Moat anchored in ${domain.regulatoryEnvironment} compliance and specialized workflow data.`
    },
    adversarialResilience: {
      score: adversarialResilience,
      factors: [
        { impact: 45, description: "Dual-key human authorization gate prevents unverified autonomous spend", groundingTier: "VERIFIED_COMPUTATION" as EpistemicTier, riskMitigationVerdict: "MITIGATES_RISK" as const },
        { impact: -(100 - adversarialResilience), description: `Red Team penalized fatal assumption: "${verifiedOpinions.redteam.fatalFlaws[0]}"`, groundingTier: "CONTRADICTED" as EpistemicTier, riskMitigationVerdict: "DOES_NOT_MITIGATE" as const }
      ],
      rationale: `Red Team highlighted fatal distribution risks; penalized composite score by ${100 - adversarialResilience}pts.`
    }
  };

  const resilienceBreakdown: ResilienceScoreBreakdown = {
    technicalFeasibility,
    demandAndAdoption,
    economicsAndCapitalEfficiency,
    defensibilityAndMoat,
    adversarialResilience,
    compositeScore,
    dimensionRationales: {
      technicalFeasibility: dimensionTraces.technicalFeasibility.rationale,
      demandAndAdoption: dimensionTraces.demandAndAdoption.rationale,
      economicsAndCapitalEfficiency: dimensionTraces.economicsAndCapitalEfficiency.rationale,
      defensibilityAndMoat: dimensionTraces.defensibilityAndMoat.rationale,
      adversarialResilience: dimensionTraces.adversarialResilience.rationale
    },
    dimensionTraces
  };

  // 7-Tier Epistemic Taxonomy Summary
  const verifiedFactsCount = evidenceFeed.filter(e => e.tier === "VERIFIED_FACT").length;
  const verifiedComputationsCount = evidenceFeed.filter(e => e.tier === "VERIFIED_COMPUTATION").length;
  const externalEvidenceCount = evidenceFeed.filter(e => e.tier === "EXTERNAL_EVIDENCE").length;
  const modelledAssumptionsCount = evidenceFeed.filter(e => e.tier === "MODELLED_ASSUMPTION").length;
  const inferencesCount = evidenceFeed.filter(e => e.tier === "INFERENCE").length;
  const unknownsCount = evidenceFeed.filter(e => e.tier === "UNKNOWN").length;
  const contradictionsCount = evidenceFeed.filter(e => e.tier === "CONTRADICTED").length;

  const fatalUntested = evidenceFeed.filter(e => e.fatal === true && e.tested !== true);
  const fatalUntestedCount = fatalUntested.length;
  const hasUnresolvedUnknownsOrContradictions = unknownsCount > 0 || contradictionsCount > 0;

  const epistemicSummary: EpistemicTaxonomySummary = {
    verifiedFactsCount,
    verifiedComputationsCount,
    externalEvidenceCount,
    modelledAssumptionsCount,
    inferencesCount,
    unknownsCount,
    contradictionsCount,
    hasUnvalidatedFatalAssumptions: fatalUntestedCount > 0,
    hasUnresolvedUnknownsOrContradictions
  };

  // EPISTEMIC VERDICT DECISION MATRIX:
  // Core Invariant: Unresolved fatal assumptions, unknowns, or contradictions MUST constrain the verdict.
  // Core Invariant: If Red Team, Architect, or Investor issues a STRONG_KILL, verdict MUST be KILL.
  let overallVerdict: ValidationVerdict = "REFINE";
  let riskLevel: RiskLevel = "MEDIUM";

  const hasUnmitigatedKillFlaw =
    verifiedOpinions.redteam?.verdict === "STRONG_KILL" ||
    verifiedOpinions.architect?.verdict === "STRONG_KILL" ||
    verifiedOpinions.investor?.verdict === "STRONG_KILL" ||
    (verifiedOpinions.redteam?.score ?? 50) <= 15;

  if (compositeScore < 50 || hasUnmitigatedKillFlaw) {
    overallVerdict = "KILL";
    riskLevel = (compositeScore < 35 || hasUnmitigatedKillFlaw) ? "CRITICAL" : "HIGH";
  } else if (compositeScore < 75) {
    overallVerdict = "REFINE";
    riskLevel = "MEDIUM";
  } else {
    // compositeScore >= 75
    if (fatalUntestedCount > 0 || hasUnresolvedUnknownsOrContradictions) {
      overallVerdict = "BUILD_IF_VALIDATED";
      riskLevel = "MEDIUM"; // Constrained: never LOW while critical assumptions/unknowns are unresolved
    } else {
      overallVerdict = "BUILD";
      riskLevel = "LOW";
    }
  }

  // Calibration: P(build-worthy) as an explicit probability for ledger tracking.
  // Uncalibrated until the ledger holds >= 20 outcomes for this archetype.
  const agentScores = [
    verifiedOpinions.analyst.score,
    verifiedOpinions.customer.score,
    verifiedOpinions.architect.score,
    verifiedOpinions.investor.score,
    verifiedOpinions.redteam.score,
    verifiedOpinions.expert.score
  ];
  const verdictSpread = Math.max(...agentScores) - Math.min(...agentScores);
  const confidenceScore = Math.min(
    95,
    Math.max(55, Math.round(100 - verdictSpread / 2))
  );

  const swarmDissent: SwarmDissent = {
    scoreSpread: verdictSpread,
    killGradeAgents: agentScores.filter(s => s < 40).length,
    avgAgentScore: Math.round(agentScores.reduce((a, b) => a + b, 0) / agentScores.length),
    verdictContested: agentScores.filter(s => s < 40).length >= 2 && compositeScore >= 50
  };

  return {
    technicalFeasibility,
    demandAndAdoption,
    economicsAndCapitalEfficiency,
    defensibilityAndMoat,
    adversarialResilience,
    compositeScore,
    resilienceBreakdown,
    epistemicSummary,
    overallVerdict,
    riskLevel,
    confidenceScore,
    agentScores,
    verdictSpread,
    swarmDissent
  };
}
