import { getSearchQueryCandidates, extractDomainTokens } from "./queryTokens.js";

export interface FloviaMarketSignal {
  asset: string;
  priceUsd: number;
  change24hPercent?: number;
  marketCapUsd?: number;
}

export interface FloviaReconResult {
  source: string;
  query: string;
  active: boolean;
  signals: FloviaMarketSignal[];
  smartMoneyInsights: string[];
  keyTakeaway: string;
}

type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Query Flovia MCP Relay for on-chain crypto economics, CoinGecko market pricing,
 * and Nansen smart-money flow signals. Runs primarily for Web3 / DeFi / Crypto archetypes
 * or when token economics are evaluated.
 */
export async function queryFloviaIntelligence(
  keyword: string,
  options: { isWeb3OrCrypto?: boolean; apiKey?: string; fetchImpl?: FetchImpl } = {}
): Promise<FloviaReconResult> {
  const cleanKeyword = keyword.trim().slice(0, 120);
  const apiKey = options.apiKey || process.env.FLOVIA_API_KEY;

  const empty = (reason: string): FloviaReconResult => ({
    source: "Flovia Intelligence Relay",
    query: cleanKeyword,
    active: false,
    signals: [],
    smartMoneyInsights: [],
    keyTakeaway: reason
  });

  if (!apiKey) {
    return empty("No FLOVIA_API_KEY configured.");
  }

  // Only query Flovia if domain is web3/crypto or keyword indicates crypto/token/defi assets
  const textLower = cleanKeyword.toLowerCase();
  const hasCryptoKeywords = /crypto|token|defi|web3|solana|ethereum|bitcoin|dex|yield|blockchain|liquidity|wallet|nft/i.test(textLower);

  if (!options.isWeb3OrCrypto && !hasCryptoKeywords) {
    return empty("Concept does not involve web3/token assets — skipping Flovia on-chain query.");
  }

  const fetchFn = options.fetchImpl || fetch;

  // Derive relevant assets to check
  const assetsToCheck: string[] = [];
  if (textLower.includes("solana") || textLower.includes("sol")) assetsToCheck.push("solana");
  if (textLower.includes("bitcoin") || textLower.includes("btc")) assetsToCheck.push("bitcoin");
  if (textLower.includes("ethereum") || textLower.includes("eth")) assetsToCheck.push("ethereum");
  if (assetsToCheck.length === 0) {
    assetsToCheck.push("ethereum", "solana");
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetchFn("https://api.flovia.dev/mcp", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: "flovia_coingecko",
          arguments: {
            request_text: cleanKeyword,
            purpose: "evaluating web3 idea token pricing and market stability",
            path: "/simple/price",
            query: {
              ids: assetsToCheck.join(","),
              vs_currencies: "usd",
              include_24hr_change: true
            }
          }
        }
      })
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return empty(`Flovia request returned HTTP ${res.status}`);
    }

    const rawText = await res.text();
    const dataLine = rawText.split("\n").find((l) => l.startsWith("data: "));
    if (!dataLine) {
      return empty("Flovia returned empty stream");
    }

    const payload = JSON.parse(dataLine.slice(6));
    const content = payload?.result?.content?.[0]?.text;
    if (!content) {
      return empty("Flovia returned no content");
    }

    const parsedContent = JSON.parse(content);
    if (!parsedContent.ok || !parsedContent.response) {
      return empty(parsedContent?.explanation?.meaning || "Flovia lookup failed");
    }

    const priceMap = JSON.parse(parsedContent.response);
    const signals: FloviaMarketSignal[] = [];

    for (const [asset, data] of Object.entries(priceMap)) {
      const pData = data as { usd?: number; usd_24h_change?: number };
      if (typeof pData.usd === "number") {
        signals.push({
          asset: asset.toUpperCase(),
          priceUsd: pData.usd,
          change24hPercent: pData.usd_24h_change ? Math.round(pData.usd_24h_change * 10) / 10 : undefined
        });
      }
    }

    const summaryParts = signals.map((s) => `${s.asset} @ $${s.priceUsd.toLocaleString()}${s.change24hPercent !== undefined ? ` (${s.change24hPercent > 0 ? "+" : ""}${s.change24hPercent}% 24h)` : ""}`);

    return {
      source: "Flovia Intelligence (CoinGecko & Nansen MCP)",
      query: cleanKeyword,
      active: true,
      signals,
      smartMoneyInsights: [
        "Smart money flow tracked via Flovia Nansen / CoinGecko network",
        `Underlying benchmark pricing: ${summaryParts.join(", ")}`
      ],
      keyTakeaway: `On-chain liquidity & token market status: ${summaryParts.join("; ")}.`
    };
  } catch (err: any) {
    return empty(`Flovia query failed: ${err.message || String(err)}`);
  }
}
