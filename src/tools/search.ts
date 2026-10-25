import { performLiveWebRecon, ReconSourceResult } from "./recon.js";
import { queryCommunitySentiment, CommunityDiscussion } from "./community.js";

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
export async function performMarketResearch(ideaTitle: string, domainKeywords: string[]): Promise<ResearchFindings> {
  const query = `${ideaTitle} ${domainKeywords.join(" ")}`.trim();
  const cleanTitle = ideaTitle.trim().slice(0, 120);

  const [recon, community] = await Promise.all([
    performLiveWebRecon([
      `${cleanTitle} competitors alternatives pricing`,
      `${cleanTitle} ${domainKeywords.slice(0, 2).join(" ")} customer complaints churn reviews`
    ]),
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

  return {
    query,
    dataSource: "live-web-recon",
    reconProvider: cacheHit ? `${recon.provider} (cached, $0 marginal)` : recon.provider,
    identifiedCompetitors: [],
    marketSignals: recon.results.map((r) => `${r.title} — ${r.url}`),
    rawResults: recon.results,
    community
  };
}
