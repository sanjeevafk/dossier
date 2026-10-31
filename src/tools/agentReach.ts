import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { dossierStorage } from "../services/storage.js";
import { extractDomainTokens, getSearchQueryCandidates } from "./queryTokens.js";

const execFileAsync = promisify(execFile);

export interface GitHubRepoSignal {
  fullName: string;
  stars: number;
  description: string;
  url: string;
}

export interface DeepPageScrape {
  url: string;
  title: string;
  extractedPricing?: string;
  keyClaims: string[];
}

export interface RegionalDiscussion {
  title: string;
  platform: string;
  url: string;
  replies?: number;
}

export interface AgentReachResult {
  query: string;
  source: string;
  gitHubRepos: GitHubRepoSignal[];
  deepScrape?: DeepPageScrape;
  regionalDiscussions: RegionalDiscussion[];
  keyTakeaway: string;
}

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Deep page scraper using Jina Reader (part of Agent-Reach zero-config web channel).
 * Converts any competitor or regulatory documentation URL into clean markdown to extract
 * factual pricing and feature specifications instead of tiny 100-character snippets.
 */
export async function scrapeWebPageWithJina(
  targetUrl: string,
  fetchImpl: FetchImpl = fetch
): Promise<DeepPageScrape | null> {
  const cleanUrl = targetUrl.trim();
  if (!cleanUrl || !cleanUrl.startsWith("http")) return null;

  try {
    const parsed = new URL(cleanUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.endsWith(".local") ||
      hostname.startsWith("169.254.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      return null;
    }
  } catch {
    return null;
  }

  const cacheKey = `reach:jina:${cleanUrl.toLowerCase()}`;
  try {
    const cached = dossierStorage.getReconCache(cacheKey);
    if (cached && typeof cached.response === "object" && cached.response !== null) {
      return cached.response as DeepPageScrape;
    }
  } catch {
    // Non-blocking cache miss
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const jinaUrl = `https://r.jina.ai/${cleanUrl}`;

    const res = await fetchImpl(jinaUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Dossier-AgentReach/1.0",
        Accept: "text/plain, text/markdown"
      }
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const markdown = await res.text();
    if (!markdown || markdown.length < 50) return null;

    // Extract title
    const titleMatch = markdown.match(/Title:\s*(.+)/i) || markdown.match(/^#\s+(.+)/m);
    const title = titleMatch ? titleMatch[1].trim() : cleanUrl;

    // Extract pricing mentions if present
    const pricingMatch = markdown.match(/(\$\d+(?:\.\d+)?(?:\/(?:mo|month|yr|year|user|seat))?)/i);
    const extractedPricing = pricingMatch ? pricingMatch[1] : undefined;

    // Extract first 3 distinct bullet points or headers
    const bulletMatches = markdown.matchAll(/^[*-]\s+([^#\n\r]{10,120})/gm);
    const keyClaims: string[] = [];
    for (const b of bulletMatches) {
      keyClaims.push(b[1].trim());
      if (keyClaims.length >= 3) break;
    }

    const result: DeepPageScrape = {
      url: cleanUrl,
      title,
      extractedPricing,
      keyClaims
    };

    try {
      dossierStorage.setReconCache(cacheKey, "jina-reader", result);
    } catch {
      // Non-blocking cache write
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * Inspects GitHub developer traction via `gh search repos` (Agent-Reach dev channel)
 * or public API fallback.
 */
export async function queryGitHubTraction(
  keyword: string,
  fetchImpl: FetchImpl = fetch
): Promise<GitHubRepoSignal[]> {
  const cleanKeyword = keyword.trim().slice(0, 100);
  const domainTokens = extractDomainTokens(cleanKeyword);
  const qTerm = domainTokens.length > 0 ? domainTokens.join(" ") : cleanKeyword;
  if (!qTerm) return [];

  const cacheKey = `reach:gh:${qTerm.toLowerCase()}`;
  try {
    const cached = dossierStorage.getReconCache(cacheKey);
    if (cached && Array.isArray((cached.response as { repos?: unknown })?.repos)) {
      return (cached.response as { repos: GitHubRepoSignal[] }).repos;
    }
  } catch {
    // Non-blocking cache miss
  }

  // 1. Try local gh CLI (fastest & authenticated)
  try {
    const { stdout } = await execFileAsync("gh", [
      "search",
      "repos",
      qTerm,
      "--limit",
      "3",
      "--json",
      "fullName,stargazersCount,description,url"
    ], { timeout: 4000 });

    const raw = JSON.parse(stdout);
    if (Array.isArray(raw) && raw.length > 0) {
      const repos: GitHubRepoSignal[] = raw.map((r) => ({
        fullName: String(r.fullName || ""),
        stars: Number(r.stargazersCount) || 0,
        description: String(r.description || "").slice(0, 150),
        url: String(r.url || `https://github.com/${r.fullName}`)
      }));

      try {
        dossierStorage.setReconCache(cacheKey, "gh-cli", { repos });
      } catch {}

      return repos;
    }
  } catch {
    // Fall back to keyless GitHub search API
  }

  // 2. Fallback to public GitHub API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(qTerm)}&per_page=3&sort=stars`;
    const res = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "Dossier-AgentReach/1.0"
      }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      const repos: GitHubRepoSignal[] = items.slice(0, 3).map((r: any) => ({
        fullName: String(r.full_name || ""),
        stars: Number(r.stargazers_count) || 0,
        description: String(r.description || "").slice(0, 150),
        url: String(r.html_url || "")
      }));

      try {
        dossierStorage.setReconCache(cacheKey, "github-api", { repos });
      } catch {}

      return repos;
    }
  } catch {
    // Fail gracefully
  }

  return [];
}

/**
 * Fetch regional community developer discussions (e.g. V2EX for APAC/China).
 */
export async function queryV2EXCommunity(fetchImpl: FetchImpl = fetch): Promise<RegionalDiscussion[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const url = "https://www.v2ex.com/api/topics/hot.json";
    const res = await fetchImpl(url, {
      signal: controller.signal,
      headers: { "User-Agent": "agent-reach/1.0", Accept: "application/json" }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.slice(0, 2).map((item) => ({
          title: String(item.title || "").slice(0, 120),
          platform: "v2ex",
          url: String(item.url || `https://v2ex.com/t/${item.id}`),
          replies: Number(item.replies) || 0
        }));
      }
    }
  } catch {
    // Non-blocking
  }
  return [];
}

export interface AgentReachOptions {
  competitorUrl?: string;
  isTechSoftware?: boolean;
  preferredChannels?: string[];
}

/**
 * Master Agent-Reach intelligence coordinator:
 * Executes deep Jina Reader scraping of competitor specs, queries GitHub repository traction,
 * and fetches regional tech community topics.
 */
export async function queryAgentReachIntel(
  conceptTitle: string,
  options: AgentReachOptions = {},
  fetchImpl: FetchImpl = fetch
): Promise<AgentReachResult> {
  const cleanTitle = conceptTitle.trim();
  const takeaways: string[] = [];

  const [deepScrape, gitHubRepos, v2exTopics] = await Promise.all([
    options.competitorUrl ? scrapeWebPageWithJina(options.competitorUrl, fetchImpl) : Promise.resolve(null),
    options.isTechSoftware !== false ? queryGitHubTraction(cleanTitle, fetchImpl) : Promise.resolve([]),
    options.preferredChannels?.includes("v2ex") ? queryV2EXCommunity(fetchImpl) : Promise.resolve([])
  ]);

  if (deepScrape) {
    takeaways.push(
      `Deep competitor inspection [${deepScrape.title.slice(0, 45)}]: ${deepScrape.extractedPricing ? `verified pricing at ${deepScrape.extractedPricing}` : "specifications indexed via Jina Reader"}`
    );
  }

  if (gitHubRepos.length > 0) {
    const top = gitHubRepos[0];
    takeaways.push(
      `GitHub open-source ecosystem: ${gitHubRepos.length} active repos (top "${top.fullName}" with ${top.stars.toLocaleString()} stars)`
    );
  }

  if (v2exTopics.length > 0) {
    takeaways.push(`APAC developer community (V2EX): ${v2exTopics.length} hot discussion topics indexed`);
  }

  const keyTakeaway = takeaways.length > 0
    ? takeaways.join(". ") + "."
    : `Agent-Reach multi-channel intelligence active for "${cleanTitle}".`;

  return {
    query: cleanTitle,
    source: "Agent-Reach Multi-Channel Intelligence (Jina/GitHub/Community)",
    gitHubRepos,
    deepScrape: deepScrape || undefined,
    regionalDiscussions: v2exTopics,
    keyTakeaway
  };
}
