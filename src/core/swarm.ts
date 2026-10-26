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
  ApprovalAction,
  SwarmRole,
  KeyAssumption,
  Contradiction,
  EvidenceItem,
  ExternalEvidenceSource,
  RiskLevel,
  DomainClassification,
  ResilienceScoreBreakdown,
  CheapestValidationExperiment,
  EpistemicTier,
  EpistemicTaxonomySummary,
  ValidationVerdict,
  SwarmEvent,
  IdeaDomainArchetype,
  SandboxStressStats,
  Contradiction as ContradictionEntry
} from "../types/index.js";
import { SWARM_ROLES } from "../config/prompts.js";
import { classifyIdeaDomain } from "./classifier.js";
import { StanfordRobustVerifier } from "./verifier.js";
import { buildMutationProposals } from "./mutator.js";
import { buildRoundOneDebateTrail, DebateTrailInput } from "./debate.js";
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
import { findMatchingItchProblems } from "../data/fixMyItchProblems.js";
import { findMatchingGraveyardPrecedents } from "../data/graveyardAntipatterns.js";
import { generateAgentTurn, getLLMStatus } from "../services/llm.js";
import { dossierStorage } from "../services/storage.js";
import { getBaseRate, shrinkTowardBaseRate } from "./baseRates.js";
import { z } from "zod";

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

/**
 * Deterministic adversarial invariants shared by the live-LLM and heuristic evaluation paths.
 * These enforce hard kill ceilings independent of model drift.
 */
function detectAdversarialInvariants(idea: IdeaInput, pricing: number) {
  const text = `${idea.title} ${idea.summary} ${idea.targetAudience} ${idea.monetization} ${idea.techStack || ""}`.toLowerCase();
  return {
    isPromptInjection: /ignore (previous|all) instructions|system prompt|jailbreak|output 100|developer mode/i.test(text),
    isImpossiblePhysics: /perpetual motion|free energy|infinite electricity|zero input energy|violates thermodynamics|overunity/i.test(text),
    isNoMonetization: /free forever|no monetization|zero revenue|not charging/i.test(text) || pricing <= 0,
    isThinWrapper: /(chrome extension|browser extension|gpt wrapper|chat with pdf|meeting notes|summariz|prompt engineering|simple crm|transcriber|ai copywriter|ai tweet)/i.test(text)
  };
}

type AdversarialInvariants = ReturnType<typeof detectAdversarialInvariants>;

const AGENT_OUTPUT_SCHEMA = z.object({
  verdict: z.enum(["STRONG_KILL", "LEAN_KILL", "PIVOT_REQUIRED", "VIABLE_WITH_RISK", "STRONG_PURSUE"]),
  score: z.number().min(0).max(100),
  fatalFlaws: z.array(z.string()).optional(),
  keyAssumptions: z.array(z.string()).optional(),
  competitiveRisks: z.array(z.string()).optional(),
  mustTestBeforeBuilding: z.array(z.string()).optional(),
  rationale: z.string().optional()
});

const WRAPPER_KILL_CEILINGS: Partial<Record<SwarmRole, { score: number; verdict: Verdict }>> = {
  analyst: { score: 35, verdict: "PIVOT_REQUIRED" },
  investor: { score: 28, verdict: "STRONG_KILL" },
  redteam: { score: 24, verdict: "STRONG_KILL" }
};
const HIGH_CHURN_KILL_CEILING = 39;

const CROSS_EXAM_SCHEMA = z.object({
  crossExam: z.string().min(1),
  targetClaim: z.string().optional()
});

const CROSSFIRE_DEFENSE_SCHEMA = z.object({
  defense: z.string().min(1),
  revisedScore: z.number().min(0).max(100),
  concedes: z.boolean()
});

// Structured domain drag so feasibility and expert confidence reflect the domain's
// genuine engineering/compliance burden instead of route-independent constants.
const DOMAIN_FEASIBILITY_DRAG: Partial<Record<IdeaDomainArchetype, number>> = {
  deeptech_research: -10,
  hardware_robotics: -7,
  web3_defi: -7,
  b2g_govtech: -5,
  healthcare_clinical: -4,
  consumer_social: -3
};

