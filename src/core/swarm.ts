import dns from "node:dns";
try {
  dns.setDefaultResultOrder?.("ipv4first");
} catch {
  // Best-effort IPv4 preference
}

import {
  IdeaInput,
  IdeaDossier,
  AgentOpinion,
  DebateChallenge,
  Verdict,
  SwarmRole,
  KeyAssumption,
  Contradiction,
  EvidenceItem,
  ExternalEvidenceSource,
  DomainClassification,
  CheapestValidationExperiment,
  ValidationPriorityItem,
  SwarmEvent,
  IdeaDomainArchetype,
  SandboxStressStats,
  Contradiction as ContradictionEntry
} from "../types/index.js";
import { SWARM_ROLES } from "../config/prompts.js";
import { classifyIdeaDomain } from "./classifier.js";
import { EpistemicRobustVerifier } from "./verifier.js";
import { buildMutationProposals } from "./mutator.js";
import { buildRoundOneDebateTrail, DebateTrailInput } from "./debate.js";
import { buildOutsideViewPanel } from "./outside-view.js";
import { runDecisionModel } from "../tools/decision-runner.js";
import { forecastLedger } from "../services/ledger.js";
import { runEconomicsSimulation } from "../tools/sandbox.js";
import { performMarketResearch } from "../tools/search.js";
import { queryUnifiedPredictionMarkets } from "../tools/markets/index.js";
import { queryNewsHeadlines } from "../tools/news.js";
import { detectJurisdiction } from "../tools/geo.js";
import { queryAgentReachIntel } from "../tools/agentReach.js";
import { queryOpenAlex } from "../tools/openalex.js";
import { queryEdgarFormD } from "../tools/edgar.js";
import { queryHuggingFace } from "../tools/huggingface.js";
import { queryClinicalEvidence } from "../tools/clinical.js";
import { queryMacroData } from "../tools/macro.js";
import { queryFloviaIntelligence } from "../tools/flovia.js";
import { findMatchingItchProblems } from "../data/fixMyItchProblems.js";
import { findMatchingGraveyardPrecedents } from "../data/graveyardAntipatterns.js";
import { generateAgentTurn, getLLMStatus } from "../services/llm.js";
import { dossierStorage } from "../services/storage.js";
import { getBaseRate, shrinkTowardBaseRate } from "./baseRates.js";

import {
  detectAdversarialInvariants,
  type AdversarialInvariants,
  WRAPPER_KILL_CEILINGS,
  HIGH_CHURN_KILL_CEILING
} from "./swarm/invariants.js";
import {
  validateAgentOutput,
  validateCrossExam,
  validateCrossfireDefense,
  VOI_EXPERIMENT_MAP
} from "./swarm/schemas.js";
import { generateHeuristicOpinion } from "./swarm/heuristics.js";
import { computeDimensionalResilience } from "./swarm/dimensionalScoring.js";
import {
  formatReconContext,
  buildEvidenceFeed,
  buildExternalEvidenceSources
} from "./swarm/evidence.js";

