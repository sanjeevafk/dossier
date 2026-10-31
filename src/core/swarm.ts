/**
 * DOSSIER // ADVERSARIAL MULTI-AGENT SWARM
 *
 * Lean pipeline orchestrator coordinating 6 domain specialist subagents,
 * multi-channel market recon, sandboxed Monte Carlo simulation, and
 * epistemic robust verification.
 */

import dns from "node:dns";
try {
  dns.setDefaultResultOrder?.("ipv4first");
} catch {
  // Best-effort IPv4 preference
}

import {
  IdeaInput,
  IdeaDossier,
  SwarmRole,
  IdeaDomainArchetype,
  AgentOpinion,
  DebateChallenge,
  Contradiction as ContradictionEntry,
  SwarmEvent,
  SandboxStressStats
} from "../types/index.js";
import { classifyIdeaDomain } from "./classifier.js";
import { performMarketResearch } from "../tools/search.js";
import { queryUnifiedPredictionMarkets } from "../tools/markets/index.js";
import { queryNewsHeadlines } from "../tools/news.js";
import { queryAgentReachIntel } from "../tools/agentReach.js";
import {
  queryOpenAlex
} from "../tools/openalex.js";
import { queryEdgarFormD } from "../tools/edgar.js";
import { queryHuggingFace } from "../tools/huggingface.js";
import { queryClinicalEvidence } from "../tools/clinical.js";
import { queryMacroData } from "../tools/macro.js";
import { queryFloviaIntelligence } from "../tools/flovia.js";
import { runEconomicsSimulation } from "../tools/sandbox.js";
import { EpistemicRobustVerifier } from "./verifier.js";
import { runDecisionModel } from "../tools/decision-runner.js";
import { getLLMStatus } from "../services/llm.js";
import { buildRoundOneDebateTrail, DebateTrailInput } from "./debate.js";
import { shrinkTowardBaseRate } from "./baseRates.js";
import { detectJurisdiction } from "../tools/geo.js";
import { findMatchingItchProblems } from "../data/fixMyItchProblems.js";
import { findMatchingGraveyardPrecedents } from "../data/graveyardAntipatterns.js";
import { detectAdversarialInvariants, type AdversarialInvariants } from "./swarm/invariants.js";
import { generateHeuristicOpinion } from "./swarm/heuristics.js";
import { computeDimensionalResilience } from "./swarm/dimensionalScoring.js";
import { formatReconContext, buildEvidenceFeed } from "./swarm/evidence.js";
import { evaluateRoleWithLLM, runRoundTwoCrossfire } from "./swarm/agentRunner.js";
import { assembleDossier } from "./swarm/dossierBuilder.js";

export { detectAdversarialInvariants, type AdversarialInvariants, generateHeuristicOpinion };

export interface SwarmExecutionOptions {
  onProgress?: (stage: string, detail: string) => void;
  onEvent?: (event: SwarmEvent) => void;
  pricingMonthlyUsd?: number;
  expectedChurnMonthly?: number;
  estimatedCacUsd?: number;
  useLiveLLM?: boolean;
  /** BYOK recon keys (per-request headers); falls back to server env. */
  exaKey?: string;
  tavilyKey?: string;
}