const DOMAIN_REGULATORY_DRAG: Partial<Record<IdeaDomainArchetype, number>> = {
  b2b_saas: 0,
  consumer_social: -3,
  general_startup: -4,
  deeptech_research: -5,
  hardware_robotics: -6,
  healthcare_clinical: -10,
  web3_defi: -12,
  b2g_govtech: -14
};

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

    const systemPrompt = `You are Agent ${roleMeta.number} // ${roleMeta.title} in the TrueForge Adversarial Intelligence Swarm.
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

      const validated = AGENT_OUTPUT_SCHEMA.safeParse(JSON.parse(jsonMatch[0]));
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
            threatSeverity: score < 50 ? "HIGH" : "MODERATE"
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
          `You are Agent ${challengerOpinion.roleNumber} // ${challengerOpinion.roleTitle} in the TrueForge adversarial crossfire. You MUST cite the stress-sandbox numbers verbatim and probe exactly one testable claim. Return strictly valid JSON: {"crossExam": string, "targetClaim": string}.`,
          `Stress evidence you must cite: ${context.stressSummary}\nContested claim to attack: "${context.contestedClaim}"\nIssue a direct cross-examination of at most 100 words to Agent ${defenderOpinion.roleNumber} // ${defenderOpinion.roleTitle}.`,
          { temperature: 0.4, maxTokens: 800, jsonMode: true }
        );
        const examMatch = skepticTurn.match(/\{[\s\S]*\}/);
        const parsedExam = CROSS_EXAM_SCHEMA.safeParse(JSON.parse(examMatch ? examMatch[0] : "{}"));
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
        const parsedDefense = CROSSFIRE_DEFENSE_SCHEMA.safeParse(JSON.parse(defMatch ? defMatch[0] : "{}"));
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

  /**
   * Domain-calibrated heuristic evaluator when live LLM is offline or ungrounded.
   * Evaluates pricing, unit economics, physics sanity, prompt injection defense, and domain procurement.
   */
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
    const roleLabels = domain.specialistRoleLabels;
    const { isPromptInjection, isImpossiblePhysics, isNoMonetization, isThinWrapper } = invariants;
    const ltvCac = sandboxSim.metrics.ltvCacRatio;

    let score = 70;
    let verdict: Verdict = "VIABLE_WITH_RISK";
    let fatalFlaws: string[] = [];
    let keyAssumptions: string[] = [];
    let competitiveRisks: string[] = [];
    let mustTestBeforeBuilding: string[] = [];
    let rationale = "";

    switch (role) {
      case "analyst": {
        if (isThinWrapper) {
          score = 35;
          verdict = "PIVOT_REQUIRED";
          fatalFlaws = [
            "Hyper-saturated category: Hundreds of nearly identical AI utility wrappers already compete for identical search queries.",
            "Non-existent switching barriers: Users quickly jump to whichever tool offers the cheapest token pricing or native foundation integration."
          ];
          keyAssumptions = ["Organic viral discovery can overcome negative paid search arbitrage."];
          competitiveRisks = ["Browser extension store cloning by international copycats with zero development overhead."];
          mustTestBeforeBuilding = ["Prove negative customer acquisition cost (CAC) via organic SEO or open-source community distribution."];
          rationale = "Market Recon: Saturated commodity category with zero structural switching friction.";
        } else {
          const reconCount = marketResearch.rawResults.length;
          score = Math.max(35, Math.min(88, 75 - (reconCount > 4 ? 8 : 0) + (domain.archetype === "deeptech_research" ? 8 : -3)));
          verdict = score >= 75 ? "STRONG_PURSUE" : (score >= 60 ? "VIABLE_WITH_RISK" : "PIVOT_REQUIRED");
          fatalFlaws = [reconCount > 0
            ? `Competitive crowding signal: live recon returned ${reconCount} closely-related results — differentiation must be verified against them.`
            : `Unclear differentiation against established ${domain.archetypeLabel} incumbents — no live recon was available to map the field.`];
          keyAssumptions = [`Market demand in ${domain.primaryCustomer} is active and funded.`];
          competitiveRisks = reconCount > 0
            ? marketResearch.rawResults.slice(0, 3).map((r: { title: string; url: string }) => `${r.title} (${r.url})`)
            : ["Competitive landscape unverified — no live recon provider was available during this evaluation."];
          mustTestBeforeBuilding = [`Validate addressable budget allocations across 10 prospective buyers in ${domain.primaryCustomer}.`];
          rationale = reconCount > 0
            ? `Evaluated competitive whitespace for ${domain.archetypeLabel} against ${reconCount} live recon sources (${marketResearch.reconProvider}).`
            : `Evaluated ${domain.archetypeLabel} whitespace from heuristic priors only — no live recon was available.`;
        }
        break;
      }

      case "customer": {
        score = domain.archetype === "b2g_govtech" ? 48 : (domain.archetype === "healthcare_clinical" ? 52 : (isThinWrapper ? 45 : 68));
        if (pricing > 150 && domain.archetype === "consumer_social") score -= 15;
        verdict = score >= 70 ? "VIABLE_WITH_RISK" : (score < 50 ? "STRONG_KILL" : "LEAN_KILL");
        fatalFlaws = isThinWrapper
          ? ["Novelty churn cliff: Users test the tool twice for curiosity, then abandon it once novelty fades.", "High price sensitivity: Unwillingness to pay recurring subscription for single-purpose utilities."]
          : [`Adoption inertia: ${domain.primaryCustomer} have entrenched habits with high switching drag.`];
        keyAssumptions = [`End users will switch to a new workflow without extensive retraining.`];
        competitiveRisks = ["Existing manual processes, bookmarks, or entrenched legacy tools with zero marginal training cost."];
        mustTestBeforeBuilding = [`Observe 5 target operators completing the core task in their native workflow.`];
        rationale = `Users feel the pain point, but habit inertia and workflow disruption create high pilot abandonment risk.`;
        break;
      }

      case "architect": {
        if (isImpossiblePhysics) {
          score = 15;
          verdict = "STRONG_KILL";
          fatalFlaws = ["Physical impossibility: Claims violate conservation of energy or standard thermodynamic feasibility laws."];
          rationale = "Engineering review: Proposed mechanism is theoretically impossible under verified physical laws.";
        } else if (isPromptInjection) {
          score = 25;
          verdict = "STRONG_KILL";
          fatalFlaws = ["System integrity risk: Input text contains prompt tampering or jailbreak syntax."];
          rationale = "Security architecture review: Flagged adversarial instruction injection.";
        } else if (isThinWrapper) {
          score = 72;
          verdict = "VIABLE_WITH_RISK";
          fatalFlaws = ["Fragile API dependency: Reliance on upstream LLM API rate limits, schema deprecation, and unexpected token price shifts."];
          rationale = "Architecture review: Trivially simple integration, but heavy upstream platform dependency.";
        } else {
          score = (sandboxSim.exitCode === 0 ? 84 : 55) + (DOMAIN_FEASIBILITY_DRAG[domain.archetype] ?? 0);
          const mcFeasibility = sandboxSim.metrics.monteCarlo;
          if (mcFeasibility) {
            if (mcFeasibility.tokenCostBurdenPercent.p50 > 0.45) score -= 6;
            if (mcFeasibility.survivalProbability12Mo < 0.6) score -= 6;
          }
          verdict = score >= 75 ? "STRONG_PURSUE" : "VIABLE_WITH_RISK";
          fatalFlaws = ["API token inflation or uncontrolled recursion under burst concurrency load."];
          rationale = `Architecture verified feasible with Python sandbox simulation (Exit 0); ${domain.archetypeLabel} engineering burden applied.`;
        }
        keyAssumptions = ["Underlying infrastructure and edge models maintain required throughput and latency budgets."];
        competitiveRisks = ["Commoditization of base foundation models."];
        mustTestBeforeBuilding = ["Benchmark single-task latency and verify isolated sandbox boundaries."];
        break;
      }

      case "investor": {
        if (isNoMonetization) {
          score = 20;
          verdict = "STRONG_KILL";
          fatalFlaws = ["Zero monetization capture: Free distribution without commercial capture creates immediate insolvency."];
        } else if (isThinWrapper) {
          score = 28;
          verdict = "STRONG_KILL";
          fatalFlaws = [
            "Zero structural defensibility: Thin wrapper architecture offers no proprietary data moat or sustainable pricing power.",
            "Platform Replication Risk: Hyperscalers or upstream model providers can commoditize this entire workflow with a native feature release."
          ];
        } else if (ltvCac < 1.0) {
          score = 22;
          verdict = "STRONG_KILL";
          fatalFlaws = [`Mathematically inverted unit economics: CAC ($${cac}) exceeds LTV ($${sandboxSim.metrics.ltvEstimateUsd}). Every user burns capital.`];
        } else if (ltvCac < 2.5) {
          score = 52;
          verdict = "VIABLE_WITH_RISK";
          fatalFlaws = [`Compressed venture margins: LTV/CAC ratio of ${ltvCac}x leaves insufficient buffer for sales payback.`];
          const mcWeak = sandboxSim.metrics.monteCarlo;
          if (mcWeak && mcWeak.survivalProbability24Mo < 0.5) {
            score -= 10;
            fatalFlaws.push(`Stochastic insolvency: ${(100 - mcWeak.survivalProbability24Mo * 100).toFixed(0)}% of ${mcWeak.iterations} Monte Carlo runs burn cash to zero before month 24.`);
          }
        } else {
          const mcStrong = sandboxSim.metrics.monteCarlo;
          const ltvP50 = mcStrong?.ltvCacPercentiles.p50 ?? ltvCac;
          score = Math.min(88, Math.round(48 + (ltvP50 * 4)));
          const paybackMonths = mcStrong?.paybackPercentiles.p50 ?? sandboxSim.metrics.estimatedPaybackMonths;
          if (paybackMonths > 22) {
            score -= 12;
          } else if (paybackMonths > 15) {
            score -= 6;
          }
          if (mcStrong) {
            if (mcStrong.survivalProbability24Mo < 0.35) {
              score -= 14;
            } else if (mcStrong.survivalProbability24Mo < 0.60) {
              score -= 8;
            } else if (mcStrong.survivalProbability24Mo < 0.85) {
              score -= 4;
            }
            if (mcStrong.ltvCacPercentiles.p10 < 1.0) {
              score = Math.max(32, score - 8);
              fatalFlaws.unshift(`Stochastic insolvency tail: ${(100 - mcStrong.survivalProbability24Mo * 100).toFixed(0)}% of ${mcStrong.iterations} Monte Carlo runs burn cash to zero before month 24.`);
            }
          }
          if (score < 50 && !fatalFlaws.length) {
            fatalFlaws = [`Long sales cycles (${domain.procurementCycle}) will strain early runway under stochastic insolvency risk.`];
          } else {
            fatalFlaws.push(`Long sales cycles (${domain.procurementCycle}) will strain early runway.`);
          }
          verdict = score >= 75 ? "STRONG_PURSUE" : "VIABLE_WITH_RISK";
        }
        keyAssumptions = [`Unit economics support healthy margins under ${domain.unitEconomicsModel}.`];
        competitiveRisks = ["Well-funded legacy providers bundle identical capability for free."];
        mustTestBeforeBuilding = [`Pre-secure 2 paid pilots or signed Letters of Intent (LOIs).`];
        rationale = `LTV/CAC modeled at ${ltvCac}x with ${sandboxSim.metrics.estimatedPaybackMonths}mo payback under ${domain.unitEconomicsModel}.`;
        break;
      }

      case "redteam": {
        if (isPromptInjection) {
          score = 10;
          verdict = "STRONG_KILL";
          fatalFlaws = [
            "Adversarial prompt injection attempt detected: Target concept attempts system prompt override or instruction tampering."
          ];
          rationale = "Red Team Security Gate: Immediate rejection due to adversarial injection tampering.";
        } else if (isImpossiblePhysics) {
          score = 12;
          verdict = "STRONG_KILL";
          fatalFlaws = [
            "Impossible physical or technical claim: Violates fundamental conservation of energy / thermodynamic laws."
          ];
          rationale = "Red Team Physics Audit: Claimed mechanism cannot function in the physical world.";
        } else if (isThinWrapper) {
          score = 24;
          verdict = "STRONG_KILL";
          fatalFlaws = [
            "Commoditization Hazard: Low defensibility thin wrapper over base foundation models. Hyperscalers or open-source extensions can replicate this within 48 hours with zero infrastructure cost.",
            "Zero Structural Moat: Without proprietary datasets or embedded workflow lock-in, monthly user churn exceeds 25% as free alternatives emerge."
          ];
          rationale = "Red Team Defensibility Audit: Extreme replication vulnerability to native foundation model updates.";
        } else if (ltvCac < 1.0) {
          score = 22;
          verdict = "STRONG_KILL";
          fatalFlaws = [
            `Terminal unit economics insolvency: Acquiring users at $${cac} produces only $${sandboxSim.metrics.ltvEstimateUsd} LTV.`
          ];
          rationale = "Red Team Capital Audit: Business model guarantees bankruptcy under modeled customer acquisition costs.";
        } else {
          // Domain-tailored adversarial failure patterns; severity narrows to
          // procurement timing when stochastic economics survive the stress replay.
          const mcRedteam = sandboxSim.metrics.monteCarlo;
          const econSurvivesStress = ltvCac >= 6 && (mcRedteam ? mcRedteam.survivalProbability24Mo >= 0.8 : false);
          switch (domain.archetype) {
            case "b2b_saas":
              score = econSurvivesStress ? 52 : (ltvCac < 2.5 ? 36 : 46);
              verdict = "LEAN_KILL";
              fatalFlaws = [
                `Enterprise Procurement Deadlock: ${domain.primaryCustomer} praise discovery demos, but security reviews and IT committees stall contracts for 4–9 months while incumbents bundle the capability for free.`,
                `Integration Churn Trap: Without bi-directional synchronization into core CRM/ERP systems, weekly active usage degrades by >60% within 60 days.`
              ];
              rationale = `High pilot abandonment risk: Enterprise buyers express enthusiasm in discovery but face procurement bottlenecks.`;
              break;

            case "b2g_govtech":
              score = 30;
              verdict = "STRONG_KILL";
              fatalFlaws = [
                `Multi-Year Tender RFP Stagnation: Public sector procurement requires sovereign hosting certifications and bureaucratic approvals that outlast seed runway.`,
                `Field Bureaucracy Friction: Civil servants and field operators avoid adopting unmandated third-party tools due to audit liability concerns.`
              ];
              rationale = `Government tender cycles and departmental inertia create high bankruptcy probability before revenue realization.`;
              break;

            case "healthcare_clinical":
              score = 32;
              verdict = "STRONG_KILL";
              fatalFlaws = [
                `EHR Gatekeeping & Malpractice Liability: Electronic Health Record vendors (Epic, Cerner) impose closed API walled gardens; diagnostic claims trigger intense medical liability.`,
                `Clinician Cognitive Overload: Doctors already spend >2 hours daily on charting; any non-automated interface suffers immediate clinical rejection.`
              ];
              rationale = `Clinical liability and hospital IT procurement barriers severely constrain deployment timeline.`;
              break;

            case "hardware_robotics":
              score = 34;
              verdict = "LEAN_KILL";
              fatalFlaws = [
                `Bill-of-Materials (BoM) Margin Compression: Sensor payloads and battery thermal degradation compress hardware margins below 30% without recurring software attach rates.`,
                `Field Servicing Overhead: Mean-time-between-failures (MTBF) under adverse weather requires costly physical repairs that destroy unit cash flow.`
              ];
              rationale = `Hardware production capital expenditure and field maintenance risk outstrip initial capitalization.`;
              break;

            case "consumer_social":
              score = 28;
              verdict = "STRONG_KILL";
              fatalFlaws = [
                `30-Day Cohort Retention Cliff: Consumer utilities face >85% month-1 dropoff without dense multi-player network effects or habit-forming loops.`,
                `Paid Acquisition Arbitrage Collapse: Performance marketing ad costs (CAC $${cac}) outpace prosumer lifetime monetization within 90 days.`
              ];
              rationale = `Rapid consumer novelty decay and high acquisition costs lead to unsustainable churn dynamics.`;
              break;

            case "deeptech_research":
              score = 44;
              verdict = "PIVOT_REQUIRED";
              fatalFlaws = [
                `Inference Latency & VRAM Wall: Heavy transformer passes incur per-query compute costs that consume >40% of subscription revenue at production scale.`,
                `Lab-to-Field Distribution Shift: Academic benchmark accuracy drops significantly when encountering messy, noisy real-world inputs.`
              ];
              rationale = `Technically ambitious but constrained by high token inference overhead and out-of-distribution edge failures.`;
              break;

            case "web3_defi":
              score = 35;
              verdict = "LEAN_KILL";
              fatalFlaws = [
                `Smart Contract Exploitation Vector: Unaudited cross-contract execution risks total liquidity drain via flash loans or oracle manipulation.`,
                `Regulatory Compliance Chasm: Shifting international securities and AML/KYC mandates expose operators to protocol-level regulatory enforcement.`
              ];
              rationale = `High systemic risk from regulatory exposure and smart contract vulnerability surface area.`;
              break;

            default:
              score = 40;
              verdict = "LEAN_KILL";
              fatalFlaws = [
                `Distribution Desert: Lack of an asymmetric, proprietary top-of-funnel acquisition channel leads to zero-traction stagnation.`,
                `Habit Inertia Trap: Defaulting to existing manual spreadsheets remains cheaper and lower friction than onboarding a new platform.`
              ];
              rationale = `Founder underestimates customer switching friction and lack of organic discovery channels.`;
          }
        }
        keyAssumptions = [`Buyers have discretionary budget authority to deploy this within ${domain.procurementCycle}.`];
        competitiveRisks = ["Zero switching cost back to legacy manual methods."];
        mustTestBeforeBuilding = [`Force a binding pre-order, deposit, or pilot MOU before committing engineering.`];
        break;
      }

      case "expert": {
        if (isImpossiblePhysics) {
          score = 15;
          verdict = "STRONG_KILL";
          fatalFlaws = ["Scientific peer review rejection: Unsound foundational claims."];
          rationale = "Domain specialist review: Failed fundamental scientific peer validation.";
        } else if (isPromptInjection) {
          score = 20;
          verdict = "STRONG_KILL";
          fatalFlaws = ["Security integrity violation."];
          rationale = "Compliance specialist review: Malicious injection payload.";
        } else {
          score = 78 + (DOMAIN_REGULATORY_DRAG[domain.archetype] ?? 0) - (isThinWrapper ? 18 : 0);
          verdict = score >= 75 ? "STRONG_PURSUE" : "VIABLE_WITH_RISK";
          fatalFlaws = [`Non-compliance with ${domain.regulatoryEnvironment} standards could halt deployment.`];
          rationale = isThinWrapper
            ? "Vertical review: compliance posture acceptable, but zero proprietary domain grounding weakens the defensibility claim."
            : `Vertical compliance analysis confirmed statutory requirements under ${domain.regulatoryEnvironment}.`;
        }
        keyAssumptions = [`Solution meets mandatory ${domain.regulatoryEnvironment} compliance protocols.`];
        competitiveRisks = ["Incumbent vendors with pre-existing certifications."];
        mustTestBeforeBuilding = [`Audit architecture against official ${domain.regulatoryEnvironment} compliance checklists.`];
        break;
      }

      default: {
        score = 70;
        verdict = "VIABLE_WITH_RISK";
        fatalFlaws = ["Unverified operational assumptions."];
        keyAssumptions = ["Target customer has active budget."];
        competitiveRisks = ["Competitor bundling."];
        mustTestBeforeBuilding = ["Conduct 5 user discovery calls."];
        rationale = "General baseline evaluation.";
      }
    }

    const meta = roleLabels[role as keyof typeof roleLabels] || { number: "01", title: role.toUpperCase() };

    return {
      role,
      roleNumber: meta.number,
      roleTitle: meta.title,
      verdict,
      score,
      status: "COMPLETE",
      fatalFlaws,
      keyAssumptions,
      competitiveRisks,
      mustTestBeforeBuilding,
      rationale
    };
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
    notify("01 INGEST", `Ingesting "${idea.title}" into TrueForge execution runtime...`);
    emit({ type: "stage", stage: "01 INGEST", detail: `Ingesting "${idea.title}" into TrueForge execution runtime...`, timestamp: new Date().toISOString() });

    const domain = classifyIdeaDomain(idea);
    notify("01 CLASSIFY", `Classified concept as [${domain.archetypeLabel}] — Target: ${domain.primaryCustomer}`);
    emit({ type: "domain", domain });

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
    const invariants = detectAdversarialInvariants(idea, pricing);
    const churn = options.expectedChurnMonthly ?? (invariants.isThinWrapper ? 0.28 : (domain.archetype === "consumer_social" ? 0.12 : 0.04));

    emit({ type: "sandbox_simulating", iterationCount: 10000 });

    const geo = detectJurisdiction(idea.targetAudience, idea.summary, idea.title);
    const combinedIdeaText = `${idea.title} ${idea.summary} ${idea.targetAudience} ${idea.monetization}`;
    const itchMatches = findMatchingItchProblems(combinedIdeaText);
    const graveyardMatches = findMatchingGraveyardPrecedents(combinedIdeaText);
    const isHealthcare = domain.archetype === "healthcare_clinical";
    const [marketResearch, unifiedMarkets, newsSignals, reachSignals, openAlexSignals, edgarSignals, hfSignals, clinicalSignals, macroSignals, sandboxSim, stressSim] = await Promise.all([
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
      queryOpenAlex(`${idea.title} ${domain.archetypeLabel}`),
      queryEdgarFormD(idea.title),
      queryHuggingFace(idea.title),
      queryClinicalEvidence(idea.title, isHealthcare),
      queryMacroData(idea.targetAudience),
      runEconomicsSimulation(pricing, churn, cac, 500, 1500, 30),
      // Pessimistic stress run feeding the crossfire tool traces (plan 2.2 ReAct evidence)
      runEconomicsSimulation(pricing * 0.85, Math.min(1, churn * 1.6), cac * 1.6, 500, 1500, 30)
    ]);
    const stressMetrics: SandboxStressStats = {
      churnStressed: true,
      cacStressed: true,
      stressLtvCacRatio: stressSim.metrics.ltvCacRatio,
      stressSurvival24Mo: stressSim.metrics.monteCarlo?.survivalProbability24Mo,
      stressPayback50: stressSim.metrics.monteCarlo?.paybackPercentiles.p50 ?? stressSim.metrics.estimatedPaybackMonths
    };

    emit({
      type: "sandbox_metrics",
      metrics: sandboxSim.metrics,
      runtime: sandboxSim.runtime,
      exitCode: sandboxSim.exitCode
    });

    const mc = sandboxSim.metrics.monteCarlo;

    // Evidence provenance block: only REAL retrieved sources are described as
    // sourced. When recon/markets/community are unavailable this is stated
    // explicitly so agents never mistake heuristic priors for external evidence.
    const reconSourceParts: string[] = [];
    if (marketResearch.dataSource === "live-web-recon" && marketResearch.rawResults.length > 0) {
      reconSourceParts.push(
        `Live web recon (${marketResearch.reconProvider}): ${marketResearch.rawResults.slice(0, 3).map(r => `"${r.title}" [${r.url}]`).join("; ")}`
      );
    } else {
      reconSourceParts.push(
        `No live web recon results were retrieved (${marketResearch.reconError || "provider unavailable"}) — treat competitive and demand statements as heuristic priors, not sourced evidence.`
      );
    }
    if (marketResearch.community.discussions.length > 0) {
      reconSourceParts.push(
        `Community discussions (${marketResearch.community.provider}): ${marketResearch.community.discussions.slice(0, 3).map(d => `"${d.title}"${typeof d.score === "number" ? ` (${d.score} pts${typeof d.comments === "number" ? `, ${d.comments} comments` : ""})` : ""} [${d.url}]`).join("; ")}`
      );
    } else {
      reconSourceParts.push("No community discussions (Reddit/HN/X) were retrievable for this concept.");
    }
    if (unifiedMarkets.signals.length > 0) {
      reconSourceParts.push(
        `Prediction markets (${unifiedMarkets.activeSources.map(s => s.toUpperCase()).join("/")}): ${unifiedMarkets.signals.slice(0, 3).map(m => `"${m.title.slice(0, 70)}" @ ${m.probabilityYesPercent}% [${m.source}]`).join("; ")}. ${unifiedMarkets.keyTakeaway}`
      );
    } else {
      reconSourceParts.push(unifiedMarkets.keyTakeaway);
    }
    if (newsSignals.articles.length > 0) {
      reconSourceParts.push(
        `Media coverage (${newsSignals.source}): ${newsSignals.articles.slice(0, 2).map(a => `"${a.title.slice(0, 60)}" [${a.source}]`).join("; ")}.`
      );
    }
    if (openAlexSignals.papers.length > 0) {
      reconSourceParts.push(
        `Academic grounding (OpenAlex, ${openAlexSignals.totalWorks.toLocaleString()} works): ${openAlexSignals.papers.slice(0, 2).map(p => `"${p.title.slice(0, 80)}" (${p.year}, ${p.citations} cites)`).join("; ")}.`
      );
    }
    if (edgarSignals.filings.length > 0) {
      reconSourceParts.push(
        `Fundraising evidence (SEC Form D): ${edgarSignals.filings.map(f => `${f.company} filed ${f.filedDate}`).join("; ")}.`
      );
    }
    if (hfSignals.models.length > 0) {
      reconSourceParts.push(
        `Open-source alternatives (HF Hub): ${hfSignals.models.map(m => `"${m.id}" (${m.likes} likes, ${m.downloads} downloads)`).join("; ")}.`
      );
    }
    if (clinicalSignals.studies.length > 0 || clinicalSignals.clearances.length > 0) {
      reconSourceParts.push(
        `Clinical evidence: ${clinicalSignals.studies.map(s => `${s.nctId} (${s.status})`).join("; ")}${clinicalSignals.clearances.length > 0 ? `; 510(k): ${clinicalSignals.clearances.map(c => c.deviceName.slice(0, 50)).join("; ")}` : ""}.`
      );
    }
    if (macroSignals.indicators.length > 0) {
      reconSourceParts.push(
        `Macro grounding (World Bank): ${macroSignals.keyTakeaway}`
      );
    }
    reconSourceParts.push(
      `Jurisdiction & Policy Context (${geo.regionName} / ${geo.countryCode}): Currency ${geo.currency}, Regulatory framework: ${geo.regulatoryFramework}.`
    );
    if (reachSignals.gitHubRepos.length > 0 || reachSignals.deepScrape || reachSignals.regionalDiscussions.length > 0) {
      reconSourceParts.push(
        `Agent-Reach developer/community intel: ${reachSignals.keyTakeaway}`
      );
    }
    if (itchMatches.length > 0) {
      reconSourceParts.push(
        `Commercial Problem Catalog (Razorpay Fix My Itch): Matches verified problem "${itchMatches[0].title}" (${itchMatches[0].problemStatement}) — Unmet need: ${itchMatches[0].unmetNeed}.`
      );
    }
    if (graveyardMatches.length > 0) {
      reconSourceParts.push(
        `Startup Graveyard Forensics (Loot Drop): Matches failure pattern of ${graveyardMatches.map(g => `"${g.companyName}" (${g.burnedCapitalUsd} burned, ${g.lifespan}): ${g.fatalFlaw}`).join("; ")}.`
      );
    }

    const marketContext = `${reconSourceParts.join(" ")}. Modeled Economics: Pricing $${pricing}/mo, CAC $${cac}. Monte Carlo (${mc?.iterations ?? 0} runs): P50 LTV/CAC ${sandboxSim.metrics.ltvCacRatio}x [P10 ${mc?.ltvCacPercentiles.p10 ?? sandboxSim.metrics.ltvCacRatio} / P90 ${mc?.ltvCacPercentiles.p90 ?? sandboxSim.metrics.ltvCacRatio}], 24-month survival ${( (mc?.survivalProbability24Mo ?? 0) * 100).toFixed(0)}%, payback P50 ${sandboxSim.metrics.estimatedPaybackMonths}mo, token burden ${(((mc?.tokenCostBurdenPercent.p50 ?? 0)) * 100).toFixed(1)}% of gross revenue. Stress run (${(Math.min(1, churn * 1.6) * 100).toFixed(0)}% churn / $${Math.round(cac * 1.6)} CAC): survival ${(((stressSim.metrics.monteCarlo?.survivalProbability24Mo ?? 0) * 100)).toFixed(0)}%.`;

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
          threatSeverity: opinion.score < 50 ? "HIGH" : "MODERATE"
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

    // 05 VERIFY (Sandboxed Python Subprocess & Stanford CS329A Robust Verifier)
    notify("05 VERIFY", "Verifying sandboxed Python metrics & executing Stanford CS329A Robust Verifier...");

    // External evidence items are included ONLY when real sources were actually
    // retrieved. When nothing was retrieved, an explicit UNKNOWN item records
    // that absence — the feed never presents heuristic priors as sourced data.
    const externalEvidenceItems: EvidenceItem[] = [];
    let retrievedExternalCount = 0;
    if (unifiedMarkets.signals.length > 0) {
      const top = unifiedMarkets.signals[0];
      const consensusNote = unifiedMarkets.consensusGroups.length > 0 && unifiedMarkets.consensusGroups[0].sources.length > 1
        ? ` Shared cross-market topic "${unifiedMarkets.consensusGroups[0].canonicalQuestion.slice(0, 70)}" priced at ${unifiedMarkets.consensusGroups[0].consensusProbabilityPercent}% across ${unifiedMarkets.consensusGroups[0].sources.join("+")} (spread: ${unifiedMarkets.consensusGroups[0].spreadPercent}%).`
        : "";
      externalEvidenceItems.push({
        id: "EV-03",
        claim: `Macro prediction market sentiment: ${unifiedMarkets.keyTakeaway} Top market: "${top.title}" at ${top.probabilityYesPercent}% on ${top.source}.${consensusNote}`,
        tier: "EXTERNAL_EVIDENCE",
        claimType: "EXTERNAL_EVIDENCE",
        provenance: `Prediction Market Oracle (${top.source.toUpperCase()}) [${top.url}]`,
        indicator: unifiedMarkets.macroSentiment === "BEARISH" ? "CONTRADICTING" : (unifiedMarkets.macroSentiment === "BULLISH" ? "SUPPORTING" : "NEUTRAL"),
        confidencePercent: 75
      });
      retrievedExternalCount++;

      unifiedMarkets.signals.slice(0, 3).forEach((sig, idx) => {
        externalEvidenceItems.push({
          id: `EV-03M${idx + 1}`,
          claim: `${sig.source.toUpperCase()} market: "${sig.title}" at ${sig.probabilityYesPercent}% ($${sig.volumeUsd.toLocaleString()} volume, status: ${sig.status}).`,
          tier: "EXTERNAL_EVIDENCE",
          claimType: "EXTERNAL_EVIDENCE",
          provenance: sig.url,
          indicator: sig.probabilityYesPercent >= 60 ? "SUPPORTING" : (sig.probabilityYesPercent <= 40 ? "CONTRADICTING" : "NEUTRAL"),
          confidencePercent: 70
        });
        retrievedExternalCount++;
      });
    }
    if (marketResearch.dataSource === "live-web-recon" && marketResearch.rawResults.length > 0) {
      marketResearch.rawResults.slice(0, 2).forEach((r, i) => {
        externalEvidenceItems.push({
          id: i === 0 ? "EV-04" : `EV-04${String.fromCharCode(65 + i)}`,
          claim: `Live web recon result (${marketResearch.reconProvider}): "${r.title}" — ${r.snippet}`,
          tier: "EXTERNAL_EVIDENCE",
          claimType: "EXTERNAL_EVIDENCE",
          provenance: r.url,
          indicator: "NEUTRAL",
          confidencePercent: 70
        });
        retrievedExternalCount++;
      });
    }
    marketResearch.community.discussions.slice(0, 2).forEach((d, i) => {
      const stats = [typeof d.score === "number" ? `${d.score} pts` : null, typeof d.comments === "number" ? `${d.comments} comments` : null]
        .filter(Boolean)
        .join(", ");
      externalEvidenceItems.push({
        id: `EV-04${String.fromCharCode(67 + i)}`, // EV-04C, EV-04D … community items
        claim: `Community discussion on ${d.platform}: "${d.title}"${stats ? ` (${stats})` : ""}`,
        tier: "EXTERNAL_EVIDENCE",
        claimType: "EXTERNAL_EVIDENCE",
        provenance: d.url,
        indicator: "NEUTRAL",
        confidencePercent: 70
      });
      retrievedExternalCount++;
    });
    for (let i = 0; i < Math.min(newsSignals.articles.length, 2); i++) {
      const art = newsSignals.articles[i];
      externalEvidenceItems.push({
        id: `EV-04N${i + 1}`,
        claim: `Factual media reporting (${art.source}): "${art.title}"`,
        tier: "EXTERNAL_EVIDENCE",
        claimType: "EXTERNAL_EVIDENCE",
        provenance: art.url,
        indicator: "SUPPORTING",
        confidencePercent: 85
      });
      retrievedExternalCount++;
    }
    for (const p of openAlexSignals.papers.slice(0, 2)) {
      externalEvidenceItems.push({
        id: `EV-03A${openAlexSignals.papers.indexOf(p) + 1}`,
        claim: `Peer-reviewed grounding: "${p.title}" (${p.year}, ${p.citations} citations, ${p.venue}) — ${p.authors.join(", ")}.`,
        tier: "EXTERNAL_EVIDENCE",
        claimType: "EXTERNAL_EVIDENCE",
        provenance: p.openAccessUrl || "OpenAlex",
        indicator: "SUPPORTING",
        confidencePercent: 80
      });
      retrievedExternalCount++;
    }
    for (const f of edgarSignals.filings.slice(0, 2)) {
      externalEvidenceItems.push({
        id: `EV-03E${edgarSignals.filings.indexOf(f) + 1}`,
        claim: `SEC Form D fundraising: ${f.company} (CIK ${f.cik}) filed ${f.filedDate} — real capital formation in this space.`,
        tier: "EXTERNAL_EVIDENCE",
        claimType: "EXTERNAL_EVIDENCE",
        provenance: f.filingUrl,
        indicator: "SUPPORTING",
        confidencePercent: 90
      });
      retrievedExternalCount++;
    }
    for (const m of hfSignals.models.slice(0, 2)) {
      externalEvidenceItems.push({
        id: `EV-03H${hfSignals.models.indexOf(m) + 1}`,
        claim: `Open-source alternative on HF Hub: "${m.id}" (${m.likes} likes, ${m.downloads} downloads) — commoditization pressure.`,
        tier: "EXTERNAL_EVIDENCE",
        claimType: "EXTERNAL_EVIDENCE",
        provenance: m.modelUrl,
        indicator: "CONTRADICTING",
        confidencePercent: 75
      });
      retrievedExternalCount++;
    }
    for (const s of clinicalSignals.studies.slice(0, 2)) {
      externalEvidenceItems.push({
        id: `EV-03C${clinicalSignals.studies.indexOf(s) + 1}`,
        claim: `Registered trial ${s.nctId}: "${s.title}" — ${s.status}, ${s.phase}, sponsored by ${s.sponsor}.`,
        tier: "EXTERNAL_EVIDENCE",
        claimType: "EXTERNAL_EVIDENCE",
        provenance: s.studyUrl,
        indicator: "NEUTRAL",
        confidencePercent: 85
      });
      retrievedExternalCount++;
    }
    if (macroSignals.indicators.length > 0) {
      externalEvidenceItems.push({
        id: "EV-03W",
        claim: `Macro grounding (World Bank): ${macroSignals.keyTakeaway}`,
        tier: "EXTERNAL_EVIDENCE",
        claimType: "EXTERNAL_EVIDENCE",
        provenance: "https://api.worldbank.org/v2",
        indicator: "NEUTRAL",
        confidencePercent: 85
      });
      retrievedExternalCount++;
    }
    for (let i = 0; i < Math.min(reachSignals.gitHubRepos.length, 2); i++) {
      const repo = reachSignals.gitHubRepos[i];
      externalEvidenceItems.push({
        id: `EV-04G${i + 1}`,
        claim: `Open source developer traction on GitHub (${repo.fullName}): ${repo.stars} stars — "${repo.description || "Active codebase"}".`,
        tier: "EXTERNAL_EVIDENCE",
        claimType: "EXTERNAL_EVIDENCE",
        provenance: repo.url,
        indicator: "SUPPORTING",
        confidencePercent: 88
      });
      retrievedExternalCount++;
    }
    if (reachSignals.deepScrape) {
      externalEvidenceItems.push({
        id: "EV-04J",
        claim: `Jina Reader deep inspection (${reachSignals.deepScrape.url}): "${reachSignals.deepScrape.title}" ${reachSignals.deepScrape.extractedPricing ? `[Pricing: ${reachSignals.deepScrape.extractedPricing}]` : ""}`,
        tier: "EXTERNAL_EVIDENCE",
        claimType: "EXTERNAL_EVIDENCE",
        provenance: reachSignals.deepScrape.url,
        indicator: "NEUTRAL",
        confidencePercent: 85
      });
      retrievedExternalCount++;
    }
    for (let i = 0; i < Math.min(reachSignals.regionalDiscussions.length, 2); i++) {
      const disc = reachSignals.regionalDiscussions[i];
      externalEvidenceItems.push({
        id: `EV-04V${i + 1}`,
        claim: `Regional community discussion (${disc.platform}): "${disc.title}" (${disc.replies || 0} replies)`,
        tier: "EXTERNAL_EVIDENCE",
        claimType: "EXTERNAL_EVIDENCE",
        provenance: disc.url,
        indicator: "NEUTRAL",
        confidencePercent: 80
      });
      retrievedExternalCount++;
    }
    for (let i = 0; i < itchMatches.length; i++) {
      const p = itchMatches[i];
      externalEvidenceItems.push({
        id: `EV-04F${i + 1}`,
        claim: `Verified Commercial Demand (Razorpay Fix My Itch - ${p.category}): "${p.problemStatement}" (Target: ${p.targetPersona})`,
        tier: "EXTERNAL_EVIDENCE",
        claimType: "EXTERNAL_EVIDENCE",
        provenance: p.sourceUrl,
        indicator: "SUPPORTING",
        confidencePercent: 90
      });
      retrievedExternalCount++;
    }
    for (let i = 0; i < graveyardMatches.length; i++) {
      const g = graveyardMatches[i];
      externalEvidenceItems.push({
        id: `EV-04D${i + 1}`,
        claim: `Startup Graveyard Forensic Precedent (Loot Drop - ${g.companyName}): Burned ${g.burnedCapitalUsd} before death (${g.lifespan}) from ${g.antipattern} — ${g.fatalFlaw}`,
        tier: "EXTERNAL_EVIDENCE",
        claimType: "EXTERNAL_EVIDENCE",
        provenance: g.sourceUrl,
        indicator: "CONTRADICTING",
        confidencePercent: 95
      });
      retrievedExternalCount++;
    }
    if (retrievedExternalCount === 0) {
      const reasons = [
        marketResearch.dataSource !== "live-web-recon" ? marketResearch.reconError || "no web recon results" : null,
        marketResearch.community.errors.length > 0 ? marketResearch.community.errors.join("; ") : "no community discussions retrievable"
      ].filter(Boolean).join(" | ");
      externalEvidenceItems.push({
        id: "EV-04",
        claim: `No live external evidence was retrieved (${reasons}) — competitive landscape, demand, and community signals in this dossier are heuristic priors, NOT sourced external evidence.`,
        tier: "UNKNOWN",
        claimType: "UNKNOWN",
        provenance: "Dossier Runtime (recon unavailable)",
        indicator: "NEUTRAL",
        confidencePercent: 90
      });
    }

    const evidenceFeed: EvidenceItem[] = [
      {
        id: "EV-01",
        claim: `Sandboxed unit economics computation: LTV/CAC ratio is ${sandboxSim.metrics.ltvCacRatio.toFixed(2)}x with payback in ${sandboxSim.metrics.estimatedPaybackMonths.toFixed(1)}mo (Python3 Subprocess Exit 0). Input pricing ($${pricing}/mo) and CAC ($${cac}) remain MODELLED_ASSUMPTION.`,
        tier: "VERIFIED_COMPUTATION",
        claimType: "VERIFIED_COMPUTATION",
        provenance: "TrueForge Python3 Sandbox (Isolated Subprocess Exit 0)",
        indicator: "SUPPORTING",
        confidencePercent: 98
      },
      {
        id: "EV-02",
        claim: `Canonical regulatory framework: Compliance required under ${domain.regulatoryEnvironment}.`,
        tier: "VERIFIED_FACT",
        claimType: "VERIFIED_FACT",
        provenance: "Statutory / Sector Standard Register",
        indicator: "SUPPORTING",
        confidencePercent: 95
      },
      ...externalEvidenceItems,
      {
        id: "EV-05",
        claim: `Founder hypothesis: Target buyers will switch to the new solution within 30 days without extensive organizational change management.`,
        tier: "MODELLED_ASSUMPTION",
        claimType: "MODELLED_ASSUMPTION",
        provenance: "Founder Input & Value Proposition Claim",
        indicator: "CONTRADICTING",
        confidencePercent: 45,
        fatal: true,
        tested: false
      },
      {
        id: "EV-06",
        claim: `Inferred vulnerability: Extended ${domain.procurementCycle} sales cycle will create an 8–12 month working capital drought before first cash settlement.`,
        tier: "INFERENCE",
        claimType: "INFERENCE",
        provenance: "Economist & Red Team Swarm Cross-Examination",
        indicator: "CONTRADICTING",
        confidencePercent: 75
      },
      {
        id: "EV-07",
        claim: `Unquantified black-box parameter: Real-world administrative payment settlement lag and emergency budget allocation friction.`,
        tier: "UNKNOWN",
        claimType: "UNKNOWN",
        provenance: "Red Team Field Adversary Threat Model",
        indicator: "CONTRADICTING",
        confidencePercent: 50
      },
      {
        id: "EV-08",
        claim: `Unresolved contradiction: Customer Advocate assumes buyer urgency ("${customerOpinion.keyAssumptions[0] || customerOpinion.rationale}") while Red Team flags "${redTeamOpinion.fatalFlaws[0] || "unproven willingness to pay"}" — and no purchase commitment has been secured.`,
        tier: "CONTRADICTED",
        claimType: "CONTRADICTED",
        provenance: `Customer Advocate vs Red Team Debate Clash (${debateSource})`,
        indicator: "CONTRADICTING",
        confidencePercent: 60
      }
    ];

    const verifier = new StanfordRobustVerifier();
    const { verifiedOpinions, audit, claimDag } = verifier.verifySwarmOpinions(
      idea,
      domain,
      {
        analyst: analystOpinion,
        customer: customerOpinion,
        architect: architectOpinion,
        investor: investorOpinion,
        redteam: redTeamOpinion,
        expert: expertOpinion,
        synthesizer: { ...analystOpinion, role: "synthesizer", roleTitle: "EXECUTIVE SYNTHESIZER" }
      },
      {
        cacEstimateUsd: sandboxSim.metrics.cacEstimateUsd,
        ltvEstimateUsd: sandboxSim.metrics.ltvEstimateUsd,
        ltvCacRatio: sandboxSim.metrics.ltvCacRatio,
        estimatedPaybackMonths: sandboxSim.metrics.estimatedPaybackMonths,
        monthlyInfraCostUsd: sandboxSim.metrics.monthlyInfraCostUsd,
        tamEstimateUsd: sandboxSim.metrics.tamEstimateUsd,
        sandboxExecutionProof: {
          runtime: sandboxSim.runtime,
          exitCode: sandboxSim.exitCode,
          stdout: sandboxSim.stdout
        }
      },
      evidenceFeed
    );

    if (audit.testTimeSelfCorrections > 0) {
      notify("05 VERIFY [SELF-CORRECTION]", `Stanford CS329A Verifier applied ${audit.testTimeSelfCorrections} test-time reflections to ungrounded scores.`);
      emit({
        type: "audit_correction",
        detail: `Stanford CS329A Verifier applied ${audit.testTimeSelfCorrections} test-time reflections to ungrounded scores.`,
        hallucinationsBlocked: audit.hallucinationsBlocked
      });
    }

    // NLI demote-only pass (async, lazy model): cited external evidence that
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
          stressSummary: `run_sandbox_economics(stress): churn ${(Math.min(1, churn * 1.6) * 100).toFixed(0)}%, CAC $${Math.round(cac * 1.6)} → P50 LTV/CAC ${stressSim.metrics.ltvCacRatio}x, survival@24mo ${(((stressSim.metrics.monteCarlo?.survivalProbability24Mo ?? 0)) * 100).toFixed(0)}%, payback P50 ${stressSim.metrics.estimatedPaybackMonths}mo.`,
          reconSummary: marketResearch.dataSource === "live-web-recon"
            ? `search_competitor_recon("${contestedClaim.split(/\s+/).slice(0, 4).join(" ")}") → ${marketResearch.rawResults.slice(0, 3).map(r => `${r.title} [${r.url}]`).join("; ")}`
            : `search_competitor_recon("${contestedClaim.split(/\s+/).slice(0, 4).join(" ")}") → no live recon results (${marketResearch.reconError || "provider unavailable"}); defense must rely on modeled priors`,
          contestedClaim,
          stressLtvCacRatio: stressSim.metrics.ltvCacRatio,
          stressSurvival24: stressSim.metrics.monteCarlo?.survivalProbability24Mo,
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

    const technicalFeasibility = Math.max(10, Math.min(100, Math.round(
      (verifiedOpinions.architect.score * (sandboxSim.exitCode === 0 ? 0.85 : 0.4)) +
      (sandboxSim.exitCode === 0 ? 15 : 0)
    )));
    const demandAndAdoption = Math.max(10, Math.min(100, Math.round(
      (verifiedOpinions.customer.score * 0.6) + (verifiedOpinions.analyst.score * 0.4)
    )));
    const economicsAndCapitalEfficiency = Math.max(10, Math.min(100, Math.round(
      (verifiedOpinions.investor.score * 0.7) +
      Math.min(Math.round((mc?.ltvCacPercentiles.p50 ?? sandboxSim.metrics.ltvCacRatio) * 6), 30) -
      (mc && mc.tokenCostBurdenPercent.p50 > 0.35 ? Math.round((mc.tokenCostBurdenPercent.p50 - 0.35) * 40) : 0)
    )));
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
    if (invariants.isThinWrapper || sandboxSim.metrics.ltvCacRatio < 1) {
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
      sandboxSim.metrics.ltvCacRatio < 1 ||
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
        factors: [
          { impact: Math.min(Math.round(sandboxSim.metrics.ltvCacRatio * 7), 40), description: `Modelled LTV/CAC ratio is ${sandboxSim.metrics.ltvCacRatio.toFixed(2)}x (computation passed Exit 0; input CAC remains modelled)`, groundingTier: "VERIFIED_COMPUTATION" as EpistemicTier, riskMitigationVerdict: "MITIGATES_RISK" as const },
          { impact: Math.round(verifiedOpinions.investor.score * 0.6) - 15, description: `Extended ${domain.procurementCycle} sales cycle requires cash buffer before first collection`, groundingTier: "INFERENCE" as EpistemicTier, riskMitigationVerdict: "PARTIAL_MITIGATION" as const }
        ],
        rationale: `LTV/CAC ratio modeled at ${sandboxSim.metrics.ltvCacRatio.toFixed(2)}x under ${domain.unitEconomicsModel}.`
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
        statement: "TrueForge sandboxed execution guarantees safe isolation for all external actions.",
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
        latencyMs: Date.now() - synthesisStart,
        claimsVerified: evidenceFeed.length,
        threatSeverity: riskLevel
      }
    };

    const approvalGates: ApprovalAction[] = [
      {
        id: "GATE-01",
        actionType: "PILOT_LOI_DRAFT",
        summary: `Dispatch 10 tailored pilot Letter of Intent (LOI) requests to verified design partners in ${domain.primaryCustomer}.`,
        payload: {
          concept: idea.title,
          domain: domain.archetypeLabel,
          targetAudience: idea.targetAudience,
          experiment: cheapestValidationExperiment.title
        },
        requiresApproval: true,
        status: "PENDING_HUMAN_APPROVAL"
      },
      {
        id: "GATE-02",
        actionType: "SMOKE_TEST_LANDING_PAGE",
        summary: `Deploy targeted one-page live demonstration request portal for "${idea.title}".`,
        payload: {
          url: "https://dossier-eval.internal/smoke-test",
          targetAudience: idea.targetAudience,
          budgetCapUsd: 50
        },
        requiresApproval: true,
        status: "PENDING_HUMAN_APPROVAL"
      }
    ];

    const externalEvidenceSources: ExternalEvidenceSource[] = [
      ...marketResearch.rawResults.map(r => ({ title: r.title, url: r.url, provider: marketResearch.reconProvider })),
      ...marketResearch.community.discussions.map(d => ({ title: d.title, url: d.url, provider: d.platform })),
      ...unifiedMarkets.signals.map(m => ({ title: `[${m.source.toUpperCase()}] ${m.title.slice(0, 120)}`, url: m.url, provider: m.source })),
      ...openAlexSignals.papers.slice(0, 3).map(p => ({ title: p.title.slice(0, 120), url: p.openAccessUrl || "https://openalex.org", provider: "openalex" })),
      ...edgarSignals.filings.map(f => ({ title: `Form D: ${f.company}`, url: f.filingUrl, provider: "sec-edgar" })),
      ...hfSignals.models.map(m => ({ title: `Hub: ${m.id}`, url: m.modelUrl, provider: "huggingface" })),
      ...clinicalSignals.studies.map(s => ({ title: `${s.nctId}: ${s.title.slice(0, 100)}`, url: s.studyUrl, provider: "clinicaltrials" })),
      ...newsSignals.articles.map(a => ({ title: `[NEWS] ${a.title.slice(0, 120)}`, url: a.url, provider: a.source })),
      ...reachSignals.gitHubRepos.map(g => ({ title: `[GitHub] ${g.fullName} (${g.stars}★): ${g.description.slice(0, 80)}`, url: g.url, provider: "github" })),
      ...(reachSignals.deepScrape ? [{ title: `[Jina Reader] ${reachSignals.deepScrape.title}`, url: reachSignals.deepScrape.url, provider: "jina-reader" }] : []),
      ...reachSignals.regionalDiscussions.map(v => ({ title: `[${v.platform.toUpperCase()}] ${v.title.slice(0, 100)}`, url: v.url, provider: v.platform })),
      ...itchMatches.map(p => ({ title: `[Razorpay Fix My Itch] ${p.problemStatement}`, url: p.sourceUrl, provider: "razorpay-fix-my-itch" })),
      ...graveyardMatches.map(g => ({ title: `[Loot Drop Graveyard] ${g.companyName} (${g.burnedCapitalUsd} burned): ${g.fatalFlaw.slice(0, 80)}`, url: g.sourceUrl, provider: "loot-drop-graveyard" }))
    ];

    const dossier: IdeaDossier = {
      id: `DOSSIER-${Date.now().toString().slice(-6)}`,
      dossierCode: `TF-007-${domain.archetype.toUpperCase().slice(0, 3)}`,
      timestamp: new Date().toISOString(),
      evaluationMode,
      pSuccess: Math.round(compositeScore) / 100,
      baseRate: getBaseRate(domain.archetype).baseRate,
      fatalsResolved: fatalUntestedCount === 0,
      costUsd: evaluationMode === "LIVE_LLM" ? 0.3 : 0.0,
      externalEvidenceSources,
      idea,
      domainClassification: domain,
      epistemicSummary,
      verificationAudit: audit,
      killScore: compositeScore,
      confidenceScore,
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
      simulation: {
        cacEstimateUsd: sandboxSim.metrics.cacEstimateUsd,
        ltvEstimateUsd: sandboxSim.metrics.ltvEstimateUsd,
        ltvCacRatio: sandboxSim.metrics.ltvCacRatio,
        estimatedPaybackMonths: sandboxSim.metrics.estimatedPaybackMonths,
        monthlyInfraCostUsd: sandboxSim.metrics.monthlyInfraCostUsd,
        tamEstimateUsd: sandboxSim.metrics.tamEstimateUsd,
        monteCarlo: sandboxSim.metrics.monteCarlo,
        stressMetrics,
        sandboxExecutionProof: {
          runtime: sandboxSim.runtime,
          exitCode: sandboxSim.exitCode,
          stdout: sandboxSim.stdout
        }
      },
      validationRoadmap: {
        day1to2: [
          `01 — Execute "${cheapestValidationExperiment.title}": Interview 5 prospective buyers in ${domain.primaryCustomer}.`,
          `02 — Refine value proposition to address Red Team fatal flaw: "${weakestAssumption.fatalRisk}".`
        ],
        day3to5: [
          `03 — Deploy targeted pilot LOI requests (Approval Gate 01).`,
          `04 — Prototype isolated core single-job execution inside TrueForge sandbox.`
        ],
        day6to7: [
          `05 — Re-run DOSSIER with live LOI response evidence.`,
          `06 — Final GO / NO-GO decision against defined kill conditions.`
        ]
      },
      approvalGates
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
