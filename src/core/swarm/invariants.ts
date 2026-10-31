import {
  IdeaInput,
  DecisionModelOutput,
  SwarmRole,
  Verdict,
  IdeaDomainArchetype
} from "../../types/index.js";

export const PRODUCT_FORMAT_KEYWORDS = /(chrome extension|browser extension|gpt wrapper|chat with pdf|meeting notes|summariz|prompt engineering|simple crm|transcriber|ai copywriter|ai tweet)/i;
export const STRUCTURAL_DEFENSIBILITY_SIGNALS = /(proprietary (data|dataset|model|algorithm|hardware|knowledge|infrastructure)|fine-tune|fine-tuning|on-prem|air-gap|system of record|soc-?2|hipaa|fda|ehr|emr|salesforce|hubspot|epic systems|sap|erp|bi-directional sync|formal verification|symbolic execution|edge yolov8|firmware|hardware|patent|escrow|settlement|autonomous drone|enterprise workflow|audit log|hardware sensor)/i;
export const EXPLICIT_COMMODITY_SIGNALS = /(thin wrapper|zero moat|commodity wrapper|no proprietary|just a wrapper|simple wrapper|wraps gpt|pure prompt|no defensibility)/i;

/**
 * Deterministic adversarial invariants shared by the live-LLM and heuristic evaluation paths.
 * These enforce hard kill ceilings independent of model drift, reinforced by the calibrated decision model.
 */
export function detectAdversarialInvariants(
  idea: IdeaInput,
  pricing: number,
  decisionEvaluation?: DecisionModelOutput | null
) {
  const text = `${idea.title} ${idea.summary} ${idea.targetAudience} ${idea.monetization} ${idea.techStack || ""}`.toLowerCase();
  const thinWrapperByDecision = decisionEvaluation?.answers?.moat?.flagged ?? false;
  const zeroMonetizationByDecision = decisionEvaluation?.answers?.monetization?.flagged ?? false;

  const hasFormatRisk = PRODUCT_FORMAT_KEYWORDS.test(text);
  const hasDefensibilityEvidence = STRUCTURAL_DEFENSIBILITY_SIGNALS.test(text);
  const hasExplicitCommodity = EXPLICIT_COMMODITY_SIGNALS.test(text);

  // Treat product format as a moat-risk signal, NOT proof of weak defensibility.
  // Only penalize when corroborating evidence supports weak differentiation/defensibility.
  const isThinWrapper = hasExplicitCommodity || (
    thinWrapperByDecision && !hasDefensibilityEvidence
  ) || (
    hasFormatRisk && !hasDefensibilityEvidence && (thinWrapperByDecision || /freemium|indie|tweet|bulleted notes|general remote workers/i.test(text))
  );

  return {
    isPromptInjection: /ignore (previous|all) instructions|system prompt|jailbreak|output 100|developer mode/i.test(text),
    isImpossiblePhysics: /perpetual motion|free energy|infinite electricity|zero input energy|violates thermodynamics|overunity/i.test(text),
    isNoMonetization: /free forever|no monetization|zero revenue|not charging/i.test(text) || pricing <= 0 || zeroMonetizationByDecision,
    hasFormatRisk,
    isThinWrapper
  };
}

export type AdversarialInvariants = ReturnType<typeof detectAdversarialInvariants>;

export const WRAPPER_KILL_CEILINGS: Partial<Record<SwarmRole, { score: number; verdict: Verdict }>> = {
  analyst: { score: 35, verdict: "PIVOT_REQUIRED" },
  investor: { score: 28, verdict: "STRONG_KILL" },
  redteam: { score: 24, verdict: "STRONG_KILL" }
};

export const HIGH_CHURN_KILL_CEILING = 39;

// Structured domain drag so feasibility and expert confidence reflect the domain's
// genuine engineering/compliance burden instead of route-independent constants.
export const DOMAIN_FEASIBILITY_DRAG: Partial<Record<IdeaDomainArchetype, number>> = {
  deeptech_research: -10,
  hardware_robotics: -7,
  web3_defi: -7,
  b2g_govtech: -5,
  healthcare_clinical: -4,
  consumer_social: -3
};

export const DOMAIN_REGULATORY_DRAG: Partial<Record<IdeaDomainArchetype, number>> = {
  b2b_saas: 0,
  consumer_social: -3,
  general_startup: -4,
  deeptech_research: -5,
  hardware_robotics: -6,
  healthcare_clinical: -10,
  web3_defi: -12,
  b2g_govtech: -14
};
