import { performLiveWebRecon, ReconSourceResult } from "./recon.js";
import { queryCommunitySentiment, CommunityDiscussion } from "./community.js";
import { rerank } from "./rerank.js";
import nlp from "compromise";

export interface MarketCompetitor {
  name: string;
  url?: string;
  category: "direct" | "indirect" | "incumbent";
  strengths: string;
  vulnerability: string;
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
  reconError?: string;
}

/**
 * Market intelligence via live web recon and community sentiment. Searches for
 * real competitive/pricing pages (Exa/Tavily) and real community discussions
 * (Hacker News natively; Reddit/X via the agent-reach CLI bridge when the host
 * has those backends logged in), all returned with source URLs.
 *
 * When nothing could be retrieved, results are explicitly empty with
 * `dataSource: "none"` — downstream consumers must surface that as "no
 * external evidence" instead of heuristic filler.
 */
export async function performMarketResearch(
  ideaTitle: string,
  domainKeywords: string[],
  opts: { liveRecon?: boolean } = {}
): Promise<ResearchFindings> {
  const query = `${ideaTitle} ${domainKeywords.join(" ")}`.trim();
  const cleanTitle = ideaTitle.trim().slice(0, 120);

  const liveReconAllowed = opts.liveRecon ?? process.env.DOSSIER_PRO === "1";
  const [recon, community] = await Promise.all([
    liveReconAllowed
      ? performLiveWebRecon([
          `${cleanTitle} competitors alternatives pricing`,
          `${cleanTitle} ${domainKeywords.slice(0, 2).join(" ")} customer complaints churn reviews`
        ])
      : Promise.resolve({ provider: "none" as const, queries: [], results: [], error: "Free tier: live recon gated to Pro (DOSSIER_PRO=1)" }),
    queryCommunitySentiment(cleanTitle)
  ]);

  const liveRecon = recon.provider !== "none" && recon.results.length > 0;
  const cacheHit = recon.provider === "exa:cache" || recon.provider === "tavily:cache";
  if (!liveRecon) {
    return {
      query,
      dataSource: "none",
      reconProvider: "none",
      identifiedCompetitors: [],
      marketSignals: [],
      rawResults: [],
      community,
      reconError: recon.error
    };
  }

  // Local MiniLM rerank (best-effort): top-6 by cosine similarity to the query.
  // Falls back to provider order when the model is unavailable (offline/CI).
  const ranked = await rerank(query, recon.results, 6);
  const rawResults = ranked ?? recon.results;
  const reranked = ranked !== null;

  // Competitor extraction (tiny, local): org/product nouns from titles.
  // Best-effort — empty list when nothing parses, never blocks evaluation.
  const identifiedCompetitors = extractCompetitors(rawResults.slice(0, 6));

  return {
    query,
    dataSource: "live-web-recon",
    reconProvider: `${recon.provider}${cacheHit ? " (cached, $0 marginal)" : ""}${reranked ? " + minilm-rerank" : ""}`,
    identifiedCompetitors,
    marketSignals: rawResults.map((r) => `${r.title} — ${r.url}`),
    rawResults,
    community
  };
}

/**
 * Extract candidate competitor names via compromise org/product noun phrases.
 * Dedupes case-insensitively, caps at 5, requires a URL-bearing source title.
 */
export function extractCompetitors(results: ReconSourceResult[]): MarketCompetitor[] {
  const seen = new Set<string>();
  const competitors: MarketCompetitor[] = [];
  for (const r of results) {
    try {
      const orgs = nlp(r.title).organizations().out("array") as string[];
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
