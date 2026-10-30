import { UnifiedMarketSignal, FetchImpl } from "./types.js";
import { getSearchQueryCandidates, extractDomainTokens, isMarketTitleCorrelated } from "../queryTokens.js";

/**
 * Query Kalshi's CFTC-regulated prediction markets (v2 trade API, keyless public endpoint)
 * for open binary markets correlated with the concept.
 * Provides institutional/US-regulated probability grounding.
 */
export async function queryKalshiMarkets(
  keyword: string,
  fetchImpl: FetchImpl = fetch
): Promise<UnifiedMarketSignal[]> {
  const cleanKeyword = keyword.trim();
  if (!cleanKeyword) return [];

  const domainTokens = extractDomainTokens(cleanKeyword);
  const queryTokens = domainTokens.length > 0
    ? domainTokens
    : cleanKeyword.toLowerCase().split(/\s+/).filter((t) => t.replace(/[^a-z0-9]/g, "").length >= 3);

  const url = "https://api.elections.kalshi.com/trade-api/v2/events?status=open&with_nested_markets=true&limit=60";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetchImpl(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Dossier/1.0"
      }
    });
    clearTimeout(timeoutId);

    if (!res.ok) return [];

    const data = await res.json();
    const events = Array.isArray(data?.events) ? data.events : [];
    if (events.length === 0) return [];

    const signals: UnifiedMarketSignal[] = [];

    for (const ev of events) {
      const eventText = `${ev.title || ""} ${ev.sub_title || ""} ${ev.category || ""}`.toLowerCase();
      const markets = Array.isArray(ev.markets) ? ev.markets : [];

      for (const m of markets) {
        if (m.market_type && m.market_type !== "binary") continue;
        const marketText = `${m.title || ""} ${m.rules_primary || ""}`;
        const combined = `${ev.title || ""} ${marketText}`;

        if (!isMarketTitleCorrelated(combined, queryTokens, ev.category)) {
          continue;
        }

        // Extract probability from last_price_dollars or yes_bid_dollars/yes_ask_dollars
        let prob = parseFloat(m.last_price_dollars || "");
        if (Number.isNaN(prob) || prob <= 0) {
          const bid = parseFloat(m.yes_bid_dollars || "");
          const ask = parseFloat(m.yes_ask_dollars || "");
          if (!Number.isNaN(bid) && !Number.isNaN(ask) && ask > 0) {
            prob = (bid + ask) / 2;
          } else if (!Number.isNaN(bid)) {
            prob = bid;
          }
        }

        if (Number.isNaN(prob) || prob < 0 || prob > 1) continue;

        const probPercent = Math.round(prob * 100);
        const volume = Math.round(parseFloat(m.volume_fp || m.volume || "0") || 0);
        const openInterest = Math.round(parseFloat(m.open_interest_fp || "0") || 0);

        signals.push({
          source: "kalshi",
          id: m.ticker || ev.event_ticker || String(Math.random()),
          title: m.title || ev.title || "Kalshi Market",
          category: ev.category || "Regulated Markets",
          description: m.rules_primary?.slice(0, 300),
          url: `https://kalshi.com/markets/${m.ticker || ev.series_ticker || ""}`,
          probabilityYesPercent: probPercent,
          volumeUsd: volume,
          openInterestUsd: openInterest,
          status: m.status === "active" || m.status === "open" ? "open" : "closed",
          createdAt: m.created_time,
          closeTime: m.close_time || m.expiration_time,
          raw: m
        });

        if (signals.length >= 5) break;
      }

      if (signals.length >= 5) break;
    }

    return signals;
  } catch {
    return [];
  }
}
