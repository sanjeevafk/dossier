export interface ManifoldMarket {
  question: string;
  probabilityPercent: number;
  volumeUsd: number;
  bettors: number;
  resolved: boolean;
  marketUrl: string;
}

export interface ManifoldReconResult {
  query: string;
  source: string;
  marketsFound: ManifoldMarket[];
  keyTakeaway: string;
}

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Query Manifold Markets' free search API (no key) for prediction markets
 * correlated with the concept. Complements Polymarket where it is thin
 * (regulation, long-tail tech). BINARY only — numeric/multiple-choice odds
 * are not comparable probabilities. Honest empty when nothing correlates.
 */
export async function queryManifoldMarkets(
  keyword: string,
  fetchImpl: FetchImpl = fetch
): Promise<ManifoldReconResult> {
  const cleanKeyword = keyword.trim();
  const queryTokens = cleanKeyword.toLowerCase().split(/\s+/).filter((t) => t.replace(/[^a-z0-9]/g, "").length >= 4);
  const url = `https://api.manifold.markets/v0/search-markets?term=${encodeURIComponent(cleanKeyword || "AI")}&limit=8`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetchImpl(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const found: ManifoldMarket[] = [];
        for (const m of data) {
          if (m?.outcomeType !== "BINARY" || m?.isResolved) continue;
          const question = String(m.question || "");
          const titleLower = question.toLowerCase();
          if (queryTokens.length > 0 && !queryTokens.some((t) => titleLower.includes(t.replace(/[^a-z0-9]/g, "")))) {
            continue;
          }
          const prob = Number(m.probability);
          if (!Number.isFinite(prob) || prob < 0 || prob > 1) continue;
          found.push({
            question,
            probabilityPercent: Math.round(prob * 100),
            volumeUsd: Math.round(Number(m.volume) || 0),
            bettors: Number(m.uniqueBettorCount) || 0,
            resolved: false,
            marketUrl: String(m.url || `https://manifold.markets/${m.slug || ""}`)
          });
          if (found.length >= 3) break;
        }
        if (found.length > 0) {
          return {
            query: cleanKeyword,
            source: "Manifold Markets (free search API)",
            marketsFound: found,
            keyTakeaway: `Manifold prediction markets indicate ${found.map((f) => `"${f.question.slice(0, 60)}" @ ${f.probabilityPercent}%`).join("; ")}.`
          };
        }
      }
    }
  } catch {
    // fall through to honest empty
  }
  return {
    query: cleanKeyword,
    source: "Manifold Markets (free search API)",
    marketsFound: [],
    keyTakeaway: `No Manifold prediction markets correlated with "${cleanKeyword}" were found.`
  };
}
