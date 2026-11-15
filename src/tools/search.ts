import { performLiveWebRecon, ReconSourceResult } from "./recon.js";
import { queryCommunitySentiment, CommunityDiscussion } from "./community.js";
import { rerank } from "./rerank.js";
import type { MarketCompetitor } from "../types/index.js";

export type { MarketCompetitor };

export interface ResearchIdea {
  title: string;
  summary?: string;
  targetAudience?: string;
}

export interface ResearchFindings {
  query: string;
  /** "live-web-recon" when real search results were retrieved; "none" means no external evidence exists. */
  dataSource: "live-web-recon" | "none";
  reconProvider: string;
  identifiedCompetitors: MarketCompetitor[];
  marketSignals: string[];
  rawResults: ReconSourceResult[];
  community: {
    provider: string;
    discussions: CommunityDiscussion[];
    errors: string[];
  };
  /** Results removed by the entity-relevance filter, with reasons (transparency). */
  filteredOut: Array<{ title: string; reason: string }>;
  reconError?: string;
}

const STOPWORDS = new Set(
  ("a an the and or of to for with from that this these those their its it is are was were be been being we our you your they them who which while when where how what into onto per plus via by as at on in over under about between each both all any can could should would will may might must lets let help helps make makes making new using use used get gets than then more most also only so such other others without within one two three first second third if but not no yes up down out off again very just own same too also because during before after above below between").split(
    /\s+/
  )
);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/**
 * Distinctive content terms of the idea (what it does, for whom), taken from the
 * summary and audience — NOT the invented brand name. Used for concept-led search
 * queries and for entity-relevance filtering.
 */
export function buildConceptTerms(idea: { summary?: string; targetAudience?: string }): string[] {
  const terms: string[] = [];
  for (const t of [...tokenize(idea.summary ?? ""), ...tokenize(idea.targetAudience ?? "")]) {
    if (!terms.includes(t)) terms.push(t);
  }
  return terms;
}

export interface ResearchQueries {
  brandQuery: string;
  conceptQuery: string;
}

/**
 * Two searches per idea:
 *  - brand: the idea's own name + competitive intent (works when the name is real and distinctive)
 *  - concept: what it does and for whom, with no name — robust to fictional or colliding names
 */
export function buildResearchQueries(idea: ResearchIdea): ResearchQueries {
  const cleanTitle = idea.title.trim().slice(0, 120);
  const conceptTerms = buildConceptTerms(idea);
  const audience = (idea.targetAudience ?? "").trim();
  const conceptQuery =
    conceptTerms.length >= 3
      ? `${audience ? audience + " " : ""}${conceptTerms.slice(0, 5).join(" ")} customer complaints churn reviews`
      : `${cleanTitle} customer complaints churn reviews`;
  return {
    brandQuery: `${cleanTitle} competitors alternatives pricing`,
    conceptQuery
  };
}

export interface EntityRelevanceFilterResult<T> {
  kept: T[];
  dropped: Array<{ item: T; reason: string }>;
}

/**
 * Entity-relevance filter: drops results that match the idea's name but share none of its
 * mechanism terms (the distinctive words in the summary — what the idea actually does).
 * That signature belongs to an unrelated real-world entity with the same or a similar name
 * (e.g. a fictional "Asha Health" app surfacing a real clinic chain). Generic audience words
 * ("care", "patients") do not count as content overlap, and results without the brand token
 * are never dropped: missing overlap alone is not proof of irrelevance (paraphrase, synonyms).
 */
export function filterEntityRelevant<T extends { title: string; snippet?: string }>(
  results: T[],
  idea: ResearchIdea
): EntityRelevanceFilterResult<T> {
  const brandTokens = [...new Set(tokenize(idea.title))].filter((t) => t.length >= 3);
  const mechanismTokens = buildConceptTerms({ summary: idea.summary }).filter((t) => !brandTokens.includes(t));
  const kept: T[] = [];
  const dropped: Array<{ item: T; reason: string }> = [];
  if (brandTokens.length === 0 || mechanismTokens.length < 2) {
    return { kept: results, dropped };
  }
  for (const item of results) {
    const tokenSet = new Set(tokenize(`${item.title} ${item.snippet ?? ""}`));
    const brandHit = brandTokens.every((t) => tokenSet.has(t));
    const mechanismHits = mechanismTokens.filter((t) => tokenSet.has(t)).length;
    if (brandHit && mechanismHits === 0) {
      dropped.push({
        item,
        reason: `title matches the idea name "${idea.title}" but shares none of its mechanism terms (${mechanismTokens.slice(0, 5).join(", ")}) — likely an unrelated entity with the same name`
      });
    } else {
      kept.push(item);
    }
  }
  return { kept, dropped };
}

/**
 * Market intelligence via live web recon and community sentiment. Searches for
 * real competitive/pricing pages (Exa/Tavily) and real community discussions
 * (Hacker News natively; Reddit/X via the agent-reach CLI bridge when the host
 * has those backends logged in), all returned with source URLs.
 *
 * One query is brand-led (useful when the name is real), one is concept-led
 * (what it does, for whom). Name-collision results are filtered before they can
 * reach agents or the evidence feed.
 *
 * When nothing could be retrieved, results are explicitly empty with
 * `dataSource: "none"` — downstream consumers must surface that as "no
 * external evidence" instead of heuristic filler.
 */
