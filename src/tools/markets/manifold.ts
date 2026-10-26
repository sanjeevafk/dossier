import { UnifiedMarketSignal, FetchImpl } from "./types.js";
import { getSearchQueryCandidates, extractDomainTokens } from "../queryTokens.js";

/**
 * Query Manifold Markets' search API for open binary prediction markets correlated with the concept.
 * Returns normalized UnifiedMarketSignal objects.
 */
export async function queryManifoldUnified(
  keyword: string,
  fetchImpl: FetchImpl = fetch
): Promise<UnifiedMarketSignal[]> {
  const cleanKeyword = keyword.trim();
  if (!cleanKeyword) return [];

  const domainTokens = extractDomainTokens(cleanKeyword);
  const queryTokens = domainTokens.length > 0
    ? domainTokens
    : cleanKeyword.toLowerCase().split(/\s+/).filter((t) => t.replace(/[^a-z0-9]/g, "").length >= 4);

  const queryCandidates = getSearchQueryCandidates(cleanKeyword);
  if (queryCandidates.length === 0) {
    queryCandidates.push("AI");
  }

  for (const queryTerm of queryCandidates) {
    const url = `https://api.manifold.markets/v0/search-markets?term=${encodeURIComponent(queryTerm)}&limit=15`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetchImpl(url, { signal: controller.signal, headers: { Accept: "application/json" } });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const signals: UnifiedMarketSignal[] = [];

          for (const m of data) {
            if (m?.outcomeType !== "BINARY" || m?.isResolved) continue;
            const question = String(m.question || "");
            const titleLower = question.toLowerCase();
            if (queryTokens.length > 0 && !queryTokens.some((t) => titleLower.includes(t.replace(/[^a-z0-9]/g, "")))) {
              continue;
            }
            const prob = Number(m.probability);
            if (!Number.isFinite(prob) || prob < 0 || prob > 1) continue;

            signals.push({
              source: "manifold",
              id: String(m.id || m.slug || Math.random()),
              title: question,
              category: "Crowd Forecasting",
              description: typeof m.textDescription === "string" ? m.textDescription.slice(0, 300) : undefined,
              url: String(m.url || `https://manifold.markets/${m.slug || ""}`),
              probabilityYesPercent: Math.round(prob * 100),
              volumeUsd: Math.round(Number(m.volume) || 0),
              liquidityUsd: Math.round(Number(m.totalLiquidity) || 0),
              status: m.isResolved ? "resolved" : "open",
              createdAt: m.createdTime ? new Date(m.createdTime).toISOString() : undefined,
              closeTime: m.closeTime ? new Date(m.closeTime).toISOString() : undefined,
              raw: m
            });

            if (signals.length >= 5) break;
          }

          if (signals.length > 0) {
            return signals;
          }
        }
      }
    } catch {
      // Continue to next candidate
    }
  }

  return [];
}
