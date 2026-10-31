import {
  IdeaInput,
  IdeaDossier,
  DomainClassification,
  AgentOpinion,
  KeyAssumption,
  Contradiction,
  CheapestValidationExperiment,
  ValidationPriorityItem,
  SwarmRole,
  SwarmEvent,
  EvidenceItem,
  VerificationAudit,
  ClaimNode,
  DebateChallenge,
  Contradiction as ContradictionEntry,
  SandboxStressStats,
  DecisionModelOutput
} from "../../types/index.js";
import { type AdversarialInvariants } from "./invariants.js";
import { type DimensionalScoringResult } from "./dimensionalScoring.js";
import { getBaseRate } from "../baseRates.js";
import { buildOutsideViewPanel } from "../outside-view.js";
import { buildMutationProposals } from "../mutator.js";
import { forecastLedger } from "../../services/ledger.js";
import { dossierStorage } from "../../services/storage.js";
import { buildExternalEvidenceSources } from "./evidence.js";
import { VOI_EXPERIMENT_MAP } from "./schemas.js";
import { getLLMStatus } from "../../services/llm.js";
import { SandboxExecutionResult } from "../../tools/sandbox.js";

export interface AssembleDossierParams {
  idea: IdeaInput;
  domain: DomainClassification;
  evaluationMode: "LIVE_LLM" | "HEURISTIC_ENGINE";
  pricing: number;
  cac: number;
  churn: number;
  invariants: AdversarialInvariants;
  verifiedOpinions: Record<SwarmRole, AgentOpinion>;
  scoringResult: DimensionalScoringResult;
  evidenceFeed: EvidenceItem[];
  strongestEvidence?: EvidenceItem;
  audit: VerificationAudit;
  claimDag: ClaimNode[];
  debateTrail: DebateChallenge[];
  convergenceRounds: number;
  crossfireToolTraces: string[];
  crossfireContradiction: ContradictionEntry | null;
  marketResearch: any;
  unifiedMarkets: any;
  openAlexSignals: any;
  edgarSignals: any;
  hfSignals: any;
  clinicalSignals: any;
  floviaSignals: any;
  newsSignals: any;
  reachSignals: any;
  itchMatches: any[];
  graveyardMatches: any[];
  sandboxSim: SandboxExecutionResult;
  stressMetrics: SandboxStressStats;
  isEconomicsAvailable: boolean;
  decisionEvaluation?: DecisionModelOutput;
  synthesisStart: number;
  emit: (event: SwarmEvent) => void;
}

/**
 * Assemble the comprehensive IdeaDossier, execute mutation pivots if collapsed,
 * register dated falsifiable forecasts in the ledger, and persist to storage.
 */
