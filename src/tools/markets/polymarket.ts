import { UnifiedMarketSignal, FetchImpl } from "./types.js";
import { getSearchQueryCandidates, extractDomainTokens } from "../queryTokens.js";

const FALSE_POSITIVE_PHRASES = [
  "regulation time",
  "regulation win",
  "autonomous okrug",
  "autonomous oblast"
];

/**
 * Query Polymarket's Gamma API for prediction-market signals correlated with the concept.
 * Returns normalized UnifiedMarketSignal objects.
 */
export async function queryPolymarketUnified(
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
    const url = `https://gamma-api.polymarket.com/public-search?q=${encodeURIComponent(queryTerm)}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetchImpl(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const events = Array.isArray(data) ? data : data?.events;
        if (Array.isArray(events) && events.length > 0) {
          const signals: UnifiedMarketSignal[] = [];

          for (const event of events.slice(0, 15)) {
            const titleLower = String(event.title || "").toLowerCase();
            if (FALSE_POSITIVE_PHRASES.some((phrase) => titleLower.includes(phrase))) {
              continue;
            }
            if (queryTokens.length > 0 && !queryTokens.some((t) => titleLower.includes(t.replace(/[^a-z0-9]/g, "")))) {
              continue;
            }
            const firstMarket = event.markets?.[0];
            if (!firstMarket?.outcomePrices) continue;

            let probYes: number;
            try {
              const prices = JSON.parse(firstMarket.outcomePrices);
              if (!Array.isArray(prices) || prices.length === 0 || Number.isNaN(parseFloat(prices[0]))) {
                continue;
              }
              probYes = Math.round(parseFloat(prices[0]) * 100);
            } catch {
              continue;
            }

            signals.push({
              source: "polymarket",
              id: event.id || firstMarket?.id || String(Math.random()),
              title: event.title || firstMarket?.question || "Prediction Market",
              category: event.tags?.[0]?.label || "Tech/Crypto",
              description: event.description?.slice(0, 300),
              url: `https://polymarket.com/event/${event.slug || ""}`,
              probabilityYesPercent: probYes,
              volumeUsd: Math.round(parseFloat(event.volume || firstMarket?.volume || "0") || 0),
              liquidityUsd: Math.round(parseFloat(event.liquidity || firstMarket?.liquidity || "0") || 0),
              status: event.closed ? "closed" : "open",
              createdAt: event.createdAt,
              closeTime: event.endDate,
              raw: event
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
