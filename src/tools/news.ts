import { getSearchQueryCandidates, extractDomainTokens } from "./queryTokens.js";
import { dossierStorage } from "../services/storage.js";

export interface NewsArticle {
  title: string;
  source: string;
  url: string;
  publishedAt?: string;
}

export interface NewsReconResult {
  query: string;
  source: string;
  articles: NewsArticle[];
  keyTakeaway: string;
}

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Keyless, fast Google News RSS client providing factual grounding, breaking media coverage,
 * and industry developments alongside prediction market consensus.
 * Cached in SQLite via dossierStorage with 7-day TTL.
 */
export async function queryNewsHeadlines(
  keyword: string,
  fetchImpl: FetchImpl = fetch
): Promise<NewsReconResult> {
  const cleanKeyword = keyword.trim().slice(0, 120);

  const empty = (reason: string): NewsReconResult => ({
    query: cleanKeyword,
    source: "Google News (keyless RSS)",
    articles: [],
    keyTakeaway: reason
  });

  if (!cleanKeyword) return empty("Empty query — no news search performed.");

  // 1. Check SQLite cache
  const cacheKey = `news:google:${cleanKeyword.toLowerCase()}`;
  try {
    const cached = dossierStorage.getReconCache(cacheKey);
    if (cached && Array.isArray((cached.response as { articles?: unknown })?.articles)) {
      const articles = (cached.response as { articles: NewsArticle[] }).articles;
      if (articles.length > 0) {
        return {
          query: cleanKeyword,
          source: "Google News (cached)",
          articles,
          keyTakeaway: `Recent media reporting (${articles.length} articles): ${articles.slice(0, 2).map((a) => `"${a.title.slice(0, 70)}" [${a.source}]`).join("; ")}.`
        };
      }
    }
  } catch {
    // Cache miss or failure falls through to live network fetch
  }

  // 2. Query candidates: full title, then extracted domain tokens
  const candidates = getSearchQueryCandidates(cleanKeyword);
  if (candidates.length === 0) candidates.push(cleanKeyword);

  for (const qTerm of candidates) {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(qTerm)}&hl=en-US&gl=US&ceid=US:en`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetchImpl(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Dossier/1.0",
          Accept: "application/xml, text/xml, */*"
        }
      });
      clearTimeout(timeoutId);

      if (!res.ok) continue;

      const xml = await res.text();
      const articles: NewsArticle[] = [];
      const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

      for (const m of itemMatches) {
        const itemXml = m[1];
        const rawTitle = itemXml.match(/<title>([\s\S]*?)<\/title>/)?.[1];
        const link = itemXml.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim();
        const sourceName = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.trim() || "News";
        const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim();

        if (rawTitle && link) {
          const title = rawTitle
            .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();

          articles.push({
            title,
            source: sourceName.replace(/&amp;/g, "&"),
            url: link,
            publishedAt: pubDate
          });
        }

        if (articles.length >= 3) break;
      }

      if (articles.length > 0) {
        const result: NewsReconResult = {
          query: cleanKeyword,
          source: "Google News (keyless RSS)",
          articles,
          keyTakeaway: `Recent media reporting (${articles.length} articles): ${articles.slice(0, 2).map((a) => `"${a.title.slice(0, 70)}" [${a.source}]`).join("; ")}.`
        };

        // Cache successful response
        try {
          dossierStorage.setReconCache(cacheKey, "google-news", { articles });
        } catch {
          // Non-blocking cache write
        }

        return result;
      }
    } catch {
      // Continue to next candidate
    }
  }

  return empty(`No recent media reports for "${cleanKeyword}".`);
}