export async function assembleDossier(params: AssembleDossierParams): Promise<IdeaDossier> {
  const {
    idea,
    domain,
    evaluationMode,
    pricing,
    cac,
    churn,
    verifiedOpinions,
    scoringResult,
    evidenceFeed,
    strongestEvidence,
    audit,
    claimDag,
    debateTrail,
    convergenceRounds,
    crossfireToolTraces,
    crossfireContradiction,
    marketResearch,
    unifiedMarkets,
    openAlexSignals,
    edgarSignals,
    hfSignals,
    clinicalSignals,
    floviaSignals,
    newsSignals,
    reachSignals,
    itchMatches,
    graveyardMatches,
    sandboxSim,
    stressMetrics,
    isEconomicsAvailable,
    decisionEvaluation,
    synthesisStart,
    emit
  } = params;

  const {
    technicalFeasibility,
    demandAndAdoption,
    defensibilityAndMoat,
    compositeScore,
    resilienceBreakdown,
    epistemicSummary,
    overallVerdict,
    riskLevel,
    confidenceScore,
    swarmDissent
  } = scoringResult;

  const fatalUntestedCount = epistemicSummary.hasUnvalidatedFatalAssumptions ? 1 : 0;
  const mc = sandboxSim.metrics.monteCarlo;

  const weakestAssumption = {
    id: "WA-01",
    statement: `Target decision makers in ${domain.primaryCustomer} possess discretionary budget authority to deploy this within ${domain.procurementCycle}.`,
    fatalRisk: verifiedOpinions.redteam.fatalFlaws[0] || "Unproven buyer willingness to pay",
    disproofThreshold: "If 10 qualified prospective buyers all decline to sign a non-binding Letter of Intent (LOI) or pre-order within 14 days."
  };

  const killConditions = [
    `If zero pilot agreements or signed LOIs are secured from ${domain.primaryCustomer} within 45 days.`,
    `If regulatory compliance with ${domain.regulatoryEnvironment} requires >6 months of bespoke certification before any live testing.`,
    `If verified customer acquisition cost (CAC) exceeds ${Math.round(pricing * 4)} under real field conditions.`
  ];

  const cheapestValidationExperiment: CheapestValidationExperiment = {
    title: `Pre-Build Commitment Test for ${domain.archetypeLabel}`,
    description: `Conduct 10 structured 20-minute adversarial interviews with target operators in ${domain.primaryCustomer}. Present a 1-page solution spec and request a signed, non-binding Letter of Intent (LOI) or pilot test authorization.`,
    estimatedCostUsd: 0,
    timeToExecuteDays: 4,
    successMetric: ">= 3 signed pilot LOIs or concrete budget allocations secured.",
    failureKillSignal: "<= 1 LOI signed after 10 qualified interviews indicates polite interest without purchasing intent — KILL or PIVOT."
  };

  const keyAssumptions: KeyAssumption[] = [
    {
      id: "A01",
      statement: `Target buyers in ${domain.primaryCustomer} experience intense enough urgency to overcome habit inertia.`,
      evidenceStatus: "UNVERIFIED",
      riskLevel: "HIGH",
      disproofCondition: "Buyers decline free 14-day trial after viewing product workflow."
    },
    {
      id: "A02",
      statement: `Solution complies with mandatory ${domain.regulatoryEnvironment} standards without architectural re-write.`,
      evidenceStatus: "VERIFIED",
      riskLevel: "LOW",
      disproofCondition: "Regulatory audit flags critical data governance or safety violation."
    },
    {
      id: "A03",
      statement: `Customer Acquisition Cost (CAC) will remain under $${Math.round(pricing * 3)} through direct field channels.`,
      evidenceStatus: "HIGH_RISK",
      riskLevel: "HIGH",
      disproofCondition: "Outreach response rate falls below 3% across 50 qualified target contacts."
    },
    {
      id: "A04",
      statement: "Dossier sandboxed execution guarantees safe isolation for all external actions.",
      evidenceStatus: "VERIFIED",
      riskLevel: "LOW",
      disproofCondition: "Sandbox execution returns non-zero error or uncontained process escape."
    }
  ];

  const roleLabels = domain.specialistRoleLabels;

  const contradictions: Contradiction[] = [
    {
      id: "C01",
      agentA: roleLabels.redteam.title,
      claimA: `Procurement cycles in ${domain.procurementCycle} will exhaust early cash runway before first revenue.`,
      agentB: roleLabels.investor.title,
      claimB: `High LTV/CAC ratio (${sandboxSim.metrics.ltvCacRatio.toFixed(2)}x) provides strong long-term venture returns.`,
      resolutionStatus: "UNRESOLVED CONFLICT // REQUIRES VALIDATION",
      guidance: `Pre-secure upfront milestone mobilization advances or grant co-funding to bridge initial pilot deployment.`
    },
    {
      id: "C02",
      agentA: roleLabels.customer.title,
      claimA: `Customer Advocate at ${verifiedOpinions.customer.score}/100 flags: "${verifiedOpinions.customer.fatalFlaws[0] || "adoption friction unresolved"}"`,
      agentB: roleLabels.architect.title,
      claimB: `Architect at ${verifiedOpinions.architect.score}/100 holds: "${verifiedOpinions.architect.keyAssumptions[0] || verifiedOpinions.architect.rationale}"`,
      resolutionStatus:
        verifiedOpinions.architect.score - verifiedOpinions.customer.score > 15
          ? "UNRESOLVED CONFLICT // REQUIRES VALIDATION"
          : "RESOLVED // ASSUMPTION MITIGATED",
      guidance:
        verifiedOpinions.architect.mustTestBeforeBuilding[0] ||
        `Validate the ${domain.primaryCustomer} workflow-fit assumption with direct field observation before build.`
    },
    ...(crossfireContradiction ? [crossfireContradiction] : [])
  ];

  const executiveSynthesizerOpinion: AgentOpinion = {
    role: "synthesizer",
    roleNumber: "00",
    roleTitle: "EXECUTIVE SYNTHESIZER",
    verdict: overallVerdict,
    score: compositeScore,
    status: "COMPLETE",
    fatalFlaws: [weakestAssumption.fatalRisk],
    keyAssumptions: [weakestAssumption.statement],
    competitiveRisks: [`Entrenched incumbents with existing ${domain.regulatoryEnvironment} certifications.`],
    mustTestBeforeBuilding: [cheapestValidationExperiment.title],
    rationale: `Swarm consensus for [${domain.archetypeLabel}]: Concept has strong technical grounding (${technicalFeasibility}/100) and regulatory fit (${defensibilityAndMoat}/100), but must resolve commercial procurement and habit inertia (${demandAndAdoption}/100) before committing full MVP engineering.`,
    telemetryMetadata: {
      modelId: evaluationMode === "LIVE_LLM" ? (getLLMStatus().activeModel || "live-llm") : "deterministic-heuristics",
      latencyMs: Date.now() - synthesisStart,
      claimsVerified: evidenceFeed.length,
      threatSeverity: riskLevel
    }
  };

  const validationPriority: ValidationPriorityItem[] | undefined = sandboxSim.metrics.voi
    ? sandboxSim.metrics.voi.partialEvpi
        .filter((e) => e.evpiPerCustomer > 0)
        .map((e) => ({
          param: e.param,
          evpiPerCustomer: e.evpiPerCustomer,
          shareOfEvpi: e.shareOfEvpi,
          experimentTitle: VOI_EXPERIMENT_MAP[e.param]?.title ?? `Resolve ${e.param} uncertainty`,
          experimentDescription:
            VOI_EXPERIMENT_MAP[e.param]?.description ??
            `Run a targeted experiment to resolve ${e.param} before committing further capital.`
        }))
    : undefined;

  const externalEvidenceSources = buildExternalEvidenceSources({
    marketResearch,
    unifiedMarkets,
    openAlexSignals,
    edgarSignals,
    hfSignals,
    clinicalSignals,
    floviaSignals,
    newsSignals,
    reachSignals,
    itchMatches,
    graveyardMatches
  });

  const outsideView = buildOutsideViewPanel(idea, compositeScore);

  if (decisionEvaluation) {
    decisionEvaluation.economicsAvailability = isEconomicsAvailable ? "available" : "unavailable";
  }

  const dossier: IdeaDossier = {
    id: `DOSSIER-${Date.now().toString().slice(-6)}`,
    dossierCode: `DOS-${domain.archetype.toUpperCase().slice(0, 3)}`,
    timestamp: new Date().toISOString(),
    evaluationMode,
    pSuccess: Math.round(compositeScore) / 100,
    baseRate: getBaseRate(domain.archetype).baseRate,
    fatalsResolved: fatalUntestedCount === 0,
    costUsd: evaluationMode === "LIVE_LLM" ? 0.3 : 0.0,
    externalEvidenceSources,
    identifiedCompetitors: marketResearch.identifiedCompetitors,
    idea,
    domainClassification: domain,
    epistemicSummary,
    verificationAudit: audit,
    killScore: compositeScore,
    confidenceScore,
    swarmDissent,
    outsideView,
    decisionEvaluation,
    overallVerdict,
    riskLevel,
    executiveSummary: executiveSynthesizerOpinion.rationale,
    roleAssessments: {
      analyst: verifiedOpinions.analyst,
      customer: verifiedOpinions.customer,
      architect: verifiedOpinions.architect,
      investor: verifiedOpinions.investor,
      redteam: verifiedOpinions.redteam,
      expert: verifiedOpinions.expert,
      synthesizer: executiveSynthesizerOpinion
    },
    keyAssumptions,
    contradictions,
    evidenceFeed,
    strongestEvidence: strongestEvidence || evidenceFeed[0],
    weakestAssumption,
    killConditions,
    cheapestValidationExperiment,
    resilienceBreakdown,
    predictionMarkets: {
      source: (unifiedMarkets.activeSources && unifiedMarkets.activeSources.length > 0)
        ? `Unified Prediction Oracle (${unifiedMarkets.activeSources.map((s: string) => s.toUpperCase()).join("/")})`
        : "Unified Prediction Oracle",
      macroSentiment: unifiedMarkets.macroSentiment,
      keyTakeaway: unifiedMarkets.keyTakeaway,
      marketsFound: (unifiedMarkets.signals ?? []).map((s: any) => ({
        title: `[${s.source.toUpperCase()}] ${s.title}`,
        probabilityYesPercent: s.probabilityYesPercent,
        volumeUsd: s.volumeUsd,
        marketUrl: s.url
      }))
    },
    debateTrail,
    convergenceRounds,
    debateRoundsExecuted: convergenceRounds,
    claimDag,
    crossfireToolTraces,
    validationPriority,
    simulation: {
      cacEstimateUsd: sandboxSim.metrics.cacEstimateUsd,
      ltvEstimateUsd: sandboxSim.metrics.ltvEstimateUsd,
      ltvCacRatio: sandboxSim.metrics.ltvCacRatio,
      estimatedPaybackMonths: sandboxSim.metrics.estimatedPaybackMonths,
      monthlyInfraCostUsd: sandboxSim.metrics.monthlyInfraCostUsd,
      tamEstimateUsd: sandboxSim.metrics.tamEstimateUsd,
      monteCarlo: sandboxSim.metrics.monteCarlo,
      sobol: sandboxSim.metrics.sobol,
      voi: sandboxSim.metrics.voi,
      stressMetrics,
      sandboxExecutionProof: {
        runtime: sandboxSim.runtime,
        exitCode: sandboxSim.exitCode,
        stdout: sandboxSim.stdout
      },
      degraded: sandboxSim.degraded,
      status: sandboxSim.degraded ? "unavailable" : "available"
    },
    validationRoadmap: {
      day1to2: [
        `01 — Execute "${cheapestValidationExperiment.title}": Interview 5 prospective buyers in ${domain.primaryCustomer}.`,
        `02 — Refine value proposition to address Red Team fatal flaw: "${weakestAssumption.fatalRisk}".`
      ],
      day3to5: [
        `03 — Deploy targeted pilot LOI requests to design partners.`,
        `04 — Prototype isolated core single-job execution inside Dossier sandbox.`
      ],
      day6to7: [
        `05 — Re-run DOSSIER with live LOI response evidence.`,
        `06 — Final GO / NO-GO decision against defined kill conditions.`
      ]
    }
  };

  if (compositeScore < 55) {
    const mutationProposals = buildMutationProposals(idea, domain, {
      killScore: compositeScore,
      fatalFlaw: verifiedOpinions.redteam.fatalFlaws[0] || "Unmitigated fatal assumption",
      pricing,
      churn,
      cac,
      survival24Mo: mc?.survivalProbability24Mo,
      ltvCacRatio: sandboxSim.metrics.ltvCacRatio,
      graveyardPrecedent: graveyardMatches[0] ? {
        companyName: graveyardMatches[0].companyName,
        burnedCapitalUsd: graveyardMatches[0].burnedCapitalUsd,
        fatalFlaw: graveyardMatches[0].fatalFlaw,
        takeaway: graveyardMatches[0].takeaway
      } : undefined
    });
    dossier.mutationProposals = mutationProposals;
    emit({ type: "mutation_proposals", proposals: mutationProposals });
  }

  try {
    const forecasts = await forecastLedger.persistDossierForecasts(dossier);
    dossier.forecastIds = forecasts.map((f: { id: string }) => f.id);
  } catch {
    // non-blocking
  }

  try {
    await dossierStorage.saveDossier(dossier);
  } catch {
    // non-blocking storage save
  }

  emit({ type: "dossier_complete", dossier });

  return dossier;
}