export { detectAdversarialInvariants, type AdversarialInvariants };

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
   * Evaluate an individual agent perspective using live LLM if available,
   * injecting domain-specific prompts, specialist mandates, and hard score calibration.
   * Returns a discriminated result so the orchestrator can surface schema/parse failures
   * on the stream instead of silently swapping heuristics in.
   */
  private async evaluateRoleWithLLM(
    role: SwarmRole,
    idea: IdeaInput,
    marketContext: string,
    domain: DomainClassification,
    invariants: AdversarialInvariants
  ): Promise<{ opinion: AgentOpinion | null; fallbackReason?: string }> {
    const status = getLLMStatus();
    if (!status.hasLiveLLM) {
      return { opinion: null };
    }

    const defaultRoleConfig = SWARM_ROLES[role];
    const roleMeta = domain.specialistRoleLabels[role as keyof typeof domain.specialistRoleLabels] || {
      number: defaultRoleConfig.number,
      title: defaultRoleConfig.roleTitle,
      mandate: defaultRoleConfig.description
    };

    const systemPrompt = `You are Agent ${roleMeta.number} // ${roleMeta.title} in the Dossier Adversarial Intelligence Swarm.
Domain Archetype: ${domain.archetypeLabel}
Primary Customer: ${domain.primaryCustomer}
Procurement & Sales Cycle: ${domain.procurementCycle}
Regulatory & Compliance Environment: ${domain.regulatoryEnvironment}
Unit Economics Model: ${domain.unitEconomicsModel}

Your Specific Mandate: ${roleMeta.mandate}

ADVERSARIAL EVALUATION RULES:
1. Do NOT give sycophantic praise. Your job is to aggressively stress-test assumptions.
2. Evaluate through the specific lens of ${domain.archetypeLabel}. NEVER apply irrelevant startup priors.
3. If this idea has fatal flaws, call them out with zero hesitation.
4. Your score is an adversarial gate, not a consensus average — resolved flaws earn points; unresolved fatal flaws must drag it below 40.

MANDATORY SCORING CALIBRATION:
${defaultRoleConfig.scoringCalibration}

You must return a strictly valid JSON object matching this schema:
{
  "verdict": "STRONG_KILL" | "LEAN_KILL" | "PIVOT_REQUIRED" | "VIABLE_WITH_RISK" | "STRONG_PURSUE",
  "score": number (0 to 100),
  "fatalFlaws": string[],
  "keyAssumptions": string[],
  "competitiveRisks": string[],
  "mustTestBeforeBuilding": string[],
  "rationale": string
}`;

    const userPrompt = `Stress-test target concept:
Title: ${idea.title}
Summary: ${idea.summary}
Target Audience: ${idea.targetAudience}
Monetization & Model: ${idea.monetization}
Tech Stack: ${idea.techStack || "Standard"}
Domain: ${domain.archetypeLabel}
Market & Prediction Signals: ${marketContext}`;

    try {
      const turnStart = Date.now();
      const raw = await generateAgentTurn(systemPrompt, userPrompt, {
        temperature: 0.5,
        maxTokens: 2000,
        jsonMode: true
      });
      const turnLatencyMs = Date.now() - turnStart;

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { opinion: null, fallbackReason: "model returned no JSON object" };
      }

      const validated = validateAgentOutput(JSON.parse(jsonMatch[0]));
      if (!validated.success) {
        const issues = validated.error.issues
          .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
          .join("; ");
        return { opinion: null, fallbackReason: `schema validation failed — ${issues}` };
      }
      const parsed = validated.data;

      let score = parsed.score;
      let verdict: Verdict = parsed.verdict;
      const fatalFlaws = (parsed.fatalFlaws ?? []).slice();

      // Deterministic adversarial invariant gates override model drift.
      if (invariants.isPromptInjection || invariants.isImpossiblePhysics) {
        score = Math.min(score, 22);
        verdict = "STRONG_KILL";
        fatalFlaws.unshift(
          invariants.isPromptInjection
            ? "System integrity risk: adversarial instruction injection detected."
            : "Physical impossibility: claimed mechanism violates conservation of energy."
        );
      } else if (invariants.isThinWrapper) {
        const guard = WRAPPER_KILL_CEILINGS[role];
        if (guard) {
          score = Math.min(score, guard.score);
          verdict = guard.verdict;
          fatalFlaws.unshift("Zero structural defensibility: thin wrapper over frontier models is trivially replicable as a native platform feature.");
        }
      } else if (invariants.hasFormatRisk) {
        // Product format is a moat-risk signal, not proof of weak defensibility.
        parsed.competitiveRisks = parsed.competitiveRisks || [];
        parsed.competitiveRisks.push("Platform format risk: distribution modality relies on host platform/OS. Long-term defensibility requires proprietary workflows and switching moats.");
      }
      if (domain.archetype === "consumer_social" && (role === "investor" || role === "redteam") && score > HIGH_CHURN_KILL_CEILING) {
        score = HIGH_CHURN_KILL_CEILING;
        if (verdict === "STRONG_PURSUE" || verdict === "VIABLE_WITH_RISK") {
          verdict = "LEAN_KILL";
        }
        fatalFlaws.unshift("High-churn consumer model: novelty-driven retention collapses unit economics before payback.");
      }

      return {
        opinion: {
          role,
          roleNumber: roleMeta.number,
          roleTitle: roleMeta.title,
          verdict,
          score,
          status: "COMPLETE",
          fatalFlaws,
          keyAssumptions: parsed.keyAssumptions ?? [],
          competitiveRisks: parsed.competitiveRisks ?? [],
          mustTestBeforeBuilding: parsed.mustTestBeforeBuilding ?? [],
          rationale: parsed.rationale || `Evaluated through ${domain.archetypeLabel} domain lens.`,
          telemetryMetadata: {
            latencyMs: turnLatencyMs,
            threatSeverity: score < 50 ? "HIGH" : "MODERATE",
            modelId: getLLMStatus().activeModel || "live-llm"
          }
        }
      };
    } catch (err: any) {
      return { opinion: null, fallbackReason: `LLM turn failed: ${err?.message || "unknown provider error"}` };
    }
  }

  /**
   * Round 2 cross-examination (plan 2.2): the lowest-scoring agent cross-examines the
   * highest-scoring agent using dynamic ReAct tool findings (stressed Monte Carlo +
   * competitor recon). The defender must produce verifiable evidence or concede
   * confidence points; falls back to deterministic stress adjudication when offline.
   */
  private async runRoundTwoCrossfire(
    challengerOpinion: AgentOpinion,
    defenderOpinion: AgentOpinion,
    context: {
      stressSummary: string;
      reconSummary: string;
      contestedClaim: string;
      stressLtvCacRatio: number;
      stressSurvival24?: number;
      hasLiveLLM: boolean;
    },
    emit: (event: SwarmEvent) => void
  ): Promise<{ challenge: DebateChallenge; contradiction: ContradictionEntry; defenderScoreDelta: number; toolTraces: string[] }> {
    emit({ type: "crossfire_start", agentA: challengerOpinion.role, agentB: defenderOpinion.role, topic: context.contestedClaim });

    const toolTraces = [context.stressSummary, context.reconSummary];
    const debateHistory: string[] = [];
    const originalScore = defenderOpinion.score;
    let newScore = originalScore;
    let crossExamText = "";
    let defenseText = "";

    if (context.hasLiveLLM) {
      try {
        const skepticTurn = await generateAgentTurn(
          `You are Agent ${challengerOpinion.roleNumber} // ${challengerOpinion.roleTitle} in the Dossier adversarial crossfire. You MUST cite the stress-sandbox numbers verbatim and probe exactly one testable claim. Return strictly valid JSON: {"crossExam": string, "targetClaim": string}.`,
          `Stress evidence you must cite: ${context.stressSummary}\nContested claim to attack: "${context.contestedClaim}"\nIssue a direct cross-examination of at most 100 words to Agent ${defenderOpinion.roleNumber} // ${defenderOpinion.roleTitle}.`,
          { temperature: 0.4, maxTokens: 800, jsonMode: true }
        );
        const examMatch = skepticTurn.match(/\{[\s\S]*\}/);
        const parsedExam = validateCrossExam(JSON.parse(examMatch ? examMatch[0] : "{}"));
        if (parsedExam.success) {
          crossExamText = parsedExam.data.crossExam;
          debateHistory.push(`Skeptic cross-examination: ${crossExamText}`);
        }

        const defenderTurn = await generateAgentTurn(
          `You are Agent ${defenderOpinion.roleNumber} // ${defenderOpinion.roleTitle} under cross-examination. Either produce concrete defensive evidence, or concede and deduct confidence points. Return strictly valid JSON: {"defense": string (<=120 words), "revisedScore": number (your defensible confidence 0-100, never above your original), "concedes": boolean}.`,
          `Cross-examination: ${crossExamText || context.contestedClaim}\nDynamic tool findings against you: ${toolTraces.join(" | ")}\nOriginal claim to defend or concede: "${context.contestedClaim}".`,
          { temperature: 0.4, maxTokens: 1200, jsonMode: true }
        );
        const defMatch = defenderTurn.match(/\{[\s\S]*\}/);
        const parsedDefense = validateCrossfireDefense(JSON.parse(defMatch ? defMatch[0] : "{}"));
        if (parsedDefense.success) {
          newScore = Math.min(parsedDefense.data.revisedScore, originalScore);
          if (parsedDefense.data.concedes) {
            newScore = Math.min(newScore, 45);
          }
          defenseText = parsedDefense.data.defense;
          defenderOpinion.score = newScore;
          if (originalScore - newScore >= 15) {
            defenderOpinion.verdict = "PIVOT_REQUIRED";
          } else if (newScore < 50 && defenderOpinion.verdict === "STRONG_PURSUE") {
            defenderOpinion.verdict = "VIABLE_WITH_RISK";
          }
          debateHistory.push(`Defender response: ${defenseText}`, `Confidence: ${originalScore} → ${newScore}`);
          emit({ type: "crossfire_rebuttal", agent: defenderOpinion.role, argument: defenseText, confidenceDelta: originalScore - newScore });
          return this.buildCrossfireOutcome(challengerOpinion, defenderOpinion, crossExamText, defenseText, debateHistory, toolTraces, originalScore, newScore);
        }
      } catch {
        // LLM crossfire failed — fall through to deterministic adjudication below
      }
    }

    if (!crossExamText) {
      crossExamText = `Round 2 cross-examination with dynamic tool evidence: ${context.stressSummary}. On "${context.contestedClaim}", defend with verifiable evidence or deduct confidence points.`;
    }
    if (!defenseText) {
      const stressSurvival = context.stressSurvival24 ?? 0;
      if (context.stressLtvCacRatio >= 2.5 && stressSurvival >= 0.8) {
        defenseText = `Economics survive stress: P50 LTV/CAC ${context.stressLtvCacRatio}x with 24-month survival ${(stressSurvival * 100).toFixed(0)}%. Confidence retained; mitigation mandate: pre-signed pilot LOIs and upfront annual prepayments before production engineering.`;
        newScore = originalScore;
      } else {
        const haircut = stressSurvival < 0.35 ? 18 : stressSurvival < 0.6 ? 12 : 10;
        newScore = Math.max(28, Math.min(originalScore, originalScore - haircut));
        defenseText = `Stress evidence does not clear viability: P50 LTV/CAC ${context.stressLtvCacRatio}x with ${(100 - stressSurvival * 100).toFixed(0)}% insolvency by month 24. Confidence deducted ${originalScore - newScore} points; mandate dual-key approval and pre-screened pilot commitments before further spend.`;
        defenderOpinion.score = newScore;
        if (originalScore - newScore >= 15) {
          defenderOpinion.verdict = "PIVOT_REQUIRED";
        } else if (newScore < 50 && defenderOpinion.verdict === "STRONG_PURSUE") {
          defenderOpinion.verdict = "VIABLE_WITH_RISK";
        }
      }
      debateHistory.push(`Deterministic stress adjudication: ${defenseText}`);
    }

    emit({ type: "crossfire_rebuttal", agent: defenderOpinion.role, argument: defenseText, confidenceDelta: originalScore - newScore });
    return this.buildCrossfireOutcome(challengerOpinion, defenderOpinion, crossExamText, defenseText, debateHistory, toolTraces, originalScore, newScore);
  }

  private buildCrossfireOutcome(
    challengerOpinion: AgentOpinion,
    defenderOpinion: AgentOpinion,
    crossExamText: string,
    defenseText: string,
    debateHistory: string[],
    toolTraces: string[],
    originalScore: number,
    newScore: number
  ): { challenge: DebateChallenge; contradiction: ContradictionEntry; defenderScoreDelta: number; toolTraces: string[] } {
    const defenderDropped = newScore < originalScore;
    const challenge: DebateChallenge = {
      challenger: challengerOpinion.role,
      target: defenderOpinion.role,
      round: 2,
      challengePoint: crossExamText,
      rebuttal: defenseText,
      status: (originalScore - newScore) >= 12 ? "CONCEDED" : "REBUTTED"
    };
    const contradiction: ContradictionEntry = {
      id: "C-CROSSFIRE-02",
      agentA: challengerOpinion.roleTitle,
      claimA: crossExamText,
      agentB: defenderOpinion.roleTitle,
      claimB: defenseText,
      resolutionStatus: defenderDropped ? "CONTRADICTED // SUSTAINED IN CROSSFIRE" : "RESOLVED // ASSUMPTION MITIGATED",
      guidance: defenderDropped
        ? `Defender conceded ${originalScore - newScore} confidence points under stochastically stressed economics; validate the contested metric empirically before further capital deployment.`
        : `Defender held score under dynamic tool evidence; enforce the mitigation mandate (pilot LOIs / upfront prepayments) during validation.`,
      debateHistory,
      toolExecutionTraces: toolTraces
    };
    return { challenge, contradiction, defenderScoreDelta: originalScore - newScore, toolTraces };
  }

  private generateHeuristicOpinion(
    role: SwarmRole,
    idea: IdeaInput,
    domain: DomainClassification,
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
      // Single vectorized Monte Carlo run (computes both baseline and pessimistic stress metrics in-memory)
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

    const mc = sandboxSim.metrics.monteCarlo;

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
      mc
    });

    // 03 INVESTIGATE (Domain-Tailored Specialist Subagents)
    notify("03 INVESTIGATE", `Deploying 6 domain specialist agents for [${domain.archetypeLabel}]...`);
    emit({ type: "stage", stage: "03 INVESTIGATE", detail: `Deploying 6 domain specialist agents for [${domain.archetypeLabel}]...`, timestamp: new Date().toISOString() });

    const shouldCallLive = options.useLiveLLM !== false;
    const evaluationMode: "LIVE_LLM" | "HEURISTIC_ENGINE" =
      shouldCallLive && getLLMStatus().hasLiveLLM ? "LIVE_LLM" : "HEURISTIC_ENGINE";

    // Stream agents live: each role emits agent_start when it begins computing
    // and agent_opinion the moment its (LLM or heuristic) opinion resolves.
    const AGENT_ROLES = ["analyst", "customer", "architect", "investor", "redteam", "expert"] as const;
    const [analystOpinion, customerOpinion, architectOpinion, investorOpinion, redTeamOpinion, expertOpinion] = await Promise.all(
      AGENT_ROLES.map(async (role) => {
        emit({ type: "agent_start", role, roleTitle: domain.specialistRoleLabels[role].title });
        const roleStart = Date.now();
        const live = shouldCallLive ? await this.evaluateRoleWithLLM(role, idea, marketContext, domain, invariants) : null;
        if (live?.fallbackReason) {
          emit({ type: "parse_fallback", role, reason: live.fallbackReason });
        }
        const opinion: AgentOpinion = live?.opinion || this.generateHeuristicOpinion(role, idea, domain, marketResearch, sandboxSim, pricing, cac, invariants);
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

    // 04 ATTACK & CROSS-EXAMINE (Adversarial Round 1 — authored from actual agent outputs)
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

    // 05 VERIFY (Sandboxed Python Subprocess & Epistemic Robust Verifier)
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

    // Dynamic audit correction stream emission
    for (const item of audit.auditItems) {
      if (item.verdict === "CORRECTED") {
        emit({
          type: "audit_correction",
          detail: `${item.id}: ${item.claimOrOpinion} — ${item.rationale}`,
          hallucinationsBlocked: audit.hallucinationsBlocked
        });
      }
    }

    // Natural Language Inference (NLI) contradiction-check pass (plan 2.1):
    // verify whether cited external evidence logically supports or contradicts
    // each agent's explicit claims. An external evidence item that empirically
    // contradicts an agent claim appends a CORRECTED audit item. Null-safe.
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

    // 06 CONVERGE (Multi-Round Convergence Loop)
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

      // Genuine top-vs-bottom cross-examination with dynamic ReAct tool findings (plan 2.2)
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

      const crossfireResolution = await this.runRoundTwoCrossfire(
        challengerOpinion,
        defenderOpinion,
        {
          stressSummary: `run_sandbox_economics(stress): churn ${(Math.min(1, churn * 1.6) * 100).toFixed(0)}%, CAC $${Math.round(cac * 1.6)} → P50 LTV/CAC ${stressMetrics.stressLtvCacRatio ?? sandboxSim.metrics.ltvCacRatio}x, survival@24mo ${(((stressMetrics.stressSurvival24Mo ?? 0)) * 100).toFixed(0)}%, payback P50 ${stressMetrics.stressPayback50 ?? sandboxSim.metrics.estimatedPaybackMonths}mo.`,
          reconSummary: marketResearch.dataSource === "live-web-recon"
            ? `search_competitor_recon("${contestedClaim.split(/\s+/).slice(0, 4).join(" ")}") → ${marketResearch.rawResults.slice(0, 3).map(r => `${r.title} [${r.url}]`).join("; ")}`
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

    // 07 TRANSPARENT DIMENSIONAL RESILIENCE SCORING WITH TRACEABLE FACTOR ATTRIBUTION
    const synthesisStart = Date.now();
    notify("07 VERDICT", "Synthesizing transparent 5-dimensional resilience breakdown & factor attribution...");

    const scoringResult = computeDimensionalResilience({
      verifiedOpinions,
      domain,
      sandboxSim,
      mc,
      isEconomicsAvailable,
      invariants,
      graveyardMatches,
      evidenceFeed
    });

    const {
      technicalFeasibility,
      demandAndAdoption,
      economicsAndCapitalEfficiency,
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

    // 08 STRUCTURED EVIDENCE WITH PROVENANCE
    const strongestEvidence = evidenceFeed[0];

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
        claimA: `Customer Advocate at ${customerOpinion.score}/100 flags: "${customerOpinion.fatalFlaws[0] || "adoption friction unresolved"}"`,
        agentB: roleLabels.architect.title,
        claimB: `Architect at ${architectOpinion.score}/100 holds: "${architectOpinion.keyAssumptions[0] || architectOpinion.rationale}"`,
        resolutionStatus:
          architectOpinion.score - customerOpinion.score > 15
            ? "UNRESOLVED CONFLICT // REQUIRES VALIDATION"
            : "RESOLVED // ASSUMPTION MITIGATED",
        guidance:
          architectOpinion.mustTestBeforeBuilding[0] ||
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

    // Validation priority (A2): rank assumption-resolution experiments by their
    // expected value of information, computed empirically in the Monte Carlo sandbox.
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
        analyst: analystOpinion,
        customer: customerOpinion,
        architect: architectOpinion,
        investor: investorOpinion,
        redteam: redTeamOpinion,
        expert: expertOpinion,
        synthesizer: executiveSynthesizerOpinion
      },
      keyAssumptions,
      contradictions,
      evidenceFeed,
      strongestEvidence,
      weakestAssumption,
      killConditions,
      cheapestValidationExperiment,
      resilienceBreakdown,
      predictionMarkets: {
        source: unifiedMarkets.activeSources.length > 0
          ? `Unified Prediction Oracle (${unifiedMarkets.activeSources.map(s => s.toUpperCase()).join("/")})`
          : "Unified Prediction Oracle",
        macroSentiment: unifiedMarkets.macroSentiment,
        keyTakeaway: unifiedMarkets.keyTakeaway,
        marketsFound: unifiedMarkets.signals.map(s => ({
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

    // Idea Autopsy & Mutation Engine (plan 3.3): collapsed concepts receive three
    // algorithmic strategic pivots that invert the verified fatal flaws.
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

    // Calibration ledger: persist dated falsifiable forecasts (kill conditions,
    // weakest assumption, validation experiment) into the forecast registry.
    try {
      const forecasts = await forecastLedger.persistDossierForecasts(dossier);
      dossier.forecastIds = forecasts.map((f) => f.id);
    } catch {
      // non-blocking
    }

    // Persist dossier asynchronously for historical retrieval and export
    try {
      await dossierStorage.saveDossier(dossier);
    } catch (err: any) {
      // Non-blocking storage save
    }

    emit({ type: "dossier_complete", dossier });

    return dossier;
  }
}
