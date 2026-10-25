export interface PredictionMarketSignal {
  id: string;
  title: string;
  category?: string;
  probabilityYesPercent: number;
  volumeUsd: number;
  liquidityUsd: number;
  marketUrl: string;
}

export interface PolymarketReconResult {
  query: string;
  source: string;
  marketsFound: PredictionMarketSignal[];
  macroSentiment: "BULLISH" | "NEUTRAL" | "BEARISH";
  keyTakeaway: string;
}

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Query Polymarket's live Gamma API for prediction-market odds correlated with
 * the concept. Returns ONLY markets actually returned by the API — when the
 * API is unreachable or no correlated markets exist, `marketsFound` is empty
 * and the takeaway says so. No synthetic fallback markets, ever.
 */
export async function queryPolymarketMarkets(
  keyword: string,
  fetchImpl: FetchImpl = fetch
): Promise<PolymarketReconResult> {
  const cleanKeyword = keyword.trim();
  // Only markets whose title shares a significant token with the query count as
  // correlated evidence; Gamma's fuzzy search otherwise returns unrelated events.
  const queryTokens = cleanKeyword.toLowerCase().split(/\s+/).filter((t) => t.replace(/[^a-z0-9]/g, "").length >= 4);
  const url = `https://gamma-api.polymarket.com/events?limit=4&active=true&closed=false&q=${encodeURIComponent(cleanKeyword || "AI")}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetchImpl(url, {
      signal: controller.signal,
      headers: { "Accept": "application/json" }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const signals: PredictionMarketSignal[] = [];

        for (const event of data.slice(0, 3)) {
          const titleLower = String(event.title || "").toLowerCase();
          if (queryTokens.length > 0 && !queryTokens.some((t) => titleLower.includes(t.replace(/[^a-z0-9]/g, "")))) {
            continue; // Title shares no significant token with the concept — not correlated evidence.
          }
          const firstMarket = event.markets?.[0];
          if (!firstMarket?.outcomePrices) {
            continue; // No parseable odds — exclude rather than defaulting to a fake 50%.
          }
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
            id: event.id || firstMarket?.id || String(Math.random()),
            title: event.title || firstMarket?.question || "Prediction Market",
            category: event.tags?.[0]?.label || "Tech/AI",
            probabilityYesPercent: probYes,
            volumeUsd: Math.round(parseFloat(event.volume || firstMarket?.volume || "0") || 0),
            liquidityUsd: Math.round(parseFloat(event.liquidity || firstMarket?.liquidity || "0") || 0),
            marketUrl: `https://polymarket.com/event/${event.slug || ""}`
          });
        }

        if (signals.length > 0) {
          const avgProb = Math.round(signals.reduce((a, b) => a + b.probabilityYesPercent, 0) / signals.length);
          return {
            query: cleanKeyword,
            source: "Polymarket Gamma Live Oracle",
            marketsFound: signals,
            macroSentiment: avgProb >= 60 ? "BULLISH" : (avgProb <= 40 ? "BEARISH" : "NEUTRAL"),
            keyTakeaway: `Prediction market odds indicate ${avgProb}% average probability across ${signals.length} correlated market(s).`
          };
        }
      }
    }
  } catch {
    // Fall through to the honest empty result below.
  }

  return {
    query: cleanKeyword,
    source: "Polymarket Gamma Live Oracle",
    marketsFound: [],
    macroSentiment: "NEUTRAL",
    keyTakeaway: `No active Polymarket markets correlated with "${cleanKeyword}" were found — no live prediction-market evidence is available for this evaluation.`
  };
}