export class IdeaSwarmOrchestrator {
  /**
   * Generates a deterministic domain-grounded heuristic opinion for a given role.
   */
  public generateHeuristicOpinion(
    role: SwarmRole,
    idea: IdeaInput,
    domain: any,
    marketResearch: any,
    sandboxSim: any,
    pricing: number,
    cac: number,
    invariants: AdversarialInvariants
  ): AgentOpinion {
    return generateHeuristicOpinion(role, idea, domain, marketResearch, sandboxSim, pricing, cac, invariants);
  }
  /**
   * Run the full evidence-first adversarial evaluation loop:
   * INGEST → DECOMPOSE → INVESTIGATE → ATTACK → VERIFY → CROSS-EXAMINE → CONVERGE → VERDICT → VALIDATION
   */
  public async evaluateIdea(
    idea: IdeaInput,
    options: SwarmExecutionOptions = {}
  ): Promise<IdeaDossier> {
    const notify = options.onProgress || (() => {});
    const emit = options.onEvent || (() => {});

    // 01 INGEST & CLASSIFY
    notify("01 INGEST", `Ingesting "${idea.title}" into Dossier execution runtime...`);
    emit({ type: "stage", stage: "01 INGEST", detail: `Ingesting "${idea.title}" into Dossier execution runtime...`, timestamp: new Date().toISOString() });

    const domain = classifyIdeaDomain(idea);
    notify("01 CLASSIFY", `Classified concept as [${domain.archetypeLabel}] — Target: ${domain.primaryCustomer}`);
    emit({ type: "domain", domain });

    const decisionEvaluation = await runDecisionModel(idea);
    emit({ type: "decision_gate", evaluation: decisionEvaluation });
    if (decisionEvaluation.fatal_flags.length > 0) {
      notify("01 GATED", `Decision Model flagged fatal gate(s): ${decisionEvaluation.fatal_flags.join(", ")}`);
    }

    // 02 DECOMPOSE & RECON
    notify("02 DECOMPOSE", `Decomposing variables under ${domain.procurementCycle} framework...`);
    emit({ type: "stage", stage: "02 DECOMPOSE", detail: `Decomposing variables under ${domain.procurementCycle} framework...`, timestamp: new Date().toISOString() });

    const pricingOrder: Record<IdeaDomainArchetype, number> = {
      hardware_robotics: 1500,
      b2b_saas: 499,
      deeptech_research: 2500,
      consumer_social: 19,
      b2g_govtech: 900,
      healthcare_clinical: 1000,
      web3_defi: 149,
      general_startup: 100
    };
    const pricing = options.pricingMonthlyUsd ?? pricingOrder[domain.archetype];
    const cac = options.estimatedCacUsd ?? (domain.archetype === "hardware_robotics" ? 2500 : domain.archetype === "b2b_saas" ? 1200 : (domain.archetype === "deeptech_research" ? 5000 : 350));
    const invariants = detectAdversarialInvariants(idea, pricing, decisionEvaluation);
    const churn = options.expectedChurnMonthly ?? (invariants.isThinWrapper ? 0.28 : (domain.archetype === "consumer_social" ? 0.12 : 0.04));

    emit({ type: "sandbox_simulating", iterationCount: 10000 });

    const geo = detectJurisdiction(idea.targetAudience, idea.summary, idea.title);
    const combinedIdeaText = `${idea.title} ${idea.summary} ${idea.targetAudience} ${idea.monetization}`;
    const itchMatches = findMatchingItchProblems(combinedIdeaText);
    const graveyardMatches = findMatchingGraveyardPrecedents(combinedIdeaText);
    const isHealthcare = domain.archetype === "healthcare_clinical";
    const isWeb3 = domain.archetype === "web3_defi";
    const isAcademicOrDeeptech = domain.archetype === "deeptech_research" || domain.archetype === "healthcare_clinical" || domain.archetype === "hardware_robotics";

    const [marketResearch, unifiedMarkets, newsSignals, reachSignals, openAlexSignals, edgarSignals, hfSignals, clinicalSignals, macroSignals, floviaSignals, sandboxSim] = await Promise.all([
      performMarketResearch(idea.title, [
        idea.targetAudience,
        idea.monetization,
        domain.regulatoryEnvironment
      ], { exaKey: options.exaKey, tavilyKey: options.tavilyKey }),
      queryUnifiedPredictionMarkets(idea.title),
      queryNewsHeadlines(idea.title, geo.googleNewsLocale),
      queryAgentReachIntel(idea.title, {
        isTechSoftware: domain.archetype === "b2b_saas" || domain.archetype === "deeptech_research" || domain.archetype === "web3_defi",
        preferredChannels: geo.preferredCommunityChannels
      }),
      isAcademicOrDeeptech
        ? queryOpenAlex(`${idea.title} ${domain.archetypeLabel}`)
        : Promise.resolve({ query: idea.title, source: "OpenAlex (skipped for commercial archetype)", totalWorks: 0, papers: [], keyTakeaway: "Skipped academic literature search for non-research archetype." }),
      queryEdgarFormD(idea.title),
      queryHuggingFace(idea.title),
      isHealthcare
        ? queryClinicalEvidence(idea.title, true)
        : Promise.resolve({ query: idea.title, source: "ClinicalTrials.gov (skipped non-healthcare)", totalStudies: 0, studies: [], clearances: [], keyTakeaway: "Non-clinical archetype — clinical trial search skipped." }),
      queryMacroData(idea.targetAudience),
      queryFloviaIntelligence(idea.title, { isWeb3OrCrypto: isWeb3 }),
      runEconomicsSimulation(pricing, churn, cac, 500, 1500, 30)
    ]);

    const isEconomicsAvailable = Boolean(sandboxSim && !sandboxSim.degraded && sandboxSim.runtime !== "unavailable" && sandboxSim.exitCode === 0);
    const stressMetrics: SandboxStressStats = sandboxSim.metrics.stressMetrics ?? {
      churnStressed: true,
      cacStressed: true,
      stressLtvCacRatio: isEconomicsAvailable ? Math.max(0.5, sandboxSim.metrics.ltvCacRatio * 0.6) : undefined,
      stressSurvival24Mo: isEconomicsAvailable ? (sandboxSim.metrics.monteCarlo?.survivalProbability24Mo ?? 0.5) * 0.7 : undefined,
      stressPayback50: isEconomicsAvailable ? sandboxSim.metrics.estimatedPaybackMonths * 1.5 : undefined
    };

    emit({
      type: "sandbox_metrics",
      metrics: sandboxSim.metrics,
      runtime: sandboxSim.runtime,
      exitCode: sandboxSim.exitCode
    });

    const marketContext = formatReconContext({
      marketResearch,
      unifiedMarkets,
      newsSignals,
      openAlexSignals,
      edgarSignals,
      hfSignals,
      clinicalSignals,
      macroSignals,
      floviaSignals,
      geo,
      reachSignals,
      itchMatches,
      graveyardMatches,
      decisionEvaluation,
      pricing,
      cac,
      churn,
      isEconomicsAvailable,
      sandboxSim,
      stressMetrics,
      mc: sandboxSim.metrics.monteCarlo
    });

    // 03 INVESTIGATE (Domain-Tailored Specialist Subagents)
    notify("03 INVESTIGATE", `Deploying 6 domain specialist agents for [${domain.archetypeLabel}]...`);
    emit({ type: "stage", stage: "03 INVESTIGATE", detail: `Deploying 6 domain specialist agents for [${domain.archetypeLabel}]...`, timestamp: new Date().toISOString() });

    const shouldCallLive = options.useLiveLLM !== false;
    const evaluationMode: "LIVE_LLM" | "HEURISTIC_ENGINE" =
      shouldCallLive && getLLMStatus().hasLiveLLM ? "LIVE_LLM" : "HEURISTIC_ENGINE";

    const AGENT_ROLES = ["analyst", "customer", "architect", "investor", "redteam", "expert"] as const;
    const [analystOpinion, customerOpinion, architectOpinion, investorOpinion, redTeamOpinion, expertOpinion] = await Promise.all(
      AGENT_ROLES.map(async (role) => {
        emit({ type: "agent_start", role, roleTitle: domain.specialistRoleLabels[role].title });
        const roleStart = Date.now();
        const live = shouldCallLive ? await evaluateRoleWithLLM(role, idea, marketContext, domain, invariants) : null;
        if (live?.fallbackReason) {
          emit({ type: "parse_fallback", role, reason: live.fallbackReason });
        }
        const opinion: AgentOpinion = live?.opinion || generateHeuristicOpinion(role, idea, domain, marketResearch, sandboxSim, pricing, cac, invariants);
        if (role === "redteam" && graveyardMatches.length > 0) {
          const g = graveyardMatches[0];
          opinion.fatalFlaws.unshift(
            `Graveyard Forensic Precedent [${g.companyName} — ${g.burnedCapitalUsd} burned]: ${g.fatalFlaw}`
          );
          opinion.mustTestBeforeBuilding.unshift(
            `Falsify ${g.companyName} Death Trap: ${g.takeaway}`
          );
          opinion.score = 28;
          opinion.verdict = "STRONG_KILL";
        }
        if (role === "customer" && itchMatches.length > 0) {
          const itch = itchMatches[0];
          opinion.keyAssumptions.unshift(
            `Verified Buyer Demand (Razorpay Fix My Itch): "${itch.problemStatement}"`
          );
        }
        if (evaluationMode === "HEURISTIC_ENGINE" && !invariants.isPromptInjection && !invariants.isImpossiblePhysics) {
          opinion.score = Math.max(10, Math.min(100, shrinkTowardBaseRate(opinion.score, domain.archetype)));
        }
        opinion.telemetryMetadata = {
          latencyMs: Date.now() - roleStart,
          threatSeverity: opinion.score < 50 ? "HIGH" : "MODERATE",
          modelId: evaluationMode === "LIVE_LLM" ? (getLLMStatus().activeModel || "live-llm") : "deterministic-heuristics"
        };
        emit({
          type: "agent_opinion",
          role: opinion.role,
          roleTitle: opinion.roleTitle,
          verdict: opinion.verdict,
          score: opinion.score,
          fatalFlaw: opinion.fatalFlaws[0]
        });
        return opinion;
      })
    );

    // 04 ATTACK & CROSS-EXAMINE (Adversarial Round 1)
    notify("04 ATTACK", `Red Team deploying fatal assumption attacks across [${domain.archetypeLabel}]...`);

    const debateInput: DebateTrailInput = {
      opinions: {
        analyst: analystOpinion,
        customer: customerOpinion,
        architect: architectOpinion,
        investor: investorOpinion,
        redteam: redTeamOpinion,
        expert: expertOpinion
      },
      procurementCycle: domain.procurementCycle,
      primaryCustomer: domain.primaryCustomer,
      sandboxMetrics: {
        ltvCacRatio: sandboxSim.metrics.ltvCacRatio,
        estimatedPaybackMonths: sandboxSim.metrics.estimatedPaybackMonths
      }
    };
    const { trail: roundOneTrail, source: debateSource } = await buildRoundOneDebateTrail(
      debateInput,
      shouldCallLive && getLLMStatus().hasLiveLLM
    );
    notify("04 ATTACK [ROUND 1]", `Crossfire authored via ${debateSource} — challenges cite actual agent claims.`);

    const debateTrail: DebateChallenge[] = roundOneTrail;
    for (const clash of debateTrail) {
      emit({ type: "crossfire_clash", challenger: clash.challenger, target: clash.target, challengePoint: clash.challengePoint, rebuttal: clash.rebuttal || "", status: clash.status });
    }

    // 05 VERIFY (Epistemic Robust Verifier & NLI)
    notify("05 VERIFY", "Verifying sandboxed Python metrics & executing Epistemic Robust Verifier...");

    const evidenceFeed = buildEvidenceFeed({
      isEconomicsAvailable,
      sandboxSim,
      pricing,
      cac,
      domain,
      unifiedMarkets,
      marketResearch,
      newsSignals,
      openAlexSignals,
      edgarSignals,
      hfSignals,
      clinicalSignals,
      macroSignals,
      floviaSignals,
      reachSignals,
      itchMatches,
      graveyardMatches,
      customerOpinion,
      redTeamOpinion,
      debateSource
    });

    const opinionsMap: Record<SwarmRole, AgentOpinion> = {
      analyst: analystOpinion,
      customer: customerOpinion,
      architect: architectOpinion,
      investor: investorOpinion,
      redteam: redTeamOpinion,
      expert: expertOpinion,
      synthesizer: {
        role: "synthesizer",
        roleNumber: "00",
        roleTitle: "SYNTHESIZER",
        verdict: "REFINE",
        score: 70,
        status: "COMPLETE",
        fatalFlaws: [],
        keyAssumptions: [],
        competitiveRisks: [],
        mustTestBeforeBuilding: [],
        rationale: "Synthesis pending."
      }
    };

    const verifier = new EpistemicRobustVerifier();
    const { verifiedOpinions, audit, claimDag } = verifier.verifySwarmOpinions(
      idea,
      domain,
      opinionsMap,
      {
        cacEstimateUsd: sandboxSim.metrics.cacEstimateUsd,
        ltvEstimateUsd: sandboxSim.metrics.ltvEstimateUsd,
        ltvCacRatio: sandboxSim.metrics.ltvCacRatio,
        estimatedPaybackMonths: sandboxSim.metrics.estimatedPaybackMonths,
        monthlyInfraCostUsd: sandboxSim.metrics.monthlyInfraCostUsd,
        tamEstimateUsd: sandboxSim.metrics.tamEstimateUsd,
        monteCarlo: sandboxSim.metrics.monteCarlo,
        degraded: sandboxSim.degraded,
        sandboxExecutionProof: {
          runtime: sandboxSim.runtime,
          exitCode: sandboxSim.exitCode,
          stdout: sandboxSim.stdout
        }
      },
      evidenceFeed
    );

    for (const item of audit.auditItems) {
      if (item.verdict === "CORRECTED") {
        emit({
          type: "audit_correction",
          detail: `${item.id}: ${item.claimOrOpinion} — ${item.rationale}`,
          hallucinationsBlocked: audit.hallucinationsBlocked
        });
      }
    }

    try {
      const nli = await verifier.verifyWithNli(evidenceFeed, verifiedOpinions);
      if (nli.demotions > 0) {
        audit.auditItems.push(...nli.auditItems);
        audit.testTimeSelfCorrections += nli.demotions;
        audit.totalClaimsAudited = audit.auditItems.length;
        notify("05 VERIFY [NLI]", `NLI contradiction pass flagged ${nli.demotions} claim(s) against cited evidence.`);
        emit({
          type: "audit_correction",
          detail: `NLI contradiction pass flagged ${nli.demotions} claim(s) against cited evidence.`,
          hallucinationsBlocked: audit.hallucinationsBlocked
        });
      }
    } catch {
      // NLI failure never breaks evaluation
    }

    // 06 CONVERGE (Round 2 Escalation)
    let convergenceRounds = 1;
    const initialScores = [
      verifiedOpinions.analyst.score,
      verifiedOpinions.customer.score,
      verifiedOpinions.architect.score,
      verifiedOpinions.investor.score,
      verifiedOpinions.redteam.score,
      verifiedOpinions.expert.score
    ];
    const scoreSpread = Math.max(...initialScores) - Math.min(...initialScores);
    const hasUnresolvedFatalFlaw = debateTrail.some(d => d.status === "OPEN") || redTeamOpinion.score < 45;
    const crossfireToolTraces: string[] = [];
    let crossfireContradiction: ContradictionEntry | null = null;

    if (hasUnresolvedFatalFlaw || scoreSpread > 25) {
      convergenceRounds = 2;
      notify("06 CONVERGE [ROUND 2]", `Convergence criteria unmet (Score Spread: ${scoreSpread}pts). Escalating to Round 2 crossfire on the contested claim...`);

      const contenderPool = [
        verifiedOpinions.analyst,
        verifiedOpinions.customer,
        verifiedOpinions.architect,
        verifiedOpinions.investor,
        verifiedOpinions.redteam,
        verifiedOpinions.expert
      ];
      const rankedContenders = [...contenderPool].sort((a, b) => b.score - a.score);
      const defenderOpinion = rankedContenders[0];
      const challengerOpinion = rankedContenders[rankedContenders.length - 1];
      const contestedClaim = defenderOpinion.keyAssumptions[0] || defenderOpinion.rationale;

      const crossfireResolution = await runRoundTwoCrossfire(
        challengerOpinion,
        defenderOpinion,
        {
          stressSummary: `run_sandbox_economics(stress): churn ${(Math.min(1, churn * 1.6) * 100).toFixed(0)}%, CAC $${Math.round(cac * 1.6)} → P50 LTV/CAC ${stressMetrics.stressLtvCacRatio ?? sandboxSim.metrics.ltvCacRatio}x, survival@24mo ${(((stressMetrics.stressSurvival24Mo ?? 0)) * 100).toFixed(0)}%, payback P50 ${stressMetrics.stressPayback50 ?? sandboxSim.metrics.estimatedPaybackMonths}mo.`,
          reconSummary: marketResearch.dataSource === "live-web-recon"
            ? `search_competitor_recon("${contestedClaim.split(/\s+/).slice(0, 4).join(" ")}") → ${marketResearch.rawResults.slice(0, 3).map((r: { title: string; url: string }) => `${r.title} [${r.url}]`).join("; ")}`
            : `search_competitor_recon("${contestedClaim.split(/\s+/).slice(0, 4).join(" ")}") → no live recon results (${marketResearch.reconError || "provider unavailable"}); defense must rely on modeled priors`,
          contestedClaim,
          stressLtvCacRatio: stressMetrics.stressLtvCacRatio ?? sandboxSim.metrics.ltvCacRatio,
          stressSurvival24: stressMetrics.stressSurvival24Mo,
          hasLiveLLM: shouldCallLive && getLLMStatus().hasLiveLLM
        },
        emit
      );

      debateTrail.push(crossfireResolution.challenge);
      crossfireToolTraces.push(...crossfireResolution.toolTraces);
      emit({ type: "crossfire_clash", challenger: crossfireResolution.challenge.challenger, target: crossfireResolution.challenge.target, challengePoint: crossfireResolution.challenge.challengePoint, rebuttal: crossfireResolution.challenge.rebuttal || "", status: crossfireResolution.challenge.status });
      crossfireContradiction = crossfireResolution.contradiction;
    }

    // 07 VERDICT (5-Dimensional Resilience Breakdown)
    const synthesisStart = Date.now();
    notify("07 VERDICT", "Synthesizing transparent 5-dimensional resilience breakdown & factor attribution...");

    const scoringResult = computeDimensionalResilience({
      verifiedOpinions,
      domain,
      sandboxSim,
      mc: sandboxSim.metrics.monteCarlo,
      isEconomicsAvailable,
      invariants,
      graveyardMatches,
      evidenceFeed
    });

    // 08 ASSEMBLE DOSSIER & PERSIST
    return assembleDossier({
      idea,
      domain,
      evaluationMode,
      pricing,
      cac,
      churn,
      invariants,
      verifiedOpinions,
      scoringResult,
      evidenceFeed,
      strongestEvidence: evidenceFeed[0],
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
    });
  }
}