export async function performMarketResearch(
  idea: ResearchIdea,
  opts: { liveRecon?: boolean; exaKey?: string; tavilyKey?: string } = {}
): Promise<ResearchFindings> {
  const { brandQuery, conceptQuery } = buildResearchQueries(idea);
  const cleanTitle = idea.title.trim().slice(0, 120);

  // BYOK: live recon runs when the caller supplies a provider key
  // (per-request headers or server env). No key → honest "none".
  const exaKey = opts.exaKey ?? process.env.EXA_API_KEY;
  const tavilyKey = opts.tavilyKey ?? process.env.TAVILY_API_KEY;
  const liveReconAllowed = (opts.liveRecon ?? true) && (!!exaKey || !!tavilyKey);
  const [recon, communityRaw] = await Promise.all([
    liveReconAllowed
      ? performLiveWebRecon([brandQuery, conceptQuery], { exaKey, tavilyKey })
      : Promise.resolve({
          provider: "none" as const,
          queries: [],
          results: [],
          error: "No recon key supplied — bring your own EXA_API_KEY or TAVILY_API_KEY (header X-Exa-Key / X-Tavily-Key, or server env)"
        }),
    queryCommunitySentiment(cleanTitle)
  ]);

  const { kept: community, dropped: communityDropped } = filterEntityRelevant(communityRaw.discussions, idea);

  const liveRecon = recon.provider !== "none" && recon.results.length > 0;
  if (!liveRecon) {
    return {
      query: `${brandQuery} | ${conceptQuery}`,
      dataSource: "none",
      reconProvider: "none",
      identifiedCompetitors: [],
      marketSignals: [],
      rawResults: [],
      community: { ...communityRaw, discussions: community },
      filteredOut: communityDropped.map((d) => ({ title: d.item.title, reason: d.reason })),
      reconError: recon.error
    };
  }

  const { kept: relevantResults, dropped: reconDropped } = filterEntityRelevant(recon.results, idea);

  // Local MiniLM rerank (best-effort): top-6 by cosine similarity to the query.
  // Falls back to provider order when the model is unavailable (offline/CI).
  const ranked = await rerank(`${cleanTitle} ${buildConceptTerms(idea).slice(0, 6).join(" ")}`, relevantResults, 6);
  const rawResults = ranked ?? relevantResults;
  const reranked = ranked !== null;

  // Competitor extraction (tiny, local): org/product nouns from titles.
  // Best-effort — empty list when nothing parses, never blocks evaluation.
  const identifiedCompetitors = extractCompetitors(rawResults.slice(0, 6));

  const filteredOut = [...reconDropped, ...communityDropped].map((d) => ({ title: d.item.title, reason: d.reason }));

  return {
    query: `${brandQuery} | ${conceptQuery}`,
    dataSource: "live-web-recon",
    reconProvider: `${recon.provider}${cacheHit(recon.provider)}${reranked ? " + minilm-rerank" : ""}`,
    identifiedCompetitors,
    marketSignals: rawResults.map((r) => `${r.title} — ${r.url}`),
    rawResults,
    community: { ...communityRaw, discussions: community },
    filteredOut
  };
}

function cacheHit(provider: string): string {
  return provider === "exa:cache" || provider === "tavily:cache" ? " (cached, $0 marginal)" : "";
}

/**
 * Extract candidate organization names from title strings.
 */
function extractOrgsFromTitle(title: string): string[] {
  const orgs: string[] = [];
  const corpRegex = /\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)*(?:\s+(?:Corp|Corporation|Inc|Incorporated|Ltd|LLC|Technologies|Labs|AI|App|Software|Group|Co)))\b/gi;
  let match: RegExpExecArray | null;
  while ((match = corpRegex.exec(title)) !== null) {
    orgs.push(match[1]);
  }
  const leadRegex = /^([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)\s+(?:launches|raises|announces|releases|unveils|builds|introduces|competes|vs)\b/i;
  const leadMatch = leadRegex.exec(title);
  if (leadMatch) {
    orgs.push(leadMatch[1]);
  }
  const sepMatch = /^([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)\s*[:|—–-]\s+/i.exec(title);
  if (sepMatch) {
    orgs.push(sepMatch[1]);
  }
  return orgs;
}

/**
 * Extract candidate competitor names via title noun phrases & corporate entities.
 * Dedupes case-insensitively, caps at 5, requires a URL-bearing source title.
 */
export function extractCompetitors(results: ReconSourceResult[]): MarketCompetitor[] {
  const seen = new Set<string>();
  const competitors: MarketCompetitor[] = [];
  for (const r of results) {
    try {
      const orgs = extractOrgsFromTitle(r.title);
      const terms = (Array.isArray(orgs) ? orgs : [])
        .map((o) => String(o).trim())
        .filter((o) => o.length >= 2 && o.length <= 40);
      for (const name of terms) {
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        competitors.push({
          name,
          url: r.url,
          category: "direct",
          strengths: `Surfaced in live recon: "${r.title.slice(0, 100)}"`,
          vulnerability: "Unverified from title alone — confirm via source URL before citing as evidence."
        });
        if (competitors.length >= 5) return competitors;
      }
    } catch {
      continue;
    }
  }
  return competitors;
}
