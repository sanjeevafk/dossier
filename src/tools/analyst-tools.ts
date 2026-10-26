import { IdeaInput, DomainClassification, MarketCompetitor, AgentOpinion } from "../types/index.js";
import { performLiveWebRecon, ReconSourceResult, searchDuckDuckGo } from "./recon.js";
import { queryCommunitySentiment, CommunityDiscussion } from "./community.js";
import { generateAgentTurn } from "../services/llm.js";

export interface GroundedEvidencePack {
  identifiedCompetitors: MarketCompetitor[];
  customerFrictions: string[];
  groundedSignals: string[];
  rawResults: ReconSourceResult[];
  discussions: CommunityDiscussion[];
  roleContextLines: {
    customer: string;
    redteam: string;
    investor: string;
    architect: string;
    expert: string;
  };
}

export interface AnalystToolResult {
  opinion: AgentOpinion | null;
  groundedEvidence: GroundedEvidencePack;
  fallbackReason?: string;
}

/**
 * Execute tool search for the Market Analyst using live web recon (Exa/Tavily/DDG)
 * and community sentiment (HN Algolia).
 */
export async function executeMarketAnalystSearches(
  competitorQuery: string,
  sentimentQuery: string
): Promise<{
  results: ReconSourceResult[];
  discussions: CommunityDiscussion[];
  provider: string;
}> {
  const [recon, community] = await Promise.all([
    performLiveWebRecon([competitorQuery, sentimentQuery], { allowDuckDuckGo: true }),
    queryCommunitySentiment(sentimentQuery || competitorQuery)
  ]);

  return {
    results: recon.results,
    discussions: community.discussions,
    provider: recon.provider
  };
}

/**
 * Build deterministic role-specific evidence slices from retrieved intelligence.
 * Anthropic Context Engineering pattern: route only what directly shapes that role's mandate.
 */
export function buildRoleEvidenceSlices(
  competitors: MarketCompetitor[],
  frictions: string[],
  results: ReconSourceResult[],
  discussions: CommunityDiscussion[],
  provider: string
): GroundedEvidencePack["roleContextLines"] {
  const compLines = competitors.length > 0
    ? `Verified Competitors & Incumbents: ${competitors.slice(0, 4).map(c => `"${c.name}" [${c.category}]${c.url ? ` (${c.url})` : ""}: Strengths: ${c.strengths}; Vulnerability: ${c.vulnerability}${c.pricingEstimate ? `; Pricing: ${c.pricingEstimate}` : ""}`).join(" | ")}`
    : results.length > 0
      ? `Live web recon (${provider}): ${results.slice(0, 3).map(r => `"${r.title}" [${r.url}]`).join("; ")}`
      : "No verified competitor pages discovered via live recon — evaluate strictly from stated priors.";

  const frictionLines = frictions.length > 0
    ? `Live Buyer Complaints & Friction: ${frictions.slice(0, 3).join("; ")}`
    : discussions.length > 0
      ? `Community Discussions: ${discussions.slice(0, 3).map(d => `"${d.title}"${typeof d.score === "number" ? ` (${d.score} pts)` : ""} [${d.url}]`).join("; ")}`
      : "No live customer complaints retrieved — evaluate adoption friction from domain priors.";

  const pricingSummary = competitors.filter(c => c.pricingEstimate).length > 0
    ? `Market Pricing Benchmarks: ${competitors.filter(c => c.pricingEstimate).slice(0, 3).map(c => `${c.name}: ${c.pricingEstimate}`).join(", ")}`
    : "No public pricing tables extracted from search results.";

  return {
    // Red Team gets competitor moats, incumbent scale, and failure modes
    redteam: `${compLines}. ${frictionLines}`,
    // Customer Advocate gets buyer friction points, complaints, and pricing resistance
    customer: `${frictionLines}. ${pricingSummary}`,
    // Investor gets market pricing benchmarks and competitor landscape
    investor: `${compLines}. ${pricingSummary}`,
    // Architect is shielded from commercial marketing — evidence is compute/sandbox only
    architect: "Technical architecture evaluation: analyze only compute burden, token throughput, and deterministic infrastructure constraints.",
    // Expert gets domain compliance & incumbent moat challenges
    expert: `${compLines}`
  };
}

