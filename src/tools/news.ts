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
  localeOrFetch?: { gl?: string; ceid?: string; hl?: string } | FetchImpl,
  fetchImpl: FetchImpl = fetch
): Promise<NewsReconResult> {
  let locale: { gl?: string; ceid?: string; hl?: string } | undefined;
  if (typeof localeOrFetch === "function") {
    fetchImpl = localeOrFetch;
    locale = undefined;
  } else {
    locale = localeOrFetch;
  }

  const cleanKeyword = keyword.trim().slice(0, 120);
  const gl = locale?.gl || "US";
  const ceid = locale?.ceid || "US:en";
  const hl = locale?.hl || "en-US";

  const empty = (reason: string): NewsReconResult => ({
    query: cleanKeyword,
    source: gl === "US" ? "Google News (keyless RSS)" : `Google News [${gl}] (keyless RSS)`,
    articles: [],
    keyTakeaway: reason
  });

  if (!cleanKeyword) return empty("Empty query — no news search performed.");

  // 1. Check SQLite cache (scoped by region, with legacy unscoped fallback)
  const cacheKey = `news:google:${gl.toLowerCase()}:${cleanKeyword.toLowerCase()}`;
  const legacyCacheKey = `news:google:${cleanKeyword.toLowerCase()}`;
  try {
    const cached = dossierStorage.getReconCache(cacheKey) || dossierStorage.getReconCache(legacyCacheKey);
    if (cached && Array.isArray((cached.response as { articles?: unknown })?.articles)) {
      const articles = (cached.response as { articles: NewsArticle[] }).articles;
      if (articles.length > 0) {
        return {
          query: cleanKeyword,
          source: gl === "US" ? "Google News (cached)" : `Google News [${gl}] (cached)`,
          articles,
          keyTakeaway: `Recent regional media reporting (${articles.length} articles): ${articles.slice(0, 2).map((a) => `"${a.title.slice(0, 70)}" [${a.source}]`).join("; ")}.`
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
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(qTerm)}&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&ceid=${encodeURIComponent(ceid)}`;

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
