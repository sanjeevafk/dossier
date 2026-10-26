/**
 * Live web recon adapter. Grounds market intelligence in real search results
 * from a configured provider (Exa or Tavily). When no provider is configured
 * or the call fails, the outcome is explicitly `provider: "none"` — callers
 * must treat that as "no external evidence available", never fabricate data.
 *
 * Recon responses are cached in SQLite (7-day TTL) via dossierStorage to cut
 * per-eval cost 5-10x. Cache keys are normalized + PII-stripped so personal
 * names/emails never reach providers or persist in the cache index.
 */

import { dossierStorage } from "../services/storage.js";

export interface ReconSourceResult {
  title: string;
  url: string;
  snippet: string;
  queryLabel?: "competitive" | "sentiment";
}

export interface ReconOutcome {
  provider: "exa" | "tavily" | "exa:cache" | "tavily:cache" | "duckduckgo" | "none";
  queries: string[];
  results: ReconSourceResult[];
  error?: string;
}

const RECON_TIMEOUT_MS = 8000;
const MAX_RESULTS_PER_QUERY = 4;
const MAX_TOTAL_RESULTS = 6;

function truncate(text: string, max = 320): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

async function fetchJson(url: string, init: RequestInit): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RECON_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${url}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function searchExa(apiKey: string, query: string): Promise<ReconSourceResult[]> {
  const payload = await fetchJson("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey
    },
    body: JSON.stringify({
      query,
      numResults: MAX_RESULTS_PER_QUERY,
      contents: { text: { maxCharacters: 400 } }
    })
  });

  const results = Array.isArray(payload?.results) ? payload.results : [];
  return results
    .filter((r: any) => r?.url)
    .map((r: any) => ({
      title: truncate(String(r.title || r.url), 140),
      url: String(r.url),
      snippet: truncate(String(r.text || r.summary || ""))
    }));
}

async function searchTavily(apiKey: string, query: string): Promise<ReconSourceResult[]> {
  const payload = await fetchJson("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: MAX_RESULTS_PER_QUERY,
      include_answer: false
    })
  });

  const results = Array.isArray(payload?.results) ? payload.results : [];
  return results
    .filter((r: any) => r?.url)
    .map((r: any) => ({
      title: truncate(String(r.title || r.url), 140),
      url: String(r.url),
      snippet: truncate(String(r.content || ""))
    }));
}

/**
 * Zero-key web search via public DuckDuckGo HTML endpoint.
 * Extracts title, destination URL, and text snippet without API keys.
 */
