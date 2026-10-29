import { AgentOpinion, DebateChallenge, SwarmRole } from "../types/index.js";
import { generateAgentTurn } from "../services/llm.js";

export interface DebateTrailInput {
  opinions: Record<Exclude<SwarmRole, "synthesizer">, AgentOpinion>;
  procurementCycle: string;
  primaryCustomer: string;
  sandboxMetrics: { ltvCacRatio: number; estimatedPaybackMonths: number };
}

type DebateRole = "analyst" | "customer" | "architect" | "investor" | "redteam" | "expert";
type DebateStatus = "OPEN" | "REBUTTED" | "CONCEDED";

interface LlmClash {
  challenger: DebateRole;
  target: DebateRole;
  challengePoint: string;
  rebuttal: string;
  status: DebateStatus;
}

const VALID_ROLES = new Set<string>(["analyst", "customer", "architect", "investor", "redteam", "expert"]);
const VALID_STATUSES = new Set<string>(["OPEN", "REBUTTED", "CONCEDED"]);

function validateDebateClashes(input: unknown): { success: true; data: { clashes: LlmClash[] } } | { success: false } {
  if (!input || typeof input !== "object" || !("clashes" in input) || !Array.isArray((input as any).clashes)) {
    return { success: false };
  }
  const clashes = (input as any).clashes;
  if (clashes.length < 3 || clashes.length > 4) return { success: false };
  for (const c of clashes) {
    if (!c || typeof c !== "object") return { success: false };
    if (!VALID_ROLES.has(c.challenger) || !VALID_ROLES.has(c.target)) return { success: false };
    if (typeof c.challengePoint !== "string" || !c.challengePoint.trim()) return { success: false };
    if (typeof c.rebuttal !== "string" || !c.rebuttal.trim()) return { success: false };
    if (!VALID_STATUSES.has(c.status)) return { success: false };
  }
  return { success: true, data: { clashes } };
}

function claimOf(opinion: AgentOpinion): string {
  return (
    opinion.keyAssumptions[0] ||
    opinion.rationale ||
    opinion.verdict
  );
}

function flawOf(opinion: AgentOpinion, index = 0): string {
  return (
    opinion.fatalFlaws[index] ||
    opinion.competitiveRisks[index] ||
    `${opinion.roleTitle} scored ${opinion.score}/100 with verdict ${opinion.verdict}`
  );
}

function statusFromGap(challengerScore: number, targetScore: number): "OPEN" | "REBUTTED" {
  return targetScore - challengerScore > 20 ? "REBUTTED" : "OPEN";
}

/**
 * Deterministic round-1 debate trail composed from the agents' ACTUAL outputs —
 * every challenge quotes a real fatal flaw or claim from the challenger and the
 * target. No fixed narrative templates. Always yields exactly three clashes.
 */
export function composeDebateTrailDeterministic(input: DebateTrailInput): DebateChallenge[] {
  const { opinions } = input;
  const { redteam, investor, customer, architect } = opinions;

  const clash1: DebateChallenge = {
    challenger: "redteam",
    target: "investor",
    round: 1,
    challengePoint: `${flawOf(redteam)} — this directly undermines ${claimOf(investor)}`,
    rebuttal: investor.mustTestBeforeBuilding[0] || `Investor maintains ${investor.score}/100 pending proof.`,
    status: statusFromGap(redteam.score, investor.score)
  };

  const clash2: DebateChallenge = {
    challenger: "customer",
    target: "architect",
    round: 1,
    challengePoint: `${flawOf(customer)} — against the architect's position: ${claimOf(architect)}`,
    rebuttal: architect.mustTestBeforeBuilding[0] || `Architect holds ${architect.score}/100 on feasibility grounds.`,
    status: statusFromGap(customer.score, architect.score)
  };

  const clash3: DebateChallenge = {
    challenger: "redteam",
    target: "customer",
    round: 1,
    challengePoint: `${flawOf(redteam, 1)} — so the assumed buyer urgency (${claimOf(customer)}) is unproven for ${input.primaryCustomer}.`,
    rebuttal: customer.mustTestBeforeBuilding[0] || `Customer advocate keeps ${customer.score}/100 pending adoption evidence.`,
    status: statusFromGap(redteam.score, customer.score)
  };

  return [clash1, clash2, clash3];
}

/**
 * LLM Crossfire Director (plan F-01): a single schema-validated LLM turn that
 * reads all six real agent opinions and authors 3–4 cross-examinations between
 * actual roles. Returns null on any failure so the caller can fall back to the
 * deterministic composition — never to canned narratives.
 */
export async function generateDebateTrailWithLLM(input: DebateTrailInput): Promise<DebateChallenge[] | null> {
  const opinionsJson = JSON.stringify(
    Object.fromEntries(
      Object.entries(input.opinions).map(([role, op]) => [
        role,
        { score: op.score, verdict: op.verdict, fatalFlaws: op.fatalFlaws, keyAssumptions: op.keyAssumptions, rationale: op.rationale }
      ])
    )
  );

  try {
    const raw = await generateAgentTurn(
      `You are the Crossfire Director of a six-agent adversarial evaluation swarm. You receive the six agents' actual opinions as JSON.
Author exactly 3 cross-examination clashes between agents whose positions genuinely conflict (highest vs lowest scorers, or opposing assumptions).
Rules:
- challenger and target MUST be distinct roles from: analyst, customer, architect, investor, redteam, expert.
- challengePoint must quote or directly attack a specific claim from the target's actual opinion (<=60 words).
- rebuttal is the target's best defense, citing its own evidence (<=60 words).
- status: "CONCEDED" if the target's position is materially weakened by the challenge, "REBUTTED" if defended with evidence, "OPEN" if it requires field validation.
Return strictly valid JSON: {"clashes": [{"challenger": string, "target": string, "challengePoint": string, "rebuttal": string, "status": "OPEN"|"REBUTTED"|"CONCEDED"}]}`,
      `Domain procurement context: ${input.procurementCycle}; primary customer: ${input.primaryCustomer}; P50 LTV/CAC ${input.sandboxMetrics.ltvCacRatio}x, payback ${input.sandboxMetrics.estimatedPaybackMonths}mo.
Six agent opinions: ${opinionsJson}`,
      { temperature: 0.5, maxTokens: 1200, jsonMode: true }
    );

    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = validateDebateClashes(JSON.parse(match[0]));
    if (!parsed.success) return null;

    const clashes = parsed.data.clashes.filter((c) => c.challenger !== c.target);
    if (clashes.length < 3) return null;

    return clashes.map((c, i) => ({
      challenger: c.challenger,
      target: c.target,
      round: 1,
      challengePoint: c.challengePoint,
      rebuttal: c.rebuttal,
      status: c.status
    }));
  } catch {
    return null;
  }
}

/**
 * Round-1 trail entrypoint: try the LLM director when live, otherwise compose
 * from actual opinions. Both paths are grounded in real agent output.
 */
export async function buildRoundOneDebateTrail(
  input: DebateTrailInput,
  hasLiveLLM: boolean
): Promise<{ trail: DebateChallenge[]; source: "llm_director" | "composed_from_opinions" }> {
  if (hasLiveLLM) {
    const llmTrail = await generateDebateTrailWithLLM(input);
    if (llmTrail) {
      return { trail: llmTrail, source: "llm_director" };
    }
  }
  return { trail: composeDebateTrailDeterministic(input), source: "composed_from_opinions" };
}