/**
 * Run the Market Analyst with dynamic bounded tool calling.
 * Turn 1: LLM formulates targeted competitor and customer search queries.
 * Tool Exec: Searches executed in parallel (Recon + HN).
 * Turn 2: LLM receives grounded tool results and produces structured competitors + calibrated opinion.
 */
export async function runAnalystWithTools(
  idea: IdeaInput,
  domain: DomainClassification,
  economicContext: string,
  options: { model?: string } = {}
): Promise<AnalystToolResult> {
  // Step 1: Formulate targeted queries
  const queryGenPrompt = `You are Agent 01 // MARKET ANALYST in the Dossier Intelligence Swarm.
Your mandate is to stress-test target market feasibility and discover real incumbents.
Target Idea: "${idea.title}"
Summary: ${idea.summary}
Target Audience: ${idea.targetAudience}
Monetization: ${idea.monetization}
Domain: ${domain.archetypeLabel}

Formulate two high-leverage search queries:
1. "competitorQuery": targeted search to find real commercial competitors, products, pricing, and alternatives.
2. "sentimentQuery": targeted search to find real customer pain points, complaints, churn discussions, or buyer frustration.

Return strictly JSON:
{
  "competitorQuery": "string",
  "sentimentQuery": "string"
}`;

  let competitorQuery = `${idea.title} competitors alternatives pricing`;
  let sentimentQuery = `${idea.title} ${idea.targetAudience} complaints problems`;

  try {
    const rawQueries = await generateAgentTurn(
      "You are a market reconnaissance tool query planner. Output strictly JSON.",
      queryGenPrompt,
      { temperature: 0.3, maxTokens: 400, jsonMode: true, model: options.model }
    );
    const parsedQ = JSON.parse(rawQueries.match(/\{[\s\S]*\}/)?.[0] || "{}");
    if (parsedQ.competitorQuery) competitorQuery = parsedQ.competitorQuery;
    if (parsedQ.sentimentQuery) sentimentQuery = parsedQ.sentimentQuery;
  } catch {
    // Fall back to default clean queries on any planning hiccup
  }

  // Step 2: Tool Execution (parallel recon & community sentiment)
  const toolResults = await executeMarketAnalystSearches(competitorQuery, sentimentQuery);

  const searchEvidenceDigest = [
    `Tool Execution: Search Provider [${toolResults.provider}]`,
    `Competitor Search Query: "${competitorQuery}"`,
    `Results:`,
    ...toolResults.results.slice(0, 5).map((r, i) => `  [${i + 1}] "${r.title}" — ${r.url}\n      ${r.snippet}`),
    `Customer Sentiment Search Query: "${sentimentQuery}"`,
    `Discussions:`,
    ...toolResults.discussions.slice(0, 4).map((d, i) => `  [${i + 1}] "${d.title}" (${d.score ?? 0} pts) — ${d.url}`)
  ].join("\n");

  // Step 3: Synthesis & Calibrated Evaluation Turn
  const synthesisSystemPrompt = `You are Agent 01 // MARKET ANALYST in the Dossier Adversarial Swarm.
Domain: ${domain.archetypeLabel}
Mandate: Identify real market competitors, extract pricing benchmarks, and rigorously evaluate commercial viability.

You must return strictly valid JSON matching this schema:
{
  "identifiedCompetitors": [
    {
      "name": "string",
      "url": "string (optional)",
      "category": "direct" | "indirect" | "incumbent",
      "strengths": "string",
      "vulnerability": "string",
      "pricingEstimate": "string (optional)"
    }
  ],
  "customerFrictions": ["string"],
  "groundedSignals": ["string"],
  "verdict": "STRONG_KILL" | "LEAN_KILL" | "PIVOT_REQUIRED" | "VIABLE_WITH_RISK" | "STRONG_PURSUE",
  "score": number (0 to 100),
  "fatalFlaws": ["string"],
  "keyAssumptions": ["string"],
  "competitiveRisks": ["string"],
  "mustTestBeforeBuilding": ["string"],
  "rationale": "string"
}

SCORING RULES:
- If this idea is a thin AI wrapper easily copied by incumbents, cap score below 35.
- If existing competitors (like Vanta, Drata, etc.) already offer this with distribution, score below 45.
- If real defensibility and healthy economics exist, award 65-80.`;

  const synthesisUserPrompt = `Target Concept:
Title: ${idea.title}
Summary: ${idea.summary}
Target Audience: ${idea.targetAudience}
Monetization: ${idea.monetization}
${economicContext}

LIVE WEB TOOL RESULTS RETRIEVED:
${searchEvidenceDigest}`;

  try {
    const rawSynthesis = await generateAgentTurn(
      synthesisSystemPrompt,
      synthesisUserPrompt,
      { temperature: 0.5, maxTokens: 2500, jsonMode: true, model: options.model }
    );

    const jsonMatch = rawSynthesis.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return fallbackAnalystResult(idea, toolResults, "No JSON in synthesis response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const competitors: MarketCompetitor[] = Array.isArray(parsed.identifiedCompetitors)
      ? parsed.identifiedCompetitors.map((c: any) => ({
          name: String(c.name || "Competitor"),
          url: c.url ? String(c.url) : undefined,
          category: ["direct", "indirect", "incumbent"].includes(c.category) ? c.category : "direct",
          strengths: String(c.strengths || ""),
          vulnerability: String(c.vulnerability || ""),
          pricingEstimate: c.pricingEstimate ? String(c.pricingEstimate) : undefined
        }))
      : [];

    const customerFrictions: string[] = Array.isArray(parsed.customerFrictions)
      ? parsed.customerFrictions.map(String)
      : [];

    const groundedSignals: string[] = Array.isArray(parsed.groundedSignals)
      ? parsed.groundedSignals.map(String)
      : toolResults.results.map(r => `${r.title} [${r.url}]`);

    const roleContextLines = buildRoleEvidenceSlices(
      competitors,
      customerFrictions,
      toolResults.results,
      toolResults.discussions,
      toolResults.provider
    );

    const opinion: AgentOpinion = {
      role: "analyst",
      roleNumber: "01",
      roleTitle: "MARKET ANALYST",
      verdict: parsed.verdict || "LEAN_KILL",
      score: typeof parsed.score === "number" ? parsed.score : 45,
      status: "COMPLETE",
      fatalFlaws: Array.isArray(parsed.fatalFlaws) ? parsed.fatalFlaws : [],
      keyAssumptions: Array.isArray(parsed.keyAssumptions) ? parsed.keyAssumptions : [],
      competitiveRisks: Array.isArray(parsed.competitiveRisks) ? parsed.competitiveRisks : [],
      mustTestBeforeBuilding: Array.isArray(parsed.mustTestBeforeBuilding) ? parsed.mustTestBeforeBuilding : [],
      rationale: String(parsed.rationale || "Market analysis completed with live recon tools.")
    };

    return {
      opinion,
      groundedEvidence: {
        identifiedCompetitors: competitors,
        customerFrictions,
        groundedSignals,
        rawResults: toolResults.results,
        discussions: toolResults.discussions,
        roleContextLines
      }
    };
  } catch (err: any) {
    return fallbackAnalystResult(idea, toolResults, err?.message || "Tool synthesis error");
  }
}

function fallbackAnalystResult(
  idea: IdeaInput,
  toolResults: { results: ReconSourceResult[]; discussions: CommunityDiscussion[]; provider: string },
  reason: string
): AnalystToolResult {
  const roleContextLines = buildRoleEvidenceSlices(
    [],
    [],
    toolResults.results,
    toolResults.discussions,
    toolResults.provider
  );

  return {
    opinion: null,
    fallbackReason: reason,
    groundedEvidence: {
      identifiedCompetitors: [],
      customerFrictions: [],
      groundedSignals: toolResults.results.map(r => `${r.title} [${r.url}]`),
      rawResults: toolResults.results,
      discussions: toolResults.discussions,
      roleContextLines
    }
  };
}
