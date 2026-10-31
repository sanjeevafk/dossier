import {
  SwarmRole,
  IdeaInput,
  DomainClassification,
  AgentOpinion,
  Verdict,
  SwarmEvent,
  DebateChallenge,
  Contradiction as ContradictionEntry
} from "../../types/index.js";
import {
  type AdversarialInvariants,
  WRAPPER_KILL_CEILINGS,
  HIGH_CHURN_KILL_CEILING
} from "./invariants.js";
import { SWARM_ROLES } from "../../config/prompts.js";
import { getLLMStatus, generateAgentTurn } from "../../services/llm.js";
import {
  validateAgentOutput,
  validateCrossExam,
  validateCrossfireDefense
} from "./schemas.js";

export interface CrossfireContext {
  stressSummary: string;
  reconSummary: string;
  contestedClaim: string;
  stressLtvCacRatio: number;
  stressSurvival24?: number;
  hasLiveLLM: boolean;
}

export interface CrossfireResult {
  challenge: DebateChallenge;
  contradiction: ContradictionEntry;
  defenderScoreDelta: number;
  toolTraces: string[];
}

/**
 * Evaluate an individual agent perspective using live LLM if available,
 * injecting domain-specific prompts, specialist mandates, and hard score calibration.
 * Returns a discriminated result so the orchestrator can surface schema/parse failures
 * on the stream instead of silently swapping heuristics in.
 */
export async function evaluateRoleWithLLM(
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
 * Build debate challenge and contradiction structure for Round 2 crossfire.
 */
export function buildCrossfireOutcome(
  challengerOpinion: AgentOpinion,
  defenderOpinion: AgentOpinion,
  crossExamText: string,
  defenseText: string,
  debateHistory: string[],
  toolTraces: string[],
  originalScore: number,
  newScore: number
): CrossfireResult {
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
 * Round 2 cross-examination: the lowest-scoring agent cross-examines the
 * highest-scoring agent using dynamic ReAct tool findings (stressed Monte Carlo +
 * competitor recon). The defender must produce verifiable evidence or concede
 * confidence points; falls back to deterministic stress adjudication when offline.
 */
export async function runRoundTwoCrossfire(
  challengerOpinion: AgentOpinion,
  defenderOpinion: AgentOpinion,
  context: CrossfireContext,
  emit: (event: SwarmEvent) => void
): Promise<CrossfireResult> {
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
        return buildCrossfireOutcome(challengerOpinion, defenderOpinion, crossExamText, defenseText, debateHistory, toolTraces, originalScore, newScore);
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
  return buildCrossfireOutcome(challengerOpinion, defenderOpinion, crossExamText, defenseText, debateHistory, toolTraces, originalScore, newScore);
}
