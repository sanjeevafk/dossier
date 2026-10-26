import {
  UnifiedMarketResult,
  UnifiedMarketSignal,
  MarketSource,
  FetchImpl
} from "./types.js";
import { queryKalshiMarkets } from "./kalshi.js";
import { queryPolymarketUnified } from "./polymarket.js";
import { queryManifoldUnified } from "./manifold.js";
import { deduplicateAndClusterMarkets } from "./dedupe.js";

/**
 * Unified Prediction Markets Information Retrieval Router.
 *
 * Simultaneously queries Polymarket, Kalshi, and Manifold, normalizes all signals
 * into the UnifiedMarketSignal schema, clusters and deduplicates equivalent questions,
 * and derives cross-market consensus probabilities and divergence spreads.
 */
export async function queryUnifiedPredictionMarkets(
  keyword: string,
  fetchImpl: FetchImpl = fetch
): Promise<UnifiedMarketResult> {
  const cleanKeyword = keyword.trim().slice(0, 120);
  const sourcesQueried: MarketSource[] = ["polymarket", "kalshi", "manifold"];

  const emptyResult = (reason: string): UnifiedMarketResult => ({
    query: cleanKeyword,
    sourcesQueried,
    activeSources: [],
    signals: [],
    consensusGroups: [],
    averageProbabilityPercent: null,
    totalVolumeUsd: 0,
    macroSentiment: "NEUTRAL",
    keyTakeaway: reason
  });

  if (!cleanKeyword) {
    return emptyResult("Empty query — no prediction markets queried.");
  }

  // Execute all connectors concurrently with isolated failure boundaries
  const [polyResult, kalshiResult, manifoldResult] = await Promise.allSettled([
    queryPolymarketUnified(cleanKeyword, fetchImpl),
    queryKalshiMarkets(cleanKeyword, fetchImpl),
    queryManifoldUnified(cleanKeyword, fetchImpl)
  ]);

  const allSignals: UnifiedMarketSignal[] = [];
  const activeSourcesSet = new Set<MarketSource>();

  if (polyResult.status === "fulfilled" && polyResult.value.length > 0) {
    allSignals.push(...polyResult.value);
    activeSourcesSet.add("polymarket");
  }
  if (kalshiResult.status === "fulfilled" && kalshiResult.value.length > 0) {
    allSignals.push(...kalshiResult.value);
    activeSourcesSet.add("kalshi");
  }
  if (manifoldResult.status === "fulfilled" && manifoldResult.value.length > 0) {
    allSignals.push(...manifoldResult.value);
    activeSourcesSet.add("manifold");
  }

  if (allSignals.length === 0) {
    return emptyResult(
      `No active prediction markets correlated with "${cleanKeyword}" were found across Polymarket, Kalshi, or Manifold.`
    );
  }

  // Deduplicate and cluster equivalent questions across providers
  const consensusGroups = deduplicateAndClusterMarkets(allSignals);

  // Volume-weighted average probability across all retrieved signals
  let totalVolume = 0;
  let weightedProbSum = 0;
  for (const sig of allSignals) {
    const weight = Math.max(sig.volumeUsd, 100);
    weightedProbSum += sig.probabilityYesPercent * weight;
    totalVolume += sig.volumeUsd;
  }

  const averageProb = Math.round(weightedProbSum / (allSignals.reduce((acc, s) => acc + Math.max(s.volumeUsd, 100), 0) || 1));
  const activeSources = Array.from(activeSourcesSet);

  const sentiment = averageProb >= 60 ? "BULLISH" : (averageProb <= 40 ? "BEARISH" : "NEUTRAL");

  // Build key takeaway summarizing consensus, coverage, and divergence
  const sharedGroups = consensusGroups.filter((g) => g.sources.length > 1);
  let divergenceNote = "";
  if (sharedGroups.length > 0) {
    const maxSpread = Math.max(...sharedGroups.map((g) => g.spreadPercent));
    divergenceNote = ` Cross-platform spread across ${sharedGroups.length} shared topic(s) is ${maxSpread}%.`;
  }

  const sourceLabels = activeSources.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(", ");
  const keyTakeaway = `Unified prediction consensus across ${sourceLabels}: ${averageProb}% volume-weighted probability across ${allSignals.length} market(s) ($${totalVolume.toLocaleString()} total volume).${divergenceNote}`;

  return {
    query: cleanKeyword,
    sourcesQueried,
    activeSources,
    signals: allSignals,
    consensusGroups,
    averageProbabilityPercent: averageProb,
    totalVolumeUsd: totalVolume,
    macroSentiment: sentiment,
    keyTakeaway
  };
}