export async function searchDuckDuckGo(
  query: string,
  maxResults = MAX_RESULTS_PER_QUERY,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<ReconSourceResult[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RECON_TIMEOUT_MS);
  try {
    const url = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query);
    const res = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    if (!res.ok) return [];
    const html = await res.text();
    const results: ReconSourceResult[] = [];
    const blocks = html.split(/<div class="result results_links/);
    for (let i = 1; i < blocks.length && results.length < maxResults; i++) {
      const block = blocks[i];
      const titleMatch = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      const hrefMatch = block.match(/href="([^"]*uddg=[^"]*)"/);

      if (titleMatch && hrefMatch) {
        let rawUrl = hrefMatch[1];
        if (rawUrl.includes("uddg=")) {
          rawUrl = decodeURIComponent(rawUrl.split("uddg=")[1].split("&")[0]);
        }
        const title = titleMatch[1].replace(/<[^>]+>/g, "").trim();
        const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, "").trim() : "";
        if (title && rawUrl.startsWith("http")) {
          results.push({
            title: truncate(title, 140),
            url: rawUrl,
            snippet: truncate(snippet),
            queryLabel: "competitive"
          });
        }
      }
    }
    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Strip PII (emails, @handles) and normalize for cache keys + outbound queries.
 * Never send idea-owner names/emails to recon providers.
 */
export function sanitizeReconQuery(query: string): string {
  return query
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
    .replace(/@[a-z0-9_]+/gi, " ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/**
 * Run live web recon across the given queries using the first configured provider.
 * Cached responses return `provider: "exa:cache"` / `"tavily:cache"` so callers
 * can meter cost. Never throws — an unreachable or unconfigured provider
 * yields `provider: "none"`.
 */
export async function performLiveWebRecon(
  queries: string[],
  opts: { exaKey?: string; tavilyKey?: string; allowDuckDuckGo?: boolean } = {}
): Promise<ReconOutcome> {
  const cleanQueries = queries.map((q) => q.trim()).filter(Boolean).slice(0, 3);
  if (cleanQueries.length === 0) {
    return { provider: "none", queries: [], results: [] };
  }

  const exaKey = opts.exaKey ?? process.env.EXA_API_KEY;
  const tavilyKey = opts.tavilyKey ?? process.env.TAVILY_API_KEY;

  if (!exaKey && !tavilyKey) {
    if (opts.allowDuckDuckGo || process.env.ENABLE_DUCKDUCKGO === "true") {
      const collected: ReconSourceResult[] = [];
      const seenUrls = new Set<string>();
      for (let q = 0; q < cleanQueries.length; q++) {
        try {
          const results = await searchDuckDuckGo(cleanQueries[q]);
          for (const result of results) {
            if (seenUrls.has(result.url)) continue;
            seenUrls.add(result.url);
            collected.push({ ...result, queryLabel: q === 0 ? "competitive" : "sentiment" });
            if (collected.length >= MAX_TOTAL_RESULTS) break;
          }
        } catch {}
      }
      if (collected.length > 0) {
        return { provider: "duckduckgo", queries: cleanQueries, results: collected };
      }
    }

    return {
      provider: "none",
      queries: cleanQueries,
      results: [],
      error: "No recon key supplied — bring your own EXA_API_KEY or TAVILY_API_KEY (header X-Exa-Key / X-Tavily-Key, or server env)"
    };
  }

  const search = exaKey ? searchExa.bind(null, exaKey) : searchTavily.bind(null, tavilyKey!);
  const provider: "exa" | "tavily" = exaKey ? "exa" : "tavily";

  const collected: ReconSourceResult[] = [];
  const seenUrls = new Set<string>();
  const errors: string[] = [];
  let cacheHits = 0;

  for (let q = 0; q < cleanQueries.length; q++) {
    const rawQuery = cleanQueries[q];
    const queryLabel: ReconSourceResult["queryLabel"] = q === 0 ? "competitive" : "sentiment";
    const query = sanitizeReconQuery(rawQuery) || "startup idea validation";
    const cacheKey = `recon:${provider}:${query}`;
    try {
      const cached = dossierStorage.getReconCache(cacheKey);
      if (cached && Array.isArray((cached.response as { results?: unknown })?.results)) {
        cacheHits++;
        const results = (cached.response as { results: ReconSourceResult[] }).results;
        for (const result of results) {
          if (seenUrls.has(result.url)) continue;
          seenUrls.add(result.url);
          collected.push({ ...result, queryLabel: result.queryLabel || queryLabel });
          if (collected.length >= MAX_TOTAL_RESULTS) break;
        }
        continue;
      }
      const results = await search(query);
      dossierStorage.setReconCache(cacheKey, provider, { results });
      for (const result of results) {
        if (seenUrls.has(result.url)) continue;
        seenUrls.add(result.url);
        collected.push({ ...result, queryLabel: result.queryLabel || queryLabel });
        if (collected.length >= MAX_TOTAL_RESULTS) break;
      }
    } catch (err: any) {
      errors.push(`${query}: ${err?.message || "recon failed"}`);
    }
    if (collected.length >= MAX_TOTAL_RESULTS) break;
  }

  if (collected.length === 0) {
    return {
      provider: "none",
      queries: cleanQueries,
      results: [],
      error: errors.join("; ") || "Recon returned no results"
    };
  }

  return {
    provider: (cacheHits === cleanQueries.length ? `${provider}:cache` : provider) as ReconOutcome["provider"],
    queries: cleanQueries,
    results: collected
  };
}
